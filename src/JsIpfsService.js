/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const ipfsHelper = require('./ipfsHelper');

const extend = require('lodash/extend');
const trim = require('lodash/trim');
const isObject = require('lodash/isObject');
const last = require('lodash/last');
const find = require('lodash/find');
const startsWith = require('lodash/startsWith');
const includes = require('lodash/includes');
const isString = require('lodash/isString');

const ipns = require('ipns');
const ipfsImproves = require('./ipfsImproves');
const {promisify} = require('es6-promisify');

const { getIpnsUpdatesTopic } = require('./name');

module.exports = class JsIpfsService {
  constructor(node) {
    this.node = node;
    
    if(node.libp2p) {
      this.fsub = node.libp2p._floodSub;

      ipfsImproves.improveFloodSub(this.fsub);
      ipfsImproves.improvePubSub(this.fsub);
      this.fSubPublishByPeerId = promisify(this.fsub.publishByPeerId).bind(this.fsub);
      this.fSubPublish = promisify(this.fsub.publish).bind(this.fsub);
      this.pubSubSubscribe = promisify(node.pubsub.subscribe).bind(node.pubsub);
    } else {
      console.warn("[JsIpfsService] Warning: libp2p features disabled")
    }

    this.id = promisify(node.id).bind(node);
    this.stop = promisify(node.stop).bind(node);
    this.swarmConnect = promisify(node.swarm.connect).bind(node.swarm);
  }

  async wrapIpfsItem(ipfsItem) {
    return {
      id: ipfsItem.hash,
      path: ipfsItem.path,
      size: ipfsItem.size,
      // storageAccountId: await this.getCurrentAccountId()
    }
  }

  async saveFileByUrl(url) {
    const result = await this.node.addFromURL(url);
    await this.node.pin.add(result[0].hash);
    return this.wrapIpfsItem(result[0]);
  }

  async saveDirectory(path) {
    const result = await this.node.addFromFs(path, {recursive: true, ignore: []});
    const dirName = last(path.split('/'));
    const dirResult = find(result, {path: dirName});
    await this.node.pin.add(dirResult.hash);
    return this.wrapIpfsItem(dirResult);
  }

  async saveBrowserFile(fileObject) {
    const result = await this.node.add(fileObject);
    await this.node.pin.add(result[0].hash);
    return this.wrapIpfsItem(result[0]);
  }

  async saveFileByData(content) {
    if (isString(content)) {
      content = Buffer.from(content, 'utf8');
    }
    return new Promise((resolve, reject) => {
      // if content is stream - subscribe for error
      if(content.on) {
        // TODO: figure out why its not working
        content.on('error', reject);
      }
      this.saveFile({content}).then(resolve).catch(reject);
    });
  }

  async saveFile(options) {
    const result = await this.node.add([options]);
    await this.node.pin.add(result[0].hash);
    return this.wrapIpfsItem(result[0]);
  }

  async getAccountIdByName(name) {
    const keys = await this.node.key.list();
    return (find(keys, {name}) || {}).id || null;
  }

  async getAccountNameById(id) {
    const keys = await this.node.key.list();
    // console.log('keys', id, keys);
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
  
  async getFileStat(filePath) {
    return this.node.files.stat('/ipfs/' + filePath);
  }

  async getFileStream(filePath, options = {}) {
    if(ipfsHelper.isIpfsHash(trim(filePath, '/'))) {
      filePath = trim(filePath, '/');
      const stat = await this.getFileStat(filePath);
      if(stat.type === 'directory') {
        filePath += '/index.html';
      }
    }
    return this.node.catReadableStream(filePath, options);
  }

  getFileData(filePath) {
    return this.node.cat(filePath).then((result) => result);
  }

  async saveObject(objectData) {
    // objectData = isObject(objectData) ? JSON.stringify(objectData) : objectData;
    const savedObj = await this.node.dag.put(objectData);
    const ipldHash = ipfsHelper.cidToHash(savedObj);
    await this.node.pin.add(ipldHash);
    return ipldHash;
  }

  async getObject(storageId) {
    if (ipfsHelper.isCid(storageId)) {
      storageId = ipfsHelper.cidToHash(storageId);
    }
    return this.node.dag.get(storageId).then(response => response.value);
  }

  async getObjectProp(storageId, propName) {
    return this.node.dag.get(storageId + '/' + propName).then(response => response.value);
  }
  
  getObjectRef(storageId) {
    return {
      '/' : storageId
    }
  }

  async bindToStaticId(storageId, accountKey, options = {}) {
    if (startsWith(accountKey, 'Qm')) {
      accountKey = await this.getAccountNameById(accountKey);
    }
    if(!options.lifetime) {
      options.lifetime = '1h';
    }
    return this.node.name.publish(storageId, extend({ key: accountKey }, options)).then(response => response.name);
  }

  async resolveStaticId(staticStorageId) {
    return this.node.name.resolve(staticStorageId).then(response => {
      return (response && response.path ? response.path : response).replace('/ipfs/', '')
    });
  }
  
  async resolveStaticIdEntry(staticStorageId) {
    return new Promise((resolve, reject) => {
      const peerId = ipfsHelper.createPeerIdFromIpns(staticStorageId);
      const { routingKey } = ipns.getIdKeys(peerId.toBytes());

      this.node._ipns.routing.get(routingKey.toBuffer(), (err, record) => {
        if(err) {
          return reject(err);
        }
        const ipnsEntry = ipns.unmarshal(record);

        ipnsEntry.value = ipnsEntry.value.toString('utf8');
        
        this.node._ipns.resolver._validateRecord(peerId, ipnsEntry, (validationErr) => {
          return validationErr ? reject(validationErr) : resolve(ipnsEntry);
        });
      })
    });
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
      this.node.bootstrap.list((err, res) => {
        responded = true;
        return err ? reject(err) : resolve(res.Peers);
      });
    });
  }

  async addBootNode(address) {
    await new Promise((resolve, reject) => {
      this.node.bootstrap.add(address, (err, res) => err ? reject(err) : resolve(res.Peers));
    });
    
    try {
      await this.swarmConnect(address);
    } catch (e) {
      console.warn('addBootNode swarm.connect error', address, e);
    }
  }

  async removeBootNode(address) {
    await new Promise((resolve, reject) => {
      this.node.swarm.disconnect(address, (err, res) => err ? reject(err) : resolve());
    });
    return new Promise((resolve, reject) => {
      this.node.bootstrap.rm(address, (err, res) => err ? reject(err) : resolve(res.Peers))
    });
  }

  async nodeAddressList() {
    return this.id().then(nodeId => nodeId.addresses);
  }
  
  subscribeToIpnsUpdates(ipnsId, callback) {
    const topic = getIpnsUpdatesTopic(ipnsId);
    return this.subscribeToEvent(topic, callback);
  }
  
  publishEventByPeerId(peerId, topic, data) {
    if(isObject(data)) {
      data = JSON.stringify(data);
    }
    if(isString(data)) {
      data = new Buffer(data);
    }
    return this.fSubPublishByPeerId(peerId, topic, data);
  }
  
  async publishEventByIpnsId(ipnsId, topic, data) {
    return this.publishEventByPeerId(await this.getAccountPeerId(ipnsId), topic, data);
  }

  getIpnsPeers(ipnsId) {
    const topic = getIpnsUpdatesTopic(ipnsId);
    return this.getPeers(topic);
  }
  
  getPeers(topic) {
    return this.node.pubsub.peers(topic);
  }

  getPubSubLs() {
    return this.node.pubsub.ls();
  }

  publishEvent(topic, data) {
    if(isObject(data)) {
      data = JSON.stringify(data);
    }
    if(isString(data)) {
      data = new Buffer(data);
    }
    return this.fSubPublish(topic, data);
  }

  subscribeToEvent(topic, callback) {
    return this.pubSubSubscribe(topic, async (event) => {
      ipfsHelper.parsePubSubEvent(event).then(parsedEvent => {
        callback(parsedEvent);
      }).catch((error) => {
        console.warn("PubSub ipns validation failed", event, error);
      })
    });
  }
  
  async keyLookup(accountKey) {
    if (startsWith(accountKey, 'Qm')) {
      accountKey = await this.getAccountNameById(accountKey);
    }
    return new Promise((resolve, reject) => {
      ipfsHelper.keyLookup(this.node, accountKey, (err, res) => {
        return err ? reject(err) : resolve(res);
      })
    });
  }

  async getAccountPeerId(accountKey) {
    const privateKey = await this.keyLookup(accountKey);
    return ipfsHelper.createPeerIdFromPrivKey(privateKey.bytes);
  }

  async getAccountPublicKey(accountKey) {
    // TODO: find the more safety way
    return (await this.keyLookup(accountKey)).public.marshal();
  }
  
  async makeDir(path) {
    return this.node.files.mkdir(path, { parents: true });
  }
  
  async copyFileFromId(storageId, filePath) {
    try {
      const existFiles = await this.node.files.ls(filePath);
      if(existFiles.length) {
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
    const {hash} = await this.node.files.stat(path, {hash: true});
    return hash;
  }
};
