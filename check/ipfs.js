import {createFactory} from 'ipfsd-ctl';
import * as ipfsHttpModule from 'ipfs-http-client';
// import ipfsModule from 'ipfs';

const factory = createFactory({
    type: 'proc', // or 'js' to run in a separate process
    // type: 'js',
    // ipfsHttpModule,
    ipfsModule: (await import('ipfs')), // only if you gonna spawn 'proc' controllers
});

factory.spawn().then(r => {
    console.log('r', r);
})