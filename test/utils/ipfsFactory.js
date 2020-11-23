const Ctl = require('ipfsd-ctl');
module.exports = Ctl.createFactory(  {
    type: 'proc',
    test: true,
    disposable: true,
    ipfsHttpModule: require('ipfs-http-client'),
    ipfsModule: require('ipfs') // only if you gonna spawn 'proc' controllers
});