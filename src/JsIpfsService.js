/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const ipfsHelper = require('./ipfsHelper');
const peerIdHelper = require('./peerIdHelper');
const common = require('./common');

const trim = require('lodash/trim');
const isObject = require('lodash/isObject');
const find = require('lodash/find');
const startsWith = require('lodash/startsWith');
const includes = require('lodash/includes');
const isString = require('lodash/isString');
const isBuffer = require('lodash/isBuffer');
const get = require('lodash/get');
const urlSource = require('ipfs-utils/src/files/url-source');
const itFirst = require('it-first');
const itConcat = require('it-concat');
const itToStream = require('it-to-stream');
const { CID } = require('multiformats/cid');
// const routingConfig = require('ipfs/packages/ipfs-core/src/ipns/routing/config')
// const resolver = require('ipfs/packages/ipfs-core/src/ipns/resolver')


const IPNS = require('ipns');

const { getIpnsUpdatesTopic } = require('./name');

module.exports = class JsIpfsService {
  constructor(node) {
    this.node = node;
    // const {libp2p, peerId} = this.node;
    // const repo = {datastore: libp2p.datastore};
    // this.ipnsRouting = routingConfig({ libp2p, repo, peerId, options: { EXPERIMENTAL: {ipnsPubsub: true} } })
    // this.ipnsResolver = new resolver(this.ipnsRouting)
    this.id = node.id.bind(node);
    this.stop = node.stop.bind(node);
    this.swarmConnect = node.swarm.connect.bind(node.swarm);
  }

  isStreamAddSupport() {
    return true;
  }

  wrapIpfsItem(ipfsItem) {
    if(!ipfsItem.hash) {
      ipfsItem.hash = ipfsHelper.cidToIpfsHash(ipfsItem.cid);
    }
    return {
      id: ipfsItem.hash,
      path: ipfsItem.path,
      size: ipfsItem.size,
      // storageAccountId: await this.getCurrentAccountId()
    }
  }

  async saveFileByUrl(url, options = {}) {
    let result = await this.node.add(urlSource(url), {pin: false});
    result = this.wrapIpfsItem(result);
    const pinPromise = this.addPin(result.id);
    if(options.waitForPin) {
      await pinPromise;
    }
    return result;
  }

  async saveBrowserFile(fileObject, options = {}) {
    let result = await this.node.add(fileObject, {pin: false});
    result = this.wrapIpfsItem(result);
    const pinPromise = this.addPin(result.id);
    if(options.waitForPin) {
      await pinPromise;
    }
    return result;
  }

  async saveFileByData(content, options = {}) {
    if (isString(content)) {
      content = Buffer.from(content, 'utf8');
    }
    return new Promise((resolve, reject) => {
      // if content is stream - subscribe for error
      if(content.on) {
        // TODO: figure out why its not working
        content.on('error', reject);
      }
      this.saveFile({content}, options).then(resolve).catch(reject);
    });
  }

  async saveFile(data, options = {}) {
    let result = await this.node.add([data], {pin: false});
    result = this.wrapIpfsItem(result);
    const pinPromise = this.addPin(result.id);
    if(options.waitForPin) {
      await pinPromise;
    }
    return result;
  }

  async getAccountIdByName(name) {
    const keys = await this.node.key.list();
    return (find(keys, {name}) || {}).id || null;
  }

  async getAccountNameById(id) {
    const keys = await this.node.key.list();
    return (find(keys, {id}) || {}).name || null;
  }

  async getCurrentAccountId() {
    return this.getAccountIdByName('self');
  }

  async createAccountIfNotExists(name) {
    const accountId = await this.getAccountIdByName(name);
    if (accountId) {
      return accountId;
    }
    return this.node.key.gen(name, {
      type: 'rsa',
      size: 2048
    }).then(result => result.id);
  }

  async removeAccountIfExists(name) {
    const accountId = await this.getAccountIdByName(name);
    if (!accountId) {
      return;
    }
    return this.node.key.rm(name);
  }

  async getFileStat(filePath, options = {attempts: 3, attemptTimeout: 2000}) {
    console.log('getFileStat', filePath, options);
    let resolved = false;

    return new Promise(async (resolve, reject) => {
      setTimeout(() => {
        if (!resolved && options.attempts > 0) {
          resolve(this.getFileStat(filePath, {
            ...options,
            attempts: options.attempts - 1
          }));
        }
      }, options.attemptTimeout);

      this.node.files.stat('/ipfs/' + filePath).then((r) => {
        resolved = true;
        resolve(r);
      });
    });
  }

  async getFileStream(filePath, options = {}) {
    if(ipfsHelper.isIpfsHash(trim(filePath, '/'))) {
      filePath = trim(filePath, '/');
      const stat = await this.getFileStat(filePath);
      if(stat.type === 'directory') {
        filePath += '/index.html';
      }
    }
    return itToStream(this.node.cat(filePath, options));
  }

  getFileData(filePath) {
    return itConcat(this.node.cat(filePath));
  }

  getFileDataText(filePath) {
    return this.getFileData(filePath).then(response => response.toString());
  }

  async saveObject(objectData, options = {}) {
    // objectData = isObject(objectData) ? JSON.stringify(objectData) : objectData;

    objectData = common.sortObject(objectData);
    const savedObj = await this.node.dag.put(objectData, {format: 'dag-cbor', hashAlg: 'sha2-256'});
    const ipldHash = ipfsHelper.cidToHash(savedObj);

    const pinPromise = this.addPin(ipldHash);
    if(options.waitForPin) {
      await pinPromise;
    }
    return ipldHash;
  }

  async getObject(storageId, resolveProp = true) {
    const splitStorageId = storageId.split('/');
    if (splitStorageId.length > 1) {
      return this.getObjectProp(splitStorageId[0], splitStorageId.slice(1).join('/'), resolveProp);
    }
    if (!ipfsHelper.isCid(storageId)) {
      storageId = CID.parse(storageId)
    }
    return this.node.dag.get(storageId).then(response => response.value);
  }

  async getObjectProp(storageId, propName, resolveProp = true) {
    if (!ipfsHelper.isCid(storageId)) {
      storageId = CID.parse(storageId)
    }
    const path = '/' + propName + '/';
    const result = await this.node.dag.get(storageId, {path, localResolve: true});
    let {value, remainderPath} = result;
    if (isObject(value) && remainderPath && get(value, remainderPath.replace('/', '.'))) {
      value = get(value, remainderPath.replace('/', '.'));
      remainderPath = undefined;
    }
    return ipfsHelper.isIpldHash(value) && resolveProp ? this.node.dag.get(ipfsHelper.ipfsHashToCid(value), {path: remainderPath, localResolve: !resolveProp}).then(response => response.value) : value;
  }

  async bindToStaticId(storageId, accountKey, options = {}) {
    if (startsWith(accountKey, 'Qm')) {
      accountKey = await this.getAccountNameById(accountKey);
    }
    if(!options.lifetime) {
      options.lifetime = '1h';
    }
    return this.node.name.publish(storageId, { key: accountKey, allowOffline: true, ...options }).then(response => response.name);
  }

  async resolveStaticId(staticStorageId) {
    //TODO: support more then 1 value
    const name = '/ipns/' + staticStorageId;
    return itFirst(this.node.name.resolve(name)).then(h => h.replace('/ipfs/', ''));
  }

  async resolveStaticIdEntry(staticStorageId) {
    const peerId = peerIdHelper.createPeerIdFromIpns(staticStorageId);
    const { routingKey } = IPNS.getIdKeys(peerId.toBytes());
    const record = await this.ipnsRouting.get(routingKey.uint8Array());
    const ipnsEntry = IPNS.unmarshal(record);
    const valid = await this.ipnsResolver._validateRecord(peerId, ipnsEntry);
    if(valid) {
      return ipnsEntry;
    } else {
      throw "record not valid"
    }
  }

  async getBootNodeList() {
    return new Promise((resolve, reject) => {
      let responded = false;
      setTimeout(() => {
        if (responded) {
          return;
        }
        reject('Failed to fetch');
      }, 1000);
      this.node.bootstrap.list().then(res => {
        responded = true;
        resolve(res.Peers);
      });
    });
  }

  async addBootNode(address) {
    await this.node.bootstrap.add(address);

    try {
      await this.swarmConnect(address);
    } catch (e) {
      console.warn('addBootNode swarm.connect error', address, e);
    }
  }

  async removeBootNode(address) {
    await this.node.swarm.disconnect(address);
    return this.node.bootstrap.rm(address).then(res => res.Peers);
  }

  async nodeAddressList() {
    return this.id().then(nodeId => nodeId.addresses);
  }

  addPin(hash) {
    return this.node.pin.add(hash).then(() => {
      console.log(new Date().toISOString().slice(0, 19).replace('T', ' '), 'pinned:', hash);
    });
  }

  getPins(hash) {
    return this.node.pin.ls(hash);
  }

  unPin(hash, options = {recursive: true}) {
    return this.node.pin.rm(hash, options);
  }

  remove(hash, options = {recursive: true}) {
    return this.node.files.rm('/ipfs/' + hash, options);
  }

  subscribeToStaticIdUpdates(staticId, callback) {
    const topic = getIpnsUpdatesTopic(staticId);
    return this.subscribeToEvent(topic, callback);
  }

  async publishEventByPrivateKey(privateKey, topic, data) {
    if(isObject(data)) {
      data = JSON.stringify(data);
    }
    if(isString(data)) {
      data = Buffer.from(data);
    }
    privateKey = privateKey.bytes || privateKey;
    const message = await ipfsHelper.buildAndSignPubSubMessage(privateKey, [topic], data);
    return this.node.pubsub.publishMessage(message);
  }

  async publishEventByStaticId(staticId, topic, data, pass) {
    return this.publishEventByPrivateKey(await this.keyLookup(staticId, pass), topic, data);
  }

  async publishEventByPeerId(peerId, topic, data) {
    return this.publishEventByPrivateKey(peerId._privKey, topic, data);
  }

  getStaticIdPeers(staticId) {
    const topic = getIpnsUpdatesTopic(staticId);
    return this.getPeers(topic);
  }

  async getPeers(topic) {
    return this.node.pubsub.peers(topic);
  }

  async getPubSubLs() {
    return this.node.pubsub.ls();
  }

  publishEvent(topic, data) {
    if(isObject(data)) {
      data = JSON.stringify(data);
    }
    if(isString(data)) {
      data = Buffer.from(data);
    }
    return this.node.pubsub.publish(topic, data);
  }

  subscribeToEvent(topic, callback) {
    return this.node.pubsub.subscribe(topic, async (event) => {
      ipfsHelper.parsePubSubEvent(event).then(parsedEvent => {
        callback(parsedEvent);
      }).catch((error) => {
        console.warn("PubSub ipns validation failed", event, error);
      })
    });
  }

  async keyLookup(accountKey, pass) {
    if (startsWith(accountKey, 'Qm')) {
      accountKey = await this.getAccountNameById(accountKey);
    }
    return ipfsHelper.keyLookup(this.node, accountKey, pass);
  }

  async getAccountPeerId(accountKey, pass) {
    // TODO: find the more safety way
    const privateKey = await this.keyLookup(accountKey, pass);
    return peerIdHelper.createPeerIdFromPrivKey(Buffer.from(privateKey.bytes));
  }

  async getAccountPublicKey(accountKey, pass) {
    // TODO: find the more safety way
    const key = (await this.keyLookup(accountKey, pass)).public.marshal();
    return isBuffer(key) ? key : Buffer.from(key);
  }

  async makeDir(path) {
    return this.node.files.mkdir(path, { parents: true });
  }

  async copyFileFromId(storageId, filePath) {
    try {
      const exist = await itFirst(this.node.files.ls(filePath));
      if(exist) {
        await this.node.files.rm(filePath);
      }
    } catch (e) {
      if(!includes(e.message, 'file does not exist')) {
        console.error('copyFileFromId error:');
        throw e;
      }
    }
    return this.node.files.cp('/ipfs/' + storageId, filePath, { parents: true });
  }

  async getDirectoryId(path) {
    let {hash, cid} = await this.node.files.stat(path, {hash: true});
    if (!hash) {
      hash = ipfsHelper.cidToIpfsHash(cid);
    }
    return hash;
  }
};
