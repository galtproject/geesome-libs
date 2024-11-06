export default {
    acceptInvite(storageAccIpns, code) {
        return 'I accept the invitation to the Geesome node with storage account: ' + storageAccIpns + ' and code: ' + code;
    },
    login(storageAccIpns, code) {
        return 'I want to login to the Geesome node with storage account: ' + storageAccIpns + ' and code: ' + code;
    }
}