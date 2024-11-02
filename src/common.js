/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import isNaN from 'lodash/isNaN.js';
import isString from 'lodash/isString.js';
import isObject from 'lodash/isObject.js';
import isUndefined from 'lodash/isUndefined.js';
import isArray from 'lodash/isArray.js';
import includes from 'lodash/includes.js';
import startsWith from 'lodash/startsWith.js';
import endsWith from 'lodash/endsWith.js';
import last from 'lodash/last.js';
import trim from 'lodash/trim.js';
import createHash from 'create-hash';
import stableSort from 'stable';
import uuidv4 from 'uuid/v4.js';
import bip39 from "ethereum-cryptography/bip39/index.js";
import englishWords from "ethereum-cryptography/bip39/wordlists/english.js";
const bip39Wordlist = englishWords.wordlist;

const isNumber = (str) => {
  if (isString(str) && !/^[0-9.]+$/.test(str)) {
    return false;
  }
  return !isNaN(parseFloat(str));
};

const moveFromDate = (fromDate, value, unit) => {
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

const moveDate = (value, unit) => {
  return module.exports.moveFromDate(new Date(), value, unit);
};

const extractHostname = (url) => {
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

const isIpAddress = (str) => {
  return /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/.test(str);
};

const random = (mode = 'hash') => {
  if (mode === 'words') {
    return bip39.generateMnemonic(bip39Wordlist);
  } else {
    return uuidv4();
  }
};

const hash = (input, algo = 'sha256') => {
  return createHash(algo).update(input).digest('hex');
}

const makeCode = (length) => {
  let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let res = '';
  for (let i = 0; i < length; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
};

const getFilenameFromPath = (path) => {
  return (trim(path, '/').split('/').slice(-1)[0] || '').split('?')[0];
}

const getExtensionFromName = (fileName) => {
  return (fileName || '').split('.').length > 1 ? last((fileName || '').split('.')).toLowerCase().split('?')[0] : null
}

const isVideoType = (fullType) => {
  //TODO: detect more video types
  return startsWith(fullType, 'video') || endsWith(fullType, 'mp4') || endsWith(fullType, 'avi') || endsWith(fullType, 'mov') || endsWith(fullType, 'quicktime');
}

export default {
  isNumber,
  moveFromDate,
  moveDate,
  extractHostname,
  sortObject,
  isIpAddress,
  random,
  hash,
  makeCode,
  getFilenameFromPath,
  getExtensionFromName,
  isVideoType,
  isUndefined: (v) => {
    return !v || v === 'null' || v === 'undefined' || isUndefined(v);
  },
}