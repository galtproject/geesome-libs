import { FluencePeer, KeyPair, setLogLevel } from "@fluencelabs/fluence";
import { testNet } from '@fluencelabs/fluence-network-environment';
import PeerId from 'peer-id';
import registryApi from '../src/fluenceService/generated/registry-api.js';

(async () => {
    const pid = await PeerId.create({ keyType: 'Ed25519' });
    console.log("generated peerid", pid);
    const pidPeer = new FluencePeer();
    const pidKeyPair = new KeyPair(pid);
    await pidPeer.start({ KeyPair: pidKeyPair, connectTo: testNet[0] });
    console.log("started peer", pidPeer);

    const res = await registryApi.createResource(pidPeer, "myLabel", { ttl: 10000 });
    console.log("resource created", res);

    // const info = await getInfo(pidPeer, testNet[0].peerId, { ttl: 10000 });
    // console.log("got info:", info);
})().then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

