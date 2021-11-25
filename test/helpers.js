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

const chai = require('chai');
const dirtyChai = require('dirty-chai');
const expect = chai.expect;
chai.use(dirtyChai);

const commonHelper = require('../src/common');

describe('helpers', function () {
    it('hash', function (done) {
        expect(commonHelper.hash("58a9149c-7575-444d-9809-b69fe040239e")).to.equal("87a339fe13f761473b6e84e707692a14149eb6092222552aa5ca660d38df8dd6");
        done();
    })
});
