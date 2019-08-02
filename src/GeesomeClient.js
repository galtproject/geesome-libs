import axios from 'axios';

const _ = require('lodash');
const pIteration = require('p-iteration');
const ipfsHelper = require('./ipfsHelper');
const trie = require('./base36Trie');
const JsIpfsService = require('./JsIpfsService');

export class GeesomeClient {
  constructor(config) {
    this.server = config.server;
    this.apiKey = config.apiKey;
    this.ipfsNode = config.ipfsNode;
    
    this.clientStorage = config.clientStorage;

    this.$http = axios.create({});
    
    this.ipfsService = null;
    this.serverIpfsAddresses = [];
    this.serverLessMode = true;
  }
  
  async init() {
    await this.setServer(this.server);
    this.setApiKey(this.apiKey);
    if(this.ipfsNode) {
      await this.setIpfsNode(this.ipfsNode);
    }
  }
  
  getRequest(url, options = null) {
    return this.wrapResponse(this.$http.get(url, options));
  }
  postRequest(url, data = null) {
    return this.wrapResponse(this.$http.post(url, options));
  }

  wrapResponse(httPromise) {
    return httPromise.then(response => response.data).catch(data => {
      throw (data.response.data);
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

  async setServer(server) {
    this.server = server;
    this.$http.defaults.baseURL = server;
    await this.setServerIpfsAddreses();
  }
  
  setApiKey(apiKey) {
    this.apiKey = apiKey;

    this.$http.defaults.headers.post['Authorization'] = 'Bearer ' + apiKey;
    this.$http.defaults.headers.get['Authorization'] = 'Bearer ' + apiKey;
    
    if(!apiKey) {
      this.serverLessMode = true;
    }
  }

  async setIpfsNode(ipfsNode) {
    this.ipfsNode = ipfsNode;
    this.ipfsService = new JsIpfsService(this.ipfsNode);
    return this.connectToIpfsNodeToServer();
  }

  async loginUserPass(username, password) {
    return this.postRequest('/v1/login', {username, password}).then(data => {
      this.setApiKey(data.apiKey);
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

  async getMemberInGroups() {
    let groupsIds;
    if (this.serverLessMode) {
      groupsIds = this.clientStorage.joinedGroups();
    } else {
      //TODO: get groups list directly from ipld
      groupsIds = await this.getRequest('/v1/user/member-in-groups').then(groups => groups.map(g => g.manifestStorageId));
    }
    return pIteration.map(groupsIds, (groupId) => this.getGroup(groupId));
  }

  getAdminInGroups() {
    //TODO: get groups list directly from ipld
    return this.getRequest('/v1/user/admin-in-groups').then(groups => {
      return pIteration.map(groups, (group) => this.getGroup(group.manifestStorageId))
    });
  }

  async getDbGroup(groupId) {
    return this.getRequest(`/v1/group/${groupId}`);
  }

  async getGroup(groupId) {
    if (ipfsHelper.isIpfsHash(groupId)) {
      groupId = await this.resolveIpns(groupId);
    }

    const groupObj = await this.getIpld(groupId);

    await this.fetchIpldFields(groupObj, ['avatarImage', 'coverImage']);

    return groupObj;
    // return this.$http.get(`/v1/group/${groupId}`).then(response => response.data);
  }

  async fetchIpldFields(obj, fieldsNamesArr) {
    await pIteration.forEach(fieldsNamesArr, async (fieldName) => {
      if (!_.get(obj, fieldName)) {
        return;
      }
      _.set(obj, fieldName, await this.getIpld(_.get(obj, fieldName)));
    })
  }

  async getImageLink(image) {
    if (!image) {
      return null;
    }
    let storageId;
    if (image.content) {
      storageId = image.content;
    }
    if (ipfsHelper.isIpldHash(storageId)) {
      storageId = (await this.getIpld(storageId).content);
    }
    if (!storageId) {
      storageId = image;
    }
    return this.server + '/v1/content-data/' + storageId;
  }

  async getIpld(ipldHash) {
    if (ipldHash.multihash || ipldHash.hash) {
      ipldHash = ipfsHelper.cidToHash(ipldHash);
    }
    if (ipldHash['/']) {
      ipldHash = ipldHash['/'];
    }
    //this.getRequest(`/ipld/${ipldHash}`))
    return ipfsService.getObject(ipldHash).then(ipldData => {
      if (!ipldData) {
        return null;
      }
      ipldData.id = ipldHash;
      return ipldData;
    });
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
      const post = await this.getIpld(postsPath + postNumberPath);
      post.id = postNumber;
      post.manifestId = ipfsHelper.cidToHash(trie.getNode(group.posts, postNumber));
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
      post = await this.getIpld(postId);
      post.manifestId = postId;
    } else {
      const postsPath = group.id + '/posts/';
      const postNumberPath = trie.getTreePath(postId).join('/');
      post = await this.getIpld(postsPath + postNumberPath);
      post.manifestId = ipfsHelper.cidToHash(trie.getNode(group.posts, postId));
    }

    post.id = postId;
    // post.sourceIpld = _.clone(post);
    post.groupId = groupId;
    post.group = group;
    return post;
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

  getFileCatalogItems(parentItemId, type, params) {
    let {sortBy, sortDir, limit, offset, search} = params;

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

  getAllItems(itemsName, search, params) {
    let {sortBy, sortDir, limit, offset} = params;
    return this.getRequest(`/v1/admin/all-` + itemsName, {params: {search, sortBy, sortDir, limit, offset}});
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

  adminAddUserAPiKey(userId) {
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

  getGroupPeers(ipnsId) {
    return this.getRequest(`/v1/group/${ipnsId}/peers`);
  }

  async connectToIpfsNodeToServer() {
    await pIteration.forEach(this.serverIpfsAddresses, async (address) => {
      return this.ipfsService.addBootNode(address).then(() => console.log('successful connect to ', address)).catch((e) => console.warn('failed connect to ', address, e));
    })
  }
  
  async setServerIpfsAddreses() {
    this.serverIpfsAddresses = await this.getNodeAddressList();

    this.serverIpfsAddresses.forEach(address => {
      if (_.includes(address, '192.168')) {
        this.serverIpfsAddresses.push(address.replace(/\b(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/, '127.0.0.1'));
      }
    });
  }
  
  async getPreloadAddresses() {
    let isLocalServer;

    if (!this.server) {
      let port = 7722;
      if (document.location.hostname === 'localhost' || document.location.hostname === '127.0.0.1' || _.startsWith(document.location.pathname, '/node')) {
        port = 7711;
        isLocalServer = true;
      }
      this.server = document.location.protocol + "//" + document.location.hostname + ":" + port;
    } else {
      isLocalServer = _.includes(this.server, ':7711');
    }

    await this.setServerIpfsAddreses();

    let preloadAddresses;

    if (isLocalServer) {
      preloadAddresses = this.serverIpfsAddresses.filter((address) => {
        return _.includes(address, '127.0.0.1');
      })
    } else {
      preloadAddresses = this.serverIpfsAddresses.filter((address) => {
        return !_.includes(address, '127.0.0.1') && !_.includes(address, '192.') && address.length > 64;
      })
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

export class AbstractClientStorage {
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

export class SimpleClientStorage extends AbstractClientStorage {
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

export class BrowserLocalClientStorage extends AbstractClientStorage {
  static get(name) {
    try {
      return JSON.parse(localStorage.getItem(name));
    } catch (e) {
      return null;
    }
  }

  static set(name, value) {
    localStorage.setItem(name, JSON.stringify(value));
  }
}
