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
const expect = chai.expect
chai.use(dirtyChai)

import pubSubHelper from '../src/pubSubHelper.js';
import peerIdHelper from '../src/peerIdHelper.js';

describe('pubsub', function () {
  this.timeout(40 * 1000);

  it('should build and parse signed fluence events', async function () {
    const peerId = await peerIdHelper.createPeerId();
    const privateKey = peerIdHelper.peerIdToPrivateBase64(peerId);

    const event = await pubSubHelper.buildAndSignFluenceMessage(privateKey, 'test-message');
    const parsed = await pubSubHelper.parseFluenceEvent(peerIdHelper.peerIdToPublicBase58(peerId) + '/update', event);

    expect(parsed.dataStr).to.equals('test-message');
    expect(parsed.staticType).to.equals('update');
    expect(parsed.fromIpns).to.equals(peerIdHelper.peerIdToPublicBase58(peerId));
  });

  it('should reject events signed by another key', async function () {
    const signerPeerId = await peerIdHelper.createPeerId();
    const anotherPeerId = await peerIdHelper.createPeerId();

    const event = await pubSubHelper.buildAndSignFluenceMessage(peerIdHelper.peerIdToPrivateBase64(signerPeerId), 'test-message');
    event.from = peerIdHelper.peerIdToPublicBase64(anotherPeerId);

    const parsed = await pubSubHelper.parseFluenceEvent('test-topic', event);
    expect(parsed).to.equals(null);
  });
})
