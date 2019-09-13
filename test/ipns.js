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

const hat = require('hat');
const chai = require('chai');
const assert = require('assert');
const dirtyChai = require('dirty-chai');
const expect = chai.expect;
chai.use(dirtyChai);

const parallel = require('async/parallel');

const IPFS = require('ipfs');
const JsIpfsService = require('../src/JsIpfsService');
const {getIpnsUpdatesTopic} = require('../src/name');
const waitFor = require('./utils/wait-for');

const DaemonFactory = require('ipfsd-ctl');
const df = DaemonFactory.create({type: 'proc'});
const {promisify} = require('es6-promisify');

describe('ipns', function () {
  let nodes;
  let nodeA;
  let nodeB;

  const dfSpawn = promisify(df.spawn).bind(df);
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
      await nodeA.addBootNode(idB.addresses[0]);
      done();
    })();
  });

  after((done) => parallel(nodes.map((node) => (cb) => node.stop(cb)), done));

  it('should handle signed event and validate signature', function (done) {
    this.timeout(80 * 1000);

    const testAccountName = 'test-account';
    const testHash = 'QmRs9acXTdRqSxEuYcizWZXgHnDAkqiujRBZuXmR565nXr';

    (async () => {
      const testAccountIpnsId = await nodeA.createAccountIfNotExists(testAccountName);
      const testAccountKey = await nodeA.keyLookup(testAccountIpnsId);
      
      await nodeB.subscribeToIpnsUpdates(testAccountIpnsId, async (message) => {
        // guarantee record is written
        await new Promise((resolve) => setTimeout(resolve, 1000));

        //TODO: find the reason of error on trying to do this with nodeA
        const resultHash = await nodeA.resolveStaticId(testAccountIpnsId);
        expect(testHash).to.equals(resultHash);
        const ipnsEntry = await nodeA.resolveStaticIdEntry(testAccountIpnsId);
        expect(testHash).to.equals(resultHash);
        
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
  })
});
