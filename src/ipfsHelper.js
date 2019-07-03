const CID = require('cids');
const _ = require('lodash');
const ipns = require('ipns');

const crypto = require('libp2p-crypto');
const errcode = require('err-code');
const waterfall = require('async/waterfall');
const base64url = require('base64url');
const { fromB58String } = require('multihashes');
const { Message } = require('libp2p-pubsub/src/message')
const { SignPrefix } = require('libp2p-pubsub/src/message/sign')
const {utils} = require('libp2p-pubsub');

const peerId = require('peer-id');
const util = require('util');

const ipfsHelper = {
  isIpfsHash(value) {
    if (!value) {
      return false;
    }
    return _.startsWith(value, 'Qm');
  },
  isIpldHash(value) {
    if (!value) {
      return false;
    }
    return _.startsWith(value.codec, 'dag-') || (_.isString(value) && (_.startsWith(value, 'zd') || _.startsWith(value, 'ba')));
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
        log.error(err)
        return callback(errcode(err, 'ERR_CANNOT_GET_KEY'))
      }

      return callback(null, privateKey)
    })
  },
  getIpnsUpdatesTopic(ipnsId) {
    const namespace = '/record/';
    const multihash = fromB58String(ipnsId);
    const idKeys = ipns.getIdKeys(multihash);
    return `${namespace}${base64url.encode(idKeys.routingKey.toBuffer())}`;
  },

  createPeerIdFromPubKey: util.promisify(peerId.createFromPubKey).bind(peerId),
  createPeerIdFromPrivKey: util.promisify(peerId.createFromPrivKey).bind(peerId),
  
  async parsePubSubEvent(event) {
    event.key = await ipfsHelper.createPeerIdFromPubKey(event.key);
    try {
      event.data = ipns.unmarshal(event.data);
      event.data.valueStr = event.data.value.toString('utf8');
      event.data.peerId = await ipfsHelper.createPeerIdFromPubKey(event.data.pubKey);
    } catch (e) {
      // not ipns event
    }
    return event;
  },
  
  checkPubSubSign(peerId, message) {
    const msg = utils.normalizeOutRpcMessage(_.pick(message, ['from', 'data', 'seqno', 'topicIDs']));
    
    const bytes = Buffer.concat([
      SignPrefix,
      Message.encode(msg)
    ]);

    return new Promise((resolve, reject) => {
      peerId._pubKey.verify(bytes, message.signature, (err, isValid) => {
        err ? reject(err) : resolve(isValid);
      });
    });
  }
};

module.exports = ipfsHelper;
