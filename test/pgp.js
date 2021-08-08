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

const {GeesomeClient} = require('../src/GeesomeClient');
const pgpHelper = require('../src/pgpHelper');
const peerIdHelper = require('../src/peerIdHelper');
const ipfsHelper = require('../src/ipfsHelper');

describe('pgp', function () {
  let geesomeClient;
  const pass = 'ipfs-is-awesome-software';

  const createNode = () => {
    return ipfsHelper.createDaemonNode({
      config: {
        Bootstrap: [],
        Discovery: {
          MDNS: {
            Enabled: false
          },
          webRTCStar: {
            Enabled: false
          }
        }
      },
      preload: {enabled: false},
    }, { pass });
  };

  before(function (done) {
    this.timeout(40 * 1000);

    (async () => {
      const ipfsNode = await createNode();
      
      geesomeClient = new GeesomeClient({ ipfsNode });
      await geesomeClient.init();
      
      done();
    })();
  });

  after((done) => {geesomeClient.ipfsNode.stop().then(() => done())});

  it('should encrypt and decrypt messages', function (done) {

    (async () => {
      this.timeout(10 * 1000);

      const bobId = await geesomeClient.ipfsService.createAccountIfNotExists('bob');
      const aliceId = await geesomeClient.ipfsService.createAccountIfNotExists('alice');

      const bobKey = await geesomeClient.ipfsService.keyLookup(bobId, pass);
      const aliceKey = await geesomeClient.ipfsService.keyLookup(aliceId, pass);

      const bobPrivateKey = await pgpHelper.transformKey(bobKey.marshal());
      const alicePrivateKey = await pgpHelper.transformKey(aliceKey.marshal());

      // DO NOT WORKING :(
      // const bobPublicPeerId = ipfsHelper.createPeerIdFromIpns(bobId);
      // const alicePublicPeerId = ipfsHelper.createPeerIdFromIpns(aliceId);
      // bobPublicPeerId._pubKey = ipfsHelper.extractPublicKeyFromId(bobPublicPeerId);
      // alicePublicPeerId._pubKey = ipfsHelper.extractPublicKeyFromId(alicePublicPeerId);
      
      const bobPublicKey = await pgpHelper.transformKey(bobKey.public.marshal(), true);
      const alicePublicKey = await pgpHelper.transformKey(aliceKey.public.marshal(), true);

      const plainText = 'Hello world!';

      const encryptedText = await pgpHelper.encrypt([bobPrivateKey], [alicePublicKey, bobPublicKey], plainText);

      const decryptedByAliceText = await pgpHelper.decrypt([alicePrivateKey], [bobPublicKey], encryptedText);

      expect(plainText).to.equals(decryptedByAliceText);

      const decryptedByBobText = await pgpHelper.decrypt([bobPrivateKey], [], encryptedText);

      expect(plainText).to.equals(decryptedByBobText);
      done();
    })();
  });

  it('should sign fluence message and validate signature', function (done) {
    (async () => {
      this.timeout(10 * 1000);

      const bobId = await geesomeClient.ipfsService.createAccountIfNotExists('bob');
      const aliceId = await geesomeClient.ipfsService.createAccountIfNotExists('alice');

      const bobKey = await geesomeClient.ipfsService.keyLookup(bobId, pass);
      const aliceKey = await geesomeClient.ipfsService.keyLookup(aliceId, pass);
      const bobKeyBase58 = peerIdHelper.privateKeyToBase64(bobKey);
      const alicePeerId = await peerIdHelper.createPeerIdFromPrivKey(peerIdHelper.privateKeyToBase64(aliceKey));
      const aliceBase64PublicKey = peerIdHelper.peerIdToPublicBase64(alicePeerId);

      const msg = await ipfsHelper.buildAndSignFluenceMessage(bobKeyBase58, 'test');
      expect(await ipfsHelper.checkFluenceSignature(msg.from, msg.data, msg.seqno, msg.signature)).to.equals(true);
      expect(await ipfsHelper.checkFluenceSignature(aliceBase64PublicKey, msg.data, msg.seqno, msg.signature)).to.equals(false);
      done();
    })();
  })
});
