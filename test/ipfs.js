/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

/* eslint max-nested-callbacks: ["error", 6] */
/* eslint-env mocha */
'use strict';

const hat = require('hat');
const chai = require('chai');
const assert = require('assert');
const dirtyChai = require('dirty-chai');
const expect = chai.expect;
chai.use(dirtyChai);

const IPFS = require('ipfs');
const JsIpfsService = require('../src/JsIpfsService');
const ipfsHelper = require('../src/ipfsHelper');
const waitFor = require('./utils/wait-for');

const Ctl = require('ipfsd-ctl');
const factory = Ctl.createFactory({
  ipfsModule: IPFS,
  ipfsOptions: {
    pass: hat(),
    libp2p: {
      dialer: {
        dialTimeout: 60e3 // increase timeout because travis is slow
      }
    }
  },
  args: ['--enable-namesys-pubsub'],
  type: 'proc',
  test: true,
  // disposable: true
});

describe('ipfs', function () {
  let node;

  const createNode = () => {
    return factory.spawn({
      ipfsOptions: {
        EXPERIMENTAL: {ipnsPubsub: true}
      }
    }).then(node => node.api)
  };

  before(function (done) {
    this.timeout(40 * 1000);

    (async () => {
      node = new JsIpfsService(await createNode());
      done();
    })();
  });

  after((done) => {factory.clean().then(() => done())})

  it('should save file with correct ipfs hash', function (done) {
    this.timeout(80 * 1000);

    (async () => {
      const content = '1';
      const savedText = await node.saveFileByData(content);
      const ipfsHash = await ipfsHelper.getIpfsHashFromString(content);
      expect(savedText.id).to.equals(ipfsHash);

      done();
    })();
  });
});
