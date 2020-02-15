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
const itAll = require('it-all');
const find = require('lodash/find');
const last = require('lodash/last');

module.exports = class JsIpfsServiceNode extends JsIpfsService {
  async saveFileByPath(path) {
    const fs = require('fs');
    return this.saveFile({content: fs.createReadStream(path)});
  }

  async saveDirectory(path) {
    const dirName = last(path.split('/'));
    const allResults = await itAll(this.node.add(globSource(path, { recursive: true })));
    const dirResult = this.wrapIpfsItem(find(allResults, {path: dirName}));
    await this.node.pin.add(dirResult.id);
    return dirResult;
  }
};
