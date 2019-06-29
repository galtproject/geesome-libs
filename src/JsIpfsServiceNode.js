const JsIpfsService = require('./JsIpfsService');

module.exports = class JsIpfsServiceNode extends JsIpfsService {
  async saveFileByPath(path) {
    const fs = require('fs');
    return this.saveFile({content: fs.createReadStream(path)});
  }
};
