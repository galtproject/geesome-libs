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

import chai from 'chai';
import dirtyChai from 'dirty-chai';
const expect = chai.expect;
chai.use(dirtyChai);

import commonHelper from '../src/common.js';
import geesomeWalletClientLib from 'geesome-wallet-client/src/lib.js';

describe('helpers', function () {
    it('hash', function (done) {
        expect(commonHelper.hash("58a9149c-7575-444d-9809-b69fe040239e")).to.equal("87a339fe13f761473b6e84e707692a14149eb6092222552aa5ca660d38df8dd6");
        done();
    });

    it('use hash to encrypt', function (done) {
        const hash = commonHelper.hash("58a9149c-7575-444d-9809-b69fe040239e");
        expect(hash).to.equal("87a339fe13f761473b6e84e707692a14149eb6092222552aa5ca660d38df8dd6");
        const content = "1AgAOMTQ5LjE1NC4xNjcuNTABu6loJ2uGda1Erw1/lXdza0JLNvjj153fOWu0t53WQ4e1DoOvoORfUCiRypRQLeW81JuyfED8dGQ0I0YF34NcEc0j1Goz/9mpaM1rrdAaF0X2665Ek7wN1wbQMbmLNtytbL//D8P/MeYswwLpv/vwqBVNpPFebchSLkr4KaRKZ5P1BY2Gj+DIvog3o+Ghy/YkEeUgX32W/MaPFFSIZ7eH97rK6CXA0wfauf2CaRID8dxlVPajlD++fbugsjM9tdDm/RwnQwEVVthixtxTMS9xz3CO1kcs76Jx6QihD0xo2Kwy5Ic/bGX50JVj+/PozCVVeKthxSfpxP1jfBYN6ac9FuQ=";
        const encrypted = geesomeWalletClientLib.encrypt(hash, content);
        expect(encrypted).to.equal("9fa2d9aa297c2215c45ede205f70da9ddf1fa1a4470879b7a8e686f286e655d0a722fbf0d7a3b0c9918e62a7d9e5f696774c42651b618e4d14371b4eba8d4ce3206dedad169c2042f0a41b29575e766de9cf05550a3d57156d1707ac3884607d161fdf3f9a77a2a31e27b699464b5a6cb2695db68d86ee3fb4d7cb7954adb72e7c9ef6442710787dbb4a3a4d3ef37f84dbbf28813751e42d115296832b83bfdf186629f02845e69fad042212216984f3f7c20af8449b77682bfa8a4c84dafc58e6fd03a356617224363e2d8703edcf2a86d6a850a9127b334763c5bb16484614ac636b43acba01c423ad8814a7d4133802e75f708a1ecd73e913c17a6b65bd89e5b3d76e26a815044c1f5076213f2fa0039db4c03d246ebe2639242061650f761719547c936bb211ec00338f28ae04ab00a123b70b05debc987479e3e019372f6c0117c74855314fc3757dff73207728e7e3c011b8ef9def69dca5fd739dd7ee75a411d13c63a4bf2c4302ebd56a33375e");

        const incorrectHash = commonHelper.hash("68a9149c-7575-444d-9809-b69fe040239e");
        const incorrectDecrypted = geesomeWalletClientLib.decrypt(incorrectHash, encrypted);
        expect(incorrectDecrypted).not.to.equal(content);
        done();
    })
});
