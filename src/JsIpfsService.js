/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

global.CustomEvent = class CustomEvent extends Event {
  #detail;

  constructor(type, options) {
    super(type, options);
    this.#detail = options?.detail ?? null;
  }

  get detail() {
    return this.#detail;
  }
}

import ipfsHelper from './ipfsHelper';
import peerIdHelper from './peerIdHelper';
// const pubSubHelper = require('./pubSubHelper');
import common from './common';

import trim from 'lodash/trim.js';
import pick from 'lodash/pick';
import isObject from 'lodash/isObject';
import find from 'lodash/find';
import startsWith from 'lodash/startsWith';
import includes from 'lodash/includes';
import isString from 'lodash/isString';
import isBuffer from 'lodash/isBuffer';
import get from 'lodash/get';
// const urlSource = require('ipfs-utils/src/files/url-source');
import itFirst from 'it-first';
import itConcat from 'it-concat';
import itToStream from 'it-to-stream';
import { CID } from 'multiformats/cid';

// const Helia = require('helia');
import got from 'got';

import name from './name';
const { getIpnsUpdatesTopic } = name;
import { unixfs } from '@helia/unixfs';

export default class JsIpfsService {
  constructor(node, type = 'helia') {
    this.node = node;
    this.type = type;
    if (type === 'helia') {
      this.id = async () => ({
        id: node.libp2p.peerId,
        multiaddrs: node.libp2p.getMultiaddrs()
      });
      this.swarmConnect = node.libp2p.dial.bind(node.libp2p);
      this.heliaFs = unixfs(this.node);
    } else {
      this.id = node.id.bind(node);
      this.swarmConnect = node.swarm.connect.bind(node.swarm);
    }
    this.stop = node.stop.bind(node);
  }

  async init() {
  }

  isStreamAddSupport() {
    return true;
  }

  async saveFileByUrl(url, options = {}) {
    return this.saveFile(got.stream(url));
  }

  async saveBrowserFile(fileObject, options = {}) {
    let result = await this.node.add(fileObject, {pin: false, cidVersion: 1});
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
      if (this.type === 'helia') {
        if (content.pipe) {
          //https://github.com/ipfs-examples/helia-examples/blob/main/examples/helia-create-car/test/index.spec.js
          return resolve(this.heliaFs.addByteStream(content));
        } else {
          //https://github.com/ipfs/helia/wiki/Migrating-from-js-IPFS
          console.log('this.heliaFs.addBytes');
          return resolve(this.heliaFs.addBytes(content));
        }
      } else {
        //https://github.com/ipfs/js-kubo-rpc-client
      }
    });
  }

  async saveFile(data, options = {}) {
    let result = await this.saveFileByData(data);
    result = this.wrapIpfsItem(await this.heliaFs.stat(result));
    // const pinPromise = this.addPin(result.id);
    // if (options.waitForPin) {
    //   await pinPromise;
    // }
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

  async getFileStat(filePath, options = {attempts: 3, attemptTimeout: 2000, withLocal: true, size: true}) {
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

      this.node.files.stat('/ipfs/' + filePath, pick(options, ['hash', 'size', 'withLocal', 'timeout', 'signal'])).then((r) => {
        if (r) {
          resolved = true;
          resolve(r);
        } else {
          reject(new Error('empty_response_error'));
        }
      }).catch(e => reject(e));
    });
  }

  async getFileStream(filePath, options = {}) {
    const firstPart = trim(filePath, '/').split('/')[0];
    if (ipfsHelper.isIpfsHash(firstPart) && filePath.slice(-1) === '/') {
      filePath = trim(filePath, '/');
      const stat = await this.getFileStat(firstPart);
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
    const savedObj = await this.node.dag.put(objectData, {storeCodec: 'dag-cbor', inputCodec: 'dag-cbor', format: 'dag-cbor', hashAlg: 'sha2-256'});
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
    return ipfsHelper.isIpfsHash(value) && resolveProp ? this.node.dag.get(ipfsHelper.ipfsHashToCid(value), {path: remainderPath, localResolve: !resolveProp}).then(response => response.value) : value;
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

  // async resolveStaticIdEntry(staticStorageId) {
  //   const peerId = peerIdHelper.createPeerIdFromIpns(staticStorageId);
  //   const { routingKey } = IPNS.getIdKeys(peerId.toBytes());
  //   const record = await this.ipnsRouting.get(routingKey.uint8Array());
  //   const ipnsEntry = IPNS.unmarshal(record);
  //   const valid = await this.ipnsResolver._validateRecord(peerId, ipnsEntry);
  //   if(valid) {
  //     return ipnsEntry;
  //   } else {
  //     throw "record not valid"
  //   }
  // }

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

  async remoteNodeAddressList(types = []) {
    return this.nodeAddressList().then(addresses => {
      addresses = addresses.filter(a => !includes(a, '/127.0.0.1/'))
      types.forEach(type => {
        addresses = addresses.filter(a => includes(a, '/' + type + '/'))
      });
      return addresses;
    });
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

  // subscribeToStaticIdUpdates(staticId, callback) {
  //   const topic = getIpnsUpdatesTopic(staticId);
  //   return this.subscribeToEvent(topic, callback);
  // }

  // async publishEventByPrivateKey(privateKey, topic, data) {
  //   if(isObject(data)) {
  //     data = JSON.stringify(data);
  //   }
  //   if(isString(data)) {
  //     data = Buffer.from(data);
  //   }
  //   privateKey = privateKey.bytes || privateKey;
  //   const message = await pubSubHelper.buildAndSignPubSubMessage(privateKey, [topic], data);
  //   return this.node.pubsub.publishMessage(message);
  // }

  // async publishEventByStaticId(staticId, topic, data, pass) {
  //   return this.publishEventByPrivateKey(await this.keyLookup(staticId, pass), topic, data);
  // }

  // async publishEventByPeerId(peerId, topic, data) {
  //   return this.publishEventByPrivateKey(peerId._privKey, topic, data);
  // }

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
    if (isObject(data)) {
      data = JSON.stringify(data);
    }
    if (isString(data)) {
      data = Buffer.from(data);
    }
    return this.node.pubsub.publish(topic, data);
  }

  // subscribeToEvent(topic, callback) {
  //   return this.node.pubsub.subscribe(topic, async (event) => {
  //     pubSubHelper.parsePubSubEvent(event).then(parsedEvent => {
  //       callback(parsedEvent);
  //     }).catch((error) => {
  //       console.warn("PubSub ipns validation failed", event, error);
  //     })
  //   });
  // }

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

  async fileLs(filePath) {
    return itFirst(this.node.files.ls(filePath));
  }

  async copyFileFromId(storageId, filePath) {
    try {
      const exist = await this.fileLs(filePath);
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

  wrapIpfsItem(ipfsItem) {
    if(!ipfsItem.hash) {
      ipfsItem.hash = ipfsHelper.cidToIpfsHash(ipfsItem.cid);
    }
    return {
      id: ipfsItem.hash,
      path: '/ipfs/' + ipfsItem.hash, //ipfsItem.path,
      size: ipfsItem.fileSize,
      // storageAccountId: await this.getCurrentAccountId()
    }
  }
};
