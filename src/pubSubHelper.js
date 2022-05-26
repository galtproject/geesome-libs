const PeerId = require('peer-id');
const ipns = require('ipns');
const {signMessage, SignPrefix: Libp2pSignPrefix} = require('libp2p-interfaces/src/pubsub/message/sign');
const {normalizeOutRpcMessage, randomSeqno, ensureArray} = require('libp2p-interfaces/src/pubsub/utils');

const isBuffer = require('lodash/isBuffer');
const isObject = require('lodash/isObject');
const isString = require('lodash/isString');
const jwkToPem = require('pem-jwk').jwk2pem;
const uint8ArrayConcat = require('uint8arrays/concat');
const libp2pKeys = require('libp2p-crypto/src/keys');
const crypto = require('crypto')
const {RPC} = require('libp2p-interfaces/src/pubsub/message/rpc');
const uint8ArrayFromString = require('uint8arrays/from-string');
const GeesomeSignPrefix = uint8ArrayFromString('geesome:');
const peerIdHelper = require('./peerIdHelper.js');
const startsWith = require('lodash/startsWith');

const pubSubHelper = {
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

    async parsePubSubEvent(event) {
        if(event.key) {
            event.keyPeerId = await peerIdHelper.createPeerIdFromPubKey(event.key);
            event.key = event.keyPeerId._pubKey;
            event.keyIpns = event.keyPeerId.toB58String();

            const pubSubSignatureValid = await pubSubHelper.checkPubSubSignature(event.key, event);
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

    async parseFluenceEvent(topic, event) {
        event.dataBuffer = Buffer.from(event.data, 'base64');
        event.seqno = Buffer.from(event.seqno, 'base64');
        event.signature = Buffer.from(event.signature, 'base64');

        const signatureValid = pubSubHelper.checkFluenceSignature(event.from, event.data, event.seqno, event.signature);
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
        return verify.verify(pem, signature);
    },

};

module.exports = pubSubHelper;