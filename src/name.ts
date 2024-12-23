/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import sortBy from 'lodash/sortBy.js';
import {Keccak} from 'sha3';
import base64url from 'base64url';
import {fromB58String} from 'multihashes';
import {fromString as uint8ArrayFromString, concat as uint8ArrayConcat} from 'uint8arrays';
import {base32upper} from 'multiformats/bases/base32';
import {key as Key} from "openpgp";
// const ipns = require('ipns');

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

  base64Ipns(ipnsId) {
    const multihash = fromB58String(ipnsId);
    // const idKeys = ipns.getIdKeys(multihash);
    // return base64url.encode(idKeys.routingKey._buf);
  }
};

function getIdKeys (pid) {
  const pkBuffer = uint8ArrayFromString('/pk/')
  const ipnsBuffer = uint8ArrayFromString('/ipns/')

  return {
    routingPubKey: new (Key as any)(uint8ArrayConcat([pkBuffer, pid]), false), // Added on https://github.com/ipfs/js-ipns/pull/8#issue-213857876 (pkKey will be deprecated in a future release)
    pkKey: new (Key as any)(rawStdEncoding(uint8ArrayConcat([pkBuffer, pid]))),
    routingKey: new (Key as any)(uint8ArrayConcat([ipnsBuffer, pid]), false), // Added on https://github.com/ipfs/js-ipns/pull/6#issue-213631461 (ipnsKey will be deprecated in a future release)
    ipnsKey: new (Key as any)(rawStdEncoding(uint8ArrayConcat([ipnsBuffer, pid])))
  }
}

function rawStdEncoding(key) {
  return base32upper.encode(key).slice(1);
}

export default name;
