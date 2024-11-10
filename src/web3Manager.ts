import Ethereum from './ethereum';
import EthCrypto from 'eth-crypto';

export default class Web3Manager {
    static currentAccountAddress: any;
    static accountAddressInterval: any;
    static onAccountAddressChangeCallbacks: any[];

    static onAccountAddressChange(callback) {
        this.onAccountAddressChangeCallbacks.push(callback);
    }

    static triggerOnAccountAddressChange(newAccountAddress) {
        this.currentAccountAddress = newAccountAddress;
        this.onAccountAddressChangeCallbacks.forEach((callback) => callback(newAccountAddress))
    }

    static signMessage(message, address, fieldName, provider = null) {
        const messageParams = [{type: 'string', name: fieldName, value: message}];

        if (!provider) {
            provider = Web3Manager.getClientProvider();
        }
        return new Promise((resolve, reject) => {
            provider.sendAsync({
                method: 'eth_signTypedData',
                params: [messageParams, address],
                from: address,
            }, function (err, response) {
                if (err) return console.error(err);
                if (response.error) {
                    return console.error(response.error.message)
                }
                // const recovered = Web3Manager.clientWeb3.eth.accounts.recover(EthData.stringToHex(message), response.result);
                const recovered = EthCrypto.recover(response.result, Ethereum.typedSignatureHash(messageParams));
                if (recovered.toLowerCase() === address.toLowerCase()) {
                    resolve(response.result);
                } else {
                    reject();
                }
            })
        })
    }

    static getClientProvider() {
        return global.window['ethereum'] ? global.window['ethereum'] : (global.window['web3'] || {}).currentProvider;
    }

    static async getClientProviderAccounts(provider = null) {
        let accounts;
        if (provider) {
            accounts = await provider.eth.getAccounts();
        } else if (global.window['ethereum']) {
            try {
                if (!global.window['ethereum'].selectedAddress) {
                    await global.window['ethereum'].enable();
                }
                accounts = await global.window['ethereum'].request({method: 'eth_accounts'});
            } catch (error) {
                console.error('ethereum enable error', error);
            }
        }
        // Legacy dapp browsers...
        else if (global.window['web3']) {
            accounts = await global.window['web3'].eth.getAccounts();
        }
        return accounts;
    }

    static async initClientWeb3(provider = null) {
        if (this.accountAddressInterval) {
            clearInterval(this.accountAddressInterval);
        }
        const accounts = await this.getClientProviderAccounts(provider);
        if (!accounts) {
            throw new Error('client_web3_not_found')
        }
        this.triggerOnAccountAddressChange(accounts[0]);

        this.accountAddressInterval = setInterval(async () => {
            try {
                const accounts = await this.getClientProviderAccounts(provider);
                if (!accounts || accounts[0] === this.currentAccountAddress)
                    return;
                this.triggerOnAccountAddressChange(accounts[0]);
            } catch (e) {
                console.warn('getAccounts interval error', e)
            }
        }, 1000);
    }
};
