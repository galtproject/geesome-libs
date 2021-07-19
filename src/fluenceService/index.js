const dhtApi = require('./dht-api');
const startsWith = require('lodash/startsWith');
const isObject = require('lodash/isObject');
const isString = require('lodash/isString');
const ipfsHelper = require('../ipfsHelper');
const { subscribeToEvent } = require('@fluencelabs/fluence');

module.exports = class FluenceService {
    constructor(accStorage, client) {
        this.accStorage = accStorage;
        this.client = client;
    }
    async bindToStaticId(storageId, accountKey, options = null) {
        if (!startsWith(accountKey, 'Qm')) {
            if (accountKey === 'self') {
                accountKey = await this.accStorage.getOrCreateAccountStaticId(accountKey);
            } else {
                accountKey = await this.accStorage.getAccountStaticId(accountKey);
            }
        }
        await dhtApi.initTopicAndSubscribe(this.client, this.client.relayPeerId, accountKey, storageId, this.client.relayPeerId, null, () => {});
        return accountKey;
    }
    async resolveStaticId(staticStorageId) {
        if (!startsWith(staticStorageId, 'Qm')) {
            staticStorageId = await this.accStorage.getAccountStaticId(staticStorageId);
        }
        return dhtApi.findSubscribers(this.client, this.client.relayPeerId, staticStorageId).then(results => {
            console.log("subscriber", results[0]);
            return results[0] && results[0].value;
        });
    }
    async removeAccountIfExists(name) {
        return this.accStorage.destroyStaticId(name);
    }
    async getAccountIdByName(name) {
        return this.accStorage.getAccountStaticId(name);
    }
    async createAccountIfNotExists(name) {
        return this.accStorage.getOrCreateAccountStaticId(name);
    }

    async getAccountPeerId(key) {
        return this.accStorage.getAccountPeerId(key);
    }

    async getAccountPublicKey(key) {
        return this.accStorage.getAccountPublicKey(key);
    }

    async getCurrentAccountId() {
        return this.accStorage.getOrCreateAccountStaticId('self');
    }

    async resolveStaticIdEntry(staticStorageId) {
        return this.resolveStaticId(staticStorageId).then(async r => ({pubKey: await this.accStorage.getAccountPublicKey(r)}))
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
        return null;
    }

    async publishEventByPeerId(peerId, topic, data) {
        return this.publishEventByPrivateKey(peerId._privKey, topic, data);
    }

    async publishEvent(topic, data) {
        await this.accStorage.getOrCreateAccountStaticId('self');
        const selfPeerId = await this.accStorage.getAccountPeerId('self');
        return this.publishEventByPrivateKey(selfPeerId._privKey, topic, data);
    }

    async subscribeToStaticIdUpdates(ipnsId, callback) {

    }
    async publishEventByPrivateKey(privateKey, topic, data) {
        if(isObject(data)) {
            data = JSON.stringify(data);
        }
        if(isString(data)) {
            data = Buffer.from(data);
        }
        privateKey = privateKey.bytes || privateKey;
        const event = await ipfsHelper.buildAndSignFluenceMessage(privateKey, data);
        // console.log('fanout_event', this.client.relayPeerId, topic, event);
        return dhtApi.fanout_event(this.client, this.client.relayPeerId, topic, event, (log) => {
            console.log(log);
        });
    }

    async subscribeToEvent(_topic, _callback) {
        // console.log('initTopicAndSubscribe', this.client.relayPeerId, _topic, this.client.relayPeerId);
        await dhtApi.initTopicAndSubscribe(this.client, this.client.relayPeerId, _topic, _topic, this.client.relayPeerId, null, () => {});
        subscribeToEvent(this.client, 'api', 'receive_event', async (args, _tetraplets) => {
            // console.log('subscribeToEvent', args, _tetraplets);
            let topic = args[0];
            let event = args[1];
            if (topic === _topic) {
                _callback(await ipfsHelper.parseFluenceEvent(event));
            }
        });
    }

    async getStaticIdPeers(ipnsId) {
        return [null];
    }

    async getPubSubLs() {
        return [null];
    }

    async getPeers(topic) {
        if (!topic) {
            return [];
        }
        return dhtApi.findSubscribers(this.client, this.client.relayPeerId, topic);
    }
}