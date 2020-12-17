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

const Ethereum = require('../src/ethreum');

describe.only('ethereum', function () {
    it('should handle signed event and validate signature', function (done) {
        expect(
            Ethereum.getAccountAddressBySignature(
                '0xb86db86ed13b40f158af54fd45c25175b6b642de1b2f28d24fbec7a1a1badf4f31b5a6ca804d6433f3a8ac23a5c729a6bcd2e1d0597effc5970f03d6d6e78e081b',
                "58a9149c-7575-444d-9809-b69fe040239e",
                "key"
            )
        ).to.equal("0x7744440C831Fc5e89605bE1ED911E0A4fD0c90BC");
        done();
    })
});
