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

import chai from 'chai';
import dirtyChai from 'dirty-chai';
const expect = chai.expect;
chai.use(dirtyChai);

import JsIpfsService from '../src/JsIpfsService';
import ipfsHelper from '../src/ipfsHelper';
import peerIdHelper from '../src/peerIdHelper';
import common from '../src/common';
import trie from '../src/base36Trie';
import { createHelia } from 'helia';
import { MemoryBlockstore } from 'blockstore-core';
import { MemoryDatastore } from 'datastore-core';
import * as Filters from '@libp2p/websockets/filters';
import { bootstrap } from '@libp2p/bootstrap';
import { identify } from '@libp2p/identify';
import { tcp } from '@libp2p/tcp';
import { webSockets } from "@libp2p/websockets";
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
const blockstore = new MemoryBlockstore();
const datastore = new MemoryDatastore();
import { unixfs } from '@helia/unixfs';

describe.only('ipfs', function () {
  let node;

  beforeEach(function (done) {
    this.timeout(400 * 1000);

    (async () => {
      try {
        // const libp2p = await createLibp2p({
        //   datastore,
        //   streamMuxers: [
        //     yamux()
        //   ],
        //   services: {
        //     identify: identify()
        //   },
        //   addresses: {
        //     listen: [
        //       '/ip4/127.0.0.1/tcp/0'
        //     ]
        //   },
        //   transports: [
        //     webSockets({
        //       filter: Filters.all // this is necessary to dial insecure websockets
        //     })
        //     // other transports
        //   ],
        //   connectionGater: {
        //     denyDialMultiaddr: () => false // this is necessary to dial local addresses at all
        //   },
        //   peerDiscovery: [
        //     bootstrap({
        //       list: [
        //         '/ip4/127.0.0.1/tcp/4001/ws/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
        //       ]
        //     })
        //   ],
        // });
        // console.log('libp2p', libp2p);
        const helia = await createHelia({
          // datastore,
          blockstore,
          // libp2p,
        });
        node = new JsIpfsService(helia);
        await node.init();
        // add the bytes to your node and receive a unique content identifier
      } catch (error) {
        console.error('catch', error);
      }
      done();
    })();
  });

  afterEach((done) => {node.stop().then(() => done())})

  it('should save file with correct ipfs hash', function (done) {
    this.timeout(80 * 1000);

    (async () => {
      const content = '1';
      const savedText = await node.saveFile(content, {waitForPin: true});
      try {
        const ipfsHash = await ipfsHelper.getIpfsHashFromString(content);
        expect(ipfsHash).to.equals('bafkreidlq2zhh7zu7tqz224aj37vup2xi6w2j2vcf4outqa6klo3pb23jm');
        expect(ipfsHelper.isFileCidHash(ipfsHash)).to.equals(true);
        expect(savedText.id).to.equals(ipfsHash);
        const savedText2 = await node.saveFile('2', {waitForPin: true});
        expect(ipfsHelper.isFileCidHash(savedText2.id)).to.equals(true);
        expect(ipfsHelper.isAccountCidHash(savedText2.id)).to.equals(false);
        expect(ipfsHelper.isObjectCidHash(savedText2.id)).to.equals(false);
      } catch (e) {
        console.error('catch', e);
      }
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
      expect(ipfsHelper.isObjectCidHash(savedIpldHash)).to.equals(true);
      expect(ipfsHelper.isAccountCidHash(savedIpldHash)).to.equals(false);
      expect(ipfsHelper.isFileCidHash(savedIpldHash)).to.equals(false);

      const gotObject = await node.getObject(savedIpld);
      expect(gotObject.foo).to.equals('bar');
      done();
    })().catch(e => {
      console.error('catch', e);
    });
  });

  it('should resolve object props', function (done) {
    this.timeout(80 * 1000);

    (async () => {
      const array = ['bar1', 'bar2'];
      const arrayId = await node.saveObject(array);
      expect(ipfsHelper.isObjectCidHash(arrayId)).to.equals(true);
      const nestedObj = {
        '0': 'zero',
        '1': 'one'
      };
      const nestedObjId = await node.saveObject(nestedObj);

      const obj = {
        foo: 'bar',
        fooArray: arrayId,
        fooObj: nestedObjId
      };
      const objectId = await node.saveObject(obj);
      expect(await node.getObjectProp(objectId, 'fooArray', true)).to.deep.equal(array);
      expect(await node.getObjectProp(objectId, 'fooArray/0', true)).to.deep.equal(array[0]);
      expect(await node.getObjectProp(objectId, 'fooObj', true)).to.deep.equal(nestedObj);
      expect(await node.getObjectProp(objectId, 'fooObj/0', true)).to.equal(nestedObj[0]);
      expect(await node.getObjectProp(objectId, 'fooArray', false)).to.deep.equal(arrayId);
      expect(await node.getObjectProp(objectId, 'fooObj', false)).to.deep.equal(nestedObjId);
      done();
    })().catch(e => console.error('error', e));
  });

  it('should resolve trie props', function (done) {
    this.timeout(80 * 1000);

    (async () => {
      const postsTree = {};

      for (let i = 1; i <= 100; i++) {
        const postManifestId = await node.saveObject({ name: 'Post #' + i });
        trie.setNode(postsTree, i, postManifestId);
      }

      const groupManifest = await node.saveObject({
        name: 'Group tree',
        posts: postsTree
      });

      for (let i = 1; i <= 100; i++) {
        const postNumberPath = trie.getTreePostCidPath(groupManifest, i);
        const obj = await node.getObject(postNumberPath, true);
        expect(obj.name).to.equal('Post #' + i);
      }
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
        updatedAt: new Date(Date.parse('2021-09-23T16:44:34.483Z')),
        createdAt: new Date(Date.parse('2021-09-23T16:44:34.483Z')),
        staticId: 'QmRxqZjNRMFoQxKXhBRMDDJupm9KXXHmQgTcwQ83G7PRdc',
        publicKey: 'CAASpgIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDgArr1MKM1YgNcZLMV303XO4wvQ621/yODb921mB8UT03RBjiTBpGCzfKjJ1Ud/g4uZFHRYV9kJl6t8bUOPG1BhpM84shRX1uDIdlLHBVPwaJJLmlQbbor03bKFYP9r3YIyPPDM9EF5hzet3uiMqj9d3j6QMUiWO5xTaCuvVfUHszurk96RDfpCENd2ImpAte0geOwdTBhlajghZWqGjW9t93YJSUyaqjJNpS3pJ5j95ENCnofXPs909xGNc9XcVM8D2yqPqaVjHz0RXSP7dVg1+Yb6H2R1EYLdCftB/S+LeqKP5NmiXPLwHtnrsyf1A2K62HdtqPTsOCl2ve8uLTVAgMBAAE=',
        accounts: [],
        _version: '0.1',
        _source: 'geesome-node',
        _protocol: 'geesome-ipsp',
        _type: 'user-manifest'
      };

      const pickObjectFields = ipfsHelper.pickObjectFields(userObj, ['name', 'title', 'email', 'description', 'updatedAt', 'createdAt', 'staticId', 'publicKey', 'accounts', '_version', '_source', '_protocol', '_type']);
      const storageId = await ipfsHelper.getIpldHashFromObject(pickObjectFields);
      expect(storageId).to.equals('bafyreidbolvs64moiamhoq4xol5jmrzpgi27wgxgwseiopr7nrkgn4pemu');
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

      expect(ipfsHelper.isAccountCidHash(peerIdHelper.peerIdToCid(peerId))).to.equals(true);
      expect(ipfsHelper.isObjectCidHash(peerIdHelper.peerIdToCid(peerId))).to.equals(false);
      expect(ipfsHelper.isFileCidHash(peerIdHelper.peerIdToCid(peerId))).to.equals(false);
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
