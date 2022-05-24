/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const JsIpfsService = require('./JsIpfsService');
const globSource = require('ipfs-utils/src/files/glob-source');

module.exports = class JsIpfsServiceNode extends JsIpfsService {
  async saveFileByPath(path, options = {}) {
    const fs = require('fs');
    return this.saveFile({content: fs.createReadStream(path)}, options);
  }

  async saveDirectory(path, options = {}) {
    const res = await this.node.add(globSource(path, { recursive: true }), {pin: false, cidVersion: 1});
    const dirResult = this.wrapIpfsItem(res);
    const pinPromise = this.addPin(dirResult.id);
    if (options.waitForPin) {
      await pinPromise;
    }
    return dirResult;
  }
};
