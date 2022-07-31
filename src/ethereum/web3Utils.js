/*
 This file is part of web3.js. (web3-utils@1.3.5)

 web3.js is free software: you can redistribute it and/or modify
 it under the terms of the GNU Lesser General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 web3.js is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public License
 along with web3.js.  If not, see <http://www.gnu.org/licenses/>.
 */
/**
 * @file utils.js
 * @author Fabian Vogelsteller <fabian@ethereum.org>
 * @date 2017
 */

import isString from 'lodash/isString.js';
import isNumber from 'lodash/isNumber.js';
import isNull from 'lodash/isNull.js';
import isUndefined from 'lodash/isUndefined.js';
import isBoolean from 'lodash/isBoolean.js';
import isObject from 'lodash/isObject.js';
import BN from 'bn.js';
import numberToBN from 'number-to-bn';
import utf8 from 'utf8';
import Hash from "eth-lib/lib/hash.js";

/**
 * Takes an input and transforms it into an BN
 *
 * @method toBN
 * @param {Number|String|BN} number, string, HEX string or BN
 * @return {BN} BN
 */
function toBN(number){
    try {
        return numberToBN.apply(null, arguments);
    } catch(e) {
        throw new Error(e + ' Given value: "'+ number +'"');
    }
}

/**
 * Returns true if object is BN, otherwise false
 *
 * @method isBN
 * @param {Object} object
 * @return {Boolean}
 */
function isBN(object) {
    return BN.isBN(object);
}

/**
 * Returns true if object is BigNumber, otherwise false
 *
 * @method isBigNumber
 * @param {Object} object
 * @return {Boolean}
 */
function isBigNumber(object) {
    return object && object.constructor && object.constructor.name === 'BigNumber';
}

/**
 * Takes and input transforms it into BN and if it is negative value, into two's complement
 *
 * @method toTwosComplement
 * @param {Number|String|BN} number
 * @return {String}
 */
function toTwosComplement(number) {
    return '0x'+ toBN(number).toTwos(256).toString(16, 64);
}

/**
 * Checks if the given string is an address
 *
 * @method isAddress
 * @param {String} address the given HEX address
 * @return {Boolean}
 */
function isAddress(address) {
    // check if it has the basic requirements of an address
    if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
        return false;
        // If it's ALL lowercase or ALL upppercase
    } else if (/^(0x|0X)?[0-9a-f]{40}$/.test(address) || /^(0x|0X)?[0-9A-F]{40}$/.test(address)) {
        return true;
        // Otherwise check each case
    } else {
        return checkAddressChecksum(address);
    }
}

/**
 * Checks if the given string is a checksummed address
 *
 * @method checkAddressChecksum
 * @param {String} address the given HEX address
 * @return {Boolean}
 */
function checkAddressChecksum(address) {
    // Check each case
    address = address.replace(/^0x/i,'');
    const addressHash = sha3(address.toLowerCase()).replace(/^0x/i,'');

    for (let i = 0; i < 40; i++ ) {
        // the nth letter should be uppercase if the nth digit of casemap is 1
        if ((parseInt(addressHash[i], 16) > 7 && address[i].toUpperCase() !== address[i]) || (parseInt(addressHash[i], 16) <= 7 && address[i].toLowerCase() !== address[i])) {
            return false;
        }
    }
    return true;
}

/**
 * Should be called to pad string to expected length
 *
 * @method leftPad
 * @param {String} string to be padded
 * @param {Number} chars that result string should have
 * @param {String} sign, by default 0
 * @returns {String} right aligned string
 */
function leftPad(string, chars, sign) {
    let hasPrefix = /^0x/i.test(string) || typeof string === 'number';
    string = string.toString(16).replace(/^0x/i,'');

    let padding = (chars - string.length + 1 >= 0) ? chars - string.length + 1 : 0;

    return (hasPrefix ? '0x' : '') + new Array(padding).join(sign ? sign : "0") + string;
}

/**
 * Should be called to pad string to expected length
 *
 * @method rightPad
 * @param {String} string to be padded
 * @param {Number} chars that result string should have
 * @param {String} sign, by default 0
 * @returns {String} right aligned string
 */
function rightPad(string, chars, sign) {
    let hasPrefix = /^0x/i.test(string) || typeof string === 'number';
    string = string.toString(16).replace(/^0x/i,'');

    let padding = (chars - string.length + 1 >= 0) ? chars - string.length + 1 : 0;

    return (hasPrefix ? '0x' : '') + string + (new Array(padding).join(sign ? sign : "0"));
}

/**
 * Should be called to get hex representation (prefixed by 0x) of utf8 string
 *
 * @method utf8ToHex
 * @param {String} str
 * @returns {String} hex representation of input string
 */
function utf8ToHex(str) {
    str = utf8.encode(str);
    let hex = "";

    // remove \u0000 padding from either side
    str = str.replace(/^(?:\u0000)*/,'');
    str = str.split("").reverse().join("");
    str = str.replace(/^(?:\u0000)*/,'');
    str = str.split("").reverse().join("");

    for(let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        // if (code !== 0) {
        const n = code.toString(16);
        hex += n.length < 2 ? '0' + n : n;
        // }
    }

    return "0x" + hex;
}

/**
 * Should be called to get utf8 from it's hex representation
 *
 * @method hexToUtf8
 * @param {String} hex
 * @returns {String} ascii string representation of hex value
 */
function hexToUtf8(hex) {
    if (!isHexStrict(hex))
        throw new Error('The parameter "'+ hex +'" must be a valid HEX string.');

    let str = "";
    let code = 0;
    hex = hex.replace(/^0x/i,'');

    // remove 00 padding from either side
    hex = hex.replace(/^(?:00)*/,'');
    hex = hex.split("").reverse().join("");
    hex = hex.replace(/^(?:00)*/,'');
    hex = hex.split("").reverse().join("");

    let l = hex.length;

    for (let i=0; i < l; i+=2) {
        code = parseInt(hex.substr(i, 2), 16);
        // if (code !== 0) {
        str += String.fromCharCode(code);
        // }
    }

    return utf8.decode(str);
}

/**
 * Converts value to it's number representation
 *
 * @method hexToNumber
 * @param {String|Number|BN} value
 * @return {String}
 */
function hexToNumber(value) {
    if (!value) {
        return value;
    }

    if (isString(value) && !isHexStrict(value)) {
        throw new Error('Given value "'+value+'" is not a valid hex string.');
    }

    return toBN(value).toNumber();
}

/**
 * Converts value to it's decimal representation in string
 *
 * @method hexToNumberString
 * @param {String|Number|BN} value
 * @return {String}
 */
function hexToNumberString(value) {
    if (!value) return value;

    if (isString(value) && !isHexStrict(value)) {
        throw new Error('Given value "'+value+'" is not a valid hex string.');
    }

    return toBN(value).toString(10);
}

/**
 * Converts value to it's hex representation
 *
 * @method numberToHex
 * @param {String|Number|BN} value
 * @return {String}
 */
function numberToHex(value) {
    if (isNull(value) || isUndefined(value)) {
        return value;
    }

    if (!isFinite(value) && !isHexStrict(value)) {
        throw new Error('Given input "'+value+'" is not a number.');
    }

    let number = toBN(value);
    let result = number.toString(16);

    return number.lt(new BN(0)) ? '-0x' + result.substr(1) : '0x' + result;
}

/**
 * Convert a byte array to a hex string
 *
 * Note: Implementation from crypto-js
 *
 * @method bytesToHex
 * @param {Array} bytes
 * @return {String} the hex string
 */
function bytesToHex(bytes) {
    let hex, i;
    for (hex = [], i = 0; i < bytes.length; i++) {
        /* jshint ignore:start */
        hex.push((bytes[i] >>> 4).toString(16));
        hex.push((bytes[i] & 0xF).toString(16));
        /* jshint ignore:end */
    }
    return '0x'+ hex.join("");
}

/**
 * Convert a hex string to a byte array
 *
 * Note: Implementation from crypto-js
 *
 * @method hexToBytes
 * @param {string} hex
 * @return {Array} the byte array
 */
function hexToBytes(hex) {
    hex = hex.toString(16);

    if (!isHexStrict(hex)) {
        throw new Error('Given value "'+ hex +'" is not a valid hex string.');
    }

    hex = hex.replace(/^0x/i,'');

    let bytes, c;
    for (bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}

/**
 * Auto converts any given value into it's hex representation.
 *
 * And even stringifys objects before.
 *
 * @method toHex
 * @param {String|Number|BN|Object|Buffer} value
 * @param {Boolean} returnType
 * @return {String}
 */
function toHex(value, returnType) {
    /*jshint maxcomplexity: false */

    if (isAddress(value)) {
        return returnType ? 'address' : '0x'+ value.toLowerCase().replace(/^0x/i,'');
    }

    if (isBoolean(value)) {
        return returnType ? 'bool' : value ? '0x01' : '0x00';
    }

    if (Buffer.isBuffer(value)) {
        return '0x' + value.toString('hex');
    }

    if (isObject(value) && !isBigNumber(value) && !isBN(value)) {
        return returnType ? 'string' : utf8ToHex(JSON.stringify(value));
    }

    // if its a negative number, pass it through numberToHex
    if (isString(value)) {
        if (value.indexOf('-0x') === 0 || value.indexOf('-0X') === 0) {
            return returnType ? 'int256' : numberToHex(value);
        } else if(value.indexOf('0x') === 0 || value.indexOf('0X') === 0) {
            return returnType ? 'bytes' : value;
        } else if (!isFinite(value)) {
            return returnType ? 'string' : utf8ToHex(value);
        }
    }

    return returnType ? (value < 0 ? 'int256' : 'uint256') : numberToHex(value);
}

/**
 * Check if string is HEX, requires a 0x in front
 *
 * @method isHexStrict
 * @param {String} hex to be checked
 * @returns {Boolean}
 */
function isHexStrict(hex) {
    return ((isString(hex) || isNumber(hex)) && /^(-)?0x[0-9a-f]*$/i.test(hex));
}

/**
 * Check if string is HEX
 *
 * @method isHex
 * @param {String} hex to be checked
 * @returns {Boolean}
 */
function isHex(hex) {
    return ((isString(hex) || isNumber(hex)) && /^(-0x|0x)?[0-9a-f]*$/i.test(hex));
}

/**
 * Remove 0x prefix from string
 *
 * @method stripHexPrefix
 * @param {String} str to be checked
 * @returns {String}
 */
function stripHexPrefix(str) {
    if (str !== 0 && isHex(str))
        return str.replace(/^(-)?0x/i, '$1')
    return str;
}

/**
 * Hashes values to a sha3 hash using keccak 256
 *
 * To hash a HEX string the hex must have 0x in front.
 *
 * @method sha3
 * @return {String} the sha3 string
 */
const SHA3_NULL_S = '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';

function sha3(value) {
    if (isBN(value)) {
        value = value.toString();
    }

    if (isHexStrict(value) && /^0x/i.test((value).toString())) {
        value = hexToBytes(value);
    }

    var returnValue = Hash.keccak256(value); // jshint ignore:line

    if(returnValue === SHA3_NULL_S) {
        return null;
    } else {
        return returnValue;
    }
}

// expose the under the hood keccak256
sha3._Hash = Hash;

/**
 * @method sha3Raw
 *
 * @param value
 *
 * @returns {string}
 */
function sha3Raw(value) {
    value = sha3(value);

    if (value === null) {
        return SHA3_NULL_S;
    }

    return value;
}

const web3Utils = {
    BN: BN,
    isBN: isBN,
    isBigNumber: isBigNumber,
    toBN: toBN,
    isAddress: isAddress,
    checkAddressChecksum: checkAddressChecksum,
    utf8ToHex: utf8ToHex,
    hexToUtf8: hexToUtf8,
    hexToNumber: hexToNumber,
    hexToNumberString: hexToNumberString,
    numberToHex: numberToHex,
    toHex: toHex,
    hexToBytes: hexToBytes,
    bytesToHex: bytesToHex,
    isHex: isHex,
    isHexStrict: isHexStrict,
    stripHexPrefix: stripHexPrefix,
    leftPad: leftPad,
    rightPad: rightPad,
    toTwosComplement: toTwosComplement,
    sha3: sha3,
    sha3Raw: sha3Raw
};

export default web3Utils;