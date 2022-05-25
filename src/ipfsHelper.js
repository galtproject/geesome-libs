/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const { CID } = require('multiformats/cid');
const { sha256 } = require('multiformats/hashes/sha2');
const startsWith = require('lodash/startsWith');
const isString = require('lodash/isString');
const libp2pCrypto = require('libp2p-crypto');
const dagCBOR = require('@ipld/dag-cbor')
const pick = require('lodash/pick');
const isUndefined = require('lodash/isUndefined');
const isDate = require('lodash/isDate');

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
    return isString(value) && value.length === 59 && /^\w+$/.test(value) || startsWith(value, 'bafkre');
  },
  isObjectCidHash(value) {
    if (!value) {
      return false;
    }
    return isString(value) && value.length === 59 && /^\w+$/.test(value) || startsWith(value, 'bafyre');
  },
  isAccountCidHash(value) {
    if (!value) {
      return false;
    }
    return isString(value) && value.length === 59 && /^\w+$/.test(value) || startsWith(value, 'bafzbe');
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
    return ipfsHelper.cidHashFromBytes(new TextEncoder('utf8').encode(string), 0x55);
  },

  async cidHashFromBytes(bytes, code) {
    // 0x55 - raw ipfs hash
    // 0x72 - pubkey
    // https://github.com/multiformats/multicodec/blob/5de6f09bdf7ed137f47c94a2e61866a87b4b3141/table.csv
    return sha256.digest(bytes).then(res => CID.createV1(code, res)).then(cid => cid.toString());
  },

  async getIpldHashFromObject(object) {
    return sha256.digest(dagCBOR.encode(object)).then(res => CID.createV1(dagCBOR.code, res)).then(res => ipfsHelper.cidToHash(res));
  },

  async createDaemonNode(options = {}, ipfsOptions = {}) {
    const hat = require('hat');
    const {createFactory} = require('ipfsd-ctl');

    const factory = createFactory({
      type: 'proc', // or 'js' to run in a separate process
      // type: 'js',
      ipfsHttpModule: require('ipfs-http-client'),
      ipfsModule: require('ipfs'), // only if you gonna spawn 'proc' controllers
      ...options
    })

    const node = await factory.spawn({
      ipfsOptions: {
        pass: hat(),
        init: true,
        // start: true,
        ...ipfsOptions
      },
      // preload: {enabled: false, addresses: await this.getPreloadAddresses()}
    });

    return node.api;
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
module.exports = ipfsHelper;
