/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const trieLib = {
  setNode(tree, id, node) {
    id = id.toString();
    const treePath = trieLib.getTreePath(id);

    let parentNode = tree;
    treePath.forEach((treePathItem) => {
      if (treePathItem.indexOf('_') === -1) {
        parentNode[treePathItem] = node;
      } else {
        if (!parentNode[treePathItem]) {
          parentNode[treePathItem] = {};
        }
        parentNode = parentNode[treePathItem];
      }
    });
  },

  getNode(tree, id) {
    id = id.toString();
    const treePath = trieLib.getTreePath(id);
    let curNode = tree;
    for (let i = 0; i < treePath.length; i++) {
      curNode = curNode[treePath[i]];
      if (i === treePath.length - 1) {
        return curNode;
      }
    }
  },

  getTreePath(id) {
    const idStr = id.toString();
    const splitId = idStr.split('');
    return splitId.map((idChunk, index) => {
      if (index === splitId.length - 1) {
        return idStr;
      }
      return idChunk + '_';
    });
  }
};

module.exports = trieLib;
