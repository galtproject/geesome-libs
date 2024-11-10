"use strict";
exports.__esModule = true;
exports.findSubscribers = exports.initTopicAndSubscribeBlocking = exports.initTopicAndSubscribe = void 0;
var v2_1 = require("@fluencelabs/fluence/dist/internal/compilerSupport/v2");
function initTopicAndSubscribe() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var script = "\n                    (xor\n                     (seq\n                      (seq\n                       (seq\n                        (seq\n                         (seq\n                          (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n                          (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n                         )\n                         (call %init_peer_id% (\"getDataSrv\" \"value\") [] value)\n                        )\n                        (call %init_peer_id% (\"getDataSrv\" \"relay_id\") [] relay_id)\n                       )\n                       (call %init_peer_id% (\"getDataSrv\" \"service_id\") [] service_id)\n                      )\n                      (xor\n                       (seq\n                        (seq\n                         (call -relay- (\"op\" \"string_to_b58\") [topic] k)\n                         (call -relay- (\"kad\" \"neighborhood\") [k [] []] nodes)\n                        )\n                        (par\n                         (fold nodes n\n                          (par\n                           (xor\n                            (seq\n                             (seq\n                              (call n (\"peer\" \"timestamp_sec\") [] t)\n                              (call n (\"aqua-dht\" \"register_key\") [topic t false 0])\n                             )\n                             (call n (\"aqua-dht\" \"put_value\") [topic value t relay_id service_id 0])\n                            )\n                            (null)\n                           )\n                           (next n)\n                          )\n                         )\n                         (null)\n                        )\n                       )\n                       (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n                      )\n                     )\n                     (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n                    )\n    ";
    return (0, v2_1.callFunction)(args, {
        "functionName": "initTopicAndSubscribe",
        "returnType": {
            "tag": "void"
        },
        "argDefs": [
            {
                "name": "topic",
                "argType": {
                    "tag": "primitive"
                }
            },
            {
                "name": "value",
                "argType": {
                    "tag": "primitive"
                }
            },
            {
                "name": "relay_id",
                "argType": {
                    "tag": "optional"
                }
            },
            {
                "name": "service_id",
                "argType": {
                    "tag": "optional"
                }
            }
        ],
        "names": {
            "relay": "-relay-",
            "getDataSrv": "getDataSrv",
            "callbackSrv": "callbackSrv",
            "responseSrv": "callbackSrv",
            "responseFnName": "response",
            "errorHandlingSrv": "errorHandlingSrv",
            "errorFnName": "error"
        }
    }, script);
}
exports.initTopicAndSubscribe = initTopicAndSubscribe;
function initTopicAndSubscribeBlocking() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var script = "\n                    (xor\n                     (seq\n                      (seq\n                       (seq\n                        (seq\n                         (seq\n                          (seq\n                           (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n                           (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n                          )\n                          (call %init_peer_id% (\"getDataSrv\" \"value\") [] value)\n                         )\n                         (call %init_peer_id% (\"getDataSrv\" \"relay_id\") [] relay_id)\n                        )\n                        (call %init_peer_id% (\"getDataSrv\" \"service_id\") [] service_id)\n                       )\n                       (new $results\n                        (seq\n                         (xor\n                          (seq\n                           (seq\n                            (call -relay- (\"op\" \"string_to_b58\") [topic] k)\n                            (call -relay- (\"kad\" \"neighborhood\") [k [] []] nodes)\n                           )\n                           (par\n                            (seq\n                             (fold nodes n\n                              (par\n                               (seq\n                                (xor\n                                 (seq\n                                  (seq\n                                   (seq\n                                    (call n (\"peer\" \"timestamp_sec\") [] t)\n                                    (call n (\"aqua-dht\" \"register_key\") [topic t false 0])\n                                   )\n                                   (call n (\"aqua-dht\" \"put_value\") [topic value t relay_id service_id 0] result)\n                                  )\n                                  (xor\n                                   (match result.$.success! true\n                                    (xor\n                                     (seq\n                                      (seq\n                                       (ap result $results)\n                                       (call -relay- (\"op\" \"noop\") [])\n                                      )\n                                      (xor\n                                       (call %init_peer_id% (\"callbackSrv\" \"progress\") [n])\n                                       (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n                                      )\n                                     )\n                                     (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n                                    )\n                                   )\n                                   (null)\n                                  )\n                                 )\n                                 (null)\n                                )\n                                (call %init_peer_id% (\"op\" \"noop\") [])\n                               )\n                               (next n)\n                              )\n                             )\n                             (call %init_peer_id% (\"op\" \"noop\") [])\n                            )\n                            (null)\n                           )\n                          )\n                          (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n                         )\n                         (call %init_peer_id% (\"op\" \"identity\") [$results.$.[0]!] results-fix)\n                        )\n                       )\n                      )\n                      (xor\n                       (call %init_peer_id% (\"callbackSrv\" \"response\") [results-fix])\n                       (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 4])\n                      )\n                     )\n                     (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 5])\n                    )\n    ";
    return (0, v2_1.callFunction)(args, {
        "functionName": "initTopicAndSubscribeBlocking",
        "returnType": {
            "tag": "primitive"
        },
        "argDefs": [
            {
                "name": "topic",
                "argType": {
                    "tag": "primitive"
                }
            },
            {
                "name": "value",
                "argType": {
                    "tag": "primitive"
                }
            },
            {
                "name": "relay_id",
                "argType": {
                    "tag": "optional"
                }
            },
            {
                "name": "service_id",
                "argType": {
                    "tag": "optional"
                }
            },
            {
                "name": "progress",
                "argType": {
                    "tag": "callback",
                    "callback": {
                        "argDefs": [
                            {
                                "name": "arg0",
                                "argType": {
                                    "tag": "primitive"
                                }
                            }
                        ],
                        "returnType": {
                            "tag": "void"
                        }
                    }
                }
            }
        ],
        "names": {
            "relay": "-relay-",
            "getDataSrv": "getDataSrv",
            "callbackSrv": "callbackSrv",
            "responseSrv": "callbackSrv",
            "responseFnName": "response",
            "errorHandlingSrv": "errorHandlingSrv",
            "errorFnName": "error"
        }
    }, script);
}
exports.initTopicAndSubscribeBlocking = initTopicAndSubscribeBlocking;
function findSubscribers() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var script = "\n                    (xor\n                     (seq\n                      (seq\n                       (seq\n                        (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n                        (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n                       )\n                       (new $res\n                        (xor\n                         (seq\n                          (seq\n                           (seq\n                            (call -relay- (\"op\" \"string_to_b58\") [topic] k)\n                            (call -relay- (\"kad\" \"neighborhood\") [k [] []] nodes)\n                           )\n                           (par\n                            (seq\n                             (fold nodes n\n                              (par\n                               (seq\n                                (xor\n                                 (seq\n                                  (call n (\"peer\" \"timestamp_sec\") [] t)\n                                  (call n (\"aqua-dht\" \"get_values\") [topic t] $res)\n                                 )\n                                 (null)\n                                )\n                                (call -relay- (\"op\" \"noop\") [])\n                               )\n                               (next n)\n                              )\n                             )\n                             (call -relay- (\"op\" \"noop\") [])\n                            )\n                            (null)\n                           )\n                          )\n                          (call -relay- (\"aqua-dht\" \"merge_two\") [$res.$.[0].result! $res.$.[1].result!] v)\n                         )\n                         (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n                        )\n                       )\n                      )\n                      (xor\n                       (call %init_peer_id% (\"callbackSrv\" \"response\") [v.$.result!])\n                       (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n                      )\n                     )\n                     (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n                    )\n    ";
    return (0, v2_1.callFunction)(args, {
        "functionName": "findSubscribers",
        "returnType": {
            "tag": "primitive"
        },
        "argDefs": [
            {
                "name": "topic",
                "argType": {
                    "tag": "primitive"
                }
            }
        ],
        "names": {
            "relay": "-relay-",
            "getDataSrv": "getDataSrv",
            "callbackSrv": "callbackSrv",
            "responseSrv": "callbackSrv",
            "responseFnName": "response",
            "errorHandlingSrv": "errorHandlingSrv",
            "errorFnName": "error"
        }
    }, script);
}
exports.findSubscribers = findSubscribers;
