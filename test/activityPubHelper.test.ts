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
import activityPubHelper from '../src/activityPubHelper.js';

const expect = chai.expect;
chai.use(dirtyChai);

describe('activityPubHelper', function () {
  this.timeout(40 * 1000);

  it('should build deterministic group actor and WebFinger payloads', function () {
    const origin = 'https://node.example';
    const actor = activityPubHelper.buildActor({
      origin,
      name: 'garden',
      displayName: 'Garden Group',
      summary: 'Public garden notes'
    });
    const webFinger = activityPubHelper.buildWebFinger({origin, name: 'garden'});

    expect(actor.id).to.equal('https://node.example/ap/actors/garden');
    expect(actor.type).to.equal('Group');
    expect(actor.inbox).to.equal('https://node.example/ap/actors/garden/inbox');
    expect(actor.outbox).to.equal('https://node.example/ap/actors/garden/outbox');
    expect(webFinger.subject).to.equal('acct:garden@node.example');
    expect(webFinger.links[0].href).to.equal(actor.id);
    expect(activityPubHelper.canonicalJson({b: 1, a: {d: 2, c: 3}})).to.equal('{"a":{"c":3,"d":2},"b":1}');
  });

  it('should build Note and Create activities with stable GeeSome links', function () {
    const note = activityPubHelper.buildNote({
      id: 'https://node.example/ap/objects/post-1',
      actor: 'https://node.example/ap/actors/garden',
      content: '<p>Hello fediverse</p>',
      published: '2026-05-03T12:00:00.000Z',
      attachments: [
        {
          type: 'Document',
          mediaType: 'image/png',
          url: 'ipfs://bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        }
      ]
    });
    const create = activityPubHelper.buildCreate({
      id: 'https://node.example/ap/activities/create-post-1',
      actor: 'https://node.example/ap/actors/garden',
      object: note
    });

    expect(note.type).to.equal('Note');
    expect(note.attachment[0].url).to.equal('ipfs://bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(create.type).to.equal('Create');
    expect(create.object.id).to.equal(note.id);
    expect(create.to).to.deep.equal([activityPubHelper.constants.PUBLIC_COLLECTION]);
  });

  it('should build digest and verify signed request headers', async function () {
    const peerId = await peerIdHelper.createPeerId();
    const body = activityPubHelper.canonicalJson({type: 'Accept', id: 'https://node.example/ap/activities/a1'});
    const headers = {
      '(request-target)': 'post /ap/actors/garden/inbox',
      host: 'node.example',
      date: 'Sun, 03 May 2026 12:00:00 GMT',
      digest: activityPubHelper.digestHeader(body),
      keyId: 'https://node.example/ap/actors/garden#main-key'
    };

    const signed = await activityPubHelper.signRequestHeaders(peerIdHelper.peerIdToPrivateBase64(peerId), headers);
    expect(signed.signingString).to.contain('(request-target): post /ap/actors/garden/inbox');
    expect(signed.headers).to.equal('(request-target) host date digest');
    expect(await activityPubHelper.verifyRequestHeaders(peerIdHelper.peerIdToPublicBase64(peerId), headers, signed.signature)).to.equals(true);

    const tamperedHeaders = {
      ...headers,
      digest: activityPubHelper.digestHeader('tampered')
    };
    expect(await activityPubHelper.verifyRequestHeaders(peerIdHelper.peerIdToPublicBase64(peerId), tamperedHeaders, signed.signature)).to.equals(false);
  });
});
