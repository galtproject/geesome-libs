/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */
'use strict';

const hat = require('hat');
const chai = require('chai');
const dirtyChai = require('dirty-chai');
const expect = chai.expect;
chai.use(dirtyChai);

const IPFS = require('ipfs');
const {GeesomeClient} = require('../src/GeesomeClient');
const pgpHelper = require('../src/pgpHelper');

const DaemonFactory = require('ipfsd-ctl');
const df = DaemonFactory.create({type: 'proc'});
const util = require('util');

describe('pgp', function () {
  let geesomeClient;

  const dfSpawn = util.promisify(df.spawn).bind(df);
  const createNode = () => {
    return dfSpawn({
      exec: IPFS,
      args: [`--pass ${hat()}`, '--enable-namesys-pubsub'],
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
      preload: {enabled: false}
    }).then(node => node.api)
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

  after((done) => {geesomeClient.ipfsService.stop().then(done)});

  it('should handle signed event and validate signature', function (done) {

    (async () => {
      this.timeout(10 * 1000);

      const bobId = await geesomeClient.ipfsService.createAccountIfNotExists('bob');
      const aliceId = await geesomeClient.ipfsService.createAccountIfNotExists('alice');

      const bobKey = await geesomeClient.ipfsService.keyLookup(bobId);
      const aliceKey = await geesomeClient.ipfsService.keyLookup(aliceId);

      const bobPrivateKey = await pgpHelper.transformKey(bobKey.marshal());
      const alicePrivateKey = await pgpHelper.transformKey(aliceKey.marshal());

      const bobPublicKey = await pgpHelper.transformKey(bobKey.public.marshal(), true);
      const alicePublicKey = await pgpHelper.transformKey(aliceKey.public.marshal(), true);

      const plainText = 'Hello world!';

      const encryptedText = await pgpHelper.encrypt([bobPrivateKey], [alicePublicKey], plainText);

      const decryptedText = await pgpHelper.decrypt([alicePrivateKey], [bobPublicKey], encryptedText);

      expect(plainText).to.equals(decryptedText);
      done();
    })();
  })
});
