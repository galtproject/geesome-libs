/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const isNaN = require('lodash/isNaN');
const isString = require('lodash/isString');
const includes = require('lodash/includes');

module.exports.isNumber = (str) => {
  if (isString(str) && !/^[0-9.]+$/.test(str)) {
    return false;
  }
  return !isNaN(parseFloat(str));
};

module.exports.moveFromDate = (fromDate, value, unit) => {
  value = parseFloat(value);
  if(includes(unit, 'second')) {
    return new Date(fromDate.getTime() + value * 1000);
  }
  if(includes(unit, 'minute')) {
    return new Date(fromDate.getTime() + value * 60 * 1000);
  }
  if(includes(unit, 'hour')) {
    return new Date(fromDate.getTime() + value * 60 * 60 * 1000);
  }
  if(includes(unit, 'day')) {
    return new Date(fromDate.getTime() + value * 24 * 60 * 60 * 1000);
  }
  if(includes(unit, 'week')) {
    return new Date(fromDate.getTime() + value * 7 * 24 * 60 * 60 * 1000);
  }
  if(includes(unit, 'month')) {
    return new Date(fromDate.getTime() + value * 30 * 24 * 60 * 60 * 1000);
  }
  return null;
};

module.exports.moveDate = (value, unit) => {
  return module.exports.moveFromDate(new Date(), value, unit);
};


module.exports.extractHostname = (url) => {
  return (new URL(url)).hostname;
};

module.exports.isIpAddress = (str) => {
  return /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/.test(str);
};
