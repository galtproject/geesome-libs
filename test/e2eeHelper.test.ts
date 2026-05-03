/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

/* eslint-env mocha */
'use strict';

import chai from 'chai';
import dirtyChai from 'dirty-chai';
import peerIdHelper from '../src/peerIdHelper.js';
import e2eeHelper from '../src/e2eeHelper.js';

const expect = chai.expect;
chai.use(dirtyChai);

describe('e2eeHelper', function () {
  this.timeout(40 * 1000);

  it('should encrypt opaque envelopes for listed recipients', async function () {
    const alice = await peerIdHelper.createPeerId();
    const bob = await peerIdHelper.createPeerId();
    const sender = await peerIdHelper.createPeerId();
    const plaintext = 'frontend-only secret';

    const envelope = await e2eeHelper.encryptEnvelope(plaintext, [
      {
        id: 'alice-device',
        publicKeyBase64: peerIdHelper.peerIdToPublicBase64(alice)
      },
      {
        id: 'bob-device',
        publicKeyBase64: peerIdHelper.peerIdToPublicBase64(bob)
      }
    ], {
      messageId: 'message-1',
      conversationId: 'group-1',
      createdAt: '2026-05-03T00:00:00.000Z',
      senderPrivateKeyBase64: peerIdHelper.peerIdToPrivateBase64(sender),
      sender: {
        deviceId: 'sender-device'
      },
      metadata: {
        relay: 'geesome-node'
      },
      contentKey: Buffer.alloc(32, 7),
      iv: Buffer.alloc(12, 3)
    });

    expect(e2eeHelper.isEncryptedEnvelope(envelope)).to.equals(true);
    expect(envelope.messageId).to.equal('message-1');
    expect(envelope.conversationId).to.equal('group-1');
    expect(envelope.sender.deviceId).to.equal('sender-device');
    expect(envelope.sender.id).to.equal(peerIdHelper.peerIdToPublicBase58(sender));
    expect(envelope.signature.algorithm).to.equal(e2eeHelper.constants.SIGNATURE_ALGORITHM);
    expect(await e2eeHelper.verifyEnvelopeSignature(envelope)).to.equals(true);
    expect(e2eeHelper.getRecipientIds(envelope)).to.deep.equal(['alice-device', 'bob-device']);
    expect(JSON.stringify(envelope).includes(plaintext)).to.equals(false);
    expect(await e2eeHelper.decryptEnvelopeText(envelope, peerIdHelper.peerIdToPrivateBase64(alice), {recipientId: 'alice-device'})).to.equals(plaintext);
    expect(await e2eeHelper.decryptEnvelopeText(envelope, peerIdHelper.peerIdToPrivateBase64(bob), {recipientId: 'bob-device'})).to.equals(plaintext);
  });

  it('should reject tampered signed envelopes', async function () {
    const alice = await peerIdHelper.createPeerId();
    const sender = await peerIdHelper.createPeerId();

    const envelope = await e2eeHelper.encryptEnvelope('signed body', [
      {
        id: 'alice-device',
        publicKeyBase64: peerIdHelper.peerIdToPublicBase64(alice)
      }
    ], {
      messageId: 'message-2',
      conversationId: 'group-1',
      createdAt: '2026-05-03T00:00:00.000Z',
      senderPrivateKeyBase64: peerIdHelper.peerIdToPrivateBase64(sender),
      contentKey: Buffer.alloc(32, 11),
      iv: Buffer.alloc(12, 5)
    });

    const tampered = {
      ...envelope,
      messageId: 'message-3'
    };

    expect(await e2eeHelper.verifyEnvelopeSignature(envelope)).to.equals(true);
    expect(await e2eeHelper.verifyEnvelopeSignature(tampered)).to.equals(false);
  });

  it('should reject decrypt with a non-recipient key', async function () {
    const alice = await peerIdHelper.createPeerId();
    const mallory = await peerIdHelper.createPeerId();

    const envelope = await e2eeHelper.encryptEnvelope({text: 'hello'}, [
      {
        id: 'alice-device',
        publicKeyBase64: peerIdHelper.peerIdToPublicBase64(alice)
      }
    ]);

    try {
      await e2eeHelper.decryptEnvelopeText(envelope, peerIdHelper.peerIdToPrivateBase64(mallory), {recipientId: 'alice-device'});
      throw new Error('expected_decrypt_failure');
    } catch (e) {
      expect(e.message).to.not.equal('expected_decrypt_failure');
    }
  });

  it('should support publicKey alias and canonical metadata aad', async function () {
    const alice = await peerIdHelper.createPeerId();
    const envelope = await e2eeHelper.encryptEnvelope('stable aad', [
      {
        publicKey: peerIdHelper.peerIdToPublicBase64(alice)
      }
    ], {
      createdAt: '2026-05-03T00:00:00.000Z',
      metadata: {
        z: 1,
        a: 2
      },
      contentKey: Buffer.alloc(32, 9),
      iv: Buffer.alloc(12, 4)
    });
    const storedEnvelope = JSON.parse(JSON.stringify({
      ...envelope,
      metadata: {
        a: 2,
        z: 1
      }
    }));

    expect(envelope.recipients[0].id).to.equal(peerIdHelper.peerIdToPublicBase58(alice));
    expect(await e2eeHelper.decryptEnvelopeText(storedEnvelope, peerIdHelper.peerIdToPrivateBase64(alice))).to.equals('stable aad');
  });

  it('should require explicit recipients', async function () {
    try {
      await e2eeHelper.encryptEnvelope('secret', []);
      throw new Error('expected_recipient_failure');
    } catch (e) {
      expect(e.message).to.equal('recipients_required');
    }
  });
});
