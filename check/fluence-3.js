import { FluencePeer, KeyPair, setLogLevel } from "@fluencelabs/fluence";
import { testNet } from '@fluencelabs/fluence-network-environment';
import PeerId from 'peer-id';
import * as registryApi from '../src/fluenceService/generated/registry-api.js';

(async () => {
    const pid = await PeerId.create({ keyType: 'Ed25519' });
    console.log("generated peerid", pid);
    const pidPeer = new FluencePeer();
    const pidKeyPair = new KeyPair(pid);
    await pidPeer.start({ KeyPair: pidKeyPair, connectTo: testNet[0] });
    console.log("started peer", pidPeer);

    const label = "myLabel";
    const res = await registryApi.createResource(pidPeer, label, { ttl: 10000 });
    console.log("resource created", res);

    const resourceId = res[0];
    const value = 'test';
    const serviceId = 'geesome-registry';

    let [success, reg_error] = await registryApi.registerProvider(pidPeer, resourceId, value, serviceId);
    console.log("registerProvider", success);
    // assert(success, reg_error.toString());
    // console.log("peer %s registered as provider successfully", Fluence.getStatus().peerId);

    let [nodeSuccess, regNodeError] = await registryApi.registerNodeProvider(pidPeer, pid.toB58String(), resourceId, value, serviceId);
    console.log("registerNodeProvider", nodeSuccess);

    // const info = await getInfo(pidPeer, testNet[0].peerId, { ttl: 10000 });
    // console.log("got info:", info);
})().then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

