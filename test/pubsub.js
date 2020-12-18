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
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const JsIpfsService = require('../src/JsIpfsService')
const ipfsHelper = require('../src/ipfsHelper')
const waitFor = require('./utils/wait-for');

describe('pubsub', function () {
  let nodeA
  let nodeB
  const pass = 'ipfs-is-awesome-software';

  const createNode = (ipfsOptions) => {
    return ipfsHelper.createDaemonNode({}, { pass, ...ipfsOptions });
  };

  before(function (done) {
    this.timeout(40 * 1000);

    (async () => {
      nodeA = new JsIpfsService(await createNode());
      nodeB = new JsIpfsService(await createNode({config: {Addresses: {Swarm: ["/ip4/0.0.0.0/tcp/4004", "/ip4/127.0.0.1/tcp/4005/ws"]}}}));

      const idB = await nodeB.id();
      await nodeA.swarmConnect(idB.addresses[0]);
      done();
    })();
  });

  after((done) => {Promise.all([nodeA.stop(), nodeB.stop()]).then(() => done())})

  it('should handle signed event and validate signature', function (done) {
    this.timeout(80 * 1000)

    const testAccountName = 'test-account';
    const testTopic = 'test-topic';

    (async () => {
      const testAccountIpnsId = await nodeA.createAccountIfNotExists(testAccountName);
      const testAccountPeerId = await nodeA.getAccountPeerId(testAccountIpnsId, pass);

      let catchedEvents = 0;
      await nodeB.subscribeToEvent(testTopic, async (message) => {
        console.log('nodeB message', message);
        expect(message.keyPeerId.toB58String()).to.equal(testAccountPeerId.toB58String());

        const isValid = await ipfsHelper.checkPubSubSignature(message.key, message);
        expect(isValid).to.equal(true);
        catchedEvents++;
        if(catchedEvents >= 2) {
          done();
        }
      });
      
      await nodeA.subscribeToEvent(testTopic, async (message) => {
        console.log('nodeA message', message);
        expect(message.keyPeerId.toB58String()).to.equal(testAccountPeerId.toB58String());

        const isValid = await ipfsHelper.checkPubSubSignature(message.key, message);
        expect(isValid).to.equal(true);
        catchedEvents++;
        if(catchedEvents >= 2) {
          done();
        }
      });

      await waitFor((callback) => {
        nodeA.getPeers(testTopic).then(peers => {
          console.log('peers', peers);
          callback(null, peers.length > 0);
        })
      });

      await new Promise((resolve) => setTimeout(resolve, 5000));

      console.log('publishEventByPeerId');

      await nodeA.publishEventByPeerId(testAccountPeerId, testTopic, "test-message");
    })();
  })
})
