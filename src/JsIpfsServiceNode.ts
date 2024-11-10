/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import JsIpfsService from './JsIpfsService';
import { globSource } from '@helia/unixfs';
import fs from 'node:fs';
import Path from "path";
import trim from 'lodash/trim.js';

export default class JsIpfsServiceNode extends JsIpfsService {
  async saveFileByPath(path, options = {}) {
    return this.saveFile(fs.createReadStream(path), options);
  }

  async saveDirectory(path, options: any = {}) {
    let res;
    let asyncGenerator;
    path = Path.resolve(process.cwd(), path);
    if (this.type === 'helia') {
      asyncGenerator = this.heliaFs.addAll(filterGlobSource(path, `{.,**/*}`), {wrapWithDirectory: true});
    } else {
      asyncGenerator = this.node.addAll(filterGlobSource(path, `**/*`), {
        pin: false,
        cidVersion: 1,
        wrapWithDirectory: true
      });
    }
    for await (const file of asyncGenerator) {
      if (!file.path || file.path === path || file.path === trim(path, '/')) {
        res = file;
      }
      console.log('addAll path', path, 'file', file)
    }
    const dirResult = this.wrapIpfsItem(res);
    const pinPromise = this.addPin(dirResult.id);
    if (options.waitForPin) {
      await pinPromise;
    }
    return dirResult;
  }
};

async function * filterGlobSource(path, pattern) {
  // yield* globSource(path + '/', '{.,**/*}', {});
  // const splitPath = trim(path, '/').split('/');
  // const subPath = '/' + splitPath.slice(0, -1).join('/');
  // const dirName = splitPath.slice(-1)
  for await (const p of globSource(path, pattern)) {
    // if (p.path === path || p.path === trim(path, '/')) {
    //   p.path += '/';
    // }
    if (!p.content) {
      p.content = null;
    }
    // console.log('p', p);
    yield p
  }
}