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
const isObject = require('lodash/isObject');
const isArray = require('lodash/isArray');
const includes = require('lodash/includes');
const createHash = require('create-hash');
const stableSort = require('stable');
const uuidv4 = require('uuid/v4');
const bip39 = require("ethereum-cryptography/bip39");
const bip39Wordlist = require("ethereum-cryptography/bip39/wordlists/english").wordlist;

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

function sortObject (objectData) {
  if(isArray(objectData)) {
    return objectData.map(i => sortObject(i));
  }
  if(!isObject(objectData)) {
    return objectData;
  }
  return Object.fromEntries(stableSort(Object.entries(objectData)).map((arr) => {
    if(isArray(arr[1]) && isObject(arr[1][0])) {
      arr[1] = arr[1].map(obj => sortObject(obj))
    } else if(isObject(arr[1]) && !isArray(arr[1])) {
      arr[1] = sortObject(arr[1]);
    }
    return arr;
  }))
}
module.exports.sortObject = sortObject;

module.exports.isIpAddress = (str) => {
  return /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/.test(str);
};

module.exports.random = (mode = 'hash') => {
  if (mode === 'words') {
    return bip39.generateMnemonic(bip39Wordlist);
  } else {
    return uuidv4();
  }
};

module.exports.hash = (input, algo = 'sha256') => {
  return createHash(algo).update(input).digest('hex');
}
