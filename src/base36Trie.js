/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const base36 = require('./base36');
const trie = require('./trie');

const base36TrieLib = {
  setNode(tree, id, node) {
    id = base36.encode(id.toString());
    trie.setNode(tree, id, node);
  },

  getNode(tree, id) {
    id = base36.encode(id.toString());
    return trie.getNode(tree, id);
  },

  getTreePath(id) {
    id = base36.encode(id.toString());
    return trie.getTreePath(id);
  }
};

module.exports = base36TrieLib;
