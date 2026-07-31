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
const DEVICE_FINGERPRINT_VERSION = 'geesome-device-fingerprint-v1';
const DEVICE_RECOVERY_VERSION = 'geesome-device-recovery-v1';
const ENVELOPE_VERSION = 'geesome-e2ee-v2';
const ATTACHMENT_VERSION = 'geesome-e2ee-attachment-v1';
const ATTACHMENT_REFERENCE_VERSION = 'geesome-e2ee-attachment-reference-v1';
const CHAT_MESSAGE_PAYLOAD_VERSION = 'geesome-chat-message-v1';
const PRIVATE_GROUP_POST_PAYLOAD_VERSION = 'geesome-private-group-post-v1';
const ENVELOPE_TYPE = 'geesome.chat.message';
const PRIVATE_GROUP_POST_ENVELOPE_TYPE = 'geesome.private-group.post';
const PRIVATE_GROUP_CONVERSATION_PREFIX = 'geesome.private-group:';
const CONTENT_ALGORITHM = 'AES-256-GCM';
const SIGNATURE_ALGORITHM = 'ECDSA-P256-SHA256';
const FINGERPRINT_ALGORITHM = 'SHA-256';
const KEY_WRAP_ALGORITHM = 'HPKE-DHKEM-P256-HKDF-SHA256-AES128GCM';
const RECOVERY_KDF_ALGORITHM = 'PBKDF2-SHA256';
const RECOVERY_CIPHER_ALGORITHM = 'AES-256-GCM';
const DEFAULT_RECOVERY_ITERATIONS = 600000;
const MINIMUM_RECOVERY_ITERATIONS = 600000;
const MAXIMUM_RECOVERY_ITERATIONS = 2000000;
const MINIMUM_RECOVERY_PASSPHRASE_LENGTH = 12;
const MAXIMUM_CHAT_ATTACHMENTS = 20;
const HPKE_INFO = new TextEncoder().encode('geesome.chat.content-key.v1');
const RECOVERY_KEY_CHECK_INFO = new TextEncoder().encode('geesome.chat.device-recovery-check.v1');
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

function formatDeviceFingerprint(keyId: string): string {
  let bytes;
  try {
    bytes = decodeBase64Url(keyId);
  } catch {
    throw new Error('device_key_id_invalid');
  }
  if (bytes.length !== 32) {
    throw new Error('device_key_id_invalid');
  }
  const hex = Array.from(bytes)
    .map(value => value.toString(16).padStart(2, '0').toUpperCase())
    .join('');
  const groups = hex.match(/.{4}/g);
  if (!groups) {
    throw new Error('device_key_id_invalid');
  }
  return groups.join(' ');
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

async function protectSigningPrivateKey(key) {
  const subtle = getCrypto().subtle;
  const jwk = await subtle.exportKey('jwk', key);
  return subtle.importKey(
    'jwk',
    jwk,
    {name: 'ECDSA', namedCurve: 'P-256'},
    false,
    ['sign']
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

function normalizeRecoveryIterations(value): number {
  const iterations = value == null ? DEFAULT_RECOVERY_ITERATIONS : Number(value);
  if (
    !Number.isSafeInteger(iterations) ||
    iterations < MINIMUM_RECOVERY_ITERATIONS ||
    iterations > MAXIMUM_RECOVERY_ITERATIONS
  ) {
    throw new Error('recovery_iterations_invalid');
  }
  return iterations;
}

function requireRecoveryPassphrase(value): string {
  const passphrase = requireString(value, 'recovery_passphrase_required');
  if (passphrase.length < MINIMUM_RECOVERY_PASSPHRASE_LENGTH) {
    throw new Error('recovery_passphrase_too_short');
  }
  return passphrase;
}

async function deriveRecoveryKey(passphrase: string, salt, iterations: number) {
  const subtle = getCrypto().subtle;
  const passphraseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toUint8Array(salt),
      iterations
    },
    passphraseKey,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt', 'decrypt']
  );
}

function getRecoveryHeader(recoveryBundle) {
  return {
    version: recoveryBundle.version,
    publicBundle: recoveryBundle.publicBundle,
    kdf: recoveryBundle.kdf,
    cipher: {
      algorithm: recoveryBundle.cipher.algorithm,
      iv: recoveryBundle.cipher.iv
    }
  };
}

function packRecoveryPrivateKeys(encryptionPrivateKey, signingPrivateKey): Uint8Array {
  const encryptionBytes = toUint8Array(encryptionPrivateKey);
  const signingBytes = toUint8Array(signingPrivateKey);
  if (encryptionBytes.length > 65535 || signingBytes.length > 65535) {
    throw new Error('recovery_private_key_too_large');
  }

  const packed = new Uint8Array(4 + encryptionBytes.length + signingBytes.length);
  const view = new DataView(packed.buffer);
  view.setUint16(0, encryptionBytes.length);
  packed.set(encryptionBytes, 2);
  view.setUint16(2 + encryptionBytes.length, signingBytes.length);
  packed.set(signingBytes, 4 + encryptionBytes.length);
  return packed;
}

function unpackRecoveryPrivateKeys(packedValue) {
  const packed = toUint8Array(packedValue);
  if (packed.length < 4) {
    throw new Error('device_recovery_payload_invalid');
  }

  const view = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
  const encryptionLength = view.getUint16(0);
  const signingLengthOffset = 2 + encryptionLength;
  if (signingLengthOffset + 2 > packed.length) {
    throw new Error('device_recovery_payload_invalid');
  }
  const signingLength = view.getUint16(signingLengthOffset);
  if (signingLengthOffset + 2 + signingLength !== packed.length) {
    throw new Error('device_recovery_payload_invalid');
  }

  return {
    encryptionPrivateKey: packed.slice(2, signingLengthOffset),
    signingPrivateKey: packed.slice(signingLengthOffset + 2)
  };
}

async function createDeviceRecoveryBundle(publicBundle, encryptionPrivateKey, signingPrivateKey, options) {
  const passphrase = requireRecoveryPassphrase(options.passphrase);
  const iterations = normalizeRecoveryIterations(options.iterations);
  const salt = options.salt ? toUint8Array(options.salt) : getCrypto().getRandomValues(new Uint8Array(16));
  const iv = options.iv ? toUint8Array(options.iv) : getCrypto().getRandomValues(new Uint8Array(12));
  if (salt.length !== 16) {
    throw new Error('recovery_salt_must_be_16_bytes');
  }
  if (iv.length !== 12) {
    throw new Error('recovery_iv_must_be_12_bytes');
  }

  const recoveryBundle: any = {
    version: DEVICE_RECOVERY_VERSION,
    publicBundle,
    kdf: {
      algorithm: RECOVERY_KDF_ALGORITHM,
      iterations,
      salt: encodeBase64Url(salt)
    },
    cipher: {
      algorithm: RECOVERY_CIPHER_ALGORITHM,
      iv: encodeBase64Url(iv)
    }
  };
  const packed = packRecoveryPrivateKeys(encryptionPrivateKey, signingPrivateKey);
  try {
    const ciphertext = await getCrypto().subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: canonicalBytes(getRecoveryHeader(recoveryBundle)),
        tagLength: 128
      },
      await deriveRecoveryKey(passphrase, salt, iterations),
      packed
    );
    recoveryBundle.cipher.ciphertext = encodeBase64Url(ciphertext);
    return recoveryBundle;
  } finally {
    packed.fill(0);
  }
}

function assertDeviceRecoveryBundleShape(recoveryBundle) {
  if (
    !recoveryBundle ||
    recoveryBundle.version !== DEVICE_RECOVERY_VERSION ||
    recoveryBundle.kdf?.algorithm !== RECOVERY_KDF_ALGORITHM ||
    recoveryBundle.cipher?.algorithm !== RECOVERY_CIPHER_ALGORITHM ||
    !hasNonEmptyString(recoveryBundle.kdf?.salt) ||
    !hasNonEmptyString(recoveryBundle.cipher?.iv) ||
    !hasNonEmptyString(recoveryBundle.cipher?.ciphertext) ||
    recoveryBundle.kdf.salt.length > 64 ||
    recoveryBundle.cipher.iv.length > 64 ||
    recoveryBundle.cipher.ciphertext.length > 16384
  ) {
    throw new Error('device_recovery_bundle_invalid');
  }
}

async function assertRecoveredKeysMatchBundle(publicBundle, privateKeys) {
  const signingCheck = {
    version: DEVICE_RECOVERY_VERSION,
    keyId: publicBundle.keyId
  };
  const signingPublicKey = await importSigningPublicKey(publicBundle);
  const signature = await signValue(signingCheck, privateKeys.signingKey);
  if (!await verifyValue(signingCheck, signature, signingPublicKey)) {
    throw new Error('device_recovery_key_mismatch');
  }

  const checkValue = new Uint8Array(32).fill(7);
  const wrapped = await hpkeSuite.seal(
    {
      recipientPublicKey: privateKeys.encryptionPublicKey,
      info: RECOVERY_KEY_CHECK_INFO
    },
    checkValue
  );
  const unwrapped = await hpkeSuite.open(
    {
      recipientKey: {
        privateKey: privateKeys.encryptionKey,
        publicKey: privateKeys.encryptionPublicKey
      },
      enc: wrapped.enc,
      info: RECOVERY_KEY_CHECK_INFO
    },
    wrapped.ct
  );
  if (
    unwrapped.byteLength !== checkValue.byteLength ||
    !toUint8Array(unwrapped).every((value, index) => value === checkValue[index])
  ) {
    throw new Error('device_recovery_key_mismatch');
  }
}

const browserE2eeHelper = {
  async generateDeviceKeys(options: any = {}) {
    const ownerId = requireString(options.ownerId, 'owner_id_required');
    const deviceId = requireString(options.deviceId, 'device_id_required');
    const createdAt = options.createdAt || new Date().toISOString();
    const encryptionKeys = await hpkeSuite.kem.generateKeyPair();
    const signingKeys = await getCrypto().subtle.generateKey(
      {name: 'ECDSA', namedCurve: 'P-256'},
      true,
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

    let recoveryBundle = null;
    if (options.recoveryPassphrase != null) {
      const encryptionPrivateKey = new Uint8Array(
        await hpkeSuite.kem.serializePrivateKey(encryptionKeys.privateKey)
      );
      const signingPrivateKey = new Uint8Array(
        await getCrypto().subtle.exportKey('pkcs8', signingKeys.privateKey)
      );
      try {
        recoveryBundle = await createDeviceRecoveryBundle(
          bundle,
          encryptionPrivateKey,
          signingPrivateKey,
          {
            passphrase: options.recoveryPassphrase,
            iterations: options.recoveryIterations,
            salt: options.recoverySalt,
            iv: options.recoveryIv
          }
        );
      } finally {
        encryptionPrivateKey.fill(0);
        signingPrivateKey.fill(0);
      }
    }

    return {
      publicBundle: bundle,
      privateKeys: {
        encryptionKey: await protectHpkePrivateKey(encryptionKeys.privateKey),
        encryptionPublicKey: encryptionKeys.publicKey,
        signingKey: await protectSigningPrivateKey(signingKeys.privateKey)
      },
      recoveryBundle
    };
  },

  async restoreDeviceKeys(recoveryBundle, recoveryPassphrase) {
    assertDeviceRecoveryBundleShape(recoveryBundle);
    if (!await browserE2eeHelper.verifyDeviceKeyBundle(recoveryBundle.publicBundle)) {
      throw new Error('device_recovery_public_bundle_invalid');
    }

    const passphrase = requireRecoveryPassphrase(recoveryPassphrase);
    const iterations = normalizeRecoveryIterations(recoveryBundle.kdf.iterations);
    const salt = decodeBase64Url(recoveryBundle.kdf.salt);
    const iv = decodeBase64Url(recoveryBundle.cipher.iv);
    if (salt.length !== 16 || iv.length !== 12) {
      throw new Error('device_recovery_bundle_invalid');
    }

    let plaintext;
    try {
      plaintext = new Uint8Array(await getCrypto().subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
          additionalData: canonicalBytes(getRecoveryHeader(recoveryBundle)),
          tagLength: 128
        },
        await deriveRecoveryKey(passphrase, salt, iterations),
        decodeBase64Url(recoveryBundle.cipher.ciphertext)
      ));
    } catch {
      throw new Error('device_recovery_decrypt_failed');
    }

    try {
      const serializedKeys = unpackRecoveryPrivateKeys(plaintext);
      try {
        const encryptionKey = await hpkeSuite.kem.deserializePrivateKey(
          serializedKeys.encryptionPrivateKey
        );
        const privateKeys = {
          encryptionKey: await protectHpkePrivateKey(encryptionKey),
          encryptionPublicKey: await hpkeSuite.kem.deserializePublicKey(
            decodeBase64Url(recoveryBundle.publicBundle.encryption.publicKey)
          ),
          signingKey: await getCrypto().subtle.importKey(
            'pkcs8',
            serializedKeys.signingPrivateKey,
            {name: 'ECDSA', namedCurve: 'P-256'},
            false,
            ['sign']
          )
        };
        await assertRecoveredKeysMatchBundle(recoveryBundle.publicBundle, privateKeys);
        return {
          publicBundle: recoveryBundle.publicBundle,
          privateKeys
        };
      } finally {
        serializedKeys.encryptionPrivateKey.fill(0);
        serializedKeys.signingPrivateKey.fill(0);
      }
    } catch (error) {
      if (error?.message === 'device_recovery_key_mismatch') {
        throw error;
      }
      throw new Error('device_recovery_payload_invalid');
    } finally {
      plaintext.fill(0);
    }
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

  async getDeviceFingerprint(bundle) {
    if (!await browserE2eeHelper.verifyDeviceKeyBundle(bundle)) {
      throw new Error('device_bundle_invalid');
    }
    return {
      version: DEVICE_FINGERPRINT_VERSION,
      algorithm: FINGERPRINT_ALGORITHM,
      ownerId: bundle.ownerId,
      deviceId: bundle.deviceId,
      keyId: bundle.keyId,
      value: formatDeviceFingerprint(bundle.keyId)
    };
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

  getAttachmentUploadData(attachment) {
    assertEncryptedAttachment(attachment, true);
    return typeof attachment.ciphertext === 'string'
      ? decodeBase64Url(attachment.ciphertext)
      : new Uint8Array(toUint8Array(attachment.ciphertext));
  },

  createAttachmentReference(storageId, attachment, key) {
    requireString(storageId, 'attachment_storage_id_required');
    assertEncryptedAttachment(attachment, false);
    const keyBytes = toUint8Array(key);
    if (keyBytes.length !== 32) {
      throw new Error('attachment_key_must_be_32_bytes');
    }
    return {
      version: ATTACHMENT_REFERENCE_VERSION,
      storageId,
      encryption: {
        version: attachment.version,
        algorithm: attachment.algorithm,
        mimeType: attachment.mimeType,
        name: attachment.name,
        size: attachment.size,
        iv: attachment.iv,
        key: encodeBase64Url(keyBytes)
      }
    };
  },

  isAttachmentReference(value) {
    try {
      assertAttachmentReference(value);
      return true;
    } catch {
      return false;
    }
  },

  async decryptAttachmentReference(ciphertext, reference) {
    assertAttachmentReference(reference);
    return browserE2eeHelper.decryptAttachment(
      {
        ...reference.encryption,
        key: undefined,
        ciphertext
      },
      decodeBase64Url(reference.encryption.key)
    );
  },

  createChatMessagePayload(text, attachments: any[] = []) {
    if (typeof text !== 'string') {
      throw new Error('chat_message_text_invalid');
    }
    assertAttachmentReferenceList(attachments);
    if (text.length === 0 && attachments.length === 0) {
      throw new Error('chat_message_content_required');
    }
    return {
      version: CHAT_MESSAGE_PAYLOAD_VERSION,
      text,
      attachments: attachments.map(copyAttachmentReference)
    };
  },

  isChatMessagePayload(value) {
    try {
      assertChatMessagePayload(value);
      return true;
    } catch {
      return false;
    }
  },

  getChatAttachmentStorageIds(payload) {
    assertChatMessagePayload(payload);
    return payload.attachments.map(attachment => attachment.storageId);
  },

  createChatMessageEnvelopeMetadata(payload) {
    return {
      kind: 'json',
      attachmentStorageIds: browserE2eeHelper.getChatAttachmentStorageIds(payload)
    };
  },

  createPrivateGroupPostPayload(text, attachments: any[] = []) {
    const chatPayload = browserE2eeHelper.createChatMessagePayload(text, attachments);
    return {
      ...chatPayload,
      version: PRIVATE_GROUP_POST_PAYLOAD_VERSION,
      kind: 'message'
    };
  },

  isPrivateGroupPostPayload(value) {
    try {
      assertPrivateGroupPostPayload(value);
      return true;
    } catch {
      return false;
    }
  },

  getPrivateGroupPostAttachmentStorageIds(payload) {
    assertPrivateGroupPostPayload(payload);
    return payload.attachments.map(attachment => attachment.storageId);
  },

  createPrivateGroupPostEnvelopeMetadata(groupIdentity, membershipVersion, payload) {
    return {
      kind: 'private-group-post',
      groupIdentity: requireString(groupIdentity, 'private_group_identity_required'),
      membershipVersion: normalizePrivateGroupMembershipVersion(membershipVersion),
      attachmentStorageIds: browserE2eeHelper.getPrivateGroupPostAttachmentStorageIds(payload)
    };
  },

  createPrivateGroupPostEnvelopeOptions(
    groupIdentity,
    membershipVersion,
    payload,
    options: any = {}
  ) {
    const metadata = browserE2eeHelper.createPrivateGroupPostEnvelopeMetadata(
      groupIdentity,
      membershipVersion,
      payload
    );
    return {
      ...options,
      type: PRIVATE_GROUP_POST_ENVELOPE_TYPE,
      conversationId: formatPrivateGroupConversationId(metadata.groupIdentity),
      metadata
    };
  },

  isPrivateGroupPostEnvelopeMetadata(value) {
    try {
      assertPrivateGroupPostEnvelopeMetadata(value);
      return true;
    } catch {
      return false;
    }
  },

  isPrivateGroupPostEnvelope(value) {
    if (
      !browserE2eeHelper.isEncryptedEnvelope(value) ||
      value.type !== PRIVATE_GROUP_POST_ENVELOPE_TYPE ||
      value.encoding !== 'json' ||
      !browserE2eeHelper.isPrivateGroupPostEnvelopeMetadata(value.metadata)
    ) {
      return false;
    }
    return value.conversationId === formatPrivateGroupConversationId(
      value.metadata.groupIdentity
    );
  },

  isDeviceRecoveryBundle(value) {
    try {
      assertDeviceRecoveryBundleShape(value);
      return true;
    } catch {
      return false;
    }
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
  formatDeviceFingerprint,

  constants: {
    DEVICE_KEYS_VERSION,
    DEVICE_FINGERPRINT_VERSION,
    DEVICE_RECOVERY_VERSION,
    ENVELOPE_VERSION,
    ATTACHMENT_VERSION,
    ATTACHMENT_REFERENCE_VERSION,
    CHAT_MESSAGE_PAYLOAD_VERSION,
    PRIVATE_GROUP_POST_PAYLOAD_VERSION,
    ENVELOPE_TYPE,
    PRIVATE_GROUP_POST_ENVELOPE_TYPE,
    PRIVATE_GROUP_CONVERSATION_PREFIX,
    CONTENT_ALGORITHM,
    SIGNATURE_ALGORITHM,
    FINGERPRINT_ALGORITHM,
    KEY_WRAP_ALGORITHM,
    RECOVERY_KDF_ALGORITHM,
    RECOVERY_CIPHER_ALGORITHM,
    DEFAULT_RECOVERY_ITERATIONS,
    MINIMUM_RECOVERY_ITERATIONS,
    MAXIMUM_CHAT_ATTACHMENTS
  }
};

function assertEncryptedAttachment(attachment, requireCiphertext: boolean) {
  if (
    !attachment ||
    attachment.version !== ATTACHMENT_VERSION ||
    attachment.algorithm !== CONTENT_ALGORITHM ||
    !hasNonEmptyString(attachment.mimeType) ||
    !(attachment.name === null || hasNonEmptyString(attachment.name)) ||
    !Number.isSafeInteger(attachment.size) ||
    attachment.size < 0 ||
    !hasNonEmptyString(attachment.iv)
  ) {
    throw new Error('encrypted_attachment_invalid');
  }
  let iv;
  try {
    iv = decodeBase64Url(attachment.iv);
  } catch {
    throw new Error('encrypted_attachment_invalid');
  }
  if (iv.length !== 12) {
    throw new Error('encrypted_attachment_invalid');
  }
  if (requireCiphertext && attachment.ciphertext === undefined) {
    throw new Error('attachment_ciphertext_required');
  }
  if (requireCiphertext) {
    try {
      const ciphertext = typeof attachment.ciphertext === 'string'
        ? decodeBase64Url(attachment.ciphertext)
        : toUint8Array(attachment.ciphertext);
      if (ciphertext.length < 16) {
        throw new Error('attachment_ciphertext_invalid');
      }
    } catch {
      throw new Error('attachment_ciphertext_invalid');
    }
  }
}

function assertAttachmentReference(value) {
  if (
    !value ||
    value.version !== ATTACHMENT_REFERENCE_VERSION ||
    !hasNonEmptyString(value.storageId) ||
    !value.encryption ||
    !hasNonEmptyString(value.encryption.key) ||
    value.encryption.ciphertext !== undefined
  ) {
    throw new Error('attachment_reference_invalid');
  }
  assertEncryptedAttachment(value.encryption, false);
  let key;
  try {
    key = decodeBase64Url(value.encryption.key);
  } catch {
    throw new Error('attachment_reference_invalid');
  }
  if (key.length !== 32) {
    throw new Error('attachment_reference_invalid');
  }
}

function assertAttachmentReferenceList(attachments) {
  if (
    !Array.isArray(attachments) ||
    attachments.length > MAXIMUM_CHAT_ATTACHMENTS
  ) {
    throw new Error('chat_message_attachments_invalid');
  }
  attachments.forEach(assertAttachmentReference);
  const storageIds = attachments.map(attachment => attachment.storageId);
  if (new Set(storageIds).size !== storageIds.length) {
    throw new Error('chat_message_attachment_duplicate');
  }
}

function assertChatMessagePayload(value) {
  if (
    !value ||
    value.version !== CHAT_MESSAGE_PAYLOAD_VERSION ||
    typeof value.text !== 'string'
  ) {
    throw new Error('chat_message_payload_invalid');
  }
  assertAttachmentReferenceList(value.attachments);
  if (value.text.length === 0 && value.attachments.length === 0) {
    throw new Error('chat_message_content_required');
  }
}

function assertPrivateGroupPostPayload(value) {
  if (
    !value ||
    value.version !== PRIVATE_GROUP_POST_PAYLOAD_VERSION ||
    value.kind !== 'message' ||
    typeof value.text !== 'string'
  ) {
    throw new Error('private_group_post_payload_invalid');
  }
  assertAttachmentReferenceList(value.attachments);
  if (value.text.length === 0 && value.attachments.length === 0) {
    throw new Error('private_group_post_content_required');
  }
}

function assertPrivateGroupPostEnvelopeMetadata(value) {
  if (
    !value ||
    !hasExactKeys(value, [
      'kind',
      'groupIdentity',
      'membershipVersion',
      'attachmentStorageIds'
    ]) ||
    value.kind !== 'private-group-post' ||
    !hasNonEmptyString(value.groupIdentity) ||
    !Array.isArray(value.attachmentStorageIds) ||
    value.attachmentStorageIds.length > MAXIMUM_CHAT_ATTACHMENTS ||
    !hasUniqueStrings(value.attachmentStorageIds)
  ) {
    throw new Error('private_group_post_metadata_invalid');
  }
  normalizePrivateGroupMembershipVersion(value.membershipVersion);
}

function normalizePrivateGroupMembershipVersion(value): string {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    (typeof value === 'number' && !Number.isSafeInteger(value)) ||
    !/^[1-9][0-9]*$/.test(String(value))
  ) {
    throw new Error('private_group_membership_version_invalid');
  }
  return String(value);
}

function formatPrivateGroupConversationId(groupIdentity): string {
  return `${PRIVATE_GROUP_CONVERSATION_PREFIX}${requireString(
    groupIdentity,
    'private_group_identity_required'
  )}`;
}

function hasExactKeys(value, keys: string[]): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  return actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]);
}

function copyAttachmentReference(reference) {
  return {
    ...reference,
    encryption: {...reference.encryption}
  };
}

export default browserE2eeHelper;
