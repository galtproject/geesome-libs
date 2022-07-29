const { FluencePeer, KeyPair } = require("@fluencelabs/fluence");
const registryApi = require('../src/fluenceService/generated/registry-api');
const { testNet } = require('@fluencelabs/fluence-network-environment');
const PeerId = require('peer-id');

// "cborg": "^1.2.1",
// "cryptiles": "4.1.3",

const connectTo = testNet[1];

(async () => {
    const nodeKeypair = await KeyPair.randomEd25519();
    const nodePeer = await initPeer(nodeKeypair)
    const channelAdminKeypair = await KeyPair.randomEd25519();
    const channelAdminPeer = await initPeer(channelAdminKeypair);

    const channelTopic = "someTopic";
    const channelResource = await createResource(channelAdminPeer, channelTopic);
    console.log('channelResource', channelResource);
})().then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});

async function initPeer(keypair) {
    const peer = new FluencePeer();
    await peer.start({ connectTo, KeyPair: keypair });
    return peer;
}

async function createResource(_peer, _topic) {
    let [resourceId, createError] = await registryApi.createResource(_peer, _topic, {ttl: 20000});
    if (!resourceId) {
        throw new Error(createError ? createError.toString() : 'resourceId_creation_failed');
    }
    return resourceId;
}