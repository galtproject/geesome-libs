/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const sortBy = require('lodash/sortBy');
const { Keccak } = require('sha3');
const base64url = require('base64url');
const ipns = require('ipns');
const {fromB58String} = require('multihashes');

const name = {
  getPersonalChatName(friendsIds, groupTheme) {
    return sortBy(friendsIds).join(':') + ':personal_chat:' + groupTheme;
  },
  getPersonalChatTopic(friendsIds, groupTheme) {
    const namespace = '/geesome/group/';
    const hash = new Keccak(256);
    return namespace + hash.update(name.getPersonalChatName(friendsIds, groupTheme)).digest('hex');
  },
  getGroupUpdatesTopic(groupIpns) {
    const namespace = '/geesome/group/';
    return `${namespace}${name.base64Ipns(groupIpns)}`;
  },

  getFluenceUpdatesTopic(ipnsId) {
    return ipnsId;
  },

  getIpnsUpdatesTopic(ipnsId) {
    const namespace = '/record/';
    return `${namespace}${name.base64Ipns(ipnsId)}`;
  },

  base64Ipns(ipnsId) {
    const multihash = fromB58String(ipnsId);
    const idKeys = ipns.getIdKeys(multihash);
    return base64url.encode(idKeys.routingKey._buf);
  }
};


module.exports = name;
