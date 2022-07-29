import { FluencePeer, KeyPair } from "@fluencelabs/fluence";
import registryApi from '../src/fluenceService/generated/registry-api.js';
import { testNet } from '@fluencelabs/fluence-network-environment';
import PeerId from 'peer-id';

const connectTo = testNet[0];

(async () => {
    const pid = await PeerId.create({ keyType: 'Ed25519' });
    console.log("generated peerid", pid);
    const pidPeer = new FluencePeer();
    const pidKeyPair = new KeyPair(pid);
    await pidPeer.start({ KeyPair: pidKeyPair, connectTo: testNet[0] });
    console.log("started peer", pidPeer);

    const res = await registryApi.createResource(pidPeer, "myLabel", { ttl: 10000 });
    console.log("resource created", res);
    // const nodePeerId = await PeerId.create({keyType: 'Ed25519'});
    // const nodePeer = await initPeer(nodePeerId)
    // const channelAdminPeerId = await PeerId.create({keyType: 'Ed25519'});
    // const channelAdminPeer = await initPeer(channelAdminPeerId);
    //
    // const channelTopic = channelAdminPeerId.toB58String();
    // const channelResource = await createResource(channelAdminPeer, channelTopic);
    // console.log('channelResource', channelResource);
})();

async function initPeer(_peerId) {
    const peer = new FluencePeer();
    await peer.start({ connectTo, KeyPair: new KeyPair(_peerId) });
    return peer;
}

async function createResource(_peer, _topic) {
    let [resourceId, createError] = await registryApi.createResource(_peer, _topic, {ttl: 20000});
    if (createError || !resourceId) {
        console.error(createError);
        throw new Error(createError ? createError.toString() : 'resourceId_creation_failed');
    }
    return resourceId;
}