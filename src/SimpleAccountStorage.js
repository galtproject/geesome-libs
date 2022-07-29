import peerIdHelper from './peerIdHelper.js';
import find from 'lodash/find.js';

export default class SimpleAccountStorage {
    getStorage() {
        // return JSON.parse(fs.existsSync(storagePath) ? fs.readFileSync(storagePath, {encoding: 'utf8'}) : '{}');
        return this.storageData || {};
    }
    setStorage(storageData) {
        // return fs.writeFileSync(storagePath, JSON.stringify(storageData), {encoding: 'utf8'});
        this.storageData = storageData;
    }
    setAccount(name, data) {
        const storageData = this.getStorage();
        if (storageData[name]) {
            return storageData[name];
        }
        if (data) {
            storageData[name] = data;
        } else {
            delete storageData[name];
        }
        this.setStorage(storageData);
        return data;
    }
    destroyStaticId(name) {
        return this.setAccount(name, null);
    }
    getAccount(name) {
        const storageData = this.getStorage();
        return storageData[name] || find(storageData, (account) => account.publicBase58 == name);
    }
    async getAccountPeerId(name) {
        const account = this.getAccount(name);
        return peerIdHelper.createPeerIdFromPrivateBase64(account.privateBase64);
    }
    async getAccountStaticId(name) {
        const account = this.getAccount(name);
        return account.publicBase58;
    }
    async getAccountPublicKey(name) {
        const account = this.getAccount(name);
        return peerIdHelper.base64ToPublicKey(account.publicBase64);
    }
    async createAccount(name) {
        const peerId = await peerIdHelper.createPeerId();
        const privateBase64 = peerIdHelper.peerIdToPrivateBase64(peerId);
        const publicBase64 = peerIdHelper.peerIdToPublicBase64(peerId);
        const publicBase58 = peerIdHelper.peerIdToPublicBase58(peerId);
        return this.setAccount(name, { privateBase64, publicBase64, publicBase58 });
    }
    async getOrCreateAccountStaticId(name, userId = null) {
        const account = this.getAccount(name);
        if (account) {
            return account.publicBase58;
        }
        return this.createAccount(name).then(acc => acc.publicBase58);
    }
};