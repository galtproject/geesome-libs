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
import dirtyChai from 'dirty-chai';
const expect = chai.expect;
chai.use(dirtyChai);

import pgpHelper from '../src/pgpHelper.js';
import peerIdHelper from '../src/peerIdHelper.js';
import pubSubHelper from '../src/pubSubHelper.js';
import {keys as cryptoKeys} from 'libp2p-crypto';

describe('pgp', function () {
  this.timeout(40 * 1000);

  it('should encrypt and decrypt messages', async function () {
    const bobKey = await cryptoKeys.generateKeyPair('RSA', 2048);
    const aliceKey = await cryptoKeys.generateKeyPair('RSA', 2048);

    const bobPrivateKey = await pgpHelper.transformKey(bobKey.marshal());
    const alicePrivateKey = await pgpHelper.transformKey(aliceKey.marshal());

    const bobPublicKey = await pgpHelper.transformKey(bobKey.public.marshal(), true);
    const alicePublicKey = await pgpHelper.transformKey(aliceKey.public.marshal(), true);

    const plainText = 'Hello world!';
    const encryptedText = await pgpHelper.encrypt([bobPrivateKey], [alicePublicKey, bobPublicKey], plainText);

    const decryptedByAliceText = await pgpHelper.decrypt([alicePrivateKey], [bobPublicKey], encryptedText);
    expect(plainText).to.equals(decryptedByAliceText);

    const decryptedByBobText = await pgpHelper.decrypt([bobPrivateKey], [], encryptedText);
    expect(plainText).to.equals(decryptedByBobText);
  });

  it('should sign fluence message and validate signature', async function () {
    const bobPeerId = await peerIdHelper.createPeerId();
    const alicePeerId = await peerIdHelper.createPeerId();
    const bobPrivateKey = peerIdHelper.peerIdToPrivateBase64(bobPeerId);
    const alicePublicKey = peerIdHelper.peerIdToPublicBase64(alicePeerId);

    const msg = await pubSubHelper.buildAndSignFluenceMessage(bobPrivateKey, 'test');
    expect(await pubSubHelper.checkFluenceSignature(msg.from, msg.data, msg.seqno, msg.signature)).to.equals(true);
    expect(await pubSubHelper.checkFluenceSignature(alicePublicKey, msg.data, msg.seqno, msg.signature)).to.equals(false);
  });
});
