/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const JsIpfsService = require('./JsIpfsService');

module.exports = class JsIpfsServiceNode extends JsIpfsService {
  async saveFileByPath(path) {
    const fs = require('fs');
    return this.saveFile({content: fs.createReadStream(path)});
  }
};
