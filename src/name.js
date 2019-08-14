const _ = require('lodash');

module.exports = {
  getPersonalChatName(friendsIds, groupTheme) {
    return _.sortBy(friendsIds).join(':') + ':personal_chat:' + groupTheme;
  }
};
