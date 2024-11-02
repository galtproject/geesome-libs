/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import JsIpfsService from './JsIpfsService.js';
import { globSource } from '@helia/unixfs';
import fs from 'node:fs';
import Path from "path";

export default class JsIpfsServiceNode extends JsIpfsService {
  async saveFileByPath(path, options = {}) {
    return this.saveFile(fs.createReadStream(path), options);
  }

  async saveDirectory(path, options = {}) {
    let res;
    let asyncGenerator;
    if (this.type === 'helia') {
      asyncGenerator = this.heliaFs.addAll(globSource(path, '**/*', {}));
    } else {
      asyncGenerator = this.node.addAll(globSource(path, '**/*',{}), {
        pin: false,
        cidVersion: 1
      });
    }
    path = Path.resolve(process.cwd(), path);
    for await (const file of asyncGenerator) {
      if (file.path === path) {
        res = file;
      }
      console.log('addAll file', file)
    }
    const dirResult = this.wrapIpfsItem(res);
    const pinPromise = this.addPin(dirResult.id);
    if (options.waitForPin) {
      await pinPromise;
    }
    return dirResult;
  }
};
