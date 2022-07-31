/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as hasher from 'multiformats/hashes/hasher';
import * as Block from 'multiformats/block';

import startsWith from 'lodash/startsWith.js';
import isString from 'lodash/isString.js';
import pick from 'lodash/pick.js';
import isUndefined from 'lodash/isUndefined.js';
import isDate from 'lodash/isDate.js';
import uint8ArrayConcat from 'uint8arrays/concat.js';
import uint8ArrayFromString from 'uint8arrays/from-string.js';

import crypto from 'crypto';
import libp2pCrypto from 'libp2p-crypto';
import libp2pKeys from 'libp2p-crypto/src/keys/index.js';
import RPC from 'libp2p-interfaces/src/pubsub/message/rpc.js';
import * as codec from "@ipld/dag-cbor";
import {jwk2pem as jwkToPem} from 'pem-jwk';

import peerIdHelper from './peerIdHelper.js';
const GeesomeSignPrefix = uint8ArrayFromString('geesome:');

const ipfsHelper = {
  isIpfsHash(value) {
    if (!value) {
      return false;
    }
    return (startsWith(value, 'Qm') || ipfsHelper.isCidHash(value)) && /^\w+$/.test(value);
  },
  isCidHash(value) {
    if (!value) {
      return false;
    }
    return startsWith(value.codec, 'dag-') || (isString(value) && value.length === 59 && /^\w+$/.test(value) && (startsWith(value, 'zd') || startsWith(value, 'ba')));
  },
  isFileCidHash(value) {
    if (!value) {
      return false;
    }
    //TODO: spec about bafybe
    return isString(value) && value.length === 59 && /^\w+$/.test(value) && (startsWith(value, 'bafkre') || startsWith(value, 'bafybe'));
  },
  isObjectCidHash(value) {
    if (!value) {
      return false;
    }
    return isString(value) && value.length === 59 && /^\w+$/.test(value) && startsWith(value, 'bafyre');
  },
  isAccountCidHash(value) {
    if (!value) {
      return false;
    }
    return isString(value) && value.length === 59 && /^\w+$/.test(value) && startsWith(value, 'bafzbe');
  },
  isCid(value) {
    const cid = CID.asCID(value);
    return !!cid;
  },
  cidToHash(cid) {
    // const cidsResult = new CID(1, 'dag-cbor', cid.multihash || Buffer.from(cid.hash.data));
    return cid.toString();
  },
  cidToIpfsHash(cid) {
    cid = CID.asCID(cid);
    return cid.toString();
  },
  ipfsHashToCid(hash) {
    return CID.parse(hash);
  },
  getObjectRef(storageId) {
    return storageId;
  },
  pickObjectFields(object, fields) {
    object = pick(object, fields);
    fields.forEach(f => {
      if (isUndefined(object[f])) {
        object[f] = null;
      }
      if (isDate(object[f])) {
        object[f] = object[f].getTime() / 1000;
      }
    });
    return object;
  },

  async keyLookup(ipfsNode, kname, pass) {
    const pem = await ipfsNode.key.export(kname, pass);
    return libp2pCrypto.keys.import(pem, pass);
  },

  async getIpfsHashFromString(string) {
    return ipfsHelper.cidHashFromBytes(new TextEncoder('utf8').encode(string), 0x12, 0x55);
  },

  async getIpldHashFromObject(value) {
    let block = await Block.encode({ value, codec, hasher: sha256 });
    // you can also decode blocks from their binary state
    block = await Block.decode({ bytes: block.bytes, codec, hasher: sha256 });
    // if you have the cid you can also verify the hash on decode
    return Block.create({ bytes: block.bytes, cid: block.cid, codec, hasher: sha256 }).then(b => b.cid.toString());
  },

  async cidHashFromBytes(bytes, hashCode, cidCode) {
    // 0x55 - raw ipfs hash
    // 0x72 - pubkey
    // https://github.com/multiformats/multicodec/blob/5de6f09bdf7ed137f47c94a2e61866a87b4b3141/table.csv
    const sha = hasher.from({
      name: 'sha2-256',
      code: hashCode,
      encode: (input) => new Uint8Array(crypto.createHash('sha256').update(input).digest())
    })
    return CID.create(1, cidCode, await sha.digest(bytes)).toString();
  },

  async parseFluenceEvent(topic, event) {
    event.dataBuffer = Buffer.from(event.data, 'base64');
    event.seqno = Buffer.from(event.seqno, 'base64');
    event.signature = Buffer.from(event.signature, 'base64');

    const signatureValid = ipfsHelper.checkFluenceSignature(event.from, event.data, event.seqno, event.signature);
    if (!signatureValid) {
      console.log('signature_not_valid');
      return null;
    }

    if (startsWith(topic, 'Qm')) {
      const split = topic.split('/');
      const staticBase58 = split[0];
      const fromBase58 = peerIdHelper.peerIdToPublicBase58(fromPeerId);
      if (staticBase58 !== fromBase58) {
        console.log('static_id_not_match');
        return null;
      }
      event.staticType = split[1];
    }

    if (event.from) {
      const fromPeerId = await peerIdHelper.createPeerIdFromPublicBase64(event.from);
      event.fromPeerId = fromPeerId;
      event.fromPubKey = peerIdHelper.publicKeyToBase64(fromPeerId.pubKey);
      event.fromIpns = event.fromPeerId.toB58String();
    }

    try {
      event.dataStr = event.dataBuffer.toString('utf8');
    } catch (e) {}

    try {
      if (event.dataStr) {
        event.dataJson = JSON.parse(event.dataStr);
      }
    } catch (e) {}

    return event;
  },

  checkFluenceSignature(from, data, seqno, signature) {
    if (isString(signature)) {
      signature = Buffer.from(signature, 'base64');
    }
    const pubKey = peerIdHelper.base64ToPublicKey(from);
    const message = {
      data,
      from,
      seqno
    };
    const bytes = uint8ArrayConcat([GeesomeSignPrefix, RPC.Message.encode(message).finish()]);
    const rsaPubKey = libp2pKeys.unmarshalPublicKey(pubKey.bytes);
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(bytes);
    const pem = jwkToPem(rsaPubKey._key);
    return verify.verify(pem, signature)
  },

  getStorageIdHash(storageId) {
    if (ipfsHelper.isCid(storageId)) {
      storageId = ipfsHelper.cidToHash(storageId);
    }

    if (storageId['/']) {
      storageId = storageId['/'];
    }

    return storageId;
  }
};
export default ipfsHelper;
