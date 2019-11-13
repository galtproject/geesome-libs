/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const CID = require('cids');

const startsWith = require('lodash/startsWith');
const isString = require('lodash/isString');
const pick = require('lodash/pick');

const ipns = require('ipns');
const { DAGNode, util: DAGUtil } = require('ipld-dag-pb');

const crypto = require('libp2p-crypto');
const errcode = require('err-code');
const waterfall = require('async/waterfall');
const {Message} = require('libp2p-pubsub/src/message');
const {SignPrefix} = require('libp2p-pubsub/src/message/sign');
const {utils} = require('libp2p-pubsub');
const multihash = require('multihashes');
// const {fromB58String} = require('multihashes');
const ID_MULTIHASH_CODE = multihash.names.id;
const bs58 = require('bs58')

const peerId = require('peer-id');
const {promisify} = require('es6-promisify');

const ipfsHelper = {
  isIpfsHash(value) {
    if (!value) {
      return false;
    }
    return startsWith(value, 'Qm');
  },
  isIpldHash(value) {
    if (!value) {
      return false;
    }
    return startsWith(value.codec, 'dag-') || (isString(value) && /^\w+$/.test(value) && (startsWith(value, 'zd') || startsWith(value, 'ba')));
  },
  isCid(value) {
    return CID.isCID(value);
  },
  cidToHash(cid) {
    const cidsResult = new CID(1, 'dag-cbor', cid.multihash || Buffer.from(cid.hash.data));
    return cidsResult.toBaseEncodedString();
  },
  keyLookup(ipfsNode, kname, callback) {
    if (kname === 'self') {
      return callback(null, ipfsNode._peerInfo.id.privKey)
    }
    const pass = ipfsNode._options.pass

    waterfall([
      (cb) => ipfsNode._keychain.exportKey(kname, pass, cb),
      (pem, cb) => crypto.keys.import(pem, pass, cb)
    ], (err, privateKey) => {
      if (err) {
        console.error(err);
        return callback(errcode(err, 'ERR_CANNOT_GET_KEY'))
      }

      return callback(null, privateKey)
    })
  },

  createPeerIdFromPubKey: promisify(peerId.createFromPubKey).bind(peerId),
  createPeerIdFromPrivKey: promisify(peerId.createFromPrivKey).bind(peerId),
  createPeerIdFromIpns: peerId.createFromB58String.bind(peerId),

  // extractPublicKeyFromId(peerId) {
  //   const decodedId = multihash.decode(peerId.id);
  //  
  //   console.log('decodedId', decodedId);
  //
  //   if (decodedId.code !== ID_MULTIHASH_CODE) {
  //     return null
  //   }
  //
  //   return crypto.keys.unmarshalPublicKey(decodedId.digest)
  // },

  async parsePubSubEvent(event) {
    if(event.key) {
      event.keyPeerId = await ipfsHelper.createPeerIdFromPubKey(event.key);
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
      event.data.peerId = await ipfsHelper.createPeerIdFromPubKey(event.data.pubKey);
      
      return new Promise((resolve, reject) => {
        ipns.validate(event.data.peerId._pubKey, event.data, (err) => {
          return err ? reject(err) : resolve(event);
        })
      });
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
    const checkMessage = pick(message, ['from', 'data', 'seqno', 'topicIDs']);
    
    // const msg = utils.normalizeOutRpcMessage(checkMessage);

    const bytes = Buffer.concat([
      SignPrefix,
      Message.encode(checkMessage)
    ]);

    return new Promise((resolve, reject) => {
      pubKey.verify(bytes, message.signature, (err, isValid) => {
        err ? reject(err) : resolve(isValid);
      });
    });
  },
  
  getIpfsHashFromString(string) {
    const Unixfs = require('ipfs-unixfs');
    
    return new Promise((resolve, reject) => {
      const unixFsFile = new Unixfs('file', Buffer.from(string));
      const buffer = unixFsFile.marshal();

      DAGNode.create(buffer, (err, dagNode) => {
        if (err) {
          reject(new Error('Cannot create ipfs DAGNode'));
        }

        DAGUtil.cid(dagNode, (error, cid) => {
          resolve(cid.toBaseEncodedString());
        });
      });
    });
  }
};

module.exports = ipfsHelper;
