/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */
import itFirst from 'it-first';
import itAll from 'it-all';
import itConcat from 'it-concat';
import itToStream from 'it-to-stream';
import { CID } from 'multiformats';
import { unixfs } from '@helia/unixfs';
import { dagCbor } from '@helia/dag-cbor';
import _ from 'lodash';
import peerIdHelper from './peerIdHelper';
import ipfsHelper from './ipfsHelper';
import common from './common';
import name from './name';
import got from 'got';
const {trim, pick, isObject, find, startsWith, isString, isBuffer, get} = _;

const { getIpnsUpdatesTopic } = name;
common.initializeCustomEvent();
// const pubSubHelper = require('./pubSubHelper');
// const Helia = require('helia');
// const urlSource = require('ipfs-utils/src/files/url-source');

// Keep transport cancellation/deadlines without exposing importer switches that
// could change the established CID or disable the pin/GC safety guarantee.
export function kuboPinnedImportOptions(options = {}) {
  kuboPinProofTimeout(options);
  return {...pick(options, ['timeout', 'signal', 'headers']), pin: true, cidVersion: 1};
}

const defaultPinProofTimeoutMs = 120000;
function proofError(code, cause?) {
  return Object.assign(new Error(code, cause === undefined ? undefined : {cause}), {code});
}
function kuboPinProofTimeout(options: any) {
  const timeout = options.pinProofTimeoutMs === undefined ? defaultPinProofTimeoutMs : options.pinProofTimeoutMs;
  if (!Number.isSafeInteger(timeout) || timeout <= 0) {
    throw proofError('kubo_import_pin_proof_timeout_invalid');
  }
  return timeout;
}
function throwIfProofStopped(signal: AbortSignal) {
  if (signal.aborted) {
    throw signal.reason;
  }
}
function proofRead<T>(pending: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, {once: true});
    Promise.resolve(pending).then(value => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) {
        reject(signal.reason);
      } else {
        resolve(value);
      }
    }, error => {
      signal.removeEventListener('abort', abort);
      reject(signal.aborted ? signal.reason : error);
    });
    if (signal.aborted) {
      abort();
    }
  });
}
function proofPause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) {
      abort();
    }
  });
}
function proofHttpStatus(error) {
  return Number(error?.response?.status || error?.status || error?.statusCode) || null;
}
function proofReadTransient(error) {
  const status = proofHttpStatus(error);
  if (status) {
    return [429, 502, 503, 504].includes(status);
  }
  const network = new Set(['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN',
    'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT']);
  let current = error;
  for (let depth = 0; current && depth < 4; depth++, current = current.cause) {
    if (network.has(current.code) || current instanceof TypeError && current.message === 'fetch failed') {
      return true;
    }
  }
  return false;
}
function proofRetryDelay(error, attempt) {
  const headers = error?.response?.headers || error?.headers;
  const value = typeof headers?.get === 'function' ? headers.get('retry-after') : headers?.['retry-after'];
  if (value == null) {
    return 50 * attempt;
  }
  const text = String(value).trim();
  const milliseconds = /^\d+$/.test(text) ? Number(text) * 1000 : Math.max(0, Date.parse(text) - Date.now());
  // Do not retry early when the server asks for more than this bounded proof can afford.
  return Number.isFinite(milliseconds) && milliseconds >= 0 && milliseconds <= 60000 ? milliseconds : null;
}

export default class JsIpfsService {
  node;
  type;
  id;
  swarmConnect;
  heliaFs;
  heliaCbor;
  stop;

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
      this.heliaCbor = dagCbor(this.node);
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
    return this.saveFile(got.stream(url), options);
  }

  async saveBrowserFile(fileObject, options: any = {}) {
    if (this.type !== 'helia') {
      const result = await this.node.add(fileObject, kuboPinnedImportOptions(options));
      await this.assertKuboRecursivePin(result.cid || result.hash, options);
      return this.wrapIpfsItem(result);
    }
    const result = this.wrapIpfsItem(await this.node.add(fileObject, {pin: false, cidVersion: 1}));
    const pinPromise = this.addPin(result.id);
    if (options.waitForPin) {
      await pinPromise;
    }
    return result;
  }

  async saveFileByData(content, options = {}) {
    if (isString(content)) {
      content = Buffer.from(content, 'utf8');
    }
    return new Promise((resolve, reject) => {
      const onError = error => reject(error);
      const cleanup = () => content.removeListener?.('error', onError);
      // Consume stream errors while import is pending. Keep the handler until
      // the importer settles even when the stream already rejected this promise.
      content.on?.('error', onError);
      let imported;
      try {
        if (this.type === 'helia') {
          imported = content.pipe ? this.heliaFs.addByteStream(content) : this.heliaFs.addBytes(content);
        } else {
          imported = this.saveFile({content}, options);
        }
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }
      Promise.resolve(imported).then(result => {
        cleanup();
        resolve(result);
      }, error => {
        cleanup();
        reject(error);
      });
    });
  }

  async saveFile(data, options: any = {}) {
    let result;
    if (this.type === 'helia') {
      result = await this.saveFileByData(data, options);
      result = this.wrapIpfsItem(await this.heliaFs.stat(result.toString()));
    } else {
      // Kubo pins inside the import, under its own GC coordination. A second
      // pin RPC after an unpinned add would leave a collection race.
      const imported = await this.node.add(data, kuboPinnedImportOptions(options));
      await this.assertKuboRecursivePin(imported.cid || imported.hash, options);
      return this.wrapIpfsItem(imported);
    }
    const pinPromise = this.addPin(result.id);
    if (options.waitForPin) {
      await pinPromise;
    }
    return result;
  }

  async assertKuboRecursivePin(value, options: any = {}) {
    const cid = CID.parse(value.toString()).toV1();
    const timeoutMs = kuboPinProofTimeout(options);
    const deadline = performance.now() + timeoutMs;
    const controller = new AbortController();
    const parent = options.signal;
    const abort = () => controller.abort(parent.reason);
    const timeout = setTimeout(() => controller.abort(proofError('kubo_import_pin_proof_timeout')), timeoutMs);
    parent?.addEventListener('abort', abort, {once: true});
    if (parent?.aborted) {
      abort();
    }
    const signal = controller.signal;
    const check = () => {
      if (!signal.aborted && performance.now() >= deadline) {
        controller.abort(proofError('kubo_import_pin_proof_timeout'));
      }
      throwIfProofStopped(signal);
    };
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        check();
        let found = false;
        let iterator;
        let consumed = false;
        try {
          // A proof has its own budget after import; retries share this same deadline.
          iterator = this.node.pin.ls({...pick(options, ['headers']), paths: [cid], type: 'recursive',
            timeout: Math.max(1, Math.ceil(deadline - performance.now())), signal})[Symbol.asyncIterator]();
          while (true) {
            check();
            const next: any = await proofRead(iterator.next(), signal);
            check();
            if (next.done) {
              consumed = true;
              break;
            }
            const pin = next.value;
            if (pin.type === 'recursive' && pin.cid && CID.parse(pin.cid.toString()).toV1().equals(cid)) {
              found = true;
            }
          }
          if (!found) {
            throw proofError('kubo_import_pin_unconfirmed');
          }
          return;
        } catch (error) {
          check();
          const status = proofHttpStatus(error);
          if (error?.code === 'kubo_import_pin_unconfirmed'
            || status !== 401 && status !== 403 && /\b(?:not pinned|not recursively pinned)\b/i.test(error?.message || '')) {
            throw proofError('kubo_import_pin_unconfirmed', error);
          }
          if (attempt === 3 || !proofReadTransient(error)) {
            throw proofError('kubo_import_pin_proof_unavailable', error);
          }
          const wait = proofRetryDelay(error, attempt);
          if (wait === null || wait >= deadline - performance.now()) {
            throw proofError('kubo_import_pin_proof_unavailable', error);
          }
          await proofPause(wait, signal);
        } finally {
          // A non-cooperating iterator must not keep the proof outcome pending.
          // The supplied AbortSignal closes real RPCs; consume any late rejection.
          if (!consumed && iterator?.return) {
            try {
              void Promise.resolve(iterator.return()).catch(() => {});
            } catch {
              // Preserve the proof failure, including cancellation.
            }
          }
        }
      }
    } finally {
      clearTimeout(timeout);
      parent?.removeEventListener('abort', abort);
    }
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
      const stat: any = await this.getFileStat(firstPart);
      if (stat.type === 'directory') {
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

  async saveObject(objectData, options: any = {}) {
    // objectData = isObject(objectData) ? JSON.stringify(objectData) : objectData;

    objectData = common.sortObject(objectData);
    let cid;
    if (this.type === 'helia') {
      cid = await this.heliaCbor.add(objectData);
    } else {
      kuboPinProofTimeout(options);
      cid = await this.node.dag.put(objectData, {...pick(options, ['timeout', 'signal', 'headers']),
        storeCodec: 'dag-cbor', hashAlg: 'sha2-256', pin: true});
      await this.assertKuboRecursivePin(cid, options);
      return ipfsHelper.cidToHash(cid);
    }
    const ipldHash = ipfsHelper.cidToHash(cid);

    const pinPromise = this.addPin(ipldHash);
    if (options.waitForPin) {
      await pinPromise;
    }
    return ipldHash;
  }

  async getObjectPure(cid, options: any = {}) {
    if (this.type === 'helia') {
      return this.heliaCbor.get(cid, options).then(response => {
        if (!options.path) {
          return {value: response};
        }
        let splitPath = options.path.split('/'), pathIndex = 0;
        while (!ipfsHelper.isIpfsHash(response)) {
          response = response[splitPath[pathIndex]];
          if (pathIndex === splitPath.length - 1) {
            return {value: response, remainderPath: splitPath.slice(pathIndex + 1).join('/')};
          }
          pathIndex++;
        }
        return {value: response, remainderPath: splitPath.slice(pathIndex).join('/')};
      });
    } else {
      return this.node.dag.get(cid, options).then((res) => {
        // console.log('node.dag.get', res);
        let {value, remainderPath} = res;
        if (isObject(value) && remainderPath && get(value, remainderPath.replace('/', '.'))) {
          // console.log('value = ', get(value, remainderPath.replace('/', '.')));
          value = get(value, remainderPath.replace('/', '.'));
          remainderPath = undefined;
        }
        return {value, remainderPath};
      });
    }
  }

  async getObject(storageId, resolveProp = true) {
    const splitStorageId = storageId.split('/');
    if (splitStorageId.length > 1) {
      return this.getObjectProp(splitStorageId[0], splitStorageId.slice(1).join('/'), resolveProp);
    }
    if (!ipfsHelper.isCid(storageId)) {
      storageId = CID.parse(storageId);
    }
    return this.getObjectPure(storageId).then(response => response.value);
  }

  async getObjectProp(storageId, propName, resolveProp = true) {
    // console.log('getObjectProp storageId', storageId, 'propName', propName);
    if (!ipfsHelper.isCid(storageId)) {
      storageId = CID.parse(storageId)
    }
    let options = {localResolve: true};
    if (propName) {
      options['path'] = this.type === 'helia' ? propName : '/' + propName + '/';
    }
    let {value, remainderPath} = await this.getObjectPure(storageId, options);
    // console.log('ipfsHelper.isIpfsHash(value)', ipfsHelper.isIpfsHash(value), 'resolveProp', resolveProp);
    if (ipfsHelper.isIpfsHash(value) && resolveProp) {
      return this.getObjectProp(ipfsHelper.ipfsHashToCid(value), remainderPath, true);
    } else {
      return value;
    }
  }

  async bindToStaticId(storageId, accountKey, options: any = {}) {
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
    return itFirst(this.node.name.resolve(name)).then((h: string) => h.replace('/ipfs/', ''));
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
      addresses = addresses.filter(a => !a.includes('/127.0.0.1/'))
      types.forEach(type => {
        addresses = addresses.filter(a => a.includes('/' + type + '/'))
      });
      return addresses;
    });
  }

  async addPin(hash) {
    // console.log('this.node', this.node);
    hash = ipfsHelper.ipfsHashToCid(hash);
    if (this.type === 'helia') {
      for await (const val of this.node.pins.add(hash)) {
        console.log(new Date().toISOString().slice(0, 19).replace('T', ' '), 'pinned:', hash);
      }
    } else {
      this.node.pin.add(hash).then(() => {
        console.log(new Date().toISOString().slice(0, 19).replace('T', ' '), 'pinned:', hash);
      });
    }
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

  async nodeLs(filePath, single = false) {
    if (this.type === 'helia') {
      return single ? itFirst(this.heliaFs.ls(filePath)) : itAll(this.heliaFs.ls(filePath));
    } else {
      return single ? itFirst(this.node.ls(filePath)) : itAll(this.node.ls(filePath));
    }
  }

  async fileLs(filePath, single = false) {
    if (this.type === 'helia') {
      return single ? itFirst(this.heliaFs.ls(filePath)) : itAll(this.heliaFs.ls(filePath));
    } else {
      return single ? itFirst(this.node.files.ls(filePath)) : itAll(this.node.files.ls(filePath));
    }
  }

  async copyFileFromId(storageId, filePath) {
    try {
      const exist = await this.fileLs(filePath, true);
      if(exist) {
        await this.node.files.rm(filePath);
      }
    } catch (e) {
      if(!e.message.includes('file does not exist')) {
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
