"use strict";
exports.__esModule = true;
exports.fanout_event = exports.registerClientAPI = exports.registerGeesomeCrypto = void 0;
var v3_1 = require("@fluencelabs/fluence/dist/internal/compilerSupport/v3");
function registerGeesomeCrypto() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    (0, v3_1.registerService)(args, {
        "defaultServiceId": "GeesomeCrypto",
        "functions": {
            "tag": "labeledProduct",
            "fields": {
                "checkSignature": {
                    "tag": "arrow",
                    "domain": {
                        "tag": "labeledProduct",
                        "fields": {
                            "from": {
                                "tag": "scalar",
                                "name": "string"
                            },
                            "data": {
                                "tag": "scalar",
                                "name": "string"
                            },
                            "seqno": {
                                "tag": "scalar",
                                "name": "string"
                            },
                            "signature": {
                                "tag": "scalar",
                                "name": "string"
                            }
                        }
                    },
                    "codomain": {
                        "tag": "unlabeledProduct",
                        "items": [
                            {
                                "tag": "scalar",
                                "name": "bool"
                            }
                        ]
                    }
                }
            }
        }
    });
}
exports.registerGeesomeCrypto = registerGeesomeCrypto;
function registerClientAPI() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    (0, v3_1.registerService)(args, {
        "defaultServiceId": "api",
        "functions": {
            "tag": "labeledProduct",
            "fields": {
                "receive_event": {
                    "tag": "arrow",
                    "domain": {
                        "tag": "labeledProduct",
                        "fields": {
                            "topic": {
                                "tag": "scalar",
                                "name": "string"
                            },
                            "e": {
                                "tag": "struct",
                                "name": "Event",
                                "fields": {
                                    "data": {
                                        "tag": "scalar",
                                        "name": "string"
                                    },
                                    "from": {
                                        "tag": "scalar",
                                        "name": "string"
                                    },
                                    "seqno": {
                                        "tag": "scalar",
                                        "name": "string"
                                    },
                                    "signature": {
                                        "tag": "scalar",
                                        "name": "string"
                                    }
                                }
                            }
                        }
                    },
                    "codomain": {
                        "tag": "nil"
                    }
                }
            }
        }
    });
}
exports.registerClientAPI = registerClientAPI;
function fanout_event() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var script = "\n                    (xor\n                     (seq\n                      (seq\n                       (seq\n                        (seq\n                         (seq\n                          (seq\n                           (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n                           (call %init_peer_id% (\"getDataSrv\" \"topic\") [] topic)\n                          )\n                          (call %init_peer_id% (\"getDataSrv\" \"event\") [] event)\n                         )\n                         (xor\n                          (call %init_peer_id% (\"callbackSrv\" \"call\") [\"will check signature\"])\n                          (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n                         )\n                        )\n                        (xor\n                         (call %init_peer_id% (\"GeesomeCrypto\" \"checkSignature\") [event.$.from! event.$.data! event.$.seqno! event.$.signature!] sigValid)\n                         (xor\n                          (call %init_peer_id% (\"callbackSrv\" \"call\") [\"checkSignature failed\"])\n                          (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n                         )\n                        )\n                       )\n                       (xor\n                        (call %init_peer_id% (\"callbackSrv\" \"call\") [\"did check signature\"])\n                        (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n                       )\n                      )\n                      (xor\n                       (match sigValid false\n                        (xor\n                         (xor\n                          (call %init_peer_id% (\"callbackSrv\" \"call\") [\"signature_not_valid\"])\n                          (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 4])\n                         )\n                         (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 5])\n                        )\n                       )\n                       (seq\n                        (seq\n                         (seq\n                          (xor\n                           (call %init_peer_id% (\"callbackSrv\" \"call\") [\"signature is valid\"])\n                           (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 6])\n                          )\n                          (new $res\n                           (xor\n                            (seq\n                             (seq\n                              (seq\n                               (call -relay- (\"op\" \"string_to_b58\") [topic] k)\n                               (call -relay- (\"kad\" \"neighborhood\") [k [] []] nodes)\n                              )\n                              (par\n                               (fold nodes n\n                                (par\n                                 (seq\n                                  (xor\n                                   (xor\n                                    (seq\n                                     (call n (\"peer\" \"timestamp_sec\") [] t)\n                                     (call n (\"aqua-dht\" \"get_values\") [topic t] $res)\n                                    )\n                                    (null)\n                                   )\n                                   (seq\n                                    (call -relay- (\"op\" \"noop\") [])\n                                    (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 7])\n                                   )\n                                  )\n                                  (call -relay- (\"op\" \"noop\") [])\n                                 )\n                                 (next n)\n                                )\n                               )\n                               (null)\n                              )\n                             )\n                             (call -relay- (\"aqua-dht\" \"merge_two\") [$res.$.[0].result! $res.$.[1].result!] v)\n                            )\n                            (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 8])\n                           )\n                          )\n                         )\n                         (par\n                          (fold v.$.result! r\n                           (par\n                            (seq\n                             (seq\n                              (call -relay- (\"op\" \"noop\") [])\n                              (call r.$.relay_id.[0]! (\"op\" \"noop\") [])\n                             )\n                             (xor\n                              (seq\n                               (call r.$.peer_id! (\"api\" \"receive_event\") [topic event])\n                               (par\n                                (seq\n                                 (seq\n                                  (call r.$.relay_id.[0]! (\"op\" \"noop\") [])\n                                  (call -relay- (\"op\" \"noop\") [])\n                                 )\n                                 (xor\n                                  (call %init_peer_id% (\"callbackSrv\" \"call\") [\"receive_event\"])\n                                  (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 9])\n                                 )\n                                )\n                                (null)\n                               )\n                              )\n                              (seq\n                               (seq\n                                (call r.$.relay_id.[0]! (\"op\" \"noop\") [])\n                                (call -relay- (\"op\" \"noop\") [])\n                               )\n                               (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 10])\n                              )\n                             )\n                            )\n                            (next r)\n                           )\n                          )\n                          (null)\n                         )\n                        )\n                        (par\n                         (xor\n                          (call %init_peer_id% (\"callbackSrv\" \"call\") [\"done\"])\n                          (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 11])\n                         )\n                         (null)\n                        )\n                       )\n                      )\n                     )\n                     (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 12])\n                    )\n    ";
    return (0, v3_1.callFunction)(args, {
        "functionName": "fanout_event",
        "arrow": {
            "tag": "arrow",
            "domain": {
                "tag": "labeledProduct",
                "fields": {
                    "topic": {
                        "tag": "scalar",
                        "name": "string"
                    },
                    "event": {
                        "tag": "struct",
                        "name": "Event",
                        "fields": {
                            "data": {
                                "tag": "scalar",
                                "name": "string"
                            },
                            "from": {
                                "tag": "scalar",
                                "name": "string"
                            },
                            "seqno": {
                                "tag": "scalar",
                                "name": "string"
                            },
                            "signature": {
                                "tag": "scalar",
                                "name": "string"
                            }
                        }
                    },
                    "call": {
                        "tag": "arrow",
                        "domain": {
                            "tag": "unlabeledProduct",
                            "items": [
                                {
                                    "tag": "scalar",
                                    "name": "string"
                                }
                            ]
                        },
                        "codomain": {
                            "tag": "nil"
                        }
                    }
                }
            },
            "codomain": {
                "tag": "nil"
            }
        },
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
exports.fanout_event = fanout_event;
