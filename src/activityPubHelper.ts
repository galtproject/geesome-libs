/*
 * Minimal ActivityPub helpers shared by geesome-node and clients.
 *
 * The helpers are deterministic and network-free so module tests can lock down
 * the GeeSome actor/object contract before the node gets live federation I/O.
 */

import crypto from 'node:crypto';
import peerIdHelper from './peerIdHelper';
import common from './common';

const ACTIVITY_STREAMS_CONTEXT = 'https://www.w3.org/ns/activitystreams';
const W3ID_SECURITY_CONTEXT = 'https://w3id.org/security/v1';
const PUBLIC_COLLECTION = 'https://www.w3.org/ns/activitystreams#Public';

const trimSlash = (value) => (value || '').replace(/\/+$/, '');
const encodeName = (value) => encodeURIComponent(value);

const sortForJson = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortForJson);
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortForJson(value[key])]));
  }
  return value;
};

const canonicalJson = (value) => JSON.stringify(sortForJson(value));

const sha256Base64 = (value) => {
  const data = typeof value === 'string' ? value : canonicalJson(value);
  return crypto.createHash('sha256').update(data).digest('base64');
};

const activityPubHelper = {
  constants: {
    ACTIVITY_STREAMS_CONTEXT,
    W3ID_SECURITY_CONTEXT,
    PUBLIC_COLLECTION
  },

  canonicalJson,

  actorId(origin, name) {
    return `${trimSlash(origin)}/ap/actors/${encodeName(name)}`;
  },

  outboxId(origin, name) {
    return `${activityPubHelper.actorId(origin, name)}/outbox`;
  },

  inboxId(origin, name) {
    return `${activityPubHelper.actorId(origin, name)}/inbox`;
  },

  followersId(origin, name) {
    return `${activityPubHelper.actorId(origin, name)}/followers`;
  },

  followingId(origin, name) {
    return `${activityPubHelper.actorId(origin, name)}/following`;
  },

  keyId(origin, name, keyName = 'main-key') {
    return `${activityPubHelper.actorId(origin, name)}#${keyName}`;
  },

  acctSubject(origin, name) {
    return `acct:${name}@${new URL(origin).hostname}`;
  },

  buildWebFinger({origin, name, actorUrl = null}) {
    actorUrl = actorUrl || activityPubHelper.actorId(origin, name);
    return {
      subject: activityPubHelper.acctSubject(origin, name),
      aliases: [actorUrl],
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: actorUrl
        }
      ]
    };
  },

  buildActor({origin, name, preferredUsername = null, displayName = null, summary = null, iconUrl = null, type = 'Group', publicKeyPem = null}) {
    const id = activityPubHelper.actorId(origin, name);
    const actor = {
      '@context': [ACTIVITY_STREAMS_CONTEXT, W3ID_SECURITY_CONTEXT],
      id,
      type,
      preferredUsername: preferredUsername || name,
      name: displayName || name,
      summary,
      inbox: activityPubHelper.inboxId(origin, name),
      outbox: activityPubHelper.outboxId(origin, name),
      followers: activityPubHelper.followersId(origin, name),
      following: activityPubHelper.followingId(origin, name),
      url: id
    };
    if (iconUrl) {
      actor['icon'] = {
        type: 'Image',
        mediaType: 'image/png',
        url: iconUrl
      };
    }
    if (publicKeyPem) {
      actor['publicKey'] = {
        id: activityPubHelper.keyId(origin, name),
        owner: id,
        publicKeyPem
      };
    }
    return common.sortObject(actor);
  },

  buildNote({id, actor, content, url = null, published = null, to = [PUBLIC_COLLECTION], cc = [], attachments = []}) {
    return common.sortObject({
      id,
      type: 'Note',
      attributedTo: actor,
      content,
      url: url || id,
      published: published || new Date().toISOString(),
      to,
      cc,
      attachment: attachments
    });
  },

  buildCreate({id, actor, object, published = null, to = null, cc = null}) {
    return common.sortObject({
      '@context': ACTIVITY_STREAMS_CONTEXT,
      id,
      type: 'Create',
      actor,
      published: published || object.published || new Date().toISOString(),
      to: to || object.to || [PUBLIC_COLLECTION],
      cc: cc || object.cc || [],
      object
    });
  },

  digestHeader(payload) {
    return `SHA-256=${sha256Base64(payload)}`;
  },

  buildSigningString(headers, headerNames = ['(request-target)', 'host', 'date', 'digest']) {
    return headerNames.map((name) => {
      const value = headers[name] || headers[name.toLowerCase()];
      if (!value) {
        throw new Error(`missing_signature_header:${name}`);
      }
      return `${name.toLowerCase()}: ${value}`;
    }).join('\n');
  },

  async signRequestHeaders(privateKeyBase64, headers, headerNames = ['(request-target)', 'host', 'date', 'digest']) {
    const peerId = await peerIdHelper.createPeerIdFromPrivateBase64(privateKeyBase64);
    const signingString = activityPubHelper.buildSigningString(headers, headerNames);
    const signature = await peerId.privKey.sign(Buffer.from(signingString, 'utf8'));
    return {
      keyId: headers.keyId,
      algorithm: 'rsa-sha256',
      headers: headerNames.join(' '),
      signature: Buffer.from(signature).toString('base64'),
      signingString
    };
  },

  async verifyRequestHeaders(publicKeyBase64, headers, signatureBase64, headerNames = ['(request-target)', 'host', 'date', 'digest']) {
    const peerId = await peerIdHelper.createPeerIdFromPublicBase64(publicKeyBase64);
    const signingString = activityPubHelper.buildSigningString(headers, headerNames);
    return peerId.pubKey.verify(Buffer.from(signingString, 'utf8'), Buffer.from(signatureBase64, 'base64'));
  }
};

export default activityPubHelper;
