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

const JsIpfsService = require('../src/JsIpfsService');
const {getIpnsUpdatesTopic} = require('../src/name');
const waitFor = require('./utils/wait-for');
const ipfsHelper = require('../src/ipfsHelper');
const SimpleAccountStorage = require('../src/SimpleAccountStorage');
const FluenceService = require('../src/fluenceService');

const { krasnodar } = require('@fluencelabs/fluence-network-environment');
const { createClient, FluenceClient } = require('@fluencelabs/fluence');

describe('ipns', function () {
  let nodeA;
  let nodeB;
  const pass = 'geesome-is-awesome-software';
  const accStorage = new SimpleAccountStorage();

  const initNodes = {
    async ipfs() {
      const createNode = () => {
        return ipfsHelper.createDaemonNode({
          test: true,
          disposable: true,
        }, { pass, EXPERIMENTAL: {ipnsPubsub: true} });
      };

      const _nodeA = new JsIpfsService(await createNode());
      const _nodeB = new JsIpfsService(await createNode());

      const idB = await _nodeB.id();
      const idA = await _nodeA.id();
      await _nodeA.swarmConnect(idB.addresses[0]);
      await _nodeA.addBootNode(idB.addresses[0]);
      await _nodeB.swarmConnect(idA.addresses[0]);
      await _nodeB.addBootNode(idA.addresses[0]);
      return [_nodeA, _nodeB];
    },
    async fluence() {
      const createNode = async () => {
        const relayNode = krasnodar[1];
        const client = await createClient(relayNode);
        return new FluenceService(accStorage, client);
      };

      const _nodeA = await createNode();
      const _nodeB = await createNode();
      return [_nodeA, _nodeB];
    }
  };

  //'ipfs',
  ['fluence'].forEach(service => {
    describe(service, function() {
      beforeEach(function (done) {
        this.timeout(40 * 1000);

        (async () => {
          [nodeA, nodeB] = await initNodes[service]();
          done();
        })();
      });

      afterEach((done) => {Promise.all([nodeA.stop && nodeA.stop(), nodeB.stop && nodeB.stop()]).then(() => done())})

      it.skip('should handle signed event and validate signature', function (done) {
        this.timeout(80 * 1000);

        const testAccountName = 'test-account';
        const testHash = 'QmRs9acXTdRqSxEuYcizWZXgHnDAkqiujRBZuXmR565nXr';

        (async () => {
          const testAccountIpnsId = await nodeA.createAccountIfNotExists(testAccountName);
          console.log('testAccountIpnsId', testAccountIpnsId);
          const testAccountKey = await nodeA.keyLookup(testAccountIpnsId, pass);

          await nodeB.subscribeToStaticIdUpdates(testAccountIpnsId, async (message) => {
            assert.equal(message.data.valueStr, '/ipfs/' + testHash);
            assert.equal(message.from, await nodeA.getAccountIdByName('self'));
            assert.notEqual(message.from, testAccountIpnsId);
            await new Promise((resolve) => setTimeout(resolve, 1000)); // guarantee record is written

            const resultHash = await nodeA.resolveStaticId(testAccountIpnsId);
            expect(testHash).to.equals(resultHash);

            //TODO: find the reason of error on trying to do this with nodeB
            // expect(await nodeB.resolveStaticId(testAccountIpnsId)).to.equals(resultHash);

            const ipnsEntry = await nodeA.resolveStaticIdEntry(testAccountIpnsId);
            assert.deepEqual(Array.from(testAccountKey.public.bytes), Array.from(ipnsEntry.pubKey));
            done();
          });

          await waitFor((callback) => {
            nodeA.getPeers(getIpnsUpdatesTopic(testAccountIpnsId)).then(peers => {
              callback(null, peers.length > 0);
            })
          });

          await nodeA.bindToStaticId(testHash, testAccountIpnsId, {resolve: false});
        })();
      });

      it('bindToStaticId and resolveStaticId', function (done) {
        this.timeout(80 * 1000);

        const testAccountName = 'test-account';
        const testHash = 'QmRs9acXTdRqSxEuYcizWZXgHnDAkqiujRBZuXmR565nXr';

        (async () => {
          await nodeA.createAccountIfNotExists(testAccountName);
          await nodeA.bindToStaticId(testHash, testAccountName);
          const resultHash = await nodeB.resolveStaticId(testAccountName);
          assert.equal(resultHash, testHash);
          done();
        })();
      });
    });
  });
});
