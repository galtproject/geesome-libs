/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 */

/* eslint-env mocha */
'use strict';

import chai from 'chai';
import dirtyChai from 'dirty-chai';
import browserE2eeHelper from '../src/browserE2eeHelper.js';

const expect = chai.expect;
chai.use(dirtyChai);

describe('browserE2eeHelper', function () {
  this.timeout(40 * 1000);

  async function createDevice(ownerId, deviceId) {
    return browserE2eeHelper.generateDeviceKeys({
      ownerId,
      deviceId,
      createdAt: '2026-07-28T00:00:00.000Z'
    });
  }

  it('creates non-extractable browser device private keys and verifiable bundles', async function () {
    const alice = await createDevice('alice', 'alice-browser');

    expect(alice.privateKeys.encryptionKey.extractable).to.equal(false);
    expect(alice.privateKeys.encryptionPublicKey.type).to.equal('public');
    expect(alice.privateKeys.signingKey.extractable).to.equal(false);
    expect(alice.recoveryBundle).to.equal(null);
    expect(await browserE2eeHelper.verifyDeviceKeyBundle(alice.publicBundle)).to.equal(true);

    const fingerprint = await browserE2eeHelper.getDeviceFingerprint(alice.publicBundle);
    expect(fingerprint).to.include({
      version: browserE2eeHelper.constants.DEVICE_FINGERPRINT_VERSION,
      algorithm: browserE2eeHelper.constants.FINGERPRINT_ALGORITHM,
      ownerId: 'alice',
      deviceId: 'alice-browser',
      keyId: alice.publicBundle.keyId
    });
    expect(fingerprint.value).to.match(/^(?:[0-9A-F]{4} ){15}[0-9A-F]{4}$/);
    expect(await browserE2eeHelper.getDeviceFingerprint(
      JSON.parse(JSON.stringify(alice.publicBundle))
    )).to.deep.equal(fingerprint);

    const tampered = JSON.parse(JSON.stringify(alice.publicBundle));
    tampered.ownerId = 'mallory';
    expect(await browserE2eeHelper.verifyDeviceKeyBundle(tampered)).to.equal(false);
    await expectRejected(
      browserE2eeHelper.getDeviceFingerprint(tampered),
      'device_bundle_invalid'
    );
  });

  it('formats a full deterministic device fingerprint', function () {
    const keyId = browserE2eeHelper.encodeBase64Url(
      Uint8Array.from({length: 32}, (_value, index) => index)
    );
    expect(browserE2eeHelper.formatDeviceFingerprint(keyId)).to.equal(
      '0001 0203 0405 0607 0809 0A0B 0C0D 0E0F ' +
      '1011 1213 1415 1617 1819 1A1B 1C1D 1E1F'
    );
    expect(() => browserE2eeHelper.formatDeviceFingerprint('short')).to.throw(
      'device_key_id_invalid'
    );
  });

  it('creates an encrypted recovery bundle and restores non-extractable device keys', async function () {
    const passphrase = 'correct horse battery staple';
    const sender = await createDevice('sender', 'sender-browser');
    const alice = await browserE2eeHelper.generateDeviceKeys({
      ownerId: 'alice',
      deviceId: 'alice-browser',
      createdAt: '2026-07-28T00:00:00.000Z',
      recoveryPassphrase: passphrase,
      recoveryIterations: browserE2eeHelper.constants.MINIMUM_RECOVERY_ITERATIONS,
      recoverySalt: new Uint8Array(16).fill(8),
      recoveryIv: new Uint8Array(12).fill(6)
    });
    const envelope = await browserE2eeHelper.encryptEnvelope(
      'recoverable browser secret',
      [alice.publicBundle],
      sender,
      {
        messageId: 'message-recovery',
        conversationId: 'conversation-1',
        createdAt: '2026-07-28T00:01:00.000Z'
      }
    );

    expect(alice.recoveryBundle.version).to.equal(
      browserE2eeHelper.constants.DEVICE_RECOVERY_VERSION
    );
    expect(browserE2eeHelper.isDeviceRecoveryBundle(alice.recoveryBundle)).to.equal(true);
    expect(alice.recoveryBundle.publicBundle).to.deep.equal(alice.publicBundle);
    expect(alice.recoveryBundle.kdf.iterations).to.equal(
      browserE2eeHelper.constants.MINIMUM_RECOVERY_ITERATIONS
    );
    expect(JSON.stringify(alice.recoveryBundle)).to.not.include(passphrase);
    expect(alice.recoveryBundle).to.not.have.property('privateKeys');

    const restored = await browserE2eeHelper.restoreDeviceKeys(
      JSON.parse(JSON.stringify(alice.recoveryBundle)),
      passphrase
    );
    expect(restored.publicBundle).to.deep.equal(alice.publicBundle);
    expect(restored.privateKeys.encryptionKey.extractable).to.equal(false);
    expect(restored.privateKeys.signingKey.extractable).to.equal(false);
    expect(await browserE2eeHelper.decryptEnvelopeText(
      envelope,
      restored,
      sender.publicBundle
    )).to.equal('recoverable browser secret');

    const reply = await browserE2eeHelper.encryptEnvelope(
      'signed after recovery',
      [sender.publicBundle],
      restored,
      {
        messageId: 'message-recovery-reply',
        conversationId: 'conversation-1',
        createdAt: '2026-07-28T00:02:00.000Z'
      }
    );
    expect(await browserE2eeHelper.verifyEnvelopeSignature(
      reply,
      alice.publicBundle
    )).to.equal(true);
    expect(await browserE2eeHelper.decryptEnvelopeText(
      reply,
      sender,
      alice.publicBundle
    )).to.equal('signed after recovery');
  });

  it('rejects wrong passphrases and recovery bundle tampering', async function () {
    const alice = await browserE2eeHelper.generateDeviceKeys({
      ownerId: 'alice',
      deviceId: 'alice-browser',
      recoveryPassphrase: 'alice recovery secret',
      recoveryIterations: browserE2eeHelper.constants.MINIMUM_RECOVERY_ITERATIONS
    });

    await expectRejected(
      browserE2eeHelper.restoreDeviceKeys(
        alice.recoveryBundle,
        'wrong recovery secret'
      ),
      'device_recovery_decrypt_failed'
    );

    const tamperedCiphertext = JSON.parse(JSON.stringify(alice.recoveryBundle));
    const ciphertext = browserE2eeHelper.decodeBase64Url(
      tamperedCiphertext.cipher.ciphertext
    );
    ciphertext[0] ^= 1;
    tamperedCiphertext.cipher.ciphertext = browserE2eeHelper.encodeBase64Url(ciphertext);
    await expectRejected(
      browserE2eeHelper.restoreDeviceKeys(
        tamperedCiphertext,
        'alice recovery secret'
      ),
      'device_recovery_decrypt_failed'
    );

    const tamperedBundle = JSON.parse(JSON.stringify(alice.recoveryBundle));
    tamperedBundle.publicBundle.ownerId = 'mallory';
    await expectRejected(
      browserE2eeHelper.restoreDeviceKeys(
        tamperedBundle,
        'alice recovery secret'
      ),
      'device_recovery_public_bundle_invalid'
    );

    const oversizedBundle = JSON.parse(JSON.stringify(alice.recoveryBundle));
    oversizedBundle.cipher.ciphertext = 'a'.repeat(16385);
    expect(browserE2eeHelper.isDeviceRecoveryBundle(oversizedBundle)).to.equal(false);
  });

  it('requires a strong recovery passphrase and bounded PBKDF2 work', async function () {
    await expectRejected(
      browserE2eeHelper.generateDeviceKeys({
        ownerId: 'alice',
        deviceId: 'alice-browser',
        recoveryPassphrase: 'too-short'
      }),
      'recovery_passphrase_too_short'
    );
    await expectRejected(
      browserE2eeHelper.generateDeviceKeys({
        ownerId: 'alice',
        deviceId: 'alice-browser',
        recoveryPassphrase: 'alice recovery secret',
        recoveryIterations: browserE2eeHelper.constants.MINIMUM_RECOVERY_ITERATIONS - 1
      }),
      'recovery_iterations_invalid'
    );
  });

  it('encrypts one opaque envelope for multiple browser devices', async function () {
    const sender = await createDevice('sender', 'sender-browser');
    const alice = await createDevice('alice', 'alice-browser');
    const bob = await createDevice('bob', 'bob-browser');
    const plaintext = 'browser-only secret';

    const envelope = await browserE2eeHelper.encryptEnvelope(
      plaintext,
      [bob.publicBundle, alice.publicBundle],
      sender,
      {
        messageId: 'message-1',
        conversationId: 'conversation-1',
        createdAt: '2026-07-28T00:01:00.000Z',
        metadata: {kind: 'text'},
        contentKey: new Uint8Array(32).fill(7),
        iv: new Uint8Array(12).fill(3)
      }
    );
    const storedEnvelope = JSON.parse(JSON.stringify(envelope));

    expect(browserE2eeHelper.isEncryptedEnvelope(storedEnvelope)).to.equal(true);
    expect(JSON.stringify(storedEnvelope)).to.not.include(plaintext);
    expect(storedEnvelope.recipients).to.have.length(2);
    expect(storedEnvelope.recipientKeyIds).to.deep.equal(
      [...storedEnvelope.recipientKeyIds].sort()
    );
    expect(await browserE2eeHelper.verifyEnvelopeSignature(storedEnvelope, sender.publicBundle)).to.equal(true);
    expect(await browserE2eeHelper.decryptEnvelopeText(storedEnvelope, alice, sender.publicBundle)).to.equal(plaintext);
    expect(await browserE2eeHelper.decryptEnvelopeText(storedEnvelope, bob, sender.publicBundle)).to.equal(plaintext);
  });

  it('deduplicates repeated recipient device bundles', async function () {
    const sender = await createDevice('sender', 'sender-browser');
    const alice = await createDevice('alice', 'alice-browser');
    const envelope = await browserE2eeHelper.encryptEnvelope(
      'one key wrap',
      [alice.publicBundle, alice.publicBundle],
      sender,
      {
        messageId: 'message-deduplicate',
        conversationId: 'conversation-1',
        createdAt: '2026-07-28T00:01:30.000Z'
      }
    );

    expect(envelope.recipientKeyIds).to.deep.equal([alice.publicBundle.keyId]);
    expect(envelope.recipients).to.have.length(1);
  });

  it('round-trips canonical JSON independently of object key order', async function () {
    const sender = await createDevice('sender', 'sender-browser');
    const alice = await createDevice('alice', 'alice-browser');
    const envelope = await browserE2eeHelper.encryptEnvelope(
      {z: 1, nested: {b: 2, a: 1}, a: 2},
      [alice.publicBundle],
      sender,
      {
        messageId: 'message-json',
        conversationId: 'conversation-1',
        createdAt: '2026-07-28T00:02:00.000Z'
      }
    );

    expect(await browserE2eeHelper.decryptEnvelopeJson(
      JSON.parse(JSON.stringify(envelope)),
      alice,
      sender.publicBundle
    )).to.deep.equal({
      a: 2,
      nested: {a: 1, b: 2},
      z: 1
    });
  });

  it('rejects envelope header and ciphertext tampering', async function () {
    const sender = await createDevice('sender', 'sender-browser');
    const alice = await createDevice('alice', 'alice-browser');
    const envelope = await browserE2eeHelper.encryptEnvelope(
      'signed body',
      [alice.publicBundle],
      sender,
      {
        messageId: 'message-tamper',
        conversationId: 'conversation-1',
        createdAt: '2026-07-28T00:03:00.000Z'
      }
    );
    const headerTampered = JSON.parse(JSON.stringify(envelope));
    headerTampered.conversationId = 'conversation-2';
    expect(await browserE2eeHelper.verifyEnvelopeSignature(
      headerTampered,
      sender.publicBundle
    )).to.equal(false);

    const ciphertextTampered = JSON.parse(JSON.stringify(envelope));
    const ciphertext = browserE2eeHelper.decodeBase64Url(ciphertextTampered.content.ciphertext);
    ciphertext[0] ^= 1;
    ciphertextTampered.content.ciphertext = browserE2eeHelper.encodeBase64Url(ciphertext);
    expect(await browserE2eeHelper.verifyEnvelopeSignature(
      ciphertextTampered,
      sender.publicBundle
    )).to.equal(false);
    await expectRejected(
      browserE2eeHelper.decryptEnvelopeText(ciphertextTampered, alice, sender.publicBundle),
      'envelope_signature_invalid'
    );
  });

  it('rejects a device that is not an envelope recipient', async function () {
    const sender = await createDevice('sender', 'sender-browser');
    const alice = await createDevice('alice', 'alice-browser');
    const mallory = await createDevice('mallory', 'mallory-browser');
    const envelope = await browserE2eeHelper.encryptEnvelope(
      'private body',
      [alice.publicBundle],
      sender,
      {
        messageId: 'message-recipient',
        conversationId: 'conversation-1',
        createdAt: '2026-07-28T00:04:00.000Z'
      }
    );

    await expectRejected(
      browserE2eeHelper.decryptEnvelopeText(envelope, mallory, sender.publicBundle),
      'recipient_not_found'
    );
  });

  it('rejects malformed bundles and incomplete encrypted envelopes', async function () {
    const sender = await createDevice('sender', 'sender-browser');
    const alice = await createDevice('alice', 'alice-browser');
    const malformedBundle = JSON.parse(JSON.stringify(alice.publicBundle));
    malformedBundle.encryption.publicKey = 'not-a-valid-key';

    expect(await browserE2eeHelper.verifyDeviceKeyBundle(malformedBundle)).to.equal(false);

    const envelope = await browserE2eeHelper.encryptEnvelope(
      'complete body',
      [alice.publicBundle],
      sender,
      {
        messageId: 'message-shape',
        conversationId: 'conversation-1',
        createdAt: '2026-07-28T00:05:00.000Z'
      }
    );
    const incomplete = JSON.parse(JSON.stringify(envelope));
    delete incomplete.recipients[0].encryptedKey;

    expect(browserE2eeHelper.isEncryptedEnvelope(incomplete)).to.equal(false);
    expect(await browserE2eeHelper.verifyEnvelopeSignature(
      incomplete,
      sender.publicBundle
    )).to.equal(false);
  });

  it('encrypts attachment bytes before storage and detects tampering', async function () {
    const plaintext = new TextEncoder().encode('attachment secret');
    const result = await browserE2eeHelper.encryptAttachment(plaintext, {
      name: 'secret.txt',
      mimeType: 'text/plain',
      key: new Uint8Array(32).fill(9),
      iv: new Uint8Array(12).fill(4)
    });
    const serialized = JSON.parse(JSON.stringify(
      browserE2eeHelper.serializeAttachment(result.attachment)
    ));

    expect(JSON.stringify(serialized)).to.not.include('attachment secret');
    expect(new TextDecoder().decode(
      await browserE2eeHelper.decryptAttachment(serialized, result.key)
    )).to.equal('attachment secret');

    const ciphertext = browserE2eeHelper.decodeBase64Url(serialized.ciphertext);
    ciphertext[0] ^= 1;
    serialized.ciphertext = browserE2eeHelper.encodeBase64Url(ciphertext);
    await expectRejected(
      browserE2eeHelper.decryptAttachment(serialized, result.key)
    );
  });
});

async function expectRejected(promise, expectedMessage = null) {
  try {
    await promise;
    throw new Error('expected_rejection');
  } catch (error) {
    expect(error.message).to.not.equal('expected_rejection');
    if (expectedMessage) {
      expect(error.message).to.equal(expectedMessage);
    }
  }
}
