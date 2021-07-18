"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var api_unstable_1 = require("@fluencelabs/fluence/dist/api.unstable");
function fanout_event(client, relay, topic, event, call, config) {
    return __awaiter(this, void 0, void 0, function () {
        var request, promise;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promise = new Promise(function (resolve, reject) {
                        var r = new api_unstable_1.RequestFlowBuilder()
                            .disableInjections()
                            .withRawScript("\n(xor\n (seq\n  (seq\n   (seq\n    (seq\n     (seq\n      (seq\n       (seq\n        (seq\n         (seq\n          (seq\n           (seq\n            (seq\n             (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n             (call %init_peer_id% (\"getDataSrv\" \"relay\") [] relay)\n            )\n            (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n           )\n           (call %init_peer_id% (\"getDataSrv\" \"event\") [] event)\n          )\n          (xor\n           (call %init_peer_id% (\"callbackSrv\" \"call\") [\"start\"])\n           (seq\n            (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n            (call -relay- (\"op\" \"noop\") [])\n           )\n          )\n         )\n         (call -relay- (\"op\" \"noop\") [])\n        )\n        (xor\n         (seq\n          (call relay (\"op\" \"string_to_b58\") [topic] k)\n          (call relay (\"kad\" \"neighborhood\") [k $nil $nil] nodes)\n         )\n         (seq\n          (seq\n           (call -relay- (\"op\" \"noop\") [])\n           (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n          )\n          (call -relay- (\"op\" \"noop\") [])\n         )\n        )\n       )\n       (call -relay- (\"op\" \"noop\") [])\n      )\n      (fold nodes n\n       (par\n        (seq\n         (xor\n          (seq\n           (call n (\"peer\" \"timestamp_sec\") [] t)\n           (call n (\"aqua-dht\" \"get_values\") [topic t] $res)\n          )\n          (null)\n         )\n         (call relay (\"op\" \"noop\") [])\n        )\n        (seq\n         (call -relay- (\"op\" \"noop\") [])\n         (next n)\n        )\n       )\n      )\n     )\n     (xor\n      (call relay (\"aqua-dht\" \"merge_two\") [$res.$.[0].result! $res.$.[1].result!] v)\n      (seq\n       (call -relay- (\"op\" \"noop\") [])\n       (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n      )\n     )\n    )\n    (call -relay- (\"op\" \"noop\") [])\n   )\n   (xor\n    (call %init_peer_id% (\"callbackSrv\" \"call\") [\"subs\"])\n    (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 4])\n   )\n  )\n  (fold v.$.result! r\n   (par\n    (seq\n     (seq\n      (seq\n       (seq\n        (xor\n         (call %init_peer_id% (\"callbackSrv\" \"call\") [r.$.peer_id!])\n         (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 5])\n        )\n        (xor\n         (call %init_peer_id% (\"callbackSrv\" \"call\") [r.$.relay_id.[0]!])\n         (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 6])\n        )\n       )\n       (call -relay- (\"op\" \"noop\") [])\n      )\n      (call r.$.relay_id.[0]! (\"op\" \"noop\") [])\n     )\n     (xor\n      (seq\n       (seq\n        (seq\n         (seq\n          (xor\n           (call %init_peer_id% (\"callbackSrv\" \"call\") [\"receive_event\"])\n           (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 7])\n          )\n          (xor\n           (call %init_peer_id% (\"callbackSrv\" \"call\") [topic])\n           (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 8])\n          )\n         )\n         (call -relay- (\"op\" \"noop\") [])\n        )\n        (call r.$.relay_id.[0]! (\"op\" \"noop\") [])\n       )\n       (par\n        (seq\n         (seq\n          (call -relay- (\"op\" \"noop\") [])\n          (call r.$.relay_id.[0]! (\"op\" \"noop\") [])\n         )\n         (call r.$.peer_id! (\"api\" \"receive_event\") [topic event])\n        )\n        (null)\n       )\n      )\n      (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 9])\n     )\n    )\n    (next r)\n   )\n  )\n )\n (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 10])\n)\n\n            ")
                            .configHandler(function (h) {
                            h.on('getDataSrv', '-relay-', function () {
                                return client.relayPeerId;
                            });
                            h.on('getDataSrv', 'relay', function () { return relay; });
                            h.on('getDataSrv', 'topic', function () { return topic; });
                            h.on('getDataSrv', 'event', function () { return event; });
                            h.on('callbackSrv', 'call', function (args) { call(args[0]); return {}; });
                            h.onEvent('errorHandlingSrv', 'error', function (args) {
                                // assuming error is the single argument
                                var err = args[0];
                                reject(err);
                            });
                        })
                            .handleScriptError(reject)
                            .handleTimeout(function () {
                            reject('Request timed out for fanout_event');
                        });
                        if (config && config.ttl) {
                            r.withTTL(config.ttl);
                        }
                        request = r.build();
                    });
                    return [4 /*yield*/, client.initiateFlow(request)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, Promise.race([promise, Promise.resolve()])];
            }
        });
    });
}
exports.fanout_event = fanout_event;
function subscribeNode(client, subscriber_node_id, topic, value, service_id, config) {
    return __awaiter(this, void 0, void 0, function () {
        var request, promise;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promise = new Promise(function (resolve, reject) {
                        var r = new api_unstable_1.RequestFlowBuilder()
                            .disableInjections()
                            .withRawScript("\n(xor\n (seq\n  (seq\n   (seq\n    (seq\n     (seq\n      (seq\n       (seq\n        (seq\n         (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n         (call %init_peer_id% (\"getDataSrv\" \"subscriber_node_id\") [] subscriber_node_id)\n        )\n        (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n       )\n       (call %init_peer_id% (\"getDataSrv\" \"value\") [] value)\n      )\n      (call %init_peer_id% (\"getDataSrv\" \"service_id\") [] service_id)\n     )\n     (call -relay- (\"op\" \"noop\") [])\n    )\n    (xor\n     (seq\n      (seq\n       (call subscriber_node_id (\"peer\" \"timestamp_sec\") [] t)\n       (call subscriber_node_id (\"aqua-dht\" \"put_host_value\") [topic value t $nil service_id 0] r)\n      )\n      (xor\n       (seq\n        (call subscriber_node_id (\"op\" \"string_to_b58\") [topic] k)\n        (call subscriber_node_id (\"kad\" \"neighborhood\") [k $nil $nil] nodes)\n       )\n       (seq\n        (call -relay- (\"op\" \"noop\") [])\n        (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n       )\n      )\n     )\n     (seq\n      (call -relay- (\"op\" \"noop\") [])\n      (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n     )\n    )\n   )\n   (call -relay- (\"op\" \"noop\") [])\n  )\n  (fold nodes n\n   (par\n    (xor\n     (seq\n      (seq\n       (call n (\"peer\" \"timestamp_sec\") [] tt)\n       (call n (\"aqua-dht\" \"register_key\") [topic tt false 0])\n      )\n      (call n (\"aqua-dht\" \"propagate_host_value\") [r tt 0])\n     )\n     (null)\n    )\n    (seq\n     (call -relay- (\"op\" \"noop\") [])\n     (next n)\n    )\n   )\n  )\n )\n (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n)\n\n            ")
                            .configHandler(function (h) {
                            h.on('getDataSrv', '-relay-', function () {
                                return client.relayPeerId;
                            });
                            h.on('getDataSrv', 'subscriber_node_id', function () { return subscriber_node_id; });
                            h.on('getDataSrv', 'topic', function () { return topic; });
                            h.on('getDataSrv', 'value', function () { return value; });
                            h.on('getDataSrv', 'service_id', function () { return service_id === null ? [] : [service_id]; });
                            h.onEvent('errorHandlingSrv', 'error', function (args) {
                                // assuming error is the single argument
                                var err = args[0];
                                reject(err);
                            });
                        })
                            .handleScriptError(reject)
                            .handleTimeout(function () {
                            reject('Request timed out for subscribeNode');
                        });
                        if (config && config.ttl) {
                            r.withTTL(config.ttl);
                        }
                        request = r.build();
                    });
                    return [4 /*yield*/, client.initiateFlow(request)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, Promise.race([promise, Promise.resolve()])];
            }
        });
    });
}
exports.subscribeNode = subscribeNode;
function executeOnSubscribers(client, node_id, topic, call, config) {
    return __awaiter(this, void 0, void 0, function () {
        var request, promise;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promise = new Promise(function (resolve, reject) {
                        var r = new api_unstable_1.RequestFlowBuilder()
                            .disableInjections()
                            .withRawScript("\n(xor\n (seq\n  (seq\n   (seq\n    (seq\n     (seq\n      (seq\n       (seq\n        (seq\n         (seq\n          (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n          (call %init_peer_id% (\"getDataSrv\" \"node_id\") [] node_id)\n         )\n         (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n        )\n        (call -relay- (\"op\" \"noop\") [])\n       )\n       (xor\n        (seq\n         (call node_id (\"op\" \"string_to_b58\") [topic] k)\n         (call node_id (\"kad\" \"neighborhood\") [k $nil $nil] nodes)\n        )\n        (seq\n         (seq\n          (call -relay- (\"op\" \"noop\") [])\n          (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n         )\n         (call -relay- (\"op\" \"noop\") [])\n        )\n       )\n      )\n      (call -relay- (\"op\" \"noop\") [])\n     )\n     (fold nodes n\n      (par\n       (seq\n        (xor\n         (seq\n          (call n (\"peer\" \"timestamp_sec\") [] t)\n          (call n (\"aqua-dht\" \"get_values\") [topic t] $res)\n         )\n         (null)\n        )\n        (call node_id (\"op\" \"noop\") [])\n       )\n       (seq\n        (call -relay- (\"op\" \"noop\") [])\n        (next n)\n       )\n      )\n     )\n    )\n    (xor\n     (call node_id (\"aqua-dht\" \"merge_two\") [$res.$.[0].result! $res.$.[1].result!] v)\n     (seq\n      (call -relay- (\"op\" \"noop\") [])\n      (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n     )\n    )\n   )\n   (call -relay- (\"op\" \"noop\") [])\n  )\n  (fold v.$.result! r\n   (par\n    (seq\n     (fold r.$.relay_id! -via-peer-\n      (seq\n       (call -via-peer- (\"op\" \"noop\") [])\n       (next -via-peer-)\n      )\n     )\n     (xor\n      (seq\n       (seq\n        (fold r.$.relay_id! -via-peer-\n         (seq\n          (call -via-peer- (\"op\" \"noop\") [])\n          (next -via-peer-)\n         )\n        )\n        (call -relay- (\"op\" \"noop\") [])\n       )\n       (xor\n        (call %init_peer_id% (\"callbackSrv\" \"call\") [r])\n        (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n       )\n      )\n      (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 4])\n     )\n    )\n    (seq\n     (call -relay- (\"op\" \"noop\") [])\n     (next r)\n    )\n   )\n  )\n )\n (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 5])\n)\n\n            ")
                            .configHandler(function (h) {
                            h.on('getDataSrv', '-relay-', function () {
                                return client.relayPeerId;
                            });
                            h.on('getDataSrv', 'node_id', function () { return node_id; });
                            h.on('getDataSrv', 'topic', function () { return topic; });
                            h.on('callbackSrv', 'call', function (args) { call(args[0]); return {}; });
                            h.onEvent('errorHandlingSrv', 'error', function (args) {
                                // assuming error is the single argument
                                var err = args[0];
                                reject(err);
                            });
                        })
                            .handleScriptError(reject)
                            .handleTimeout(function () {
                            reject('Request timed out for executeOnSubscribers');
                        });
                        if (config && config.ttl) {
                            r.withTTL(config.ttl);
                        }
                        request = r.build();
                    });
                    return [4 /*yield*/, client.initiateFlow(request)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, Promise.race([promise, Promise.resolve()])];
            }
        });
    });
}
exports.executeOnSubscribers = executeOnSubscribers;
function subscribe(client, node_id, topic, value, relay_id, service_id, config) {
    return __awaiter(this, void 0, void 0, function () {
        var request, promise;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promise = new Promise(function (resolve, reject) {
                        var r = new api_unstable_1.RequestFlowBuilder()
                            .disableInjections()
                            .withRawScript("\n(xor\n (seq\n  (seq\n   (seq\n    (seq\n     (seq\n      (seq\n       (seq\n        (seq\n         (seq\n          (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n          (call %init_peer_id% (\"getDataSrv\" \"node_id\") [] node_id)\n         )\n         (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n        )\n        (call %init_peer_id% (\"getDataSrv\" \"value\") [] value)\n       )\n       (call %init_peer_id% (\"getDataSrv\" \"relay_id\") [] relay_id)\n      )\n      (call %init_peer_id% (\"getDataSrv\" \"service_id\") [] service_id)\n     )\n     (call -relay- (\"op\" \"noop\") [])\n    )\n    (xor\n     (seq\n      (call node_id (\"op\" \"string_to_b58\") [topic] k)\n      (call node_id (\"kad\" \"neighborhood\") [k $nil $nil] nodes)\n     )\n     (seq\n      (call -relay- (\"op\" \"noop\") [])\n      (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n     )\n    )\n   )\n   (call -relay- (\"op\" \"noop\") [])\n  )\n  (fold nodes n\n   (par\n    (xor\n     (seq\n      (call n (\"peer\" \"timestamp_sec\") [] t)\n      (call n (\"aqua-dht\" \"put_value\") [topic value t relay_id service_id 0])\n     )\n     (null)\n    )\n    (seq\n     (call -relay- (\"op\" \"noop\") [])\n     (next n)\n    )\n   )\n  )\n )\n (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n)\n\n            ")
                            .configHandler(function (h) {
                            h.on('getDataSrv', '-relay-', function () {
                                return client.relayPeerId;
                            });
                            h.on('getDataSrv', 'node_id', function () { return node_id; });
                            h.on('getDataSrv', 'topic', function () { return topic; });
                            h.on('getDataSrv', 'value', function () { return value; });
                            h.on('getDataSrv', 'relay_id', function () { return relay_id === null ? [] : [relay_id]; });
                            h.on('getDataSrv', 'service_id', function () { return service_id === null ? [] : [service_id]; });
                            h.onEvent('errorHandlingSrv', 'error', function (args) {
                                // assuming error is the single argument
                                var err = args[0];
                                reject(err);
                            });
                        })
                            .handleScriptError(reject)
                            .handleTimeout(function () {
                            reject('Request timed out for subscribe');
                        });
                        if (config && config.ttl) {
                            r.withTTL(config.ttl);
                        }
                        request = r.build();
                    });
                    return [4 /*yield*/, client.initiateFlow(request)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, Promise.race([promise, Promise.resolve()])];
            }
        });
    });
}
exports.subscribe = subscribe;
function getNeighbours(client, node_id, topic, config) {
    return __awaiter(this, void 0, void 0, function () {
        var request, promise;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promise = new Promise(function (resolve, reject) {
                        var r = new api_unstable_1.RequestFlowBuilder()
                            .disableInjections()
                            .withRawScript("\n(xor\n (seq\n  (seq\n   (seq\n    (seq\n     (seq\n      (seq\n       (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n       (call %init_peer_id% (\"getDataSrv\" \"node_id\") [] node_id)\n      )\n      (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n     )\n     (call -relay- (\"op\" \"noop\") [])\n    )\n    (xor\n     (seq\n      (call node_id (\"op\" \"string_to_b58\") [topic] k)\n      (call node_id (\"kad\" \"neighborhood\") [k $nil $nil] nodes)\n     )\n     (seq\n      (call -relay- (\"op\" \"noop\") [])\n      (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n     )\n    )\n   )\n   (call -relay- (\"op\" \"noop\") [])\n  )\n  (xor\n   (call %init_peer_id% (\"callbackSrv\" \"response\") [nodes])\n   (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n  )\n )\n (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n)\n\n            ")
                            .configHandler(function (h) {
                            h.on('getDataSrv', '-relay-', function () {
                                return client.relayPeerId;
                            });
                            h.on('getDataSrv', 'node_id', function () { return node_id; });
                            h.on('getDataSrv', 'topic', function () { return topic; });
                            h.onEvent('callbackSrv', 'response', function (args) {
                                var res = args[0];
                                resolve(res);
                            });
                            h.onEvent('errorHandlingSrv', 'error', function (args) {
                                // assuming error is the single argument
                                var err = args[0];
                                reject(err);
                            });
                        })
                            .handleScriptError(reject)
                            .handleTimeout(function () {
                            reject('Request timed out for getNeighbours');
                        });
                        if (config && config.ttl) {
                            r.withTTL(config.ttl);
                        }
                        request = r.build();
                    });
                    return [4 /*yield*/, client.initiateFlow(request)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, promise];
            }
        });
    });
}
exports.getNeighbours = getNeighbours;
function initTopicAndSubscribeNode(client, subscriber_node_id, topic, value, service_id, config) {
    return __awaiter(this, void 0, void 0, function () {
        var request, promise;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promise = new Promise(function (resolve, reject) {
                        var r = new api_unstable_1.RequestFlowBuilder()
                            .disableInjections()
                            .withRawScript("\n(xor\n (seq\n  (seq\n   (seq\n    (seq\n     (seq\n      (seq\n       (seq\n        (seq\n         (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n         (call %init_peer_id% (\"getDataSrv\" \"subscriber_node_id\") [] subscriber_node_id)\n        )\n        (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n       )\n       (call %init_peer_id% (\"getDataSrv\" \"value\") [] value)\n      )\n      (call %init_peer_id% (\"getDataSrv\" \"service_id\") [] service_id)\n     )\n     (call -relay- (\"op\" \"noop\") [])\n    )\n    (xor\n     (seq\n      (seq\n       (seq\n        (call subscriber_node_id (\"peer\" \"timestamp_sec\") [] t)\n        (call subscriber_node_id (\"aqua-dht\" \"register_key\") [topic t false 0])\n       )\n       (call subscriber_node_id (\"aqua-dht\" \"put_host_value\") [topic value t $nil service_id 0] r)\n      )\n      (xor\n       (seq\n        (call subscriber_node_id (\"op\" \"string_to_b58\") [topic] k)\n        (call subscriber_node_id (\"kad\" \"neighborhood\") [k $nil $nil] nodes)\n       )\n       (seq\n        (call -relay- (\"op\" \"noop\") [])\n        (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n       )\n      )\n     )\n     (seq\n      (call -relay- (\"op\" \"noop\") [])\n      (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n     )\n    )\n   )\n   (call -relay- (\"op\" \"noop\") [])\n  )\n  (fold nodes n\n   (par\n    (xor\n     (seq\n      (seq\n       (call n (\"peer\" \"timestamp_sec\") [] tt)\n       (call n (\"aqua-dht\" \"register_key\") [topic tt false 0])\n      )\n      (call n (\"aqua-dht\" \"propagate_host_value\") [r tt 0])\n     )\n     (null)\n    )\n    (seq\n     (call -relay- (\"op\" \"noop\") [])\n     (next n)\n    )\n   )\n  )\n )\n (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n)\n\n            ")
                            .configHandler(function (h) {
                            h.on('getDataSrv', '-relay-', function () {
                                return client.relayPeerId;
                            });
                            h.on('getDataSrv', 'subscriber_node_id', function () { return subscriber_node_id; });
                            h.on('getDataSrv', 'topic', function () { return topic; });
                            h.on('getDataSrv', 'value', function () { return value; });
                            h.on('getDataSrv', 'service_id', function () { return service_id === null ? [] : [service_id]; });
                            h.onEvent('errorHandlingSrv', 'error', function (args) {
                                // assuming error is the single argument
                                var err = args[0];
                                reject(err);
                            });
                        })
                            .handleScriptError(reject)
                            .handleTimeout(function () {
                            reject('Request timed out for initTopicAndSubscribeNode');
                        });
                        if (config && config.ttl) {
                            r.withTTL(config.ttl);
                        }
                        request = r.build();
                    });
                    return [4 /*yield*/, client.initiateFlow(request)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, Promise.race([promise, Promise.resolve()])];
            }
        });
    });
}
exports.initTopicAndSubscribeNode = initTopicAndSubscribeNode;
function initTopic(client, node_id, topic, config) {
    return __awaiter(this, void 0, void 0, function () {
        var request, promise;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promise = new Promise(function (resolve, reject) {
                        var r = new api_unstable_1.RequestFlowBuilder()
                            .disableInjections()
                            .withRawScript("\n(xor\n (seq\n  (seq\n   (seq\n    (seq\n     (seq\n      (seq\n       (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n       (call %init_peer_id% (\"getDataSrv\" \"node_id\") [] node_id)\n      )\n      (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n     )\n     (call -relay- (\"op\" \"noop\") [])\n    )\n    (xor\n     (seq\n      (call node_id (\"op\" \"string_to_b58\") [topic] k)\n      (call node_id (\"kad\" \"neighborhood\") [k $nil $nil] nodes)\n     )\n     (seq\n      (call -relay- (\"op\" \"noop\") [])\n      (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n     )\n    )\n   )\n   (call -relay- (\"op\" \"noop\") [])\n  )\n  (fold nodes n\n   (par\n    (xor\n     (seq\n      (call n (\"peer\" \"timestamp_sec\") [] t)\n      (call n (\"aqua-dht\" \"register_key\") [topic t false 0])\n     )\n     (null)\n    )\n    (seq\n     (call -relay- (\"op\" \"noop\") [])\n     (next n)\n    )\n   )\n  )\n )\n (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n)\n\n            ")
                            .configHandler(function (h) {
                            h.on('getDataSrv', '-relay-', function () {
                                return client.relayPeerId;
                            });
                            h.on('getDataSrv', 'node_id', function () { return node_id; });
                            h.on('getDataSrv', 'topic', function () { return topic; });
                            h.onEvent('errorHandlingSrv', 'error', function (args) {
                                // assuming error is the single argument
                                var err = args[0];
                                reject(err);
                            });
                        })
                            .handleScriptError(reject)
                            .handleTimeout(function () {
                            reject('Request timed out for initTopic');
                        });
                        if (config && config.ttl) {
                            r.withTTL(config.ttl);
                        }
                        request = r.build();
                    });
                    return [4 /*yield*/, client.initiateFlow(request)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, Promise.race([promise, Promise.resolve()])];
            }
        });
    });
}
exports.initTopic = initTopic;
function findSubscribers(client, node_id, topic, config) {
    return __awaiter(this, void 0, void 0, function () {
        var request, promise;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promise = new Promise(function (resolve, reject) {
                        var r = new api_unstable_1.RequestFlowBuilder()
                            .disableInjections()
                            .withRawScript("\n(xor\n (seq\n  (seq\n   (seq\n    (seq\n     (seq\n      (seq\n       (seq\n        (seq\n         (seq\n          (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n          (call %init_peer_id% (\"getDataSrv\" \"node_id\") [] node_id)\n         )\n         (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n        )\n        (call -relay- (\"op\" \"noop\") [])\n       )\n       (xor\n        (seq\n         (call node_id (\"op\" \"string_to_b58\") [topic] k)\n         (call node_id (\"kad\" \"neighborhood\") [k $nil $nil] nodes)\n        )\n        (seq\n         (seq\n          (call -relay- (\"op\" \"noop\") [])\n          (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n         )\n         (call -relay- (\"op\" \"noop\") [])\n        )\n       )\n      )\n      (call -relay- (\"op\" \"noop\") [])\n     )\n     (fold nodes n\n      (par\n       (seq\n        (xor\n         (seq\n          (call n (\"peer\" \"timestamp_sec\") [] t)\n          (call n (\"aqua-dht\" \"get_values\") [topic t] $res)\n         )\n         (null)\n        )\n        (call node_id (\"op\" \"noop\") [])\n       )\n       (seq\n        (call -relay- (\"op\" \"noop\") [])\n        (next n)\n       )\n      )\n     )\n    )\n    (xor\n     (call node_id (\"aqua-dht\" \"merge_two\") [$res.$.[0].result! $res.$.[1].result!] v)\n     (seq\n      (call -relay- (\"op\" \"noop\") [])\n      (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n     )\n    )\n   )\n   (call -relay- (\"op\" \"noop\") [])\n  )\n  (xor\n   (call %init_peer_id% (\"callbackSrv\" \"response\") [v.$.result!])\n   (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n  )\n )\n (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 4])\n)\n\n            ")
                            .configHandler(function (h) {
                            h.on('getDataSrv', '-relay-', function () {
                                return client.relayPeerId;
                            });
                            h.on('getDataSrv', 'node_id', function () { return node_id; });
                            h.on('getDataSrv', 'topic', function () { return topic; });
                            h.onEvent('callbackSrv', 'response', function (args) {
                                var res = args[0];
                                resolve(res);
                            });
                            h.onEvent('errorHandlingSrv', 'error', function (args) {
                                // assuming error is the single argument
                                var err = args[0];
                                reject(err);
                            });
                        })
                            .handleScriptError(reject)
                            .handleTimeout(function () {
                            reject('Request timed out for findSubscribers');
                        });
                        if (config && config.ttl) {
                            r.withTTL(config.ttl);
                        }
                        request = r.build();
                    });
                    return [4 /*yield*/, client.initiateFlow(request)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, promise];
            }
        });
    });
}
exports.findSubscribers = findSubscribers;
function initTopicAndSubscribe(client, node_id, topic, value, relay_id, service_id, notify, config) {
    return __awaiter(this, void 0, void 0, function () {
        var request, promise;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promise = new Promise(function (resolve, reject) {
                        var r = new api_unstable_1.RequestFlowBuilder()
                            .disableInjections()
                            .withRawScript("\n(xor\n (seq\n  (seq\n   (seq\n    (seq\n     (seq\n      (seq\n       (seq\n        (seq\n         (seq\n          (seq\n           (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n           (call %init_peer_id% (\"getDataSrv\" \"node_id\") [] node_id)\n          )\n          (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n         )\n         (call %init_peer_id% (\"getDataSrv\" \"value\") [] value)\n        )\n        (call %init_peer_id% (\"getDataSrv\" \"relay_id\") [] relay_id)\n       )\n       (call %init_peer_id% (\"getDataSrv\" \"service_id\") [] service_id)\n      )\n      (call -relay- (\"op\" \"noop\") [])\n     )\n     (xor\n      (seq\n       (call node_id (\"op\" \"string_to_b58\") [topic] k)\n       (call node_id (\"kad\" \"neighborhood\") [k $nil $nil] nodes)\n      )\n      (seq\n       (call -relay- (\"op\" \"noop\") [])\n       (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n      )\n     )\n    )\n    (call -relay- (\"op\" \"noop\") [])\n   )\n   (fold nodes n\n    (par\n     (seq\n      (xor\n       (seq\n        (seq\n         (seq\n          (call n (\"peer\" \"timestamp_sec\") [] t)\n          (call n (\"aqua-dht\" \"register_key\") [topic t false 0])\n         )\n         (call n (\"aqua-dht\" \"put_value\") [topic value t relay_id service_id 0] result)\n        )\n        (xor\n         (match result.$.success! true\n          (xor\n           (seq\n            (call n (\"op\" \"identity\") [result] $results)\n            (par\n             (seq\n              (call -relay- (\"op\" \"noop\") [])\n              (xor\n               (call %init_peer_id% (\"callbackSrv\" \"notify\") [])\n               (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n              )\n             )\n             (null)\n            )\n           )\n           (seq\n            (call -relay- (\"op\" \"noop\") [])\n            (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n           )\n          )\n         )\n         (null)\n        )\n       )\n       (null)\n      )\n      (call %init_peer_id% (\"op\" \"noop\") [])\n     )\n     (seq\n      (call -relay- (\"op\" \"noop\") [])\n      (next n)\n     )\n    )\n   )\n  )\n  (xor\n   (call %init_peer_id% (\"callbackSrv\" \"response\") [$results.$.[0]!])\n   (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 4])\n  )\n )\n (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 5])\n)\n\n            ")
                            .configHandler(function (h) {
                            h.on('getDataSrv', '-relay-', function () {
                                return client.relayPeerId;
                            });
                            h.on('getDataSrv', 'node_id', function () { return node_id; });
                            h.on('getDataSrv', 'topic', function () { return topic; });
                            h.on('getDataSrv', 'value', function () { return value; });
                            h.on('getDataSrv', 'relay_id', function () { return relay_id === null ? [] : [relay_id]; });
                            h.on('getDataSrv', 'service_id', function () { return service_id === null ? [] : [service_id]; });
                            h.on('callbackSrv', 'notify', function (args) { notify(); return {}; });
                            h.onEvent('callbackSrv', 'response', function (args) {
                                var res = args[0];
                                resolve(res);
                            });
                            h.onEvent('errorHandlingSrv', 'error', function (args) {
                                // assuming error is the single argument
                                var err = args[0];
                                reject(err);
                            });
                        })
                            .handleScriptError(reject)
                            .handleTimeout(function () {
                            reject('Request timed out for initTopicAndSubscribe');
                        });
                        if (config && config.ttl) {
                            r.withTTL(config.ttl);
                        }
                        request = r.build();
                    });
                    return [4 /*yield*/, client.initiateFlow(request)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, promise];
            }
        });
    });
}
exports.initTopicAndSubscribe = initTopicAndSubscribe;
function sendToSubscribers(client, relay, topic, message, config) {
    return __awaiter(this, void 0, void 0, function () {
        var request, promise;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promise = new Promise(function (resolve, reject) {
                        var r = new api_unstable_1.RequestFlowBuilder()
                            .disableInjections()
                            .withRawScript("\n(xor\n (seq\n  (seq\n   (seq\n    (seq\n     (seq\n      (seq\n       (seq\n        (seq\n         (seq\n          (seq\n           (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n           (call %init_peer_id% (\"getDataSrv\" \"relay\") [] relay)\n          )\n          (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n         )\n         (call %init_peer_id% (\"getDataSrv\" \"message\") [] message)\n        )\n        (call -relay- (\"op\" \"noop\") [])\n       )\n       (xor\n        (seq\n         (call relay (\"op\" \"string_to_b58\") [topic] k)\n         (call relay (\"kad\" \"neighborhood\") [k $nil $nil] nodes)\n        )\n        (seq\n         (seq\n          (call -relay- (\"op\" \"noop\") [])\n          (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n         )\n         (call -relay- (\"op\" \"noop\") [])\n        )\n       )\n      )\n      (call -relay- (\"op\" \"noop\") [])\n     )\n     (fold nodes n\n      (par\n       (seq\n        (xor\n         (seq\n          (call n (\"peer\" \"timestamp_sec\") [] t)\n          (call n (\"aqua-dht\" \"get_values\") [topic t] $res)\n         )\n         (null)\n        )\n        (call relay (\"op\" \"noop\") [])\n       )\n       (seq\n        (call -relay- (\"op\" \"noop\") [])\n        (next n)\n       )\n      )\n     )\n    )\n    (xor\n     (call relay (\"aqua-dht\" \"merge_two\") [$res.$.[0].result! $res.$.[1].result!] v)\n     (seq\n      (seq\n       (call -relay- (\"op\" \"noop\") [])\n       (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n      )\n      (call -relay- (\"op\" \"noop\") [])\n     )\n    )\n   )\n   (call -relay- (\"op\" \"noop\") [])\n  )\n  (fold v.$.result! sub\n   (seq\n    (seq\n     (seq\n      (seq\n       (fold sub.$.relay_id! -via-peer-\n        (seq\n         (call -via-peer- (\"op\" \"noop\") [])\n         (next -via-peer-)\n        )\n       )\n       (xor\n        (seq\n         (fold sub.$.relay_id! -via-peer-\n          (seq\n           (call -via-peer- (\"op\" \"noop\") [])\n           (next -via-peer-)\n          )\n         )\n         (call sub.$.set_by! (sub.$.service_id.[0]! \"send_event\") [message])\n        )\n        (seq\n         (seq\n          (seq\n           (fold sub.$.relay_id! -via-peer-\n            (seq\n             (call -via-peer- (\"op\" \"noop\") [])\n             (next -via-peer-)\n            )\n           )\n           (call -relay- (\"op\" \"noop\") [])\n          )\n          (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n         )\n         (call -relay- (\"op\" \"noop\") [])\n        )\n       )\n      )\n      (fold sub.$.relay_id! -via-peer-\n       (seq\n        (call -via-peer- (\"op\" \"noop\") [])\n        (next -via-peer-)\n       )\n      )\n     )\n     (call -relay- (\"op\" \"noop\") [])\n    )\n    (next sub)\n   )\n  )\n )\n (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 4])\n)\n\n            ")
                            .configHandler(function (h) {
                            h.on('getDataSrv', '-relay-', function () {
                                return client.relayPeerId;
                            });
                            h.on('getDataSrv', 'relay', function () { return relay; });
                            h.on('getDataSrv', 'topic', function () { return topic; });
                            h.on('getDataSrv', 'message', function () { return message; });
                            h.onEvent('errorHandlingSrv', 'error', function (args) {
                                // assuming error is the single argument
                                var err = args[0];
                                reject(err);
                            });
                        })
                            .handleScriptError(reject)
                            .handleTimeout(function () {
                            reject('Request timed out for sendToSubscribers');
                        });
                        if (config && config.ttl) {
                            r.withTTL(config.ttl);
                        }
                        request = r.build();
                    });
                    return [4 /*yield*/, client.initiateFlow(request)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, Promise.race([promise, Promise.resolve()])];
            }
        });
    });
}
exports.sendToSubscribers = sendToSubscribers;
function removeSubscriber(client, node_id, topic, config) {
    return __awaiter(this, void 0, void 0, function () {
        var request, promise;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promise = new Promise(function (resolve, reject) {
                        var r = new api_unstable_1.RequestFlowBuilder()
                            .disableInjections()
                            .withRawScript("\n(xor\n (seq\n  (seq\n   (seq\n    (seq\n     (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n     (call %init_peer_id% (\"getDataSrv\" \"node_id\") [] node_id)\n    )\n    (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n   )\n   (call -relay- (\"op\" \"noop\") [])\n  )\n  (xor\n   (seq\n    (call node_id (\"peer\" \"timestamp_sec\") [] t)\n    (call node_id (\"aqua-dht\" \"clear_host_value\") [topic t])\n   )\n   (seq\n    (call -relay- (\"op\" \"noop\") [])\n    (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n   )\n  )\n )\n (seq\n  (call -relay- (\"op\" \"noop\") [])\n  (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n )\n)\n\n            ")
                            .configHandler(function (h) {
                            h.on('getDataSrv', '-relay-', function () {
                                return client.relayPeerId;
                            });
                            h.on('getDataSrv', 'node_id', function () { return node_id; });
                            h.on('getDataSrv', 'topic', function () { return topic; });
                            h.onEvent('errorHandlingSrv', 'error', function (args) {
                                // assuming error is the single argument
                                var err = args[0];
                                reject(err);
                            });
                        })
                            .handleScriptError(reject)
                            .handleTimeout(function () {
                            reject('Request timed out for removeSubscriber');
                        });
                        if (config && config.ttl) {
                            r.withTTL(config.ttl);
                        }
                        request = r.build();
                    });
                    return [4 /*yield*/, client.initiateFlow(request)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, Promise.race([promise, Promise.resolve()])];
            }
        });
    });
}
exports.removeSubscriber = removeSubscriber;
