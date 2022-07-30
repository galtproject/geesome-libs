/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import sortBy from 'lodash/sortBy.js';
import { Keccak } from 'sha3';
import base64url from 'base64url';
import * as ipns from 'ipns';
import {fromB58String} from'multihashes';
import peerIdHelper from'./peerIdHelper.js';

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

  getFluenceUpdatesTopic(cid, namespace) {
    const hash = new Keccak(256);
    return hash.update(`/${namespace}/${cid}`).digest('hex');
  },

  getFluenceAccountsGroupUpdatesTopic(cids, namespace) {
    const hash = new Keccak(256);
    return hash.update(`/${namespace}/${sortBy(cids).join(':')}`).digest('hex');
  },

  getIpnsUpdatesTopic(ipnsId) {
    const namespace = '/record/';
    return `${namespace}${name.base64Ipns(ipnsId)}`;
  },

  getPeerIdTopic(peerId) {
    return peerIdHelper.peerIdToPublicBase58(peerId);
  },

  base64Ipns(ipnsId) {
    const multihash = fromB58String(ipnsId);
    const idKeys = ipns.getIdKeys(multihash);
    return base64url.encode(idKeys.routingKey._buf);
  }
};

export default name;
