import {createFactory} from 'ipfsd-ctl';
import * as ipfsHttpModule from 'ipfs-http-client';
import commonHelper from "./common.js";

async function createDaemonNode (options = {}, ipfsOptions = {}) {
    console.log('createFactory');
    const factory = createFactory({
        type: 'proc', // or 'js' to run in a separate process
        // type: 'js',
        ipfsHttpModule,
        ipfsModule: (await import('ipfs')), // only if you gonna spawn 'proc' controllers
        ...options
    })

    console.log('factory.spawn');
    const node = await factory.spawn({
        ipfsOptions: {
            // pass: commonHelper.random('hash'),
            init: { algorithm: 'Ed25519' },
            // start: true,
            ...ipfsOptions
        },
        // preload: {enabled: false, addresses: await this.getPreloadAddresses()}
    });

    return node.api;
}

export default {
    createDaemonNode
};