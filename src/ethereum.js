/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import web3Utils = require('web3-utils');
const EthCrypto = require('eth-crypto');
const stripHexPrefix = require('strip-hex-prefix');
const BN = require('bn.js');

const Ethereum = {
    getAccountAddressBySignature(signature, message, fieldName) {
        const messageParams = [ { type: 'string', name: fieldName, value: message} ];
        return EthCrypto.recover(signature, Ethereum.typedSignatureHash(messageParams));
    },
    isSignatureValid(address, signature, message, fieldName) {
        const signedByAddress = this.getAccountAddressBySignature(signature, message, fieldName);
        return signedByAddress.toLowerCase() === address.toLowerCase();
    },
    isAddressValid(address) {
        return web3Utils.isAddress(address);
    },
    typedSignatureHash(typedData){
        const error = new Error('Expect argument to be non-empty array');
        if (typeof typedData !== 'object' || !('length' in typedData) || !typedData.length) {
            throw error;
        }

        const data = typedData.map(function (e) {
            return e.type === 'bytes' ? Ethereum.toBuffer(e.value) : e.value;
        });
        const types = typedData.map(function (e) {
            return e.type;
        });
        const schema = typedData.map(function (e) {
            if (!e.name) {
                throw error;
            }
            return `${e.type} ${e.name}`;
        });

        return web3Utils.soliditySha3(
            {t: 'bytes32', v: web3Utils.soliditySha3.apply(web3Utils, typedData.map((d, i) => ({t: 'string', v: schema[i]})))},
            {t: 'bytes32', v: web3Utils.soliditySha3.apply(web3Utils, types.map((t, i) => ({t, v: data[i]})))},
        );
    },
    isHexString(v) {
      return v && v.indexOf && v.indexOf('0x') === 0;
    },
    toBuffer(v) {
        if (v === null || v === undefined) {
            return Buffer.allocUnsafe(0)
        }

        if (Buffer.isBuffer(v)) {
            return Buffer.from(v)
        }

        if (Array.isArray(v) || v instanceof Uint8Array) {
            return Buffer.from(v)
        }

        if (typeof v === 'string') {
            if (!Ethereum.isHexString(v)) {
                throw new Error(
                    `Cannot convert string to buffer. toBuffer only supports 0x-prefixed hex strings and this string was given: ${v}`,
                )
            }
            return Buffer.from(Ethereum.padToEven(stripHexPrefix(v)), 'hex')
        }

        if (typeof v === 'number') {
            return Ethereum.intToBuffer(v)
        }

        if (BN.isBN(v)) {
            return v.toArrayLike(Buffer)
        }

        if (v.toArray) {
            // converts a BN to a Buffer
            return Buffer.from(v.toArray())
        }

        if (v.toBuffer) {
            return Buffer.from(v.toBuffer())
        }

        throw new Error('invalid type')
    },
    intToHex(i) {
        var hex = i.toString(16); // eslint-disable-line

        return `0x${hex}`;
    },
    intToBuffer(i) {
        const hex = Ethereum.intToHex(i);

        return new Buffer(Ethereum.padToEven(hex.slice(2)), 'hex');
    },
    padToEven(value) {
        var a = value; // eslint-disable-line

        if (typeof a !== 'string') {
            throw new Error(`[ethjs-util] while padding to even, value must be string, is currently ${typeof a}, while padToEven.`);
        }

        if (a.length % 2) {
            a = `0${a}`;
        }

        return a;
    }
};

module.exports = Ethereum;