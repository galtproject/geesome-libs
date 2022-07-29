import { testNet } from '@fluencelabs/fluence-network-environment';

import SimpleAccountStorage from '../../src/SimpleAccountStorage.js';
import ipfsHelper from '../../src/ipfsHelper.js';
import JsIpfsService from '../../src/JsIpfsService.js';
import FluenceService from '../../src/fluenceService/index.js';
import peerIdHelper from '../../src/peerIdHelper.js';

const accStorage = new SimpleAccountStorage();

export default {
    async ipfs(options) {
        const createNode = () => {
            return ipfsHelper.createDaemonNode({
                test: true,
                // disposable: true,
            }, { pass: options.pass, EXPERIMENTAL: {ipnsPubsub: true} });
        };

        const _nodeA = new JsIpfsService(await createNode());
        const _nodeB = new JsIpfsService(await createNode());

        const idB = await _nodeB.id();
        const idA = await _nodeA.id();
        await _nodeA.swarmConnect(idB.addresses[0]);
        await _nodeA.addBootNode(idB.addresses[0]);
        await _nodeB.swarmConnect(idA.addresses[0]);
        await _nodeB.addBootNode(idA.addresses[0]);
        return [_nodeA, _nodeB];
    },
    async fluence() {
        const createNode = async () => {
            const service = new FluenceService(accStorage);
            await service.initPeer(await peerIdHelper.createPeerId(), testNet[2]);
            return service;
        };

        const _nodeA = await createNode();
        const _nodeB = await createNode();
        return [_nodeA, _nodeB];
    }
};