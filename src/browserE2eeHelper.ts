/*
 * Browser-first encrypted chat helpers.
 *
 * Private keys are returned as WebCrypto CryptoKey objects so browser clients
 * can persist them in IndexedDB without serializing key bytes. GeeSome nodes
 * should only receive public device bundles and opaque encrypted envelopes.
 */

import {
  Aes128Gcm,
  CipherSuite,
  DhkemP256HkdfSha256,
  HkdfSha256
} from '@hpke/core';

const DEVICE_KEYS_VERSION = 'geesome-device-keys-v1';
const ENVELOPE_VERSION = 'geesome-e2ee-v2';
const ATTACHMENT_VERSION = 'geesome-e2ee-attachment-v1';
const ENVELOPE_TYPE = 'geesome.chat.message';
const CONTENT_ALGORITHM = 'AES-256-GCM';
const SIGNATURE_ALGORITHM = 'ECDSA-P256-SHA256';
const KEY_WRAP_ALGORITHM = 'HPKE-DHKEM-P256-HKDF-SHA256-AES128GCM';
const HPKE_INFO = new TextEncoder().encode('geesome.chat.content-key.v1');
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const hpkeSuite = new CipherSuite({
  kem: new DhkemP256HkdfSha256(),
  kdf: new HkdfSha256(),
  aead: new Aes128Gcm()
});

function getCrypto(): any {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('webcrypto_required');
  }
  return cryptoApi;
}

function toUint8Array(value): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new Error('byte_array_required');
}

function encodeBase64Url(value): string {
  const bytes = toUint8Array(value);
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const block = (first << 16) | (second << 8) | third;

    output += BASE64_ALPHABET[(block >>> 18) & 63];
    output += BASE64_ALPHABET[(block >>> 12) & 63];
    output += index + 1 < bytes.length ? BASE64_ALPHABET[(block >>> 6) & 63] : '=';
    output += index + 2 < bytes.length ? BASE64_ALPHABET[block & 63] : '=';
  }

  return output.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value)) {
    throw new Error('invalid_base64url');
  }

  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const output: number[] = [];

  for (let index = 0; index < padded.length; index += 4) {
    const first = BASE64_ALPHABET.indexOf(padded[index]);
    const second = BASE64_ALPHABET.indexOf(padded[index + 1]);
    const third = padded[index + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(padded[index + 2]);
    const fourth = padded[index + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(padded[index + 3]);

    if (first < 0 || second < 0 || third < 0 || fourth < 0) {
      throw new Error('invalid_base64url');
    }

    const block = (first << 18) | (second << 12) | (third << 6) | fourth;
    output.push((block >>> 16) & 255);
    if (padded[index + 2] !== '=') {
      output.push((block >>> 8) & 255);
    }
    if (padded[index + 3] !== '=') {
      output.push(block & 255);
    }
  }

  return new Uint8Array(output);
}

function canonicalize(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  const result = {};
  Object.keys(value)
    .filter(key => value[key] !== undefined)
    .sort()
    .forEach(key => {
      result[key] = canonicalize(value[key]);
    });
  return result;
}

function canonicalBytes(value): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(canonicalize(value)));
}

async function sha256(value): Promise<Uint8Array> {
  return new Uint8Array(await getCrypto().subtle.digest('SHA-256', toUint8Array(value)));
}

async function signValue(value, privateKey): Promise<string> {
  const signature = await getCrypto().subtle.sign(
    {name: 'ECDSA', hash: 'SHA-256'},
    privateKey,
    canonicalBytes(value)
  );
  return encodeBase64Url(signature);
}

async function verifyValue(value, signature: string, publicKey): Promise<boolean> {
  return getCrypto().subtle.verify(
    {name: 'ECDSA', hash: 'SHA-256'},
    publicKey,
    decodeBase64Url(signature),
    canonicalBytes(value)
  );
}

function getDeviceBundleIdentity(bundle) {
  return {
    version: bundle.version,
    ownerId: bundle.ownerId,
    deviceId: bundle.deviceId,
    createdAt: bundle.createdAt,
    encryption: bundle.encryption,
    signing: bundle.signing
  };
}

async function getDeviceKeyId(bundle): Promise<string> {
  return encodeBase64Url(await sha256(canonicalBytes(getDeviceBundleIdentity(bundle))));
}

async function importSigningPublicKey(bundle) {
  return getCrypto().subtle.importKey(
    'raw',
    decodeBase64Url(bundle.signing.publicKey),
    {name: 'ECDSA', namedCurve: 'P-256'},
    false,
    ['verify']
  );
}

async function protectHpkePrivateKey(key) {
  const subtle = getCrypto().subtle;
  const jwk = await subtle.exportKey('jwk', key);
  return subtle.importKey(
    'jwk',
    jwk,
    {name: 'ECDH', namedCurve: 'P-256'},
    false,
    ['deriveBits']
  );
}

function requireString(value, errorCode) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(errorCode);
  }
  return value;
}

function compareStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function hasNonEmptyString(value): boolean {
  return typeof value === 'string' && value.length > 0;
}

function hasUniqueStrings(values): boolean {
  return Array.isArray(values) &&
    values.every(hasNonEmptyString) &&
    new Set(values).size === values.length;
}

function preparePlaintext(value) {
  if (typeof value === 'string') {
    return {
      encoding: 'utf8',
      bytes: new TextEncoder().encode(value)
    };
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return {
      encoding: 'binary',
      bytes: toUint8Array(value)
    };
  }
  return {
    encoding: 'json',
    bytes: canonicalBytes(value)
  };
}

function getEnvelopeHeader(envelope) {
  return {
    version: envelope.version,
    type: envelope.type,
    messageId: envelope.messageId,
    conversationId: envelope.conversationId,
    createdAt: envelope.createdAt,
    sender: envelope.sender,
    recipientKeyIds: envelope.recipientKeyIds,
    encoding: envelope.encoding,
    metadata: envelope.metadata || {}
  };
}

function getUnsignedEnvelope(envelope) {
  const {signature, ...unsignedEnvelope} = envelope;
  return unsignedEnvelope;
}

function generateMessageId(): string {
  const bytes = new Uint8Array(16);
  getCrypto().getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

async function importAesKey(rawKey, usages) {
  return getCrypto().subtle.importKey(
    'raw',
    toUint8Array(rawKey),
    {name: 'AES-GCM'},
    false,
    usages
  );
}

async function encryptAesGcm(plaintext, rawKey, aad, iv = null) {
  const normalizedIv = iv ? toUint8Array(iv) : new Uint8Array(12);
  if (!iv) {
    getCrypto().getRandomValues(normalizedIv);
  }
  if (normalizedIv.length !== 12) {
    throw new Error('iv_must_be_12_bytes');
  }

  const ciphertext = await getCrypto().subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: normalizedIv,
      additionalData: aad,
      tagLength: 128
    },
    await importAesKey(rawKey, ['encrypt']),
    toUint8Array(plaintext)
  );
  return {
    iv: normalizedIv,
    ciphertext: new Uint8Array(ciphertext)
  };
}

async function decryptAesGcm(ciphertext, rawKey, aad, iv) {
  return new Uint8Array(await getCrypto().subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toUint8Array(iv),
      additionalData: aad,
      tagLength: 128
    },
    await importAesKey(rawKey, ['decrypt']),
    toUint8Array(ciphertext)
  ));
}

const browserE2eeHelper = {
  async generateDeviceKeys(options: any = {}) {
    const ownerId = requireString(options.ownerId, 'owner_id_required');
    const deviceId = requireString(options.deviceId, 'device_id_required');
    const createdAt = options.createdAt || new Date().toISOString();
    const encryptionKeys = await hpkeSuite.kem.generateKeyPair();
    const signingKeys = await getCrypto().subtle.generateKey(
      {name: 'ECDSA', namedCurve: 'P-256'},
      false,
      ['sign', 'verify']
    );

    const bundle: any = {
      version: DEVICE_KEYS_VERSION,
      ownerId,
      deviceId,
      createdAt,
      encryption: {
        algorithm: KEY_WRAP_ALGORITHM,
        publicKey: encodeBase64Url(await hpkeSuite.kem.serializePublicKey(encryptionKeys.publicKey))
      },
      signing: {
        algorithm: SIGNATURE_ALGORITHM,
        publicKey: encodeBase64Url(await getCrypto().subtle.exportKey('raw', signingKeys.publicKey))
      }
    };
    bundle.keyId = await getDeviceKeyId(bundle);
    bundle.proof = {
      algorithm: SIGNATURE_ALGORITHM,
      signature: await signValue(bundle, signingKeys.privateKey)
    };

    return {
      publicBundle: bundle,
      privateKeys: {
        encryptionKey: await protectHpkePrivateKey(encryptionKeys.privateKey),
        encryptionPublicKey: encryptionKeys.publicKey,
        signingKey: signingKeys.privateKey
      }
    };
  },

  async verifyDeviceKeyBundle(bundle) {
    try {
      if (
        !bundle ||
        bundle.version !== DEVICE_KEYS_VERSION ||
        !hasNonEmptyString(bundle.ownerId) ||
        !hasNonEmptyString(bundle.deviceId) ||
        !hasNonEmptyString(bundle.createdAt) ||
        !hasNonEmptyString(bundle.keyId) ||
        bundle.encryption?.algorithm !== KEY_WRAP_ALGORITHM ||
        !hasNonEmptyString(bundle.encryption?.publicKey) ||
        bundle.signing?.algorithm !== SIGNATURE_ALGORITHM ||
        !hasNonEmptyString(bundle.signing?.publicKey) ||
        bundle.proof?.algorithm !== SIGNATURE_ALGORITHM ||
        !hasNonEmptyString(bundle.proof?.signature)
      ) {
        return false;
      }
      if (bundle.keyId !== await getDeviceKeyId(bundle)) {
        return false;
      }
      return verifyValue(
        {...bundle, proof: undefined},
        bundle.proof.signature,
        await importSigningPublicKey(bundle)
      );
    } catch {
      return false;
    }
  },

  async encryptEnvelope(plaintext, recipients, senderKeys, options: any = {}) {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('recipients_required');
    }
    if (!senderKeys?.publicBundle || !senderKeys?.privateKeys?.signingKey) {
      throw new Error('sender_device_keys_required');
    }
    if (!await browserE2eeHelper.verifyDeviceKeyBundle(senderKeys.publicBundle)) {
      throw new Error('sender_device_bundle_invalid');
    }

    const validRecipients = [];
    for (const recipient of recipients) {
      if (!await browserE2eeHelper.verifyDeviceKeyBundle(recipient)) {
        throw new Error('recipient_device_bundle_invalid');
      }
      validRecipients.push(recipient);
    }
    const uniqueRecipients = [...new Map(
      validRecipients.map(recipient => [recipient.keyId, recipient])
    ).values()];
    uniqueRecipients.sort((left, right) => compareStrings(left.keyId, right.keyId));

    const prepared = preparePlaintext(plaintext);
    const envelope: any = {
      version: ENVELOPE_VERSION,
      type: options.type || ENVELOPE_TYPE,
      messageId: options.messageId || generateMessageId(),
      conversationId: requireString(options.conversationId, 'conversation_id_required'),
      createdAt: options.createdAt || new Date().toISOString(),
      sender: {
        ownerId: senderKeys.publicBundle.ownerId,
        deviceId: senderKeys.publicBundle.deviceId,
        keyId: senderKeys.publicBundle.keyId
      },
      recipientKeyIds: uniqueRecipients.map(recipient => recipient.keyId),
      encoding: prepared.encoding,
      metadata: options.metadata || {}
    };
    const aad = canonicalBytes(getEnvelopeHeader(envelope));
    const contentKey = options.contentKey
      ? toUint8Array(options.contentKey)
      : getCrypto().getRandomValues(new Uint8Array(32));
    if (contentKey.length !== 32) {
      throw new Error('content_key_must_be_32_bytes');
    }
    const encryptedContent = await encryptAesGcm(prepared.bytes, contentKey, aad, options.iv);

    envelope.content = {
      algorithm: CONTENT_ALGORITHM,
      iv: encodeBase64Url(encryptedContent.iv),
      ciphertext: encodeBase64Url(encryptedContent.ciphertext)
    };
    envelope.recipients = [];
    for (const recipient of uniqueRecipients) {
      const publicKey = await hpkeSuite.kem.deserializePublicKey(
        decodeBase64Url(recipient.encryption.publicKey)
      );
      const wrapped = await hpkeSuite.seal(
        {
          recipientPublicKey: publicKey,
          info: HPKE_INFO
        },
        contentKey,
        aad
      );
      envelope.recipients.push({
        ownerId: recipient.ownerId,
        deviceId: recipient.deviceId,
        keyId: recipient.keyId,
        algorithm: KEY_WRAP_ALGORITHM,
        encapsulatedKey: encodeBase64Url(wrapped.enc),
        encryptedKey: encodeBase64Url(wrapped.ct)
      });
    }
    envelope.signature = {
      algorithm: SIGNATURE_ALGORITHM,
      keyId: senderKeys.publicBundle.keyId,
      signature: await signValue(getUnsignedEnvelope(envelope), senderKeys.privateKeys.signingKey)
    };
    return envelope;
  },

  async verifyEnvelopeSignature(envelope, senderBundle) {
    try {
      if (
        !browserE2eeHelper.isEncryptedEnvelope(envelope) ||
        !await browserE2eeHelper.verifyDeviceKeyBundle(senderBundle) ||
        envelope.sender?.ownerId !== senderBundle.ownerId ||
        envelope.sender?.deviceId !== senderBundle.deviceId ||
        envelope.sender?.keyId !== senderBundle.keyId ||
        envelope.signature?.algorithm !== SIGNATURE_ALGORITHM ||
        envelope.signature?.keyId !== senderBundle.keyId
      ) {
        return false;
      }
      return verifyValue(
        getUnsignedEnvelope(envelope),
        envelope.signature.signature,
        await importSigningPublicKey(senderBundle)
      );
    } catch {
      return false;
    }
  },

  async decryptEnvelope(envelope, recipientKeys, senderBundle) {
    if (!browserE2eeHelper.isEncryptedEnvelope(envelope)) {
      throw new Error('unsupported_envelope_version');
    }
    if (
      !recipientKeys?.publicBundle ||
      !recipientKeys?.privateKeys?.encryptionKey ||
      !recipientKeys?.privateKeys?.encryptionPublicKey
    ) {
      throw new Error('recipient_device_keys_required');
    }
    if (!await browserE2eeHelper.verifyEnvelopeSignature(envelope, senderBundle)) {
      throw new Error('envelope_signature_invalid');
    }

    const recipient = envelope.recipients.find(item =>
      item.keyId === recipientKeys.publicBundle.keyId &&
      item.deviceId === recipientKeys.publicBundle.deviceId
    );
    if (!recipient) {
      throw new Error('recipient_not_found');
    }
    const aad = canonicalBytes(getEnvelopeHeader(envelope));
    const contentKey = await hpkeSuite.open(
      {
        recipientKey: {
          privateKey: recipientKeys.privateKeys.encryptionKey,
          publicKey: recipientKeys.privateKeys.encryptionPublicKey
        },
        enc: decodeBase64Url(recipient.encapsulatedKey),
        info: HPKE_INFO
      },
      decodeBase64Url(recipient.encryptedKey),
      aad
    );
    const plaintext = await decryptAesGcm(
      decodeBase64Url(envelope.content.ciphertext),
      contentKey,
      aad,
      decodeBase64Url(envelope.content.iv)
    );
    return {
      encoding: envelope.encoding,
      plaintext
    };
  },

  async decryptEnvelopeText(envelope, recipientKeys, senderBundle) {
    const result = await browserE2eeHelper.decryptEnvelope(envelope, recipientKeys, senderBundle);
    if (result.encoding === 'binary') {
      throw new Error('envelope_is_binary');
    }
    return new TextDecoder().decode(result.plaintext);
  },

  async decryptEnvelopeJson(envelope, recipientKeys, senderBundle) {
    const result = await browserE2eeHelper.decryptEnvelope(envelope, recipientKeys, senderBundle);
    if (result.encoding !== 'json') {
      throw new Error('envelope_is_not_json');
    }
    return JSON.parse(new TextDecoder().decode(result.plaintext));
  },

  async encryptAttachment(data, options: any = {}) {
    const plaintext = toUint8Array(data);
    const key = options.key ? toUint8Array(options.key) : getCrypto().getRandomValues(new Uint8Array(32));
    if (key.length !== 32) {
      throw new Error('attachment_key_must_be_32_bytes');
    }
    const aad = canonicalBytes({
      version: ATTACHMENT_VERSION,
      mimeType: options.mimeType || 'application/octet-stream',
      name: options.name || null,
      size: plaintext.byteLength
    });
    const encrypted = await encryptAesGcm(plaintext, key, aad, options.iv);
    return {
      key,
      attachment: {
        version: ATTACHMENT_VERSION,
        algorithm: CONTENT_ALGORITHM,
        mimeType: options.mimeType || 'application/octet-stream',
        name: options.name || null,
        size: plaintext.byteLength,
        iv: encodeBase64Url(encrypted.iv),
        ciphertext: encrypted.ciphertext
      }
    };
  },

  async decryptAttachment(attachment, key) {
    if (
      !attachment ||
      attachment.version !== ATTACHMENT_VERSION ||
      attachment.algorithm !== CONTENT_ALGORITHM
    ) {
      throw new Error('unsupported_attachment_version');
    }
    const ciphertext = typeof attachment.ciphertext === 'string'
      ? decodeBase64Url(attachment.ciphertext)
      : toUint8Array(attachment.ciphertext);
    const aad = canonicalBytes({
      version: attachment.version,
      mimeType: attachment.mimeType,
      name: attachment.name,
      size: attachment.size
    });
    const plaintext = await decryptAesGcm(
      ciphertext,
      toUint8Array(key),
      aad,
      decodeBase64Url(attachment.iv)
    );
    if (plaintext.byteLength !== attachment.size) {
      throw new Error('attachment_size_mismatch');
    }
    return plaintext;
  },

  serializeAttachment(attachment) {
    return {
      ...attachment,
      ciphertext: typeof attachment.ciphertext === 'string'
        ? attachment.ciphertext
        : encodeBase64Url(attachment.ciphertext)
    };
  },

  isEncryptedEnvelope(value) {
    if (
      !value ||
      value.version !== ENVELOPE_VERSION ||
      !hasNonEmptyString(value.type) ||
      !hasNonEmptyString(value.messageId) ||
      !hasNonEmptyString(value.conversationId) ||
      !hasNonEmptyString(value.createdAt) ||
      !hasNonEmptyString(value.sender?.ownerId) ||
      !hasNonEmptyString(value.sender?.deviceId) ||
      !hasNonEmptyString(value.sender?.keyId) ||
      !hasUniqueStrings(value.recipientKeyIds) ||
      value.recipientKeyIds.length === 0 ||
      value.content?.algorithm !== CONTENT_ALGORITHM ||
      !hasNonEmptyString(value.content?.iv) ||
      !hasNonEmptyString(value.content?.ciphertext) ||
      !Array.isArray(value.recipients) ||
      value.recipients.length !== value.recipientKeyIds.length ||
      value.signature?.algorithm !== SIGNATURE_ALGORITHM ||
      value.signature?.keyId !== value.sender.keyId ||
      !hasNonEmptyString(value.signature?.signature)
    ) {
      return false;
    }

    const recipientKeyIds = value.recipients.map(recipient => recipient?.keyId);
    return hasUniqueStrings(recipientKeyIds) &&
      recipientKeyIds.every((keyId, index) => keyId === value.recipientKeyIds[index]) &&
      value.recipients.every(recipient =>
        hasNonEmptyString(recipient.ownerId) &&
        hasNonEmptyString(recipient.deviceId) &&
        recipient.algorithm === KEY_WRAP_ALGORITHM &&
        hasNonEmptyString(recipient.encapsulatedKey) &&
        hasNonEmptyString(recipient.encryptedKey)
      );
  },

  encodeBase64Url,
  decodeBase64Url,

  constants: {
    DEVICE_KEYS_VERSION,
    ENVELOPE_VERSION,
    ATTACHMENT_VERSION,
    ENVELOPE_TYPE,
    CONTENT_ALGORITHM,
    SIGNATURE_ALGORITHM,
    KEY_WRAP_ALGORITHM
  }
};

export default browserE2eeHelper;
