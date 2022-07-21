const registryApi = require('./generated/registry-api');
//registerNodeProvider, createResource, registerProvider, resolveProviders
const startsWith = require('lodash/startsWith');
const orderBy = require('lodash/orderBy');
const pIteration = require('p-iteration');
const ipfsHelper = require('../ipfsHelper');
const peerIdHelper = require('../peerIdHelper');
const log = require('loglevel');
const {getIpnsUpdatesTopic, getPeerIdTopic} = require('../name');
const { FluencePeer, KeyPair } = require("@fluencelabs/fluence");

module.exports = class FluenceService {
    accStorage;
    subscribesByTopics;
    connectTo;
    peer;
    geesomeCryptoResourceId;

    registryService = 'geesome-registry';

    constructor(accStorage, peer = null, options = {}) {
        this.accStorage = accStorage;
        this.peer = peer;
        this.subscribesByTopics = {};

        if (options.logLevel) {
            log.setLevel(options.logLevel);
        }
    }
    async isReady() {
        return !!this.peer;
    }
    setPeer(peer) {
        this.peer = peer;
    }
    async buildPeerAndConnect(peerId) {
        const peer = new FluencePeer();
        console.log('this.connectTo', this.connectTo);
        await peer.start({ connectTo: this.connectTo, KeyPair: new KeyPair(peerId) });
        return peer;
    }
    async getPeerId() {
        return peerIdHelper.createFromB58String(this.peer.getStatus().peerId);
    }
    async initPeer(peerId, connectTo = null) {
        if (connectTo) {
            this.connectTo = connectTo;
        }
        this.setPeer(await this.buildPeerAndConnect(peerId));
        console.log('registryApi', registryApi);

        // registryApi.registerClientAPI(this.peer, 'api', {
        //     receive_event: (topic, e) => {
        //         this.emitTopicSubscribers(topic, e);
        //     }
        // });
        //
        // registryApi.registerGeesomeCrypto(this.peer, 'GeesomeCrypto', {
        //     checkSignature: (from, data, seqno, signature) => {
        //         try {
        //             return ipfsHelper.checkFluenceSignature(from, data, seqno, signature);
        //         } catch (e) {
        //             console.error('registerGeesomeCrypto', e);
        //         }
        //     }
        // });
    }
    getClientRelayId() {
        return this.peer.getStatus().relayPeerId;
    }
    addTopicSubscriber(topic, callback) {
        if (!this.subscribesByTopics[topic]) {
            this.subscribesByTopics[topic] = [];
        }
        this.subscribesByTopics[topic].push(callback);
    }
    emitTopicSubscribers(topic, event) {
        return pIteration.forEach(this.subscribesByTopics[topic] || [], async callback => {
            const parsedEvent = await ipfsHelper.parseFluenceEvent(topic, event);
            return parsedEvent && callback(parsedEvent);
        });
    }
    async bindToStaticId(accountKey, storageId, options = {}) {
        return new Promise(async (resolve, reject) => {
            let resolved = false;
            setTimeout(() => {
                if (!resolved) {
                    reject('timeout');
                }
            }, 3000);
            const peerId = await this.getAccountPeerId(accountKey);
            const peer = await this.buildPeerAndConnect(peerId);
            const topic = getPeerIdTopic(peerId);
            console.log('bindToStaticId:createResource');
            const resourceId = await this.createResource(peer, topic, options.tries || 0);
            console.log('bindToStaticId:registerResourceProvider');
            await this.registerResourceProvider(peer, resourceId, storageId);
            console.log('bindToStaticId:publishEventByPeerId');
            await this.publishEventByPeerId(peerId, topic, storageId);
            resolved = true;
            resolve(accountKey);
        });
    }
    async resolveStaticId(staticStorageId) {
        return this.resolveStaticItem(staticStorageId).then(item => item ? item.value : null)
    }
    async getResourceByPeerId(hostPeerId, topicPeerId) {
        return registryApi.getResourceId(this.peer, getPeerIdTopic(topicPeerId), peerIdHelper.peerIdToPublicBase58(hostPeerId));
    }
    async getResourceByTopicAndPeerId(topic, hostPeerId) {
        console.log('getResourceId', 'topic', topic, 'peerId', peerIdHelper.peerIdToPublicBase58(hostPeerId))
        return registryApi.getResourceId(this.peer, topic, peerIdHelper.peerIdToPublicBase58(hostPeerId)).catch(e => {
            console.error(e);
            return null;
        });
    }
    async getHostAndAccResourceByStaticId(staticId) {
        if (!startsWith(staticId, 'Qm')) {
            staticId = await this.accStorage.getAccountStaticId(staticId);
        }
        const accPeerId = await this.accStorage.getAccountPeerId(staticId);
        const hostPeerId = await this.getPeerId();
        return [
            await this.getResourceByPeerId(hostPeerId, accPeerId),
            await this.getResourceByPeerId(accPeerId, accPeerId),
        ];
    }
    async resolveStaticItem(staticStorageId) {
        const [hostResource, accResource] = await this.getHostAndAccResourceByStaticId(staticStorageId);
        return Promise.all([
            registryApi.resolveProviders(this.peer, hostResource, 1).then(records => orderBy(records, ['timestamp_created'], ['desc'])[0]),
            registryApi.resolveProviders(this.peer, accResource, 1).then(records => orderBy(records, ['timestamp_created'], ['desc'])[0]),
        ])
            .then(records => records.filter(r => r))
            .then(records => orderBy(records, ['timestamp_created'], ['desc'])[0]);
    }
    async removeAccountIfExists(name) {
        return this.accStorage.destroyStaticId(name);
    }
    async getAccountIdByName(name) {
        return this.accStorage.getAccountStaticId(name);
    }
    async createAccountIfNotExists(name, userId = null) {
        return this.accStorage.getOrCreateAccountStaticId(name, userId = null);
    }

    async getAccountPeerId(key) {
        return this.accStorage.getAccountPeerId(key);
    }

    async getAccountPublicKey(key) {
        return this.accStorage.getAccountPublicKey(key);
    }

    async getCurrentAccountId() {
        return this.accStorage.getAccountStaticId('self');
    }

    async resolveStaticIdEntry(staticStorageId) {
        // TODO: implement
        return null;
        // return this.resolveStaticId(staticStorageId).then(async r => ({pubKey: await this.accStorage.getAccountPublicKey(r)}))
    }

    async keyLookup(ipnsId) {
        return this.accStorage.getAccountPeerId(ipnsId).then(r => r.privKey);
    }

    async getBootNodeList() {
        // TODO: implement
        return [null];
    }

    async addBootNode(address) {
        // TODO: implement
        return [null];
    }

    async removeBootNode(address) {
        // TODO: implement
        return [null];
    }

    async nodeAddressList() {
        // TODO: implement
        return [null];
    }

    async publishEventByStaticId(ipnsId, topic, data) {
        const peerId = await this.accStorage.getAccountPeerId(ipnsId);
        return this.publishEventByPeerId(peerId, topic, data);
    }

    async publishEventByPeerId(peerId, topic, data) {
        let privateKey = peerId._privKey;
        privateKey = privateKey.bytes || privateKey;
        const event = await ipfsHelper.buildAndSignFluenceMessage(privateKey, data);
        // console.log('fanout_event', this.peer.relayPeerId, topic, event);
        return this.publishEventByData(topic, event);
    }

    async publishEvent(topic, data) {
        return this.publishEventByPeerId(await this.accStorage.getAccountPeerId('self'), topic, data);
    }

    async subscribeToStaticIdUpdates(ipnsId, callback) {
        return this.subscribeToEvent(getIpnsUpdatesTopic(ipnsId), callback);
    }

    async publishEventByData(topic, event) {
        // console.log('fanout_event', this.peer.relayPeerId, topic, event);
        return new Promise((resolve, reject) => {
            registryApi.fanout_event(this.peer, this.geesomeCryptoResourceId, 1, topic, event, (res) => {
                // console.log("fanout_event", res);
                if (res === 'done') {
                    return resolve();
                } else if (res === 'signature_not_valid') {
                    return reject('fanout_event failed: signature isnt valid');
                }
            });
        });
    }

    async subscribeToEvent(_topic, _callback, options = {}) {
        await this.createResource(_topic, _topic, options.tries || 0);
        return this.addTopicSubscriber(_topic, _callback);
    }

    async createResource(_peer, _topic, tries = 0) {
        try {
            let [resourceId, createError] = await registryApi.createResource(_peer, _topic, {ttl: 20000});
            if (createError || !resourceId) {
                throw new Error(createError ? createError.toString() : 'resourceId_creation_failed');
            }
            return resourceId;
        } catch (e) {
            tries--;
            if (tries <= 0) {
                return console.warn('createResource failed', e);
            }
            console.warn('createResource failed, try again...', e);
            await this.peer.stop().catch(e => console.warn('peer.stop failed', e));
            await this.peer.start();
            return this.createResource(_topic, tries);
        }
    }

    async registerResourceProvider(_peer, _resourceId, _value) {
        let [nodeSuccess, regNodeError] = await registryApi.registerNodeProvider(_peer, await this.getPeerId(), _resourceId, _value, this.registryService);
        if (!nodeSuccess || regNodeError) {
            throw new Error(regNodeError ? regNodeError.toString() : 'registerNodeProvider_failed');
        }
    }

    async stop() {
        return this.peer.stop();
    }

    async getStaticIdPeers(ipnsId) {
        const [hostResourceId, accResourceId] = await this.getHostAndAccResourceByStaticId(ipnsId);
        const [hostPeers, accPeers] = await Promise.all([
            registryApi.resolveProviders(this.peer, hostResourceId, 1),
            registryApi.resolveProviders(this.peer, accResourceId, 1)
        ]);
        return hostPeers.concat(accPeers);
    }

    async getPubSubLs() {
        return [null];
    }

    async getPeers(topic) {
        if (!topic) {
            return [];
        }
        let subs = await registryApi.resolveProviders(this.peer, await this.getResourceByTopicAndPeerId(topic, await this.getPeerId()), 1).catch(e => {
            console.error(e);
            return [];
        });
        return subs;
    }
}