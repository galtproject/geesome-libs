/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import crypto from 'libp2p-crypto';
import PeerId from 'peer-id';
import {keys as cryptoKeys} from 'libp2p-crypto';

const peerIdHelper = {
  async encryptPrivateBase64WithPass(privateBase64, pass) {
    return (await this.createPeerIdFromPrivateBase64(privateBase64)).privKey.export(pass)
  },

  async decryptPrivateBase64WithPass(encryptedPrivateKey, pass) {
    return Buffer.from((await crypto.keys.import(encryptedPrivateKey, pass)).bytes).toString('base64');
  },

  peerIdToPrivateBase64(peerId) {
    return peerId.marshalPrivKey().toString('base64');
  },

  peerIdToPublicBase64(peerId) {
    return peerId.marshalPubKey().toString('base64');
  },

  peerIdToPublicBase58(peerId) {
    return peerId.toB58String();
  },

  async createPeerIdFromPrivateBase64(base64) {
    return peerIdHelper.createPeerIdFromPrivKey(Buffer.from(base64, 'base64'));
  },

  async createPeerIdFromPublicBase64(base64) {
    return peerIdHelper.createPeerIdFromPubKey(Buffer.from(base64, 'base64'));
  },

  base64ToPublicKey(base64) {
    return cryptoKeys.unmarshalPublicKey(new Uint8Array(Buffer.from(base64, 'base64')))
  },

  publicKeyToBase64(publicKey) {
    return (publicKey.bytes ? Buffer.from(publicKey.bytes) : publicKey).toString('base64');
  },

  privateKeyToBase64(privateKey) {
    return (privateKey.bytes ? Buffer.from(privateKey.bytes) : privateKey).toString('base64');
  },

  createPeerId: PeerId.create.bind(PeerId),
  createPeerIdFromPubKey: PeerId.createFromPubKey.bind(PeerId),
  createFromB58String: PeerId.createFromB58String.bind(PeerId),
  createPeerIdFromPrivKey: PeerId.createFromPrivKey.bind(PeerId),
  createPeerIdFromIpns: PeerId.createFromCID.bind(PeerId)
};
export default peerIdHelper;
