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
const assert = require('assert');
const dirtyChai = require('dirty-chai');
const expect = chai.expect;
chai.use(dirtyChai);

const waitFor = require('./utils/wait-for');
const createNodes = require('./utils/createNodes');
const peerIdHelper = require('../src/peerIdHelper');
const commonHelper = require('../src/common');

describe.only('ipns', function () {
  let nodeA;
  let nodeB;
  const pass = 'geesome-is-awesome-software';

  //'ipfs',
  ['fluence'].forEach(service => {
    describe(service, function() {
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
          const testHash = 'QmRs9acXTdRqSxEuYcizWZXgHnDAkqiujRBZuXmR565nXr';

          const testAccountIpnsId = await nodeA.createAccountIfNotExists(testAccountName);
          const testAccountPublicKey = peerIdHelper.publicKeyToBase64(await nodeA.getAccountPublicKey(testAccountIpnsId));
          await nodeA.createAccountIfNotExists('self');
          const selfAccountPublicKey = peerIdHelper.publicKeyToBase64(await nodeA.getAccountPublicKey('self'));

          console.log('subscribeToStaticIdUpdates', testAccountIpnsId);
          await nodeB.subscribeToStaticIdUpdates(testAccountIpnsId, async (message) => {
            assert.equal(message.dataStr, '/ipfs/' + testHash);
            assert.equal(message.from, testAccountPublicKey);
            assert.notEqual(message.from, selfAccountPublicKey);
            await new Promise((resolve) => setTimeout(resolve, 1000)); // guarantee record is written

            const resultHash = await nodeA.resolveStaticId(testAccountIpnsId);
            expect(testHash).to.equals(resultHash);

            // const ipnsEntry = await nodeA.resolveStaticIdEntry(testAccountIpnsId);
            // assert.deepEqual(Array.from(peerIdHelper.base64ToPublicKey(testAccountPublicKey)), Array.from(ipnsEntry.pubKey));
            done();
          });

          console.log('getPeers', nodeA.getUpdatesTopic(testAccountIpnsId, 'update'));
          await waitFor((callback) => {
            nodeA.getPeers(nodeA.getUpdatesTopic(testAccountIpnsId, 'update')).then(peers => {
              callback(null, peers.length > 0);
            })
          });

          console.log('bindToStaticId', testHash, testAccountIpnsId);
          await nodeA.bindToStaticId(testHash, testAccountIpnsId, {resolve: false});
        })();
      });

      it('bindToStaticId and resolveStaticId', function (done) {
        this.timeout(80 * 1000);

        (async () => {
          const testAccountName = commonHelper.random('words');
          const testHash = 'QmRs9acXTdRqSxEuYcizWZXgHnDAkqiujRBZuXmR565nXr';

          const staticId = await nodeA.createAccountIfNotExists(testAccountName);
          console.log('staticId', staticId);

          let peers = await nodeA.getPeers(staticId);
          assert.equal(peers.length, 0);

          await nodeA.bindToStaticId(testHash, testAccountName);

          peers = await nodeA.getPeers(staticId);
          assert.equal(peers.length, 1);

          const resultHash = await nodeB.resolveStaticId(testAccountName);
          assert.equal(resultHash, testHash);

          done();
        })();
      });
    });
  });
});
