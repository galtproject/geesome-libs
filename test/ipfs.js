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
const peerIdHelper = require('../src/peerIdHelper');
const common = require('../src/common');

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

  it('should resolve object props', function (done) {
    this.timeout(80 * 1000);

    (async () => {
      const array = ['bar1', 'bar2'];
      const arrayId = await node.saveObject(array);

      const obj = {
        foo: 'bar',
        fooArray: arrayId
      };
      const objectId = await node.saveObject(obj);
      expect(await node.getObjectProp(objectId, 'fooArray')).to.deep.equal(array);
      done();
    })();
  });

  it('should resolve object props', function (done) {
    this.timeout(80 * 1000);

    (async () => {
      const userObj = {
        name: 'admin',
        title: undefined,
        email: 'admin@admin.com',
        description: undefined,
        updatedAt: Date.parse('2021-09-23T16:44:34.483Z'),
        createdAt: Date.parse('2021-09-23T16:44:34.483Z'),
        staticId: 'QmRxqZjNRMFoQxKXhBRMDDJupm9KXXHmQgTcwQ83G7PRdc',
        publicKey: 'CAASpgIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDgArr1MKM1YgNcZLMV303XO4wvQ621/yODb921mB8UT03RBjiTBpGCzfKjJ1Ud/g4uZFHRYV9kJl6t8bUOPG1BhpM84shRX1uDIdlLHBVPwaJJLmlQbbor03bKFYP9r3YIyPPDM9EF5hzet3uiMqj9d3j6QMUiWO5xTaCuvVfUHszurk96RDfpCENd2ImpAte0geOwdTBhlajghZWqGjW9t93YJSUyaqjJNpS3pJ5j95ENCnofXPs909xGNc9XcVM8D2yqPqaVjHz0RXSP7dVg1+Yb6H2R1EYLdCftB/S+LeqKP5NmiXPLwHtnrsyf1A2K62HdtqPTsOCl2ve8uLTVAgMBAAE=',
        accounts: [],
        _version: '0.1',
        _source: 'geesome-node',
        _protocol: 'geesome-ipsp',
        _type: 'user-manifest'
      };

      const storageId = await ipfsHelper.getIpldHashFromObject(
          ipfsHelper.pickObjectFields(userObj, ['name', 'title', 'email', 'description', 'updatedAt', 'createdAt', 'staticId', 'publicKey', 'accounts', '_version', '_source', '_protocol', '_type'])
      );
      assert.equal(storageId, 'bafyreigx5agapxojfn4rge4wzti77sz7q35lrnmhc7w2ev24ofpjfav3di');
      done();
    })();
  });


  it('should correctly convert peerId to string representations', function (done) {
    this.timeout(80 * 1000);

    (async () => {
      const peerId = await peerIdHelper.createPeerId();

      expect(peerIdHelper.peerIdToPrivateBase64(peerId).indexOf('CAAS')).to.equals(0);
      expect(peerIdHelper.peerIdToPrivateBase64(peerId).length === 1596 || peerIdHelper.peerIdToPrivateBase64(peerId).length === 1600).to.equals(true);

      expect(peerIdHelper.peerIdToPublicBase64(peerId).indexOf('CAAS')).to.equals(0);
      expect(peerIdHelper.peerIdToPublicBase64(peerId).length).to.equals(400);

      const pubKey = peerIdHelper.base64ToPublicKey(peerIdHelper.peerIdToPublicBase64(peerId));
      const peerIdFromPubKey = await peerIdHelper.createPeerIdFromPubKey(pubKey.bytes);
      expect(peerIdHelper.peerIdToPublicBase58(peerId)).to.equals(peerIdHelper.peerIdToPublicBase58(peerIdFromPubKey));
      expect(peerIdHelper.publicKeyToBase64(pubKey)).to.equals(peerIdHelper.peerIdToPublicBase64(peerId));

      expect(peerIdHelper.peerIdToPublicBase58(peerId).indexOf('Qm')).to.equals(0);
      expect(peerIdHelper.peerIdToPublicBase58(peerId).length).to.equals(46);

      done();
    })();
  });

  it('encrypt and decrypt base64 private key', function (done) {
    this.timeout(80 * 1000);

    (async () => {
      const pass = common.random('words');
      const peerId = await peerIdHelper.createPeerId();
      const privateKey = peerIdHelper.peerIdToPrivateBase64(peerId);

      const encryptedPrivateKey = await peerIdHelper.encryptPrivateBase64WithPass(privateKey, pass);
      expect(encryptedPrivateKey.indexOf('-----BEGIN ENCRYPTED PRIVATE KEY-----')).to.equals(0);

      const decryptedPrivateKey = await peerIdHelper.decryptPrivateBase64WithPass(encryptedPrivateKey, pass);
      expect(decryptedPrivateKey).to.equals(privateKey);

      done();
    })();
  });
});
