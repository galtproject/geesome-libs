/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */
'use strict';

const chai = require('chai');
const dirtyChai = require('dirty-chai');
const expect = chai.expect;
chai.use(dirtyChai);

const JsIpfsService = require('../src/JsIpfsService');
const ipfsHelper = require('../src/ipfsHelper');

describe('ipfs', function () {
  let node;

  beforeEach(function (done) {
    this.timeout(40 * 1000);

    (async () => {
      node = new JsIpfsService(await ipfsHelper.createDaemonNode({
        test: true,
        disposable: true,
      }));
      done();
    })();
  });

  afterEach((done) => {node.stop().then(() => done())})

  it('should save file with correct ipfs hash', function (done) {
    this.timeout(80 * 1000);

    (async () => {
      const content = '1';
      const savedText = await node.saveFileByData(content, {waitForPin: true});
      const ipfsHash = await ipfsHelper.getIpfsHashFromString(content);
      expect(ipfsHash).to.equals('QmWYddCPs7uR9EvHNCZzpguVFVNfHc6aM3hPVzPdAEESMc');
      expect(savedText.id).to.equals(ipfsHash);
      done();
    })();
  });

  it('should save object with correct ipld hash', function (done) {
    this.timeout(80 * 1000);

    (async () => {
      const content = {foo: 'bar'};
      const savedIpld = await node.saveObject(content, {waitForPin: true});
      const savedIpldHash = await ipfsHelper.getIpldHashFromObject(content);
      expect(savedIpld).to.equals('bafyreiblaotetvwobe7cu2uqvnddr6ew2q3cu75qsoweulzku2egca4dxq');
      expect(savedIpld).to.equals(savedIpldHash);

      const gotObject = await node.getObject(savedIpld);
      expect(gotObject.foo).to.equals('bar');
      done();
    })();
  });

  it('should correctly convert peerId to string representations', function (done) {
    this.timeout(80 * 1000);

    (async () => {
      const peerId = await ipfsHelper.createPeerId();

      expect(ipfsHelper.peerIdToPrivateBase64(peerId).indexOf('CAAS')).to.equals(0);
      expect(ipfsHelper.peerIdToPrivateBase64(peerId).length).to.equals(1596);

      expect(ipfsHelper.peerIdToPublicBase64(peerId).indexOf('CAAS')).to.equals(0);
      expect(ipfsHelper.peerIdToPublicBase64(peerId).length).to.equals(400);

      expect(ipfsHelper.peerIdToPublicBase58(peerId).indexOf('Qm')).to.equals(0);
      expect(ipfsHelper.peerIdToPublicBase58(peerId).length).to.equals(46);

      done();
    })();
  });
});
