export class JsIpfsServiceNode extends JsIpfsService {
  async saveFileByPath(path) {
    const fs = require('fs');
    return this.saveFile({content: fs.createReadStream(path)});
  }
}
