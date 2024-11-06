/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import _ from "lodash";
import uuid from 'uuid';
import stableSort from 'stable';
import createHash from 'create-hash';
import bip39 from "ethereum-cryptography/bip39";
import englishWords from "ethereum-cryptography/bip39/wordlists/english";
const {isNaN, isString, isObject, isUndefined, isArray, startsWith, last, trim} = _;
const bip39Wordlist = englishWords.wordlist;
const {v4: uuidv4} = uuid;

const isNumber = (str: string) => {
  if (isString(str) && !/^[0-9.]+$/.test(str)) {
    return false;
  }
  return !isNaN(parseFloat(str));
};

const moveFromDate = (fromDate, value, unit) => {
  value = parseFloat(value);
  if(unit.includes('second')) {
    return new Date(fromDate.getTime() + value * 1000);
  }
  if(unit.includes('minute')) {
    return new Date(fromDate.getTime() + value * 60 * 1000);
  }
  if(unit.includes('hour')) {
    return new Date(fromDate.getTime() + value * 60 * 60 * 1000);
  }
  if(unit.includes('day')) {
    return new Date(fromDate.getTime() + value * 24 * 60 * 60 * 1000);
  }
  if(unit.includes('week')) {
    return new Date(fromDate.getTime() + value * 7 * 24 * 60 * 60 * 1000);
  }
  if(unit.includes('month')) {
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
  return createHash(algo as any).update(input).digest('hex');
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
  return (fileName || '').split('.').length > 1 ? (last((fileName || '').split('.')) as string).toLowerCase().split('?')[0] : null
}

const isVideoType = (fullType) => {
  //TODO: detect more video types
  return startsWith(fullType, 'video') || fullType.endsWith('mp4') || fullType.endsWith('avi') || fullType.endsWith('mov') || fullType.endsWith('quicktime');
}

function initializeCustomEvent() {
  if (typeof globalThis.CustomEvent !== 'function') {
    globalThis.CustomEvent = class CustomEvent extends Event {
      detail;
      constructor(event, params) {
        params = params || { bubbles: false, cancelable: false, detail: null };
        super(event, params);
        this.detail = params.detail;
      }
    };
  }
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
  initializeCustomEvent,
}