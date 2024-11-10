import commonHelper from '../common';
import * as pIteration from 'p-iteration';
import pubSubHelper from '../pubSubHelper';
import ipfsHelper from '../ipfsHelper';
import name from '../name';
const {getFluenceUpdatesTopic, getFluenceAccountsGroupUpdatesTopic} = name;
commonHelper.initializeCustomEvent();
// import { Fluence, randomKras } from "@fluencelabs/js-client";
// const geesomeCrypto = require('./generated/geesome-crypto');
// const log = require('loglevel');

export default class FluenceService {
    accStorage: any;
    subscribesByTopics: any;
    peer: any;
    client: any;
    dhtApi: any;

    constructor(accStorage = null, options = {}) {
        this.accStorage = accStorage;
        this.subscribesByTopics = {};

        // if (options.logLevel) {
        //     log.setLevel(options.logLevel);
        // }
    }

    async initClient(keyPair, relay = null) {
        // this.dhtApi = await import('./generated/resources.ts');
        // const {Fluence, randomKras} = await import("@fluencelabs/js-client.api");

        // await Fluence.connect(randomKras(), {
        //     // keyPair,
        // });

        // this.client = await Fluence.getClient();
        this.registerEvents();
    }

    async isReady() {
        return !!this.peer;
    }
    registerEvents() {
        // geesomeCrypto.registerClientAPI(this.peer, 'api', {
        //     receive_event: (topic, e) => {
        //         this.emitTopicSubscribers(topic, e);
        //     }
        // });
        //
        // geesomeCrypto.registerGeesomeCrypto(this.peer, 'GeesomeCrypto', {
        //     checkSignature: (from, data, seqno, signature) => {
        //         try {
        //             return pubSubHelper.checkFluenceSignature(from, data, seqno, signature);
        //         } catch (e) {
        //             console.error('registerGeesomeCrypto', e);
        //         }
        //     }
        // });
    }
    getClientRelayId() {
        return this.client.getStatus().relayPeerId;
    }
    addTopicSubscriber(topic, callback) {
        if (!this.subscribesByTopics[topic]) {
            this.subscribesByTopics[topic] = [];
        }
        this.subscribesByTopics[topic].push(callback);
    }
    emitTopicSubscribers(topic, event) {
        return pIteration.forEach(this.subscribesByTopics[topic] || [], async (callback: any) => {
            const parsedEvent = await pubSubHelper.parseFluenceEvent(topic, event);
            return parsedEvent && callback(parsedEvent);
        });
    }
    async bindToStaticId(storageId, accountKey, options: any = {}) {
        return new Promise(async (resolve, reject) => {
            let resolved = false;
            setTimeout(() => {
                if (!resolved) {
                    reject('timeout');
                }
            }, 3000);
            if (!ipfsHelper.isAccountCidHash(accountKey)) {
                accountKey = await this.accStorage.getAccountStaticId(accountKey);
            }
            console.log('bindToStaticId:initTopicAndSubscribeBlocking');
            await this.initTopicAndSubscribeBlocking(accountKey, storageId, options.tries || 0);
            // console.log('bindToStaticId:fanout_event');
            // await this.publishEventByStaticId(accountKey, this.getUpdatesTopic(accountKey, 'update'), '/ipfs/' + storageId);
            resolved = true;
            resolve(accountKey);
        });
    }
    async resolveStaticId(staticStorageId) {
        return this.resolveStaticItem(staticStorageId).then(item => item ? item.value : null)
    }
    getUpdatesTopic(cid, type = 'update') {
        return getFluenceUpdatesTopic(cid, type);
    }
    getAccountsGroupUpdatesTopic(accounts, type = 'update') {
        return getFluenceAccountsGroupUpdatesTopic(accounts, type);
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
        return this.publishEventByPrivateKey(peerId._privKey, topic, data);
    }

    async publishEvent(topic, data) {
        const selfPeerId = await this.accStorage.getAccountPeerId('self');
        return this.publishEventByPrivateKey(selfPeerId._privKey, topic, data);
    }

    async subscribeToStaticIdUpdates(ipnsId, callback) {
        return this.subscribeToEvent(this.getUpdatesTopic(ipnsId, 'update'), callback);
    }
    async publishEventByPrivateKey(privateKey, topic, data) {
        privateKey = privateKey.bytes || privateKey;
        const event = await pubSubHelper.buildAndSignFluenceMessage(privateKey, data);
        // console.log('fanout_event', this.peer.relayPeerId, topic, event);
        return this.publishEventByData(topic, event);
    }

    async publishEventByData(topic, event) {
        // console.log('fanout_event', this.peer.relayPeerId, topic, event);
        return new Promise((resolve, reject) => {
            // geesomeCrypto.fanout_event(this.peer, topic, event, (res) => {
            //     // console.log("fanout_event", res);
            //     if (res === 'done') {
            //         return resolve();
            //     } else if (res === 'signature_not_valid') {
            //         return reject('fanout_event failed: signature isnt valid');
            //     }
            // });
        });
    }

    async subscribeToEvent(_topic, _callback, options: any = {}) {
        console.log('initTopicAndSubscribeBlocking', _topic);
        await this.initTopicAndSubscribeBlocking(_topic, _topic, options.tries || 0);
        return this.addTopicSubscriber(_topic, _callback);
    }

    async initTopicAndSubscribeBlocking(topic, value, tries = 0) {
        if(!this.dhtApi) {
            return;
        }
        try {
            const [resId, errors] = await this.dhtApi.createResource(topic); //, value, this.getClientRelayId(), null, () => {}, {}
            if (errors.length) {
                throw new Error(errors[0]);
            }
            await this.dhtApi.registerService(resId, JSON.stringify({value}), this.client.getPeerId(), 'ipns')
        } catch (e) {
            tries--;
            if (tries <= 0) {
                return console.warn('initTopicAndSubscribeBlocking failed', e);
            }
            console.warn('initTopicAndSubscribeBlocking failed, try again...', e);
            await this.client.stop().catch(e => console.warn('peer.stop failed', e));
            await this.client.start();
            return this.initTopicAndSubscribeBlocking(topic, value, tries);
        }
    }

    async resolveStaticItem(staticStorageId) {
        if (!ipfsHelper.isAccountCidHash(staticStorageId)) {
            staticStorageId = await this.accStorage.getAccountStaticId(staticStorageId);
        }
        if(!this.dhtApi) {
            return;
        }
        return this.dhtApi.resolveResource(staticStorageId, 1).then(results => {
            // console.log("subscriber", results[0]);
            let lastItem;
            results.forEach(item => {
                if (!lastItem || item.timestamp_created > lastItem.timestamp_created) {
                    lastItem = item;
                }
            });
            if (lastItem) {
                lastItem.createdAt = lastItem.timestamp_created;
            }
            return lastItem;
        });
    }

    async getStaticIdPeers(ipnsId) {
        let subs = await this.dhtApi.findSubscribers(this.client, this.getUpdatesTopic(ipnsId, 'update'));
        return subs;
    }

    async getPubSubLs() {
        return [null];
    }

    async getPeers(topic) {
        if (!topic) {
            return [];
        }
        let subs = await this.dhtApi.findSubscribers(this.client, topic);
        return subs;
    }

    async stop() {
        return this.client.stop();
    }
}