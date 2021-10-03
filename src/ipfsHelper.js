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
const isBuffer = require('lodash/isBuffer');
const isObject = require('lodash/isObject');
const jwkToPem = require('pem-jwk').jwk2pem

const ipns = require('ipns');
const { DAGNode, util: DAGUtil } = require('ipld-dag-pb');
const uint8ArrayConcat = require('uint8arrays/concat')
const uint8ArrayFromString = require('uint8arrays/from-string')

const libp2pCrypto = require('libp2p-crypto');
const libp2pKeys = require('libp2p-crypto/src/keys');
const crypto = require('crypto')
const {RPC} = require('libp2p-interfaces/src/pubsub/message/rpc');
const {signMessage, SignPrefix: Libp2pSignPrefix} = require('libp2p-interfaces/src/pubsub/message/sign');
const {normalizeOutRpcMessage, randomSeqno, ensureArray} = require('libp2p-interfaces/src/pubsub/utils');
const dagCBOR = require('@ipld/dag-cbor')
const PeerId = require('peer-id');
const pick = require('lodash/pick');
const isUndefined = require('lodash/isUndefined');
const isDate = require('lodash/isDate');
const GeesomeSignPrefix = uint8ArrayFromString('geesome:');
const peerIdHelper = require('./peerIdHelper.js');

const ipfsHelper = {
  isIpfsHash(value) {
    if (!value) {
      return false;
    }
    return startsWith(value, 'Qm') && /^\w+$/.test(value);
  },
  isIpldHash(value) {
    if (!value) {
      return false;
    }
    return startsWith(value.codec, 'dag-') || (isString(value) && value.length === 59 && /^\w+$/.test(value) && (startsWith(value, 'zd') || startsWith(value, 'ba')));
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

  async parsePubSubEvent(event) {
    if(event.key) {
      event.keyPeerId = await peerIdHelper.createPeerIdFromPubKey(event.key);
      event.key = event.keyPeerId._pubKey;
      event.keyIpns = event.keyPeerId.toB58String();

      const pubSubSignatureValid = await ipfsHelper.checkPubSubSignature(event.key, event);
      if(!pubSubSignatureValid) {
        throw "pubsub_signature_invalid";
      }
    }

    try {
      event.data = ipns.unmarshal(event.data);
      event.data.valueStr = event.data.value.toString('utf8');
      event.data.peerId = await peerIdHelper.createPeerIdFromPubKey(event.data.pubKey);

      const validateRes = await ipns.validate(event.data.peerId._pubKey, event.data);
    } catch (e) {
      // not ipns event
      // console.warn('Failed unmarshal ipns of event', event);
      event.dataStr = event.data.toString('utf8');
      try {
        event.dataJson = JSON.parse(event.dataStr);
      } catch (e) {}
    }
    return event;
  },

  checkPubSubSignature(pubKey, message) {
    // const checkMessage = pick(message, ['from', 'data', 'seqno', 'topicIDs']);

    // Get message sans the signature
    const bytes = uint8ArrayConcat([
      Libp2pSignPrefix,
      RPC.Message.encode({
        ...message,
        // @ts-ignore message.from needs to exist
        from: PeerId.createFromCID(message.from).toBytes(),
        signature: undefined,
        key: undefined
      }).finish()
    ])

    // verify the base message
    return pubKey.verify(bytes, message.signature)
  },

  async getIpfsHashFromString(string) {
    const { UnixFS } = require('ipfs-unixfs');
    const unixFsFile = new UnixFS({ type: 'file', data: Buffer.from(string) });
    const buffer = unixFsFile.marshal();

    const node = new DAGNode(buffer);
    const serialized = DAGUtil.serialize(node);
    const cid = await DAGUtil.cid(serialized, { cidVersion: 0 });

    return cid.toBaseEncodedString();
  },

  async getIpldHashFromObject(object) {
    //TODO: find more efficient way
    return sha256.digest(dagCBOR.encode(object)).then(res => CID.createV1(dagCBOR.code, res)).then(res => ipfsHelper.cidToHash(res));
  },

  async buildAndSignPubSubMessage(privateKey, topics, data) {
    const peerId = await peerIdHelper.createPeerIdFromPrivKey(privateKey);
    const from = peerId.toB58String();
    let msgObject = {
      data,
      from,
      receivedFrom: from,
      seqno: randomSeqno(),
      topicIDs: ensureArray(topics)
    }
    return signMessage(peerId, normalizeOutRpcMessage(msgObject));
  },

  async buildAndSignFluenceMessage(privateKeyBase64, data) {
    if (isObject(data)) {
      data = JSON.stringify(data);
    }
    if (isString(data)) {
      data = Buffer.from(data);
    }
    if (isBuffer(data)) {
      data = data.toString('base64');
    }
    const peerId = await peerIdHelper.createPeerIdFromPrivateBase64(privateKeyBase64);
    const from = peerIdHelper.peerIdToPublicBase64(peerId);
    const message = {
      data,
      from,
      seqno: randomSeqno().toString('base64')
    };
    const bytes = uint8ArrayConcat([GeesomeSignPrefix, RPC.Message.encode(message).finish()]);
    const signature = await peerId.privKey.sign(bytes);
    return {
      ...message,
      signature: signature.toString('base64'),
    }
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
  }
};
module.exports = ipfsHelper;
