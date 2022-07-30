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

import chai from 'chai';
import dirtyChai from 'dirty-chai';

import commonHelper from '../src/common.js';
import ipfsHelper from '../src/ipfsHelper.js';
import peerIdHelper from '../src/peerIdHelper.js';
import waitFor from './utils/wait-for.js';
import createNodes from './utils/createNodes.js';
import {randomSeqno} from 'libp2p-interfaces/src/pubsub/utils.js';

const expect = chai.expect
chai.use(dirtyChai)

describe('pubsub', function () {
  let nodeA
  let nodeB
  const pass = 'ipfs-is-awesome-software';

  after(() => {
    process.exit();
  });

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
          const testAccountName = commonHelper.random('words');
          const testTopic = commonHelper.random('words');

          const testAccountIpnsId = await nodeA.createAccountIfNotExists(testAccountName);
          const testAccountPeerId = await nodeA.getAccountPeerId(testAccountIpnsId, pass);

          let catchedEvents = 0;
          await nodeB.subscribeToEvent(testTopic, async (message) => {
            // console.log('nodeB message', message);
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
            // console.log('nodeA message', message);
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
          await nodeA.publishEventByPeerId(testAccountPeerId, testTopic, "test-message");
        })();
      });

      it('should handle signed event and validate signature', function (done) {
        this.timeout(80 * 1000);

        (async () => {
          const testAccountName = commonHelper.random('words');
          const testTopic = commonHelper.random('words');
          const testAccountIpnsId = await nodeA.createAccountIfNotExists(testAccountName);
          const testAccountPeerId = await nodeA.getAccountPeerId(testAccountIpnsId, pass);

          const event = await pubSubHelper.buildAndSignFluenceMessage(peerIdHelper.peerIdToPrivateBase64(testAccountPeerId), "test-message-2");
          event.seqno = randomSeqno().toString('base64');
          try {
            await nodeA.publishEventByData(testTopic, event);
            expect(true, false);
          } catch (e) {
            expect(e.message, 'signature_not_valid');
          }
          done();
        })();
      });
    });
  });
})
