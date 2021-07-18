const SimpleAccountStorage = require('../../src/SimpleAccountStorage');
const ipfsHelper = require('../../src/ipfsHelper');
const JsIpfsService = require('../../src/JsIpfsService');

const FluenceService = require('../../src/fluenceService');

const { krasnodar } = require('@fluencelabs/fluence-network-environment');
const { createClient, FluenceClient } = require('@fluencelabs/fluence');

const accStorage = new SimpleAccountStorage();

module.exports = {
    async ipfs(options) {
        const createNode = () => {
            return ipfsHelper.createDaemonNode({
                test: true,
                disposable: true,
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
            const relayNode = krasnodar[1];
            const client = await createClient(relayNode);
            return new FluenceService(accStorage, client);
        };

        const _nodeA = await createNode();
        const _nodeB = await createNode();
        return [_nodeA, _nodeB];
    }
};