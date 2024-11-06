/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import { CID } from 'multiformats';
import * as codec from "@ipld/dag-cbor";
import libp2pCrypto from 'libp2p-crypto';
import { sha256 } from 'multiformats/hashes/sha2';
import * as jsonCodec from 'multiformats/codecs/json';
import _ from 'lodash';
import common from "./common";
const {startsWith, isString, pick, isUndefined, isDate} = _;
// import * as dagCBOR from '@ipld/dag-cbor';
// import * as dagJSON from '@ipld/dag-json';

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
    return isString(value) && (value.length === 59 || value.length === 61) && /^\w+$/.test(value) && (startsWith(value, 'bafyre') || startsWith(value, 'bagaai'));
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
    return ipfsHelper.cidHashFromBytes(new (TextEncoder as any)('utf8').encode(string), 0x55);
  },

  async cidHashFromBytes(bytes, code) {
    // 0x55 - raw ipfs hash
    // 0x72 - pubkey
    // https://github.com/multiformats/multicodec/blob/5de6f09bdf7ed137f47c94a2e61866a87b4b3141/table.csv
    return (sha256.digest(bytes) as any).then(res => CID.createV1(code, res)).then(cid => cid.toString());
  },

  async getJsonHashFromObject(object) {
    object = common.sortObject(object);
    const buf = jsonCodec.encode(object);
    const hash = await sha256.digest(buf);
    const cid = CID.createV1(jsonCodec.code, hash);
    return ipfsHelper.cidToHash(cid);
  },

  async getIpldHashFromObject(object) {
    object = common.sortObject(object);
    const buf = codec.encode(object);
    const hash = await sha256.digest(buf);
    const cid = CID.createV1(codec.code, hash);
    return ipfsHelper.cidToHash(cid);
  },

  async createDaemonNode(options = {}, ipfsOptions = {}) {
    // const hat = require('hat');
    // const {createFactory} = require('ipfsd-ctl');
    //
    // const factory = createFactory({
    //   type: 'proc', // or 'js' to run in a separate process
    //   // type: 'js',
    //   ipfsHttpModule: require('ipfs-http-client'),
    //   ipfsModule: require('ipfs'), // only if you gonna spawn 'proc' controllers
    //   ...options
    // })
    //
    // const node = await factory.spawn({
    //   ipfsOptions: {
    //     pass: hat(),
    //     init: true,
    //     // start: true,
    //     ...ipfsOptions
    //   },
    //   // preload: {enabled: false, addresses: await this.getPreloadAddresses()}
    // });
    //
    // return node.api;
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
