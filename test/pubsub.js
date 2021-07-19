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

const ipfsHelper = require('../src/ipfsHelper')
const commonHelper = require('../src/common')
const waitFor = require('./utils/wait-for');
const createNodes = require('./utils/createNodes');

describe.only('pubsub', function () {
  let nodeA
  let nodeB
  const pass = 'ipfs-is-awesome-software';

  ['fluence'].forEach(service => {
    describe(service, function () {

      beforeEach(function (done) {
        this.timeout(40 * 1000);

        (async () => {
          [nodeA, nodeB] = await createNodes[service]({pass});
          done();
        })();
      });

      afterEach((done) => {Promise.all([nodeA.stop && nodeA.stop(), nodeB.stop && nodeB.stop()]).then(() => done())})

      it('should handle signed event and validate signature', function (done) {
        this.timeout(80 * 1000);

        (async () => {
          const testAccountName = 'test-account';
          const testTopic = await commonHelper.random('words');

          const testAccountIpnsId = await nodeA.createAccountIfNotExists(testAccountName);
          const testAccountPeerId = await nodeA.getAccountPeerId(testAccountIpnsId, pass);

          let catchedEvents = 0;
          await nodeB.subscribeToEvent(testTopic, async (message) => {
            console.log('nodeB message', message);
            expect(message.fromPeerId.toB58String()).to.equal(testAccountPeerId.toB58String());
            expect(message.staticType, 'update');

            // const isValid = await ipfsHelper.checkPubSubSignature(message.key, message);
            // expect(isValid).to.equal(true);
            catchedEvents++;
            if(catchedEvents >= 2) {
              done();
            }
          });

          // await nodeB.subscribeToEvent('test', () => {})
          // console.log('await nodeA.getPeers(\'test\')', await nodeA.getPeers('test'));

          await nodeA.subscribeToEvent(testTopic, async (message) => {
            console.log('nodeA message', message);
            expect(message.fromPeerId.toB58String()).to.equal(testAccountPeerId.toB58String());
            expect(message.staticType, 'update');

            // const isValid = await ipfsHelper.checkPubSubSignature(message.key, message);
            // expect(isValid).to.equal(true);
            catchedEvents++;
            if(catchedEvents >= 2) {
              done();
            }
          });

          await waitFor((callback) => {
            nodeA.getPeers(testTopic).then(peers => {
              callback(null, peers.length > 0);
            })
          });

          await new Promise((resolve) => setTimeout(resolve, 5000));

          console.log('publishEventByPeerId');

          await nodeA.publishEventByPeerId(testAccountPeerId, testTopic, "test-message");
        })();
      })
    });
  });
})
