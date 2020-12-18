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

describe('ipns', function () {
  let nodeA;
  let nodeB;
  const pass = 'ipfs-is-awesome-software';

  const createNode = () => {
    return ipfsHelper.createDaemonNode({
      test: true,
      disposable: true,
    }, { pass, EXPERIMENTAL: {ipnsPubsub: true} });
  };

  beforeEach(function (done) {
    this.timeout(40 * 1000);

    (async () => {
      nodeA = new JsIpfsService(await createNode());
      nodeB = new JsIpfsService(await createNode());

      const idB = await nodeB.id();
      const idA = await nodeA.id();
      await nodeA.swarmConnect(idB.addresses[0]);
      await nodeA.addBootNode(idB.addresses[0]);
      await nodeB.swarmConnect(idA.addresses[0]);
      await nodeB.addBootNode(idA.addresses[0]);
      done();
    })();
  });

  afterEach((done) => {Promise.all([nodeA.stop(), nodeB.stop()]).then(() => done())})

  it('should handle signed event and validate signature', function (done) {
    this.timeout(80 * 1000);

    const testAccountName = 'test-account';
    const testHash = 'QmRs9acXTdRqSxEuYcizWZXgHnDAkqiujRBZuXmR565nXr';

    (async () => {
      const testAccountIpnsId = await nodeA.createAccountIfNotExists(testAccountName);
      const testAccountKey = await nodeA.keyLookup(testAccountIpnsId, pass);
      
      await nodeB.subscribeToIpnsUpdates(testAccountIpnsId, async (message) => {
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
});
