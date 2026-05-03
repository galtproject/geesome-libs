# Libraries for effective working with IPFS
[![Build Status](https://travis-ci.org/galtspace/geesome-libs.svg?branch=master)](https://travis-ci.org/galtspace/geesome-libs)

Created for [GeeSome project](https://github.com/galtspace/geesome-node)
## Features:
- Trie for store large list in IPLD: [base36Trie.ts](./src/base36Trie.ts)
- IPFS wrapper for improve developer-friendly expirience: [JsIpfsService.ts](./src/JsIpfsService.ts)
- Helpers with parsing, converting, checking: [ipfsHelper.ts](./src/ipfsHelper.ts)
- Import IPFS keys to PGP and encryption/decryption: [pgpHelper.ts](./src/pgpHelper.ts)
- Opaque frontend-side E2EE envelope helpers for chat/storage routing: [e2eeHelper.ts](./src/e2eeHelper.ts)
- Deterministic ActivityPub actor/object/signature helper contracts: [activityPubHelper.ts](./src/activityPubHelper.ts)

## E2EE chat helper usage

Use [e2eeHelper.ts](./src/e2eeHelper.ts) for frontend-side chat payload envelopes only. A browser/client should encrypt with the sender private key and recipient device public keys, then send the returned envelope to geesome-node. The node should store, index, relay, and optionally verify the sender signature, but must not receive private keys or plaintext.

The current `geesome-e2ee-v1` envelope is a compatibility layer, not a full production group chat protocol. It provides opaque content encryption, per-recipient key wrapping, message/conversation/device metadata, and sender signatures. Group-chat delivery still needs higher-level policy for trusted devices, key rotation when members/devices change, replay protection, ordered history, and a future MLS/ratchet-style protocol for forward secrecy.

Typical frontend flow:

```ts
const envelope = await e2eeHelper.encryptEnvelope(messageText, recipientDevices, {
  messageId,
  conversationId,
  senderPrivateKeyBase64,
  sender: {
    deviceId
  }
});
```

Typical node-side checks:

```ts
if (!e2eeHelper.isEncryptedEnvelope(envelope)) {
  throw new Error('encrypted_envelope_required');
}
if (!(await e2eeHelper.verifyEnvelopeSignature(envelope))) {
  throw new Error('envelope_signature_invalid');
}
```
