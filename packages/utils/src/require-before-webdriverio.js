/**
 * `webdriverio` provides no way to intercept the logger,
 * so we install a plugin on its logger to filter it.
 */
'use strict';

const debug = require('./scope-debug');

// We want the version that comes with `webdriverio`.
// eslint-disable-next-line node/no-extraneous-require
const log = require('loglevel');

const replacementText = '[REDACTED]';
const elementSendKeysRegex = /elementSendKeys\("(.+)", ".*"\)/;
// eslint-disable-next-line no-control-regex
const commandRegex = /^(?:\x1b\[35m)?COMMAND(?:\x1b\[39m)?$/;
// eslint-disable-next-line no-control-regex
const dataRegex = /^(?:\x1b\[33m)?DATA(?:\x1b\[39m)?$/;

let replacementCountRemaining;
function resetCounter() {
  replacementCountRemaining = 0;
}

// https://github.com/pimterry/loglevel#writing-plugins
const { methodFactory } = log;
log.methodFactory = function(methodName, level, loggerName) {
  let _rawMethod = methodFactory(...arguments);

  let rawMethod;
  if (methodName === 'info' && loggerName === 'webdriver') {
    module.exports.rawMethod = _rawMethod;
    rawMethod = function() {
      module.exports.rawMethod(...arguments);
    };
  } else {
    rawMethod = _rawMethod;
  }

  return function(message, type, data) {
    // `webdriverio` logging is broken and sometimes ignores `logLevel`
    // so we do our own filtering
    if (!debug.enabled) {
      return;
    }

    if (replacementCountRemaining > 0 && type) {
      let wasFound;

      if (commandRegex.test(type) && elementSendKeysRegex.test(data)) {
        rawMethod(message, type, data.replace(elementSendKeysRegex, `elementSendKeys("$1", "${replacementText}")`));
        wasFound = true;
      }
      if (dataRegex.test(type) && Object.prototype.hasOwnProperty.call(data, 'text')) {
        rawMethod(message, type, {
          ...data,
          text: replacementText,
        });
        wasFound = true;
      }

      if (wasFound) {
        replacementCountRemaining--;
        return;
      }
    }

    rawMethod(...arguments);
  };
};
log.setLevel(log.getLevel()); // Be sure to call setLevel method in order to apply plugin

module.exports.hideNextPassword = () => replacementCountRemaining = 2;
module.exports.resetCounter = resetCounter;
module.exports.replacementText = replacementText;
