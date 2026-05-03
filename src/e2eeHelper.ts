/*
 * Shared helpers for opaque end-to-end encrypted GeeSome envelopes.
 *
 * These helpers deliberately keep plaintext handling client-side: geesome-node
 * should store and route the returned envelope without inspecting message data.
 */

import crypto from 'node:crypto';
import peerIdHelper from './peerIdHelper';
import common from './common';

const ENVELOPE_VERSION = 'geesome-e2ee-v1';
const CONTENT_ALGORITHM = 'aes-256-gcm';
const KEY_WRAP_ALGORITHM = 'libp2p-rsa';

const toBuffer = (value) => {
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (typeof value === 'string') {
    return Buffer.from(value, 'utf8');
  }
  return Buffer.from(JSON.stringify(value), 'utf8');
};

const toBase64 = (value) => Buffer.from(value).toString('base64');
const fromBase64 = (value) => Buffer.from(value, 'base64');

const normalizePublicKey = async (publicKey) => {
  if (typeof publicKey === 'string') {
    return peerIdHelper.base64ToPublicKey(publicKey);
  }
  if (publicKey.bytes || publicKey.encrypt) {
    return publicKey;
  }
  throw new Error('recipient_public_key_required');
};

const normalizePrivateKey = async (privateKey) => {
  if (typeof privateKey === 'string') {
    return (await peerIdHelper.createPeerIdFromPrivateBase64(privateKey)).privKey;
  }
  if (privateKey.privKey) {
    return privateKey.privKey;
  }
  if (privateKey.decrypt) {
    return privateKey;
  }
  throw new Error('recipient_private_key_required');
};

const getRecipientId = async (recipient, publicKey) => {
  if (recipient.id) {
    return recipient.id;
  }
  const publicKeyBase64 = recipient.publicKeyBase64 || recipient.publicKey;
  if (publicKeyBase64) {
    return peerIdHelper.peerIdToPublicBase58(await peerIdHelper.createPeerIdFromPublicBase64(publicKeyBase64));
  }
  return peerIdHelper.peerIdToPublicBase58(await peerIdHelper.createPeerIdFromPubKey(publicKey.bytes));
};

const buildAad = (envelopeFields) => {
  return Buffer.from(JSON.stringify(common.sortObject({
    version: envelopeFields.version,
    type: envelopeFields.type,
    createdAt: envelopeFields.createdAt,
    metadata: envelopeFields.metadata || {}
  })), 'utf8');
};

const e2eeHelper = {
  async encryptEnvelope(plaintext, recipients, options: any = {}) {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('recipients_required');
    }

    const contentKey = options.contentKey ? toBuffer(options.contentKey) : crypto.randomBytes(32);
    if (contentKey.length !== 32) {
      throw new Error('content_key_must_be_32_bytes');
    }
    const iv = options.iv ? toBuffer(options.iv) : crypto.randomBytes(12);
    if (iv.length !== 12) {
      throw new Error('iv_must_be_12_bytes');
    }

    const envelopeFields = {
      version: ENVELOPE_VERSION,
      type: options.type || 'geesome.chat.message',
      createdAt: options.createdAt || new Date().toISOString(),
      metadata: options.metadata || {}
    };
    const aad = buildAad(envelopeFields);
    const cipher = crypto.createCipheriv(CONTENT_ALGORITHM, contentKey, iv);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(toBuffer(plaintext)), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const wrappedRecipients = [];
    for (const recipient of recipients) {
      const publicKeyBase64 = recipient.publicKeyBase64 || recipient.publicKey;
      const publicKey = await normalizePublicKey(publicKeyBase64 || recipient);
      const wrappedKey = await publicKey.encrypt(contentKey);
      wrappedRecipients.push({
        id: await getRecipientId(recipient, publicKey),
        publicKey: publicKeyBase64 || peerIdHelper.publicKeyToBase64(publicKey),
        algorithm: KEY_WRAP_ALGORITHM,
        wrappedKey: toBase64(wrappedKey)
      });
    }

    return {
      ...envelopeFields,
      content: {
        algorithm: CONTENT_ALGORITHM,
        iv: toBase64(iv),
        authTag: toBase64(authTag),
        ciphertext: toBase64(ciphertext)
      },
      recipients: wrappedRecipients
    };
  },

  async decryptEnvelope(envelope, privateKey, options: any = {}) {
    if (!envelope || envelope.version !== ENVELOPE_VERSION) {
      throw new Error('unsupported_envelope_version');
    }
    const recipient = options.recipientId
      ? envelope.recipients.find(item => item.id === options.recipientId)
      : envelope.recipients[0];
    if (!recipient) {
      throw new Error('recipient_not_found');
    }

    const normalizedPrivateKey = await normalizePrivateKey(privateKey);
    const contentKey = Buffer.from(await normalizedPrivateKey.decrypt(fromBase64(recipient.wrappedKey)));
    const decipher = crypto.createDecipheriv(CONTENT_ALGORITHM, contentKey, fromBase64(envelope.content.iv));
    decipher.setAAD(buildAad(envelope));
    decipher.setAuthTag(fromBase64(envelope.content.authTag));
    return Buffer.concat([
      decipher.update(fromBase64(envelope.content.ciphertext)),
      decipher.final()
    ]);
  },

  decryptEnvelopeText(envelope, privateKey, options: any = {}) {
    return e2eeHelper.decryptEnvelope(envelope, privateKey, options).then((data) => data.toString('utf8'));
  },

  getRecipientIds(envelope) {
    return (envelope.recipients || []).map(recipient => recipient.id);
  },

  isEncryptedEnvelope(value) {
    return !!value && value.version === ENVELOPE_VERSION && value.content && Array.isArray(value.recipients);
  },

  constants: {
    ENVELOPE_VERSION,
    CONTENT_ALGORITHM,
    KEY_WRAP_ALGORITHM
  }
};

export default e2eeHelper;
