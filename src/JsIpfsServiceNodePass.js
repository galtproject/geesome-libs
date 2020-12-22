/*
 * Copyright ©️ 2020 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const JsIpfsServiceNode = require('./JsIpfsServiceNode');

module.exports = function (node, pass) {
  class JsIpfsServiceNodePass extends JsIpfsServiceNode {
    constructor(node) {
      super(node);
    }
    getAccountPublicKey(accountKey) {
      return super.getAccountPublicKey(accountKey, pass);
    }
    getAccountPeerId(accountKey) {
      return super.getAccountPeerId(accountKey, pass);
    }
    keyLookup(accountKey) {
      return super.keyLookup(accountKey, pass);
    }
  }
  return new JsIpfsServiceNodePass(node);
};
