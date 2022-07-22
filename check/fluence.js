const { FluencePeer, KeyPair } = require("@fluencelabs/fluence");
const registryApi = require('../src/fluenceService/generated/registry-api');
const { testNet } = require('@fluencelabs/fluence-network-environment');
const PeerId = require('peer-id');

const connectTo = testNet[1];

(async () => {
    const nodePeerId = await PeerId.create();
    const nodePeer = await initPeer(nodePeerId)
    const channelAdminPeerId = await PeerId.create();
    const channelAdminPeer = await initPeer(channelAdminPeerId);

    const channelTopic = channelAdminPeerId.toB58String();
    const channelResource = await createResource(channelAdminPeer, channelTopic);
    console.log('channelResource', channelResource);
})();

async function initPeer(_peerId) {
    const peer = new FluencePeer();
    await peer.start({ connectTo, KeyPair: new KeyPair(_peerId) });
    return peer;
}

async function createResource(_peer, _topic) {
    let [resourceId, createError] = await registryApi.createResource(_peer, _topic, {ttl: 20000});
    if (createError || !resourceId) {
        throw new Error(createError ? createError.toString() : 'resourceId_creation_failed');
    }
    return resourceId;
}