/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */
'use strict'

const hat = require('hat')
const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const parallel = require('async/parallel')

// const isNode = require('detect-node')
const IPFS = require('ipfs')
const JsIpfsService = require('../src/JsIpfsService')
const ipfsHelper = require('../src/ipfsHelper')
const waitFor = require('./utils/wait-for')

const DaemonFactory = require('ipfsd-ctl')
const df = DaemonFactory.create({type: 'proc'})
const util = require('util');

describe('pubsub', function () {
  // if (!isNode) {
  //   return
  // }

  let nodes
  let nodeA
  let nodeB

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
      nodeA = new JsIpfsService(await createNode());
      nodeB = new JsIpfsService(await createNode());
      nodes = [nodeA, nodeB];
      
      const idB = await nodeB.id();
      await nodeA.swarmConnect(idB.addresses[0]);
      done();
    })();
  });

  after((done) => parallel(nodes.map((node) => (cb) => node.stop(cb)), done))

  it('should handle signed event and validate signature', function (done) {
    this.timeout(80 * 1000)

    const testAccountName = 'test-account';
    const testTopic = 'test-topic';

    (async () => {
      const testAccount = await nodeA.createAccountIfNotExists(testAccountName);
      const testAccountPeerId = await nodeA.getAccountPeerId(testAccount);

      await nodeB.subscribeToEvent(testTopic, (message) => {
        expect(message.key.toB58String()).to.equal(testAccountPeerId.toB58String());

        ipfsHelper.checkPubSubSign(testAccountPeerId, message).then((isValid) => {
          expect(isValid).to.equal(true);
          done();
        });
      });

      await waitFor((callback) => {
        nodeA.getPeers(testTopic).then(peers => {
          callback(null, peers.length > 0);
        })
      });

      await nodeA.publishEventByPeerId(testAccountPeerId, testTopic, "test-message");
    })();
  })
})
