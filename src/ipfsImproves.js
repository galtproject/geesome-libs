const assert = require('assert');
const noop = () => {
};

const {signMessage} = require('libp2p-pubsub/src/message/sign');
const peerId = require('peer-id');
const asyncMap = require('async/map');
const nextTick = require('async/nextTick');
const {utils} = require('libp2p-pubsub');
const ensureArray = utils.ensureArray

module.exports = {
  improvePubSub(fsub) {
    // https://github.com/libp2p/js-libp2p-pubsub/blob/f1e188929d779e7af91e1fd039b2c3b95cdf05df/src/index.js#L246
    fsub._buildMessageByPeerId = (function (peerId, message, callback) {
      const msg = utils.normalizeOutRpcMessage(message)
      if (peerId) {
        signMessage(peerId, msg, callback)
      } else {
        nextTick(callback, null, msg)
      }
    }).bind(fsub);

    fsub._buildMessage = (function (message, callback) {
      this._buildMessageByPeerId(this.peerId, message, callback)
    }).bind(fsub);
  },
  
  improveFloodSub(fsub) {
    //https://github.com/libp2p/js-libp2p-floodsub/blob/4feadeb9ef0cc35892a9c499c740e759b3d73ec8/src/index.js#L167
    fsub.publishByPeerId = (function (peerId, topics, messages, callback) {
      assert(this.started, 'FloodSub is not started')
      callback = callback || noop

      this.log('publish', topics, messages)

      topics = ensureArray(topics)
      messages = ensureArray(messages)

      const from = this.libp2p.peerInfo.id.toB58String();

      const buildMessage = (msg, cb) => {
        const seqno = utils.randomSeqno()
        this.seenCache.put(utils.msgId(from, seqno))

        const message = {
          from: from,
          data: msg,
          seqno: seqno,
          topicIDs: topics,
          key: peerId._pubKey
        };

        // Emit to self if I'm interested
        this._emitMessages(topics, [message])

        this._buildMessageByPeerId(peerId, message, cb)
      }

      asyncMap(messages, buildMessage, (err, msgObjects) => {
        if (err) return callback(err)

        // send to all the other peers
        this._forwardMessages(topics, msgObjects)

        callback(null)
      })
    }).bind(fsub);

    fsub.publish = function (topics, messages, callback) {
      this.publishByPeerId(this.peerId, topics, messages, callback);
    };
  }
}
