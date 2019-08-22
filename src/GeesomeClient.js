const axios = require('axios');
const _ = require('lodash');
const pIteration = require('p-iteration');
const ipfsHelper = require('./ipfsHelper');
const pgpHelper = require('./pgpHelper');
const trie = require('./base36Trie');
const JsIpfsService = require('./JsIpfsService');
const PeerId = require('peer-id');
const PeerInfo = require('peer-info');

const {extractHostname, isIpAddress} = require('./common');
const {getGroupUpdatesTopic, getPersonalChatTopic} = require('./name');

class GeesomeClient {
  constructor(config) {
    this.server = config.server;
    this.apiKey = config.apiKey;
    this.ipfsNode = config.ipfsNode;

    this.clientStorage = config.clientStorage;

    this.$http = axios.create({});

    this.ipfsService = null;
    this.serverLessMode = true;
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
    return this.wrapResponse(this.$http.get(url, options));
  }

  postRequest(url, data = null) {
    return this.wrapResponse(this.$http.post(url, data));
  }

  wrapResponse(httPromise) {
    return httPromise.then(response => response.data).catch(err => {
      throw (err.response ? err.response.data : err.message);
    });
  }

  getCurrentUser() {
    return this.getRequest('/v1/user').then(user => {
      this.serverLessMode = false;
      return user;
    }).catch((err) => {
      this.serverLessMode = true;
      throw (err);
    });
  }

  async exportPrivateKey() {
    this._privateKey = await this.postRequest(`/v1/user/export-private-key`).then(res => res.result);
  }
  
  async decryptText(encryptedText) {
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

  async setIpfsNode(ipfsNode, ipfsIddleTime = 1000) {
    this.ipfsNode = ipfsNode;
    this.ipfsService = new JsIpfsService(this.ipfsNode);
    this.ipfsIddleTime = ipfsIddleTime;
    if(!this.serverLessMode) {
      await this.connectToIpfsNodeToServer();
    }
  }

  async loginUserPass(username, password) {
    return this.postRequest('/v1/login', {username, password}).then(data => {
      this.setApiKey(data.apiKey);
      this.serverLessMode = false;
      return data;
    });
  }

  async logout() {
    this.setApiKey(null);
    //TODO: send request to server for disable api key
  }

  setup(setupData) {
    return this.postRequest(`/v1/setup`, setupData).then(data => {
      this.setApiKey(data.apiKey);
      return data;
    });
  }

  updateCurrentUser(userData) {
    return this.postRequest(`/v1/user/update`, userData);
  }

  userGetFriends(search = null, listParams = {}) {
    return this.getRequest(`/v1/user/get-friends`, {params: _.extend({search}, listParams)});
  }

  addFriend(friendId) {
    return this.postRequest(`/v1/user/add-friend`, {friendId});
  }

  removeFriend(friendId) {
    return this.postRequest(`/v1/user/remove-friend`, {friendId});
  }

  getPersonalChatGroups() {
    return this.getRequest(`/v1/user/personal-chat-groups`);
  }

  createGroup(groupData) {
    return this.postRequest(`/v1/user/create-group`, groupData);
  }

  updateGroup(groupData) {
    return this.postRequest(`/v1/user/group/${groupData.id}/update`, groupData);
  }

  async joinGroup(groupId) {
    if (this.serverLessMode) {
      return this.clientStorage.joinToGroup(groupId);
    }
    return this.postRequest(`/v1/user/group/${groupId}/join`);
  }

  async leaveGroup(groupId) {
    if (this.serverLessMode) {
      return this.clientStorage.leaveGroup(groupId);
    }
    return this.postRequest(`/v1/user/group/${groupId}/leave`);
  }

  async isMemberOfGroup(groupId) {
    if (this.serverLessMode) {
      return this.clientStorage.isMemberOfGroup(groupId);
    }
    return this.postRequest(`/v1/user/group/${groupId}/is-member`).then(data => data.result);
  }

  saveFile(file, params = {}) {
    const formData = new FormData();

    _.forEach(params, (value, key) => {
      formData.append(key, value);
    });

    formData.append("file", file);
    return this.postRequest('/v1/user/save-file', formData, {headers: {'Content-Type': 'multipart/form-data'}});
  }

  saveObject(object) {
    return this.postRequest('/save-object', object, {headers: {'Content-Type': 'multipart/form-data'}});
  }

  saveContentData(content, params = {}) {
    return this.postRequest('/v1/user/save-data', _.extend({content}, params));
  }

  saveDataByUrl(url, params = {}) {
    return this.postRequest('/v1/user/save-data-by-url', _.extend({url}, params));
  }

  createPost(contentsIds, params) {
    return this.postRequest(`/v1/user/group/${params.groupId}/create-post`, _.extend({contentsIds}, params));
  }

  getContentData(storageId) {
    return this.getRequest('/v1/content-data/' + storageId);
  }

  getDbContent(dbId) {
    return this.getRequest('/v1/content/' + dbId);
  }

  async getMemberInGroups(types) {
    let groupsIds;
    if (this.serverLessMode) {
      groupsIds = this.clientStorage.joinedGroups();
      // TODO: filter by types
    } else {
      //TODO: get groups list directly from ipld?
      groupsIds = await this.getRequest('/v1/user/member-in-groups', { params: {types: types.join(',')} }).then(groups => groups.map(g => g.manifestStorageId));
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
    return this.getRequest('/v1/user/admin-in-groups', { params: {types: types.join(',')} }).then(groups => {
      return pIteration.map(groups, (group) => this.getGroup(group.manifestStorageId))
    });
  }
  
  getAdminInChannels() {
    return this.getAdminInGroups(['channel']);
  }

  getAdminInChats() {
    return this.getAdminInGroups(['chat', 'personal_chat']);
  }

  async getUser(userId) {
    if (ipfsHelper.isIpfsHash(userId)) {
      userId = await this.resolveIpns(userId);
    }

    const userObj = await this.getObject(userId);

    await this.fetchIpldFields(userObj, ['avatarImage']);

    return userObj;
  }

  async getDbGroup(groupId) {
    return this.getRequest(`/v1/group/${groupId}`);
  }

  async getGroup(groupId) {
    if (ipfsHelper.isIpfsHash(groupId)) {
      groupId = await this.resolveIpns(groupId);
    }

    const groupObj = await this.getObject(groupId);

    await this.fetchIpldFields(groupObj, ['avatarImage', 'coverImage']);

    return groupObj;
    // return this.$http.get(`/v1/group/${groupId}`).then(response => response.data);
  }

  async fetchIpldFields(obj, fieldsNamesArr) {
    await pIteration.forEach(fieldsNamesArr, async (fieldName) => {
      if (!_.get(obj, fieldName)) {
        return;
      }
      _.set(obj, fieldName, await this.getObject(_.get(obj, fieldName)));
    })
  }

  async getContentLink(content) {
    if (!content) {
      return null;
    }
    let storageId;
    if (content.content) {
      storageId = content.content;
    } else {
      storageId = content;
    }

    if (ipfsHelper.isIpldHash(storageId)) {
      storageId = (await this.getObject(storageId)).content;
    }
    return this.server + '/v1/content-data/' + storageId;
  }

  async getObject(ipldHash) {
    if (ipldHash.multihash || ipldHash.hash) {
      ipldHash = ipfsHelper.cidToHash(ipldHash);
    }
    if (ipldHash['/']) {
      ipldHash = ipldHash['/'];
    }
    let responded = false;
    
    return new Promise((resolve, reject) => {
      this.ipfsService.getObject(ipldHash).then(wrapObject).then(resolve).catch(reject);
      
      setTimeout(() => {
        if (!responded) {
          this.getRequest(`/ipld/${ipldHash}`).then(wrapObject).then(resolve).catch(reject);
        }
      }, this.ipfsIddleTime);
    });
    
    function wrapObject(ipldData) {
      responded = true;
      if (!ipldData) {
        return null;
      }
      ipldData.id = ipldHash;
      return ipldData;
    }
  }
  
  async getContentData(contentHash) {
    if(contentHash['/']) {
      contentHash = contentHash['/'];
    }
    if(ipfsHelper.isIpldHash(contentHash)) {
      contentHash = (await this.getObject(contentHash)).content;
    }
    
    let responded = false;
    
    return new Promise((resolve, reject) => {
      this.ipfsService.getFileData(contentHash).then(wrap).then(resolve).catch(reject);
      
      setTimeout(() => {
        if (!responded) {
          this.getContentData(contentHash).then(wrap).then(resolve).catch(reject);
        }
      }, this.ipfsIddleTime);
    });
    
    function wrap(content) {
      responded = true;
      return content;
    }
  }

  async getGroupPostsAsync(groupId, options = {}, onItemCallback = null, onFinishCallback = null) {
    const group = await this.getGroup(groupId);

    const defaultOptions = {
      limit: 10,
      offset: 0,
      orderDir: 'desc'
    };

    _.forEach(defaultOptions, (optionValue, optionName) => {
      if (_.isUndefined(options[optionName])) {
        options[optionName] = optionValue;
      }
    });

    const postsCount = parseInt(group.postsCount);
    if (options.offset + options.limit > postsCount) {
      options.limit = postsCount - options.offset;
    }

    const postsPath = group.id + '/posts/';
    const posts = [];
    pIteration.forEach(_.range(postsCount - options.offset, postsCount - options.offset - options.limit), async (postNumber, index) => {
      const postNumberPath = trie.getTreePath(postNumber).join('/');
      let post = await this.getObject(postsPath + postNumberPath);
      
      const node = trie.getNode(group.posts, postNumber);
      
      if(ipfsHelper.isCid(node)) {
        post.manifestId = ipfsHelper.cidToHash(node);
      } else if(node['/']) {
        post.manifestId = node['/'];
      } else if(group.isEncrypted) {
        const manifestId = await this.decryptText(post);
        post = { manifestId };
      }
      
      post.id = postNumber;
      
      post.groupId = groupId;
      if (post) {
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
// return this.$http.get(`/v1/group/${groupId}/posts`, { params: { limit, offset } }).then(response => response.data);
  }

  async getGroupPost(groupId, postId) {
    const group = await this.getGroup(groupId);
    let post;
    if (ipfsHelper.isIpldHash(postId)) {
      post = await this.getObject(postId);
      post.manifestId = postId;
    } else {
      const postsPath = group.id + '/posts/';
      const postNumberPath = trie.getTreePath(postId).join('/');
      post = await this.getObject(postsPath + postNumberPath);

      const node = trie.getNode(group.posts, postId);
      if(ipfsHelper.isCid(node)) {
        post.manifestId = ipfsHelper.cidToHash(node);
      } else if(node['/']) {
        post.manifestId = node['/'];
      } else if(group.isEncrypted) {
        const manifestId = await this.decryptText(post);
        post = { manifestId };
      }
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
    this.ipfsService.subscribeToEvent(getGroupUpdatesTopic(groupId), callback);
  }

  subscribeToPersonalChatUpdates(membersIpnsIds, groupTheme, callback) {
    this.ipfsService.subscribeToEvent(getPersonalChatTopic(membersIpnsIds, groupTheme), (event) => {
      if(_.includes(membersIpnsIds, event.keyIpns)) {
        callback(event);
      }
    });
  }

  getCanCreatePost(groupId) {
    return this.getRequest(`/v1/user/group/${groupId}/can-create-post`).then(data => data.valid);
  }

  getCanEditGroup(groupId) {
    return this.getRequest(`/v1/user/group/${groupId}/can-edit`).then(data => data.valid);
  }

  resolveIpns(ipns) {
    return this.getRequest(`/resolve/${ipns}`).catch(() => null);
  }

  getFileCatalogItems(parentItemId, type, listParams = {}) {
    let {sortBy, sortDir, limit, offset, search} = listParams;

    if (!sortBy) {
      sortBy = 'updatedAt';
    }
    if (!sortDir) {
      sortDir = 'desc';
    }
    return this.getRequest(`/v1/user/file-catalog/`, {
      params: {parentItemId, type, sortBy, sortDir, limit, offset, search}
    });
  }

  getFileCatalogBreadcrumbs(itemId) {
    return this.getRequest(`/v1/user/file-catalog/file-catalog-item/${itemId}/breadcrumbs`);
  }

  createFolder(parentItemId, name) {
    return this.postRequest(`/v1/user/file-catalog/create-folder`, {parentItemId, name});
  }

  addContentIdToFolderId(contentId, folderId) {
    return this.postRequest(`/v1/user/file-catalog/add-content-to-folder`, {contentId, folderId});
  }

  updateFileCatalogItem(itemId, updateData) {
    return this.postRequest(`/v1/user/file-catalog/file-catalog-item/${itemId}/update`, updateData);
  }

  getContentsIdsByFileCatalogIds(fileCatalogIds) {
    return this.postRequest(`/v1/file-catalog/get-contents-ids`, fileCatalogIds);
  }

  getAllItems(itemsName, search = null, listParams = {}) {
    let {sortBy, sortDir, limit, offset} = listParams;
    return this.getRequest(`/v1/admin/all-` + itemsName, {params: {search, sortBy, sortDir, limit, offset}});
  }

  getUserApiKeys(isDisabled = null, search = null, listParams = {}) {
    let {sortBy, sortDir, limit, offset} = listParams;
    return this.getRequest(`/v1/user/api-keys`, {params: {sortBy, sortDir, limit, offset}});
  }

  adminCreateUser(userData) {
    return this.postRequest(`/v1/admin/add-user`, userData);
  }

  adminSetUserLimit(limitData) {
    return this.postRequest(`/v1/admin/set-user-limit`, limitData);
  }

  adminIsHaveCorePermission(permissionName) {
    return this.getRequest(`v1/user/permissions/core/is-have/${permissionName}`).then(data => data.result);
  }

  adminAddCorePermission(userId, permissionName) {
    return this.postRequest(`/v1/admin/permissions/core/add_permission`, {userId, permissionName});
  }

  adminRemoveCorePermission(userId, permissionName) {
    return this.postRequest(`/v1/admin/permissions/core/remove_permission`, {userId, permissionName});
  }

  adminAddUserApiKey(userId) {
    return this.postRequest(`/v1/admin/add-user-api-key`, {userId});
  }

  adminGetBootNodes() {
    return this.getRequest(`/v1/admin/boot-nodes`);
  }

  adminAddBootNode(address) {
    return this.postRequest(`/v1/admin/boot-nodes/add`, {address});
  }

  adminRemoveBootNode(address) {
    return this.postRequest(`/v1/admin/boot-nodes/remove`, {address});
  }

  getNodeAddressList() {
    return this.getRequest(`/v1/node-address-list`).then(data => data.result);
  }

  async getNodeAddress(includes = null) {
    let addresses = await this.getNodeAddressList();

    if(includes) {
      return _.find(addresses, (address) => {
        return _.includes(address, includes);
      });
    } else {
      return _.filter(addresses, (address) => {
        return !_.includes(address, '127.0.0.1') && !_.includes(address, '192.168') && address.length > 64;//&& !_.includes(address, '/p2p-circuit/ipfs/')
      })[0];
    }
  }

  getGroupPeers(ipnsId) {
    return this.getRequest(`/v1/group/${ipnsId}/peers`);
  }

  async connectToIpfsNodeToServer() {
    let address = await this.getNodeAddress(this.isLocalServer() ? '127.0.0.1' : null);

    if(this.isLocalServer()) {
      address = address.replace('4002/ipfs', '4003/ws/ipfs')
    }
    
    // prevent Error: Dial is currently blacklisted for this peer on swarm connect
    this.ipfsNode.libp2p._switch.dialer.clearBlacklist(new PeerInfo(PeerId.createFromB58String(_.last(address.split('/')))));
    
    return this.ipfsService.addBootNode(address).then(() => console.log('successful connect to ', address)).catch((e) => console.warn('failed connect to ', address, e));
  }

  setServerByDocumentLocation() {
    let port = 7722;
    if (document.location.hostname === 'localhost' || document.location.hostname === '127.0.0.1' || _.startsWith(document.location.pathname, '/node')) {
      port = 7711;
    }
    this.server = document.location.protocol + "//" + document.location.hostname + ":" + port;
  }
  
  isLocalServer() {
    return _.includes(this.server, ':7711');
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

    preloadAddresses = preloadAddresses.map(address => {
      return address.replace('/p2p-circuit', '').replace('4002', '5002').replace(/\/ipfs\/.+/, '/');
    });

    preloadAddresses = preloadAddresses.concat([
      //TODO: get from some dynamic place
      '/dns4/node0.preload.ipfs.io/tcp/443/wss/ipfs/QmZMxNdpMkewiVZLMRxaNxUeZpDUb34pWjZ1kZvsd16Zic',
      '/dns4/node1.preload.ipfs.io/tcp/443/wss/ipfs/Qmbut9Ywz9YEDrz8ySBSgWyJk41Uvm2QJPhwDJzJyGFsD6'
    ]);

    console.log('preloadAddresses', preloadAddresses);

    return preloadAddresses;
  }

  async initBrowserIpfsNode() {
    function createIpfsNode(options) {
      return new Promise((resolve, reject) => {
        const ipfs = window['Ipfs'].createNode(_.merge({
          EXPERIMENTAL: {
            pubsub: true,
            ipnsPubsub: true
          }
        }, options));
        ipfs.once('ready', () => resolve(ipfs))
        ipfs.once('error', err => reject(err))
      })
    }

    return this.setIpfsNode(await createIpfsNode({
      preload: {
        enabled: true,
        addresses: await this.getPreloadAddresses()
      }
    }));
  }
}

class AbstractClientStorage {
  set(name, value) {
    assert(false, 'you have to override getValue');
  }

  get(name) {
    assert(false, 'you have to override getValue');
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


module.exports = {
  GeesomeClient,
  AbstractClientStorage,
  SimpleClientStorage,
  BrowserLocalClientStorage
};
