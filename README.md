# Libraries for effective working with IPFS
[![Build Status](https://travis-ci.org/galtspace/geesome-libs.svg?branch=master)](https://travis-ci.org/galtspace/geesome-libs)

Created for [GeeSome project](https://github.com/galtspace/geesome-node)
## Features:
- Trie for store large list in IPLD: [base36Trie.ts](./src/base36Trie.ts)
- IPFS wrapper for improve developer-friendly expirience: [JsIpfsService.ts](./src/JsIpfsService.ts)
- Helpers with parsing, converting, checking: [ipfsHelper.ts](./src/ipfsHelper.ts)
- Import IPFS keys to PGP and encryption/decryption: [pgpHelper.ts](./src/pgpHelper.ts)
- Browser-native device keys, encrypted envelopes, and attachments: [browserE2eeHelper.ts](./src/browserE2eeHelper.ts)
- Legacy Node.js E2EE envelope compatibility: [e2eeHelper.ts](./src/e2eeHelper.ts)
- Deterministic ActivityPub actor/object/signature helper contracts: [activityPubHelper.ts](./src/activityPubHelper.ts)

## E2EE chat helper usage

Use [browserE2eeHelper.ts](./src/browserE2eeHelper.ts) for new chat clients. It uses browser WebCrypto for non-extractable device private keys, HPKE-wrapped content keys, signed AES-GCM envelopes, and encrypted attachments. Persist the returned `CryptoKey` objects in IndexedDB. Publish only the public device bundle and send only encrypted envelopes or attachments to geesome-node.

The node may store, index, relay, and verify opaque payloads, but it must not receive private keys, attachment keys, or plaintext. The helper requires a secure browser context with WebCrypto. Applications must authenticate public device bundles before trusting them, track revoked devices, and include every currently authorized device when encrypting.

The `geesome-e2ee-v2` contract is versioned so the chat protocol can later adopt MLS or a ratchet. This initial browser contract does not provide forward secrecy or post-compromise security by itself. Conversation membership, key epochs, replay protection, ordered history, acknowledgements, and retry policy belong to the higher-level chat protocol.

Typical browser flow:

```ts
const aliceDevice = await browserE2eeHelper.generateDeviceKeys({
  ownerId: 'alice',
  deviceId: crypto.randomUUID()
});

const envelope = await browserE2eeHelper.encryptEnvelope(
  messageText,
  recipientPublicDeviceBundles,
  aliceDevice,
  {
    messageId,
    conversationId
  }
);

const plaintext = await browserE2eeHelper.decryptEnvelopeText(
  envelope,
  aliceDevice,
  senderPublicDeviceBundle
);
```

Enable recovery while creating a device if the user has chosen a recovery
passphrase. `recoveryBundle` is `null` when recovery is not requested:

```ts
const device = await browserE2eeHelper.generateDeviceKeys({
  ownerId,
  deviceId,
  recoveryPassphrase
});

const restoredDevice = await browserE2eeHelper.restoreDeviceKeys(
  device.recoveryBundle,
  recoveryPassphrase
);
```

The recovery bundle is versioned and protects the transient private key bytes
with PBKDF2-SHA256 using at least 600,000 iterations and AES-256-GCM. The live
keys and restored keys are non-extractable. Restore also proves that both
recovered private keys match the signed public device bundle before returning
them.

Keep recovery client-owned:

- Store live `CryptoKey` objects in IndexedDB, not `localStorage`.
- Never upload the recovery passphrase or decrypted private keys to
  `geesome-node`.
- Treat the downloaded recovery bundle as sensitive encrypted data.
- If both IndexedDB state and the recovery bundle are lost, create a new device
  and revoke the old one.
- Frontends should provide backup reminders, device verification, revocation,
  and multi-device trust UX.

Attachments must be encrypted before upload:

```ts
const encrypted = await browserE2eeHelper.encryptAttachment(fileBytes, {
  name: file.name,
  mimeType: file.type
});

const storedAttachment = browserE2eeHelper.serializeAttachment(
  encrypted.attachment
);
```

The attachment key belongs inside the encrypted message payload. Upload `storedAttachment` separately; never upload `encrypted.key` as public metadata.

The older [e2eeHelper.ts](./src/e2eeHelper.ts) remains available for `geesome-e2ee-v1` compatibility. It depends on Node.js crypto and should not be used for new browser key generation.

Typical opaque-storage check:

```ts
if (!browserE2eeHelper.isEncryptedEnvelope(envelope)) {
  throw new Error('encrypted_envelope_required');
}
```
