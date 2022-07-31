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
import assert from 'assert';
import dirtyChai from 'dirty-chai';
const expect = chai.expect;
chai.use(dirtyChai);

import waitFor from './utils/wait-for.js';
import createNodes from './utils/createNodes.js';
import peerIdHelper from '../src/peerIdHelper.js';
import commonHelper from'../src/common.js';

describe('ipns', function () {
  this.timeout(80 * 1000);
  let nodeA;
  let nodeB;
  const pass = 'geesome-is-awesome-software';

  //'ipfs',
  ['fluence'].forEach(service => {
    describe(service, function() {
      beforeEach(async () => {
        [nodeA, nodeB] = await createNodes[service]({pass});
      });

      afterEach((done) => {Promise.all([nodeA.stop && nodeA.stop(), nodeB.stop && nodeB.stop()]).then(() => done())})

      it('should handle signed event and validate signature', async (done) => {
        const testAccountName = commonHelper.random('words');
        const testHash = 'QmRs9acXTdRqSxEuYcizWZXgHnDAkqiujRBZuXmR565nXr';

        const testAccountIpnsId = await nodeA.createAccountIfNotExists(testAccountName);
        const testAccountPublicKey = peerIdHelper.publicKeyToBase64(await nodeA.getAccountPublicKey(testAccountIpnsId));
        await nodeA.createAccountIfNotExists('self');
        const selfAccountPublicKey = peerIdHelper.publicKeyToBase64(await nodeA.getAccountPublicKey('self'));

        console.log('subscribeToStaticIdUpdates', testAccountIpnsId);
        await new Promise(async (resolve) => {
          await nodeB.subscribeToStaticIdUpdates(testAccountIpnsId, async (message) => {
            assert.equal(message.dataStr, '/ipfs/' + testHash);
            assert.equal(message.from, testAccountPublicKey);
            assert.notEqual(message.from, selfAccountPublicKey);
            await new Promise((resolve) => setTimeout(resolve, 1000)); // guarantee record is written

            const resultHash = await nodeA.resolveStaticId(testAccountIpnsId);
            expect(testHash).to.equals(resultHash);

            // const ipnsEntry = await nodeA.resolveStaticIdEntry(testAccountIpnsId);
            // assert.deepEqual(Array.from(peerIdHelper.base64ToPublicKey(testAccountPublicKey)), Array.from(ipnsEntry.pubKey));
            resolve();
          });

          console.log('getPeers', nodeA.getUpdatesTopic(testAccountIpnsId, 'update'));
          await waitFor((callback) => {
            nodeA.getPeers(nodeA.getUpdatesTopic(testAccountIpnsId, 'update')).then(peers => {
              callback(null, peers.length > 0);
            })
          });

          await nodeA.bindToStaticId(testAccountIpnsId, testHash, {resolve: false});
        });
      });

      it.only('bindToStaticId and resolveStaticId', async (done) => {
        const testAccountName = commonHelper.random('words');
        const testHash = 'QmRs9acXTdRqSxEuYcizWZXgHnDAkqiujRBZuXmR565nXr';

        const staticId = await nodeA.createAccountIfNotExists(testAccountName);
        console.log('staticId', staticId);

        let peers = await nodeA.getPeers(staticId);
        console.log('peers', peers);
        assert.equal(peers.length, 0);

        await nodeA.bindToStaticId(testAccountName, testHash);

        peers = await nodeA.getPeers(staticId);
        assert.equal(peers.length, 1);

        const resultHash = await nodeB.resolveStaticId(testAccountName);
        assert.equal(resultHash, testHash);
      });
    });
  });
});
