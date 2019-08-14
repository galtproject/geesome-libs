const _ = require('lodash');
const { Keccak } = require('sha3');

const name = {
  getPersonalChatName(friendsIds, groupTheme) {
    return _.sortBy(friendsIds).join(':') + ':personal_chat:' + groupTheme;
  },
  getPersonalChatHash(friendsIds, groupTheme) {
    const hash = new Keccak(256);
    return hash.update(name.getPersonalChatName(friendsIds, groupTheme)).digest('hex');
  }
};

module.exports = name;
