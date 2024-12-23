/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import _ from 'lodash';
import axios from 'axios';
import pIteration from 'p-iteration';
import geesomeWalletClientLib from 'geesome-wallet-client/src/lib.js';
import JsIpfsService from './JsIpfsService';
import ipfsHelper from './ipfsHelper';
import commonHelper from './common';
import pgpHelper from './pgpHelper';
import trie from './base36Trie';
import common from './common';
import name from './name';

const {extend, get, set, isObject, forEach, isUndefined, range, merge, find, filter, startsWith, pick, isEmpty} = _;
const {extractHostname, isIpAddress, isNumber} = common;
const {getGroupUpdatesTopic, getPersonalChatTopic} = name;

class GeesomeClient {
  server;
  apiKey;
  ipfsNode;
  clientStorage;
  $http;
  ipfsService;
  serverLessMode;
  ipfsIddleTime;
  _privateKey;
  communicator;
  decryptedSocNetCache = {};

  constructor(config: any = {}) {
    this.server = config.server;
    if (commonHelper.isUndefined(this.server)) {
      this.setServerByDocumentLocation();
    }
    this.apiKey = config.apiKey;
    this.ipfsNode = config.ipfsNode;

    this.clientStorage = config.clientStorage;

    this.$http = axios.create({});

    this.ipfsService = null;
    this.serverLessMode = isUndefined(config.serverLessMode) ? true : config.serverLessMode;
    // wait for respond of ipfs in miliseconds, until send request to server
    this.ipfsIddleTime = 1000;
  }

  async init() {
    await this.setServer(this.server);
    this.setApiKey(this.apiKey);
    if (this.ipfsNode) {
      await this.setIpfsNode(this.ipfsNode);
    }
  }

  getRequest(url, options = null) {
    return this.wrapResponse(this.$http.get('/v1/' + url, options));
  }

  postRequest(url, data = null, options = null) {
    return this.wrapResponse(this.$http.post('/v1/' + url, data, options));
  }

  wrapResponse(httPromise) {
    return httPromise.then(response => response.data).catch(err => {
      throw (err.response ? err.response.data : err.message);
    });
  }

  getCurrentUser() {
    return this.getRequest('user').then(async user => {
      user.foreignAccounts = await this.getUserAccounts();
      this.serverLessMode = false;
      return user;
    }).catch((err) => {
      this.serverLessMode = true;
      throw (err);
    });
  }

  setUserAccount(accountData) {
    return this.postRequest('user/set-account', accountData);
  }

  getUserAccounts() {
    return this.getRequest('user/get-accounts');
  }

  async exportPrivateKey() {
    this._privateKey = await this.postRequest(`user/export-private-key`).then(res => res.result);
  }

  async decryptText(encryptedText) {
    if (!this._privateKey) {
      await this.exportPrivateKey();
    }
    const pgpPrivateKey = await pgpHelper.transformKey(Buffer.from(this._privateKey));

    return pgpHelper.decrypt([pgpPrivateKey], [], encryptedText);
  }

  async setServer(server) {
    this.server = server;
    this.$http.defaults.baseURL = server;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;

    this.$http.defaults.headers.post['Authorization'] = 'Bearer ' + apiKey;
    this.$http.defaults.headers.get['Authorization'] = 'Bearer ' + apiKey;

    if (!apiKey) {
      this.serverLessMode = true;
    }
  }

  setCommunicator(communicator) {
    this.communicator = communicator;
  }

  async setIpfsNode(ipfsNode, ipfsIddleTime = 1000) {
    this.ipfsNode = ipfsNode;
    this.ipfsService = new JsIpfsService(this.ipfsNode);
    this.ipfsIddleTime = ipfsIddleTime;
    if (!this.serverLessMode) {
      await this.connectToIpfsNodeToServer().catch((e) => {
        console.warn('connectToIpfsNodeToServer error', e);
      });
    }
  }

  async loginPassword(username, password) {
    return this.postRequest('login/password', {username, password}).then(data => {
      this.setApiKey(data.apiKey);
      this.serverLessMode = false;
      return data;
    });
  }

  async loginAuthMessage(authMessageId, accountAddress, signature, params = {}) {
    return this.postRequest('login/auth-message', {authMessageId, accountAddress, signature, params}).then(data => {
      this.setApiKey(data.apiKey);
      this.serverLessMode = false;
      return data;
    });
  }

  async generateAuthMessage(accountProvider, accountAddress) {
    return this.postRequest('generate-auth-message', {accountProvider, accountAddress});
  }

  async logout() {
    this.setApiKey(null);
    //TODO: send request to server for disable api key
  }

  isNodeEmpty() {
    return this.getRequest(`is-empty`).then(r => r.result);
  }

  setup(setupData) {
    return this.postRequest(`setup`, setupData).then(data => {
      this.setApiKey(data.apiKey);
      return data;
    });
  }

  async socNetNamesList() {
    return this.getRequest(`soc-net-list`);
  }

  apiKeyHash() {
    return commonHelper.hash(this.apiKey);
  }

  async socNetLogin(socNetName, loginData) { // phoneNumber, phoneCodeHash, phoneCode, password for telegram
    if (loginData.isEncrypted) {
      const acc = await this.socNetDbAccount(socNetName, pick(loginData, [loginData['id'] ? 'id' : 'phoneNumber']));
      if (acc && !acc.sessionKey && loginData.stage === 2) { // second stage: submitting phone code
        loginData.sessionKey = this.decryptedSocNetCache[acc.id];
        loginData.encryptedSessionKey = geesomeWalletClientLib.encrypt(this.apiKeyHash(), loginData.sessionKey);
      }
      if (acc && acc.sessionKey && loginData.stage === 3) { // third stage: input password
        loginData.sessionKey = this.decryptedSocNetCache[commonHelper.hash(acc.sessionKey)];
      }
      if (!this.isSessionKeyCorrect(loginData.sessionKey)) {
        loginData.sessionKey = '';
        loginData.encryptedSessionKey = '';
      }
    }
    const response = await this.postRequest(`soc-net/${socNetName}/login`, loginData);
    if (loginData.isEncrypted) {
      const {account} = response;
      if (loginData.stage === 1) {
        // write temp session key value by account id(only need for second stage of login)
        this.decryptedSocNetCache[account.id] = response['sessionKey'];
      } else {
        // write cache session key from response by hashed encrypted session key
        // remove temp session key by account id
        delete this.decryptedSocNetCache[account.id];
        const updateData = {};
        ['sessionKey', 'apiKey'].forEach(name => {
          const key = response[name];
          if (!key) {
            return;
          }
          const encryptedKey = geesomeWalletClientLib.encrypt(this.apiKeyHash(), key);
          this.decryptedSocNetCache[commonHelper.hash(encryptedKey)] = key;
          if (account[name] !== encryptedKey) {
            updateData[name] = encryptedKey;
          }
        });
        if (!isEmpty(updateData)) {
          await this.socNetUpdateDbAccount(account.id, updateData);
        }
      }
    }
    return response;
  }

  async socNetDbAccountList(params) {
    return this.postRequest(`soc-net-account/list`, params);
  }

  contentBotList(params) {
    return this.postRequest(`content-bot/list`, params);
  }

  contentBotAdd(botData) {
    return this.postRequest(`content-bot/add`, botData);
  }

  addUserTg(params) {
    return this.postRequest(`content-bot/addUser`, params);
  }

  async socNetDbAccount(socNet, accountData) {
    const acc = await this.postRequest(`soc-net-account/get`, { socNet, accountData });
    if (acc && acc.sessionKey && acc.isEncrypted) {
      this.decryptSessionKey(acc.sessionKey);
    }
    return acc;
  }

  async socNetUpdateDbAccount(id, accData) {
    return this.postRequest(`soc-net-account/update`, {accountData: {...accData, id}});
  }

  decryptSessionKey(encryptedSessionKey) {
    const sessionHash = commonHelper.hash(encryptedSessionKey);
    this.decryptedSocNetCache[sessionHash] = geesomeWalletClientLib.decrypt(this.apiKeyHash(), encryptedSessionKey);
    return this.decryptedSocNetCache[sessionHash];
  }

  async socNetDbChannel(socNetName, channelData) {
    return this.postRequest(`soc-net-import/get-channel`, {channelData});
  }

  isSocNetSessionKeyCorrect(acc) {
    const sessionHash = commonHelper.hash(acc.sessionKey);
    return this.isSessionKeyCorrect(this.decryptedSocNetCache[sessionHash]);
  }

  isSessionKeyCorrect(sessionKey) {
    return sessionKey !== 'undefined' && /^[A-Za-z0-9+/=/%]*$/.test(sessionKey);
  }

  async setKeysToSocNetAccountData(socNetName, accountData) {
    const acc = await this.socNetDbAccount(socNetName, accountData);
    const keysFields = ['sessionKey', 'apiKey'];
    if (!acc.isEncrypted) {
      keysFields.forEach(name => {
        accountData[name] = acc[name];
      });
      return;
    }
    keysFields.forEach(name => {
      if (!acc[name]) {
        return;
      }
      const keyHash = commonHelper.hash(acc[name]);
      if (!this.decryptedSocNetCache[keyHash]) {
        this.decryptSessionKey(acc[name]);
      }
      const key = this.decryptedSocNetCache[keyHash];
      accountData[name] = this.isSessionKeyCorrect(key) ? key : '';
    });
    return accountData;
  }

  async getSocNetSessionKey(socNetName, accountData) {
    await this.setKeysToSocNetAccountData(socNetName, accountData);
    return accountData.sessionKey;
  }

  async getSocNetApiKey(socNetName, accountData) {
    await this.setKeysToSocNetAccountData(socNetName, accountData);
    return accountData.sessionKey;
  }

  async socNetUserInfo(socNetName, accountData, username = 'me') {
    await this.setKeysToSocNetAccountData(socNetName, accountData);
    return this.postRequest(`soc-net/${socNetName}/user-info`, { accountData, username });
  }

  async socNetUpdateAccount(socNetName, accountData) {
    await this.setKeysToSocNetAccountData(socNetName, accountData);
    return this.postRequest(`soc-net/${socNetName}/update-account`, { accountData });
  }

  async socNetGetChannels(socNetName, accountData) {
    await this.setKeysToSocNetAccountData(socNetName, accountData);
    return this.postRequest(`soc-net/${socNetName}/channels`, { accountData });
  }

  async socNetGetChannelInfo(socNetName, accountData, channelId) {
    await this.setKeysToSocNetAccountData(socNetName, accountData);
    return this.postRequest(`soc-net/${socNetName}/channel-info`, { accountData, channelId });
  }

  async socNetUpdateDbChannel(socNetName, id, updateData) {
    return this.postRequest(`soc-net-import/get-channel`, { channelData: {id}, updateData });
  }

  async socNetRunChannelImport(socNetName, accountData, channelId, advancedSettings = {}) {
    await this.setKeysToSocNetAccountData(socNetName, accountData);
    return this.postRequest(`soc-net/${socNetName}/run-channel-import`, { accountData, channelId, advancedSettings });
  }

  async staticSiteGetDefaultOptions(entityType, entityId) {
    return this.postRequest(`render/static-site-generator/get-default-options`, { entityType, entityId });
  }

  async staticSiteRunGenerate(entityType, entityId, options) {
    return this.postRequest(`render/static-site-generator/run`, { entityType, entityId, options });
  }

  async staticSiteBind(id) {
    return this.postRequest(`render/static-site-generator/bind-to-static-id/${id}`);
  }

  async updateStaticSiteInfo(staticSiteId, data) {
    return this.postRequest(`render/static-site-generator/update-info/${staticSiteId}`, data);
  }

  async getStaticSiteInfo(entityType, entityId) {
    return this.postRequest(`render/static-site-generator/get-info`, { entityType, entityId });
  }

  async addSerialAutoActions(actions) {
    return this.postRequest(`user/add-serial-auto-actions`, actions);
  }

  async getAutoActions(params) {
    return this.getRequest(`user/get-auto-actions`, {params});
  }

  async updateAutoAction(id, updateData) {
    return this.postRequest(`user/update-auto-action/${id}`, updateData);
  }

  buildAutoActions(actions, runPeriod) {
    return actions.map((a, i) => {
      const {funcArgs} = a;
      return {
        executePeriod: i ? 0 : runPeriod,
        executeOn: i || !runPeriod ? null : commonHelper.moveDate(runPeriod, 'second'),
        isActive: true,
        isEncrypted: true,
        position: 1,
        totalExecuteAttempts: 3,
        currentExecuteAttempts: 3,
        ...a,
        funcArgs: JSON.stringify(funcArgs),
      }
    });
  }

  updateCurrentUser(userData) {
    return this.postRequest(`user/update`, userData);
  }

  userGetFriends(search = null, listParams = {}) {
    return this.getRequest(`user/get-friends`, {params: extend({search}, listParams)});
  }

  addFriend(friendId) {
    return this.postRequest(`user/add-friend`, {friendId});
  }

  removeFriend(friendId) {
    return this.postRequest(`user/remove-friend`, {friendId});
  }

  getPersonalChatGroups() {
    return this.getRequest(`user/personal-chat-groups`);
  }

  createGroup(groupData) {
    return this.postRequest(`user/create-group`, groupData);
  }

  updateGroup(groupData) {
    return this.postRequest(`user/group/${groupData.id}/update`, groupData);
  }

  async isMemberOfCategory(categoryId) {
    return this.postRequest(`user/category/${categoryId}/is-member`).then(data => data.result);
  }

  async joinGroup(groupId) {
    if (this.serverLessMode) {
      return this.clientStorage.joinToGroup(groupId);
    }
    return this.postRequest(`user/group/${groupId}/join`);
  }

  async leaveGroup(groupId) {
    if (this.serverLessMode) {
      return this.clientStorage.leaveGroup(groupId);
    }
    return this.postRequest(`user/group/${groupId}/leave`);
  }

  async isMemberOfGroup(groupId) {
    if (this.serverLessMode) {
      return this.clientStorage.isMemberOfGroup(groupId);
    }
    return this.postRequest(`user/group/${groupId}/is-member`).then(data => data.result);
  }

  saveObject(object) {
    return this.postRequest('save-object', object, {headers: {'Content-Type': 'multipart/form-data'}});
  }

  saveFile(file, params = {}) {
    const formData = new FormData();

    forEach(params, (value, key) => {
      formData.append(key, value);
    });

    formData.append("file", file);
    return this.postRequest('user/save-file', formData, {headers: {'Content-Type': 'multipart/form-data'}})
      .then(res => this.asyncResponseWrapper(res, params));
  }

  saveContentData(content, params = {}) {
    return this.postRequest('user/save-data', extend({content}, params))
      .then(res => this.asyncResponseWrapper(res, params));
  }

  saveDataByUrl(url, params = {}) {
    return this.postRequest('user/save-data-by-url', extend({url}, params))
      .then(res => this.asyncResponseWrapper(res, params));
  }

  getAsyncOperation(id) {
    return this.postRequest('user/get-async-operation/' + id);
  }

  cancelAsyncOperation(id) {
    return this.postRequest('user/cancel-async-operation/' + id);
  }

  findAsyncOperations(name, channelLike, inProcess = true) {
    return this.postRequest('user/find-async-operations', {name, channelLike, inProcess});
  }

  waitForAsyncOperation(asyncOperationId, onProcess) {
    return new Promise((resolve, reject) => {
      // TODO: use channel
      const waitingForFinish = () => {
        setTimeout(() => {
          this.getAsyncOperation(asyncOperationId).then((operation) => {
            if (onProcess) {
              onProcess(operation);
            }
            if (operation.inProcess) {
              return waitingForFinish();
            }

            if (operation.errorMessage) {
              return reject({message: operation.errorMessage});
            }

            resolve(operation.contentId ? this.getDbContent(operation.contentId) : 'done');
          }).catch(waitingForFinish);
        }, 1000);
      };

      waitingForFinish();
    })
  }

  asyncResponseWrapper(res, params) {
    if (!res.asyncOperationId) {
      return res;
    }
    return this.waitForAsyncOperation(res.asyncOperationId, params ? params.onProcess : null);
  }

  createPost(postData) {
    return this.postRequest(`user/group/create-post`, postData);
  }

  updatePost(postData) {
    return this.postRequest(`user/group/update-post/${postData.id}`, postData);
  }

  getGroupUnread(groupId) {
    return this.getRequest(`user/group/unread/${groupId}`).then(res => {
      res.count = parseInt(res.count);
      return res;
    });
  }

  setGroupRead(readData) {
    return this.postRequest(`user/group/set-read`, readData);
  }

  getDbPost(postId) {
    return this.getRequest(`user/post/${postId}`);
  }

  getDbGroupPosts(groupId, params = null) {
    return this.getRequest(`group/${groupId}/posts`, {params});
  }

  createCategory(categoryData) {
    return this.postRequest(`user/create-category`, categoryData);
  }

  getDbCategoryPosts(categoryId, params = null) {
    return this.getRequest(`category/${categoryId}/posts`, {params});
  }

  getDbCategoryGroups(categoryId, params = null) {
    return this.getRequest(`user/category/${categoryId}/groups`, {params});
  }

  createGroupSection(groupSectionData) {
    return this.postRequest(`user/group-section/create`, groupSectionData);
  }

  updateGroupSection(groupSectionId, groupSectionData) {
    return this.postRequest(`user/group-section/${groupSectionId}/update`, groupSectionData);
  }

  getDbCategoryGroupSections(params = null) {
    return this.getRequest(`user/group-sections`, {params});
  }

  getDbCategoryByParams(params) {
    return this.postRequest(`category/get`, params);
  }

  getDbGroupByParams(params) {
    return this.postRequest(`group/get`, params);
  }

  getDbPostByParams(params) {
    return this.postRequest(`post/get`, params);
  }

  addGroupToCategory(groupId, categoryId) {
    return this.postRequest(`user/category/${categoryId}/add-group`, {groupId});
  }

  addAdminToGroup(groupId, userId) {
    return this.postRequest(`user/group/${groupId}/add-admin`, {userId});
  }

  removeAdminFromGroup(groupId, userId) {
    return this.postRequest(`user/group/${groupId}/remove-admin`, {userId});
  }

  setAdminsOfGroup(groupId, userIds) {
    return this.postRequest(`user/group/${groupId}/set-admins`, {userIds});
  }

  addMemberToGroup(groupId, userId, permissions = []) {
    return this.postRequest(`user/group/${groupId}/add-member`, {userId, permissions});
  }

  setMembersOfGroup(groupId, userIds, permissions = []) {
    return this.postRequest(`user/group/${groupId}/set-members`, {userIds, permissions});
  }

  setMemberGroupPermissions(groupId, userId, permissions = []) {
    return this.postRequest(`user/group/${groupId}/set-permissions`, {userId, permissions});
  }

  removeMemberFromGroup(groupId, userId) {
    return this.postRequest(`user/group/${groupId}/remove-member`, {userId});
  }

  addMemberToCategory(categoryId, userId, permissions = []) {
    return this.postRequest(`user/category/${categoryId}/add-member`, {userId, permissions});
  }

  removeMemberFromCategory(categoryId, userId) {
    return this.postRequest(`user/category/${categoryId}/remove-member`, {userId});
  }

  regenerateUserPreviews() {
    return this.postRequest(`user/regenerate-previews`);
  }

  getContentDataByApi(storageId) {
    return this.getRequest('content-data/' + storageId);
  }

  getDbContent(dbId) {
    return this.getRequest('content/' + dbId);
  }

  getDbContentByStorageId(storageId) {
    return this.getRequest('content-by-storage-id/' + storageId);
  }

  async getMemberInGroups(types) {
    let groupsIds;
    if (this.serverLessMode) {
      groupsIds = this.clientStorage.joinedGroups();
      // TODO: filter by types
    } else {
      //TODO: get groups list directly from ipld?
      groupsIds = await this.getRequest('user/member-in-groups', {params: {types: types.join(',')}}).then(groupData => groupData.list.map(g => g.manifestStorageId));
    }
    return pIteration.map(groupsIds, (groupId) => this.getGroup(groupId));
  }

  getMemberInChannels() {
    return this.getMemberInGroups(['channel']);
  }

  getMemberInChats() {
    return this.getMemberInGroups(['chat', 'personal_chat']);
  }

  getAdminInGroups(types) {
    //TODO: get groups list directly from ipld?
    return this.getRequest('user/admin-in-groups', {params: {types: types.join(',')}}).then(groupData => {
      return pIteration.map(groupData.list, (group: any) => this.getGroup(group.manifestStorageId))
    });
  }

  getAdminInChannels() {
    return this.getAdminInGroups(['channel']);
  }

  getAdminInChats() {
    return this.getAdminInGroups(['chat', 'personal_chat']);
  }

  async getUser(userId) {
    if (ipfsHelper.isAccountCidHash(userId)) {
      userId = await this.resolveIpns(userId);
    }
    const userObj = await this.getObject(userId);

    await this.fetchIpldFields(userObj, ['avatarImage']);

    return userObj;
  }

  async getDbGroup(groupId) {
    return this.getRequest(`group/${groupId}`);
  }

  async getGroup(groupId) {
    if (ipfsHelper.isAccountCidHash(groupId)) {
      groupId = await this.resolveIpns(groupId);
    }

    const groupObj: any = await this.getObject(groupId);

    if (groupObj) {
      groupObj.$manifestId = groupId;
    }

    await this.fetchIpldFields(groupObj, ['avatarImage', 'coverImage']);

    return groupObj;
    // return this.$http.get(`group/${groupId}`).then(response => response.data);
  }

  async fetchIpldFields(obj, fieldsNamesArr) {
    await pIteration.forEach(fieldsNamesArr, async (fieldName: string) => {
      if (!get(obj, fieldName)) {
        return;
      }
      set(obj, fieldName, await this.getObject(get(obj, fieldName)));
    })
  }

  async getContentLinkByStaticId(staticId) {
    return this.server + '/ipns/' + staticId;
  }

  async getContentLink(content, previewType = null) {
    if (!content) {
      return null;
    }
    let storageId;
    let manifest;
    if (content.storageId) {
      manifest = content;
    } else {
      storageId = content;
    }

    if (manifest) {
      if (previewType) {
        const previewObj = ((manifest.preview || {})[previewType] || {});
        storageId = previewObj.storageId || manifest.storageId;
      } else {
        storageId = manifest.storageId;
      }
    }
    if (ipfsHelper.isIpfsHash(storageId)) {
      return this.getServerStorageUri(ipfsHelper.isAccountCidHash(storageId)) + storageId;
    } else {
      return this.server + '/v1/content-data/' + storageId;
    }
  }

  getServerStorageUri(isIpns) {
    return `${this.server}/${isIpns ? 'ipns' : 'ipfs'}/`;
  }

  async getObject(ipldHash, isResolve = true) {
    if (ipldHash.multihash || ipldHash.hash) {
      ipldHash = ipfsHelper.cidToHash(ipldHash);
    }
    if (ipldHash['/']) {
      ipldHash = ipldHash['/'];
    }
    let responded = false;
    //TODO: enable on migrate to new version
    //
    // if(!this.ipfsService) {
    //   return this.getRequest(`/ipld/${ipldHash}`).then(wrapObject);
    // }

    return new Promise((resolve, reject) => {
      // this.ipfsService.getObject(ipldHash).then(wrapObject).then(resolve).catch(reject);

      // setTimeout(() => {
      //   if (!responded) {
          this.getRequest(`ipld/${ipldHash}`, { isResolve }).then(wrapObject).then(resolve).catch(reject);
        // }
      // }, this.ipfsIddleTime);
    });

    function wrapObject(ipldData) {
      responded = true;
      if (!ipldData) {
        return null;
      }
      return ipldData;
    }
  }

  async getContentData(contentHash: any) {
    // @ts-ignore
    if (isObject(contentHash) && contentHash.storageId) {
      // @ts-ignore
      contentHash = contentHash.storageId;
    }
    if (contentHash['/']) {
      contentHash = contentHash['/'];
    }

    let responded = false;

    return new Promise((resolve, reject) => {
      if(!this.ipfsService) {
        return this.getContentDataByApi(contentHash).then(wrap).then(resolve).catch(reject);
      }
      this.ipfsService.getFileData(contentHash).then(wrap).then(resolve).catch(reject);

      setTimeout(() => {
        if (!responded) {
          this.getContentDataByApi(contentHash).then(wrap).then(resolve).catch(reject);
        }
      }, this.ipfsIddleTime);
    });

    function wrap(content) {
      responded = true;
      return content;
    }
  }

  async getGroupPostsAsync(groupId, options: any = {}, onItemCallback = null, onFinishCallback = null) {
    const group = await this.getGroup(groupId);

    const defaultOptions = {
      limit: 10,
      offset: 0,
      orderDir: 'desc'
    };

    forEach(defaultOptions, (optionValue, optionName) => {
      if (isUndefined(options[optionName])) {
        options[optionName] = optionValue;
      }
    });

    const postsCount = parseInt(group.postsCount);
    if (options.offset + options.limit > postsCount) {
      options.limit = postsCount - options.offset;
    }

    const posts = [];
    pIteration.forEach(range(postsCount - options.offset, postsCount - options.offset - options.limit), async (postNumber, index) => {
      const postNumberPath = trie.getTreePostCidPath(group.$manifestId, postNumber);

      let postManifestId, post;

      if (group.isEncrypted) {
        post = await this.getPost(postNumberPath);
        postManifestId = await this.decryptText(post);
        post = await this.getPost(postManifestId);
      } else {
        [postManifestId, post] = await Promise.all([
          this.getObject(postNumberPath, false),
          this.getObject(postNumberPath)
        ]);
      }

      if (post) {
        post.id = postNumber;
        post.manifestId = postManifestId;
        post.groupId = groupId;
        post.group = group;
      }

      posts[index] = post;

      if (onItemCallback) {
        onItemCallback(posts);
      }
    }).then(() => {
      if (onFinishCallback) {
        onFinishCallback(posts);
      }
    });
    return posts;
// return this.$http.get(`group/${groupId}/posts`, { params: { limit, offset } }).then(response => response.data);
  }

  async getGroupPost(groupId, postId) {
    const group = await this.getGroup(groupId);
    let post;
    if (ipfsHelper.isObjectCidHash(postId)) {
      post = await this.getObject(postId);
      post.manifestId = postId;
    } else if (isNumber(postId)) {
      const postsPath = group.$manifestId + '/posts/';
      const postNumberPath = trie.getTreePath(postId).join('/');
      post = await this.getObject(postsPath + postNumberPath);

      const node = trie.getNode(group.posts, postId);
      if (ipfsHelper.isCid(node)) {
        post.manifestId = ipfsHelper.cidToHash(node);
      } else if (node['/']) {
        post.manifestId = node['/'];
      } else if (group.isEncrypted) {
        const manifestId = await this.decryptText(post);
        post = await this.getGroupPost(groupId, manifestId);
      }
    } else if (group.isEncrypted) {
      const manifestId = await this.decryptText(postId);
      post = await this.getGroupPost(groupId, manifestId);
    }

    post.id = postId;
    // post.sourceIpld = _.clone(post);
    post.groupId = groupId;
    post.group = group;
    return post;
  }

  async getPost(postManifestIpld) {
    return this.getObject(postManifestIpld);
  }

  subscribeToGroupUpdates(groupId, callback) {
    if (!this.communicator) {
      return console.warn('[GeesomeClient] Communicator not defined');
    }
    this.communicator.subscribeToEvent(getGroupUpdatesTopic(groupId), callback);
  }

  subscribeToPersonalChatUpdates(membersIpnsIds, groupTheme, callback) {
    if (!this.communicator) {
      return console.warn('[GeesomeClient] Communicator not defined');
    }
    this.communicator.subscribeToEvent(getPersonalChatTopic(membersIpnsIds, groupTheme), (event) => {
      if (membersIpnsIds.includes(event.keyIpns)) {
        callback(event);
      }
    });
  }

  getStorageIdStat(storageId) {
    return this.communicator.getFileStat(storageId);
  }

  getStorageIdPins(storageId) {
    return this.communicator.getPins(storageId);
  }

  getPeers(storageId) {
    return this.communicator.getPeers(storageId);
  }

  getStaticIdPeers(storageId) {
    return this.communicator.getStaticIdPeers(storageId);
  }

  getCanCreatePost(groupId) {
    return this.getRequest(`user/group/${groupId}/can-create-post`).then(data => data.valid);
  }

  getCanEditGroup(groupId) {
    return this.getRequest(`user/group/${groupId}/can-edit`).then(data => data.valid);
  }

  resolveIpns(ipns) {
    return this.getRequest(`resolve/${ipns}`).catch(() => null);
  }

  getFileCatalogItems(parentItemId, type, listParams: any = {}) {
    let {sortBy, sortDir, limit, offset, search} = listParams;

    if (!sortBy) {
      sortBy = 'updatedAt';
    }
    if (!sortDir) {
      sortDir = 'desc';
    }
    return this.getRequest(`user/file-catalog/`, {
      params: {parentItemId, type, sortBy, sortDir, limit, offset, search}
    });
  }

  getFileCatalogBreadcrumbs(itemId) {
    return this.getRequest(`user/file-catalog/file-catalog-item/${itemId}/breadcrumbs`);
  }

  createFolder(parentItemId, name) {
    return this.postRequest(`user/file-catalog/create-folder`, {parentItemId, name});
  }

  addContentIdToFolderId(contentId, folderId) {
    return this.postRequest(`user/file-catalog/add-content-to-folder`, {contentId, folderId});
  }

  updateFileCatalogItem(itemId, updateData) {
    return this.postRequest(`user/file-catalog/file-catalog-item/${itemId}/update`, updateData);
  }

  deleteFileCatalogItem(itemId, options) {
    return this.postRequest(`user/file-catalog/file-catalog-item/${itemId}/delete`, options);
  }

  getContentsIdsByFileCatalogIds(fileCatalogIds) {
    return this.postRequest(`user/file-catalog/get-contents-ids`, fileCatalogIds);
  }

  saveContentByPath(contentId, path) {
    return this.postRequest(`user/file-catalog/save-content-by-path`, {contentId, path});
  }

  getContentByPath(path) {
    return this.postRequest(`user/file-catalog/get-content-by-path`, {path});
  }

  getFileCatalogItemByPath(path, type) {
    return this.postRequest(`user/file-catalog/get-item-by-path`, {path, type});
  }

  publishFolder(folderId, params = {}) {
    return this.postRequest(`user/file-catalog/publish-folder/${folderId}`, params);
  }

  getAllItems(itemsName, search = null, listParams: any = {}) {
    let {sortBy, sortDir, limit, offset} = listParams;
    return this.getRequest(`admin/all-` + itemsName, {params: {search, sortBy, sortDir, limit, offset}});
  }

  getUserApiKeys(isDisabled = null, search = null, listParams: any = {}) {
    let {sortBy, sortDir, limit, offset} = listParams;
    return this.getRequest(`user/api-key-list`, {params: {sortBy, sortDir, limit, offset}});
  }

  getUserByApiToken(token) {
    return this.postRequest(`get-user-by-api-token`, {token});
  }

  getCurrentUserApiKey() {
    return this.getRequest(`user/api-key/current`);
  }

  addUserApiKey(data) {
    return this.postRequest(`user/api-key/add`, data);
  }

  updateUserApiKey(apiKeyId, updateData) {
    return this.postRequest(`user/api-key/${apiKeyId}/update`, updateData);
  }

  getSelfAccountId() {
    return this.getRequest(`self-account-id`).then(r => r.result);
  }

  joinByInvite(code, userData) {
    return this.postRequest(`invite/join/${code}`, userData);
  }

  adminCreateUser(userData) {
    return this.postRequest(`admin/add-user`, userData);
  }

  adminCreateInvite(inviteData) {
    return this.postRequest(`admin/add-invite`, inviteData);
  }

  adminUpdateInvite(inviteId, inviteData) {
    return this.postRequest(`admin/update-invite/${inviteId}`, inviteData);
  }

  adminInvitesList(isActive = undefined, listParams: any = {}) {
    let {sortBy, sortDir, limit, offset} = listParams;

    if (!sortBy) {
      sortBy = 'createdAt';
    }
    if (!sortDir) {
      sortDir = 'desc';
    }
    return this.getRequest(`admin/invites/`, {
      params: {sortBy, sortDir, limit, offset, isActive}
    });
  }

  adminSetUserLimit(limitData) {
    return this.postRequest(`admin/set-user-limit`, limitData);
  }

  adminGetUserLimit(userId, limitName) {
    return this.getRequest(`admin/get-user/${userId}/limit/${limitName}`);
  }

  adminIsHaveCorePermission(permissionName) {
    return this.getRequest(`user/permissions/core/is-have/${permissionName}`).then(data => data.result);
  }

  adminAddCorePermission(userId, permissionName) {
    return this.postRequest(`admin/permissions/core/add_permission`, {userId, permissionName});
  }

  adminRemoveCorePermission(userId, permissionName) {
    return this.postRequest(`admin/permissions/core/remove_permission`, {userId, permissionName});
  }

  adminSetCorePermission(userId, permissionNameList) {
    return this.postRequest(`admin/permissions/core/set_permissions`, {userId, permissionNameList});
  }

  adminGetCorePermissionList(userId) {
    return this.postRequest(`admin/permissions/core/get_list`, {userId});
  }

  adminAddUserApiKey(userId, data) {
    return this.postRequest(`admin/add-user-api-key`, {userId, ...data});
  }

  adminGetBootNodes(type = 'ipfs') {
    return this.getRequest(`admin/boot-nodes`, {type});
  }

  adminAddBootNode(address, type = 'ipfs') {
    return this.postRequest(`admin/boot-nodes/add`, {address, type});
  }

  adminRemoveBootNode(address, type = 'ipfs') {
    return this.postRequest(`admin/boot-nodes/remove`, {address, type});
  }

  adminGetUserAccount(provider, address) {
    return this.postRequest(`admin/get-user-account`, {provider, address});
  }

  getNodeAddressList(type = 'ipfs') {
    return this.getRequest(`node-address-list`, {params: {type}}).then(data => data.result);
  }

  async getNodeAddress(_includesAddress = null) {
    let addresses = await this.getNodeAddressList();

    if (_includesAddress) {
      return find(addresses, (address) => {
        return address.includes(_includesAddress);
      });
    } else {
      return filter(addresses, (address) => {
        return !address.ncludes('127.0.0.1') && !address.includes('192.168') && address.length > 64;//&& !includes(address, '/p2p-circuit/ipfs/')
      })[0];
    }
  }

  getGroupPeers(ipnsId) {
    return this.getRequest(`group/${ipnsId}/peers`);
  }

  async connectToIpfsNodeToServer() {
    let address = await this.getNodeAddress(this.isLocalServer() ? '127.0.0.1' : null);

    if (this.isLocalServer()) {
      address = address.replace('4002/ipfs', '4003/ws/ipfs')
    }

    // prevent Error: Dial is currently blacklisted for this peer on swarm connect
    // this.ipfsNode.libp2p._switch.dialer.clearBlacklist(new PeerInfo(PeerId.createFromB58String(last(address.split('/')))));

    await this.communicator.addBootNode(address);

    return this.ipfsService.addBootNode(address).then(() => console.log('successful connect to ', address)).catch((e) => console.warn('failed connect to ', address, e));
  }

  setServerByDocumentLocation() {
    let postfix = '/api';
    if (global.document.location.hostname === 'localhost' || global.document.location.hostname === '127.0.0.1' || startsWith(global.document.location.pathname, '/node')) {
      postfix = ':2052';
    }
    this.server = global.document.location.protocol + "//" + global.document.location.hostname + postfix;
  }

  isLocalServer() {
    return this.server.includes(':2052');
  }

  async getPreloadAddresses() {

    let preloadAddresses = [];

    if (this.isLocalServer()) {
      preloadAddresses.push(await this.getNodeAddress('127.0.0.1'));
    } else {
      const serverDomain = extractHostname(this.server);

      if (serverDomain && !isIpAddress(serverDomain)) {
        preloadAddresses.push('/dnsaddr/' + serverDomain + '/tcp/7722/https');
      }

      preloadAddresses.push(await this.getNodeAddress('127.0.0.1'));
    }

    preloadAddresses = preloadAddresses.filter(a => a).map(address => {
      return address.replace('/p2p-circuit', '').replace('4002', '5002').replace(/\/ipfs\/.+/, '/');
    });

    preloadAddresses = preloadAddresses.concat([
      //TODO: get from some dynamic place
      '/dns4/node0.preload.ipfs.io/tcp/443/wss/ipfs/QmZMxNdpMkewiVZLMRxaNxUeZpDUb34pWjZ1kZvsd16Zic',
      '/dns4/node1.preload.ipfs.io/tcp/443/wss/ipfs/Qmbut9Ywz9YEDrz8ySBSgWyJk41Uvm2QJPhwDJzJyGFsD6'
    ]);

    return preloadAddresses;
  }

  async initBrowserIpfsNode() {
    function createIpfsNode(options) {
      return global.window['Ipfs'].create(merge({
        EXPERIMENTAL: {
          pubsub: true,
          ipnsPubsub: true
        }
      }, options));
    }

    return this.setIpfsNode(await createIpfsNode({
      preload: {
        enabled: true,
        addresses: await this.getPreloadAddresses()
      }
    }));
  }

  async initRuntimeIpfsNode(options = {}, ipfsOptions = {}) {
    return this.setIpfsNode(await ipfsHelper.createDaemonNode(options, ipfsOptions));
  }
}

class AbstractClientStorage {
  set(name, value) {
    global.assert(false, 'you have to override getValue');
  }

  get(name): any {
    global.assert(false, 'you have to override getValue');
  }

  joinToGroup(groupId) {
    const groupsIds = this.joinedGroups();
    groupsIds.push(groupId);
    this.set('joined-groups', groupsIds);
  }

  leaveGroup(groupId) {
    const groupsIds = this.joinedGroups();
    const groupIndex = groupsIds.indexOf(groupId);
    if (groupIndex === -1) {
      return;
    }
    groupsIds.splice(groupIndex, 1);
    this.set('joined-groups', groupsIds);
  }

  isMemberOfGroup(groupId) {
    const groupsIds = this.joinedGroups();
    return groupsIds.indexOf(groupId) !== -1;
  }

  joinedGroups() {
    return this.get('joined-groups') || [];
  }
}

class SimpleClientStorage extends AbstractClientStorage {
  storage;
  constructor() {
    super();
    this.storage = {};
  }

  set(name, value) {
    this.storage[name] = value;
  }

  get(name) {
    return this.storage[name];
  }
}

class BrowserLocalClientStorage extends AbstractClientStorage {
  get(name) {
    try {
      return JSON.parse(localStorage.getItem(name));
    } catch (e) {
      return null;
    }
  }

  set(name, value) {
    localStorage.setItem(name, JSON.stringify(value));
  }
}

export default GeesomeClient;
