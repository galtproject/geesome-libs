const dhtApi = require('./dht-api');
const startsWith = require('lodash/startsWith');

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
        console.log('bindToStaticId', storageId, accountKey);

        await dhtApi.initTopicAndSubscribe(this.client, this.client.relayPeerId, accountKey, storageId, this.client.relayPeerId, null, () => {});
        return accountKey;
    }
    async resolveStaticId(staticStorageId) {
        console.log('resolveStaticId', staticStorageId);
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

    async publishEvent(topic, data) {
        return null;
    }

    async subscribeToStaticIdUpdates(ipnsId, callback) {
        return null;
    }

    subscribeToEvent(topic, callback) {
        return dhtApi.initTopicAndSubscribe(this.client, this.client.relayPeerId, topic, null, this.client.relayPeerId, null, callback);
    }

    async getStaticIdPeers(ipnsId) {
        return [null];
    }

    async getPubSubLs() {
        return [null];
    }

    async getPeers(topic) {
        return [null];
    }
}