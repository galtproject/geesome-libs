"use strict";
exports.__esModule = true;
exports.registerNodeProvider = exports.registerProvider = exports.getResourceId = exports.resolveProviders = exports.createResource = void 0;
var v3_1 = require("@fluencelabs/fluence/dist/internal/compilerSupport/v3");
function createResource() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var script = "\n                    (xor\n                     (seq\n                      (seq\n                       (seq\n                        (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n                        (call %init_peer_id% (\"getDataSrv\" \"label\") [] label)\n                       )\n                       (new $resource_id\n                        (seq\n                         (new $successful\n                          (seq\n                           (call %init_peer_id% (\"peer\" \"timestamp_sec\") [] t)\n                           (xor\n                            (seq\n                             (seq\n                              (call -relay- (\"registry\" \"get_key_bytes\") [label [] t [] \"\"] bytes)\n                              (xor\n                               (call %init_peer_id% (\"sig\" \"sign\") [bytes] result)\n                               (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n                              )\n                             )\n                             (xor\n                              (match result.$.success! false\n                               (ap result.$.error.[0]! $error)\n                              )\n                              (seq\n                               (seq\n                                (seq\n                                 (seq\n                                  (seq\n                                   (call -relay- (\"registry\" \"get_key_id\") [label %init_peer_id%] resource_id-0)\n                                   (call -relay- (\"op\" \"string_to_b58\") [resource_id-0] k)\n                                  )\n                                  (call -relay- (\"kad\" \"neighborhood\") [k [] []] nodes)\n                                 )\n                                 (par\n                                  (fold nodes n-0\n                                   (par\n                                    (seq\n                                     (xor\n                                      (xor\n                                       (seq\n                                        (seq\n                                         (seq\n                                          (call n-0 (\"peer\" \"timestamp_sec\") [] t-0)\n                                          (call n-0 (\"trust-graph\" \"get_weight\") [%init_peer_id% t-0] weight)\n                                         )\n                                         (call n-0 (\"registry\" \"register_key\") [label [] t [] \"\" result.$.signature.[0]! weight t-0] result-0)\n                                        )\n                                        (xor\n                                         (match result-0.$.success! true\n                                          (ap true $successful)\n                                         )\n                                         (ap result-0.$.error! $error)\n                                        )\n                                       )\n                                       (call n-0 (\"op\" \"noop\") [])\n                                      )\n                                      (seq\n                                       (call -relay- (\"op\" \"noop\") [])\n                                       (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n                                      )\n                                     )\n                                     (call -relay- (\"op\" \"noop\") [])\n                                    )\n                                    (next n-0)\n                                   )\n                                  )\n                                  (null)\n                                 )\n                                )\n                                (new $status\n                                 (new $result-1\n                                  (seq\n                                   (seq\n                                    (seq\n                                     (par\n                                      (seq\n                                       (seq\n                                        (call -relay- (\"math\" \"sub\") [1 1] sub)\n                                        (call -relay- (\"op\" \"noop\") [$successful.$.[sub]!])\n                                       )\n                                       (ap \"ok\" $status)\n                                      )\n                                      (call -relay- (\"peer\" \"timeout\") [6000 \"timeout\"] $status)\n                                     )\n                                     (call -relay- (\"op\" \"identity\") [$status.$.[0]!] stat)\n                                    )\n                                    (xor\n                                     (match stat \"ok\"\n                                      (ap true $result-1)\n                                     )\n                                     (ap false $result-1)\n                                    )\n                                   )\n                                   (call -relay- (\"op\" \"identity\") [$result-1] result-fix)\n                                  )\n                                 )\n                                )\n                               )\n                               (xor\n                                (match result-fix.$.[0]! false\n                                 (ap \"resource wasn't created: timeout exceeded\" $error)\n                                )\n                                (ap resource_id-0 $resource_id)\n                               )\n                              )\n                             )\n                            )\n                            (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n                           )\n                          )\n                         )\n                         (call %init_peer_id% (\"op\" \"identity\") [$resource_id] resource_id-fix)\n                        )\n                       )\n                      )\n                      (xor\n                       (call %init_peer_id% (\"callbackSrv\" \"response\") [resource_id-fix $error])\n                       (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 4])\n                      )\n                     )\n                     (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 5])\n                    )\n    ";
    return (0, v3_1.callFunction)(args, {
        "functionName": "createResource",
        "arrow": {
            "tag": "arrow",
            "domain": {
                "tag": "labeledProduct",
                "fields": {
                    "label": {
                        "tag": "scalar",
                        "name": "string"
                    }
                }
            },
            "codomain": {
                "tag": "unlabeledProduct",
                "items": [
                    {
                        "tag": "option",
                        "type": {
                            "tag": "scalar",
                            "name": "string"
                        }
                    },
                    {
                        "tag": "array",
                        "type": {
                            "tag": "scalar",
                            "name": "string"
                        }
                    }
                ]
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
exports.createResource = createResource;
function resolveProviders() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var script = "\n                    (xor\n                     (seq\n                      (seq\n                       (seq\n                        (seq\n                         (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n                         (call %init_peer_id% (\"getDataSrv\" \"resource_id\") [] resource_id)\n                        )\n                        (call %init_peer_id% (\"getDataSrv\" \"ack\") [] ack)\n                       )\n                       (new $successful\n                        (new $res\n                         (xor\n                          (seq\n                           (seq\n                            (seq\n                             (seq\n                              (seq\n                               (seq\n                                (call -relay- (\"op\" \"string_to_b58\") [resource_id] k)\n                                (call -relay- (\"kad\" \"neighborhood\") [k [] []] nodes)\n                               )\n                               (par\n                                (fold nodes n-0\n                                 (par\n                                  (seq\n                                   (xor\n                                    (xor\n                                     (seq\n                                      (seq\n                                       (call n-0 (\"peer\" \"timestamp_sec\") [] t)\n                                       (call n-0 (\"registry\" \"get_records\") [resource_id t] get_result)\n                                      )\n                                      (xor\n                                       (match get_result.$.success! true\n                                        (seq\n                                         (ap get_result.$.result! $res)\n                                         (ap true $successful)\n                                        )\n                                       )\n                                       (ap get_result.$.error! $error)\n                                      )\n                                     )\n                                     (call n-0 (\"op\" \"noop\") [])\n                                    )\n                                    (seq\n                                     (call -relay- (\"op\" \"noop\") [])\n                                     (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n                                    )\n                                   )\n                                   (call -relay- (\"op\" \"noop\") [])\n                                  )\n                                  (next n-0)\n                                 )\n                                )\n                                (null)\n                               )\n                              )\n                              (new $status\n                               (new $result-0\n                                (seq\n                                 (seq\n                                  (seq\n                                   (par\n                                    (seq\n                                     (seq\n                                      (call -relay- (\"math\" \"sub\") [ack 1] sub)\n                                      (call -relay- (\"op\" \"noop\") [$successful.$.[sub]!])\n                                     )\n                                     (ap \"ok\" $status)\n                                    )\n                                    (call -relay- (\"peer\" \"timeout\") [6000 \"timeout\"] $status)\n                                   )\n                                   (call -relay- (\"op\" \"identity\") [$status.$.[0]!] stat)\n                                  )\n                                  (xor\n                                   (match stat \"ok\"\n                                    (ap true $result-0)\n                                   )\n                                   (ap false $result-0)\n                                  )\n                                 )\n                                 (call -relay- (\"op\" \"identity\") [$result-0] result-fix)\n                                )\n                               )\n                              )\n                             )\n                             (xor\n                              (match result-fix.$.[0]! false\n                               (ap \"timeout exceeded\" $error)\n                              )\n                              (call -relay- (\"op\" \"noop\") [])\n                             )\n                            )\n                            (call -relay- (\"registry\" \"merge\") [$res] result)\n                           )\n                           (xor\n                            (match result.$.success! false\n                             (ap result.$.error! $error)\n                            )\n                            (call -relay- (\"op\" \"noop\") [])\n                           )\n                          )\n                          (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n                         )\n                        )\n                       )\n                      )\n                      (xor\n                       (call %init_peer_id% (\"callbackSrv\" \"response\") [result.$.result! $error])\n                       (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n                      )\n                     )\n                     (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 4])\n                    )\n    ";
    return (0, v3_1.callFunction)(args, {
        "functionName": "resolveProviders",
        "arrow": {
            "tag": "arrow",
            "domain": {
                "tag": "labeledProduct",
                "fields": {
                    "resource_id": {
                        "tag": "scalar",
                        "name": "string"
                    },
                    "ack": {
                        "tag": "scalar",
                        "name": "i16"
                    }
                }
            },
            "codomain": {
                "tag": "unlabeledProduct",
                "items": [
                    {
                        "tag": "array",
                        "type": {
                            "tag": "struct",
                            "name": "Record",
                            "fields": {
                                "relay_id": {
                                    "tag": "array",
                                    "type": {
                                        "tag": "scalar",
                                        "name": "string"
                                    }
                                },
                                "signature": {
                                    "tag": "array",
                                    "type": {
                                        "tag": "scalar",
                                        "name": "u8"
                                    }
                                },
                                "set_by": {
                                    "tag": "scalar",
                                    "name": "string"
                                },
                                "peer_id": {
                                    "tag": "scalar",
                                    "name": "string"
                                },
                                "service_id": {
                                    "tag": "array",
                                    "type": {
                                        "tag": "scalar",
                                        "name": "string"
                                    }
                                },
                                "value": {
                                    "tag": "scalar",
                                    "name": "string"
                                },
                                "timestamp_created": {
                                    "tag": "scalar",
                                    "name": "u64"
                                },
                                "key_id": {
                                    "tag": "scalar",
                                    "name": "string"
                                },
                                "solution": {
                                    "tag": "array",
                                    "type": {
                                        "tag": "scalar",
                                        "name": "u8"
                                    }
                                }
                            }
                        }
                    },
                    {
                        "tag": "array",
                        "type": {
                            "tag": "scalar",
                            "name": "string"
                        }
                    }
                ]
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
exports.resolveProviders = resolveProviders;
function getResourceId() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var script = "\n                    (xor\n                     (seq\n                      (seq\n                       (seq\n                        (seq\n                         (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n                         (call %init_peer_id% (\"getDataSrv\" \"label\") [] label)\n                        )\n                        (call %init_peer_id% (\"getDataSrv\" \"peer_id\") [] peer_id)\n                       )\n                       (call %init_peer_id% (\"registry\" \"get_key_id\") [label peer_id] resource_id)\n                      )\n                      (xor\n                       (call %init_peer_id% (\"callbackSrv\" \"response\") [resource_id])\n                       (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n                      )\n                     )\n                     (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n                    )\n    ";
    return (0, v3_1.callFunction)(args, {
        "functionName": "getResourceId",
        "arrow": {
            "tag": "arrow",
            "domain": {
                "tag": "labeledProduct",
                "fields": {
                    "label": {
                        "tag": "scalar",
                        "name": "string"
                    },
                    "peer_id": {
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
                        "name": "string"
                    }
                ]
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
exports.getResourceId = getResourceId;
function registerProvider() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var script = "\n                    (xor\n                     (seq\n                      (seq\n                       (seq\n                        (seq\n                         (seq\n                          (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n                          (call %init_peer_id% (\"getDataSrv\" \"resource_id\") [] resource_id)\n                         )\n                         (call %init_peer_id% (\"getDataSrv\" \"value\") [] value)\n                        )\n                        (call %init_peer_id% (\"getDataSrv\" \"service_id\") [] service_id)\n                       )\n                       (new $successful\n                        (new $error_get\n                         (new $success\n                          (seq\n                           (new $relay_id\n                            (seq\n                             (seq\n                              (ap -relay- $relay_id)\n                              (call %init_peer_id% (\"peer\" \"timestamp_sec\") [] t)\n                             )\n                             (xor\n                              (seq\n                               (seq\n                                (call -relay- (\"registry\" \"get_record_bytes\") [resource_id value $relay_id service_id t []] bytes)\n                                (xor\n                                 (call %init_peer_id% (\"sig\" \"sign\") [bytes] signature)\n                                 (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n                                )\n                               )\n                               (xor\n                                (match signature.$.success! false\n                                 (seq\n                                  (ap signature.$.error.[0]! $error)\n                                  (ap false $success)\n                                 )\n                                )\n                                (seq\n                                 (seq\n                                  (seq\n                                   (new $resources\n                                    (new $successful-0\n                                     (new $result\n                                      (seq\n                                       (seq\n                                        (seq\n                                         (seq\n                                          (seq\n                                           (call -relay- (\"op\" \"string_to_b58\") [resource_id] k)\n                                           (call -relay- (\"kad\" \"neighborhood\") [k [] []] nodes-1)\n                                          )\n                                          (par\n                                           (fold nodes-1 n-0-0\n                                            (par\n                                             (seq\n                                              (xor\n                                               (xor\n                                                (seq\n                                                 (seq\n                                                  (call n-0-0 (\"peer\" \"timestamp_sec\") [] t-0)\n                                                  (call n-0-0 (\"registry\" \"get_key_metadata\") [resource_id t-0] get_result)\n                                                 )\n                                                 (xor\n                                                  (match get_result.$.success! true\n                                                   (seq\n                                                    (ap get_result.$.key! $resources)\n                                                    (ap true $successful-0)\n                                                   )\n                                                  )\n                                                  (seq\n                                                   (call n-0-0 (\"op\" \"concat_strings\") [get_result.$.error! \" on \"] e)\n                                                   (call n-0-0 (\"op\" \"concat_strings\") [e n-0-0] $error-0)\n                                                  )\n                                                 )\n                                                )\n                                                (call n-0-0 (\"op\" \"noop\") [])\n                                               )\n                                               (seq\n                                                (call -relay- (\"op\" \"noop\") [])\n                                                (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n                                               )\n                                              )\n                                              (call -relay- (\"op\" \"noop\") [])\n                                             )\n                                             (next n-0-0)\n                                            )\n                                           )\n                                           (null)\n                                          )\n                                         )\n                                         (new $status\n                                          (new $result-0\n                                           (seq\n                                            (seq\n                                             (seq\n                                              (par\n                                               (seq\n                                                (seq\n                                                 (call -relay- (\"math\" \"sub\") [1 1] sub)\n                                                 (call -relay- (\"op\" \"noop\") [$successful-0.$.[sub]!])\n                                                )\n                                                (ap \"ok\" $status)\n                                               )\n                                               (call -relay- (\"peer\" \"timeout\") [6000 \"timeout\"] $status)\n                                              )\n                                              (call -relay- (\"op\" \"identity\") [$status.$.[0]!] stat)\n                                             )\n                                             (xor\n                                              (match stat \"ok\"\n                                               (ap true $result-0)\n                                              )\n                                              (ap false $result-0)\n                                             )\n                                            )\n                                            (call -relay- (\"op\" \"identity\") [$result-0] result-fix-0)\n                                           )\n                                          )\n                                         )\n                                        )\n                                        (xor\n                                         (match result-fix-0.$.[0]! false\n                                          (ap \"resource not found: timeout exceeded\" $error-0)\n                                         )\n                                         (seq\n                                          (call -relay- (\"registry\" \"merge_keys\") [$resources] merge_result)\n                                          (xor\n                                           (match merge_result.$.success! true\n                                            (ap merge_result.$.key! $result)\n                                           )\n                                           (ap merge_result.$.error! $error-0)\n                                          )\n                                         )\n                                        )\n                                       )\n                                       (call -relay- (\"op\" \"identity\") [$result] result-fix)\n                                      )\n                                     )\n                                    )\n                                   )\n                                   (call -relay- (\"op\" \"identity\") [$error-0] push-to-stream-40)\n                                  )\n                                  (ap push-to-stream-40 $error_get)\n                                 )\n                                 (xor\n                                  (match result-fix []\n                                   (seq\n                                    (fold $error_get e-0-0\n                                     (seq\n                                      (ap e-0-0 $error)\n                                      (next e-0-0)\n                                     )\n                                    )\n                                    (ap false $success)\n                                   )\n                                  )\n                                  (seq\n                                   (seq\n                                    (seq\n                                     (seq\n                                      (seq\n                                       (seq\n                                        (call -relay- (\"op\" \"string_to_b58\") [resource_id] k-0)\n                                        (call -relay- (\"kad\" \"neighborhood\") [k-0 [] []] nodes)\n                                       )\n                                       (par\n                                        (fold nodes n-1\n                                         (par\n                                          (seq\n                                           (seq\n                                            (ap n-1 $error)\n                                            (xor\n                                             (xor\n                                              (seq\n                                               (seq\n                                                (seq\n                                                 (call n-1 (\"peer\" \"timestamp_sec\") [] t-1)\n                                                 (call n-1 (\"trust-graph\" \"get_weight\") [result-fix.$.[0].owner_peer_id! t-1] weight)\n                                                )\n                                                (call n-1 (\"registry\" \"republish_key\") [result-fix.$.[0]! weight t-1] result-1)\n                                               )\n                                               (xor\n                                                (match result-1.$.success! false\n                                                 (ap result-1.$.error! $error)\n                                                )\n                                                (seq\n                                                 (seq\n                                                  (seq\n                                                   (call n-1 (\"peer\" \"timestamp_sec\") [] t-2)\n                                                   (call n-1 (\"trust-graph\" \"get_weight\") [%init_peer_id% t-2] weight-0)\n                                                  )\n                                                  (call n-1 (\"registry\" \"put_record\") [resource_id value $relay_id service_id t [] signature.$.signature.[0]! weight-0 t-2] result-2)\n                                                 )\n                                                 (xor\n                                                  (match result-2.$.success! true\n                                                   (ap true $successful)\n                                                  )\n                                                  (ap result-2.$.error! $error)\n                                                 )\n                                                )\n                                               )\n                                              )\n                                              (call n-1 (\"op\" \"noop\") [])\n                                             )\n                                             (seq\n                                              (call -relay- (\"op\" \"noop\") [])\n                                              (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n                                             )\n                                            )\n                                           )\n                                           (call -relay- (\"op\" \"noop\") [])\n                                          )\n                                          (next n-1)\n                                         )\n                                        )\n                                        (null)\n                                       )\n                                      )\n                                      (new $status-0\n                                       (new $result-3\n                                        (seq\n                                         (seq\n                                          (seq\n                                           (par\n                                            (seq\n                                             (seq\n                                              (call -relay- (\"math\" \"sub\") [1 1] sub-0)\n                                              (call -relay- (\"op\" \"noop\") [$successful.$.[sub-0]!])\n                                             )\n                                             (ap \"ok\" $status-0)\n                                            )\n                                            (call -relay- (\"peer\" \"timeout\") [6000 \"timeout\"] $status-0)\n                                           )\n                                           (call -relay- (\"op\" \"identity\") [$status-0.$.[0]!] stat-0)\n                                          )\n                                          (xor\n                                           (match stat-0 \"ok\"\n                                            (ap true $result-3)\n                                           )\n                                           (ap false $result-3)\n                                          )\n                                         )\n                                         (call -relay- (\"op\" \"identity\") [$result-3] result-fix-1)\n                                        )\n                                       )\n                                      )\n                                     )\n                                     (ap result-fix-1.$.[0]! $success)\n                                    )\n                                    (call -relay- (\"op\" \"identity\") [$success.$.[0]!] identity)\n                                   )\n                                   (xor\n                                    (match identity false\n                                     (ap \"provider hasn't registered: timeout exceeded\" $error)\n                                    )\n                                    (call -relay- (\"op\" \"noop\") [])\n                                   )\n                                  )\n                                 )\n                                )\n                               )\n                              )\n                              (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 4])\n                             )\n                            )\n                           )\n                           (call %init_peer_id% (\"op\" \"identity\") [$success] success-fix)\n                          )\n                         )\n                        )\n                       )\n                      )\n                      (xor\n                       (call %init_peer_id% (\"callbackSrv\" \"response\") [success-fix.$.[0]! $error])\n                       (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 5])\n                      )\n                     )\n                     (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 6])\n                    )\n    ";
    return (0, v3_1.callFunction)(args, {
        "functionName": "registerProvider",
        "arrow": {
            "tag": "arrow",
            "domain": {
                "tag": "labeledProduct",
                "fields": {
                    "resource_id": {
                        "tag": "scalar",
                        "name": "string"
                    },
                    "value": {
                        "tag": "scalar",
                        "name": "string"
                    },
                    "service_id": {
                        "tag": "option",
                        "type": {
                            "tag": "scalar",
                            "name": "string"
                        }
                    }
                }
            },
            "codomain": {
                "tag": "unlabeledProduct",
                "items": [
                    {
                        "tag": "scalar",
                        "name": "bool"
                    },
                    {
                        "tag": "array",
                        "type": {
                            "tag": "scalar",
                            "name": "string"
                        }
                    }
                ]
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
exports.registerProvider = registerProvider;
function registerNodeProvider() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var script = "\n                    (xor\n                     (seq\n                      (seq\n                       (seq\n                        (seq\n                         (seq\n                          (seq\n                           (call %init_peer_id% (\"getDataSrv\" \"-relay-\") [] -relay-)\n                           (call %init_peer_id% (\"getDataSrv\" \"provider_node_id\") [] provider_node_id)\n                          )\n                          (call %init_peer_id% (\"getDataSrv\" \"resource_id\") [] resource_id)\n                         )\n                         (call %init_peer_id% (\"getDataSrv\" \"value\") [] value)\n                        )\n                        (call %init_peer_id% (\"getDataSrv\" \"service_id\") [] service_id)\n                       )\n                       (new $successful\n                        (new $error_get\n                         (new $success\n                          (seq\n                           (seq\n                            (seq\n                             (seq\n                              (seq\n                               (call %init_peer_id% (\"peer\" \"timestamp_sec\") [] t)\n                               (call -relay- (\"op\" \"noop\") [])\n                              )\n                              (xor\n                               (seq\n                                (seq\n                                 (seq\n                                  (call provider_node_id (\"registry\" \"get_host_record_bytes\") [resource_id value [] service_id t []] bytes)\n                                  (call -relay- (\"op\" \"noop\") [])\n                                 )\n                                 (xor\n                                  (seq\n                                   (call %init_peer_id% (\"sig\" \"sign\") [bytes] signature)\n                                   (call -relay- (\"op\" \"noop\") [])\n                                  )\n                                  (seq\n                                   (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 1])\n                                   (call -relay- (\"op\" \"noop\") [])\n                                  )\n                                 )\n                                )\n                                (xor\n                                 (seq\n                                  (match signature.$.success! false\n                                   (seq\n                                    (ap signature.$.error.[0]! $error)\n                                    (ap false $success)\n                                   )\n                                  )\n                                  (call -relay- (\"op\" \"noop\") [])\n                                 )\n                                 (seq\n                                  (xor\n                                   (seq\n                                    (seq\n                                     (new $resources\n                                      (new $successful-0\n                                       (new $result\n                                        (seq\n                                         (seq\n                                          (seq\n                                           (seq\n                                            (seq\n                                             (call -relay- (\"op\" \"string_to_b58\") [resource_id] k)\n                                             (call -relay- (\"kad\" \"neighborhood\") [k [] []] nodes-1)\n                                            )\n                                            (par\n                                             (fold nodes-1 n-0-0\n                                              (par\n                                               (seq\n                                                (xor\n                                                 (xor\n                                                  (seq\n                                                   (seq\n                                                    (call n-0-0 (\"peer\" \"timestamp_sec\") [] t-0)\n                                                    (call n-0-0 (\"registry\" \"get_key_metadata\") [resource_id t-0] get_result)\n                                                   )\n                                                   (xor\n                                                    (match get_result.$.success! true\n                                                     (seq\n                                                      (ap get_result.$.key! $resources)\n                                                      (ap true $successful-0)\n                                                     )\n                                                    )\n                                                    (seq\n                                                     (call n-0-0 (\"op\" \"concat_strings\") [get_result.$.error! \" on \"] e)\n                                                     (call n-0-0 (\"op\" \"concat_strings\") [e n-0-0] $error-0)\n                                                    )\n                                                   )\n                                                  )\n                                                  (call n-0-0 (\"op\" \"noop\") [])\n                                                 )\n                                                 (seq\n                                                  (call -relay- (\"op\" \"noop\") [])\n                                                  (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 2])\n                                                 )\n                                                )\n                                                (call -relay- (\"op\" \"noop\") [])\n                                               )\n                                               (next n-0-0)\n                                              )\n                                             )\n                                             (null)\n                                            )\n                                           )\n                                           (new $status\n                                            (new $result-0\n                                             (seq\n                                              (seq\n                                               (seq\n                                                (par\n                                                 (seq\n                                                  (seq\n                                                   (call -relay- (\"math\" \"sub\") [1 1] sub)\n                                                   (call -relay- (\"op\" \"noop\") [$successful-0.$.[sub]!])\n                                                  )\n                                                  (ap \"ok\" $status)\n                                                 )\n                                                 (call -relay- (\"peer\" \"timeout\") [6000 \"timeout\"] $status)\n                                                )\n                                                (call -relay- (\"op\" \"identity\") [$status.$.[0]!] stat)\n                                               )\n                                               (xor\n                                                (match stat \"ok\"\n                                                 (ap true $result-0)\n                                                )\n                                                (ap false $result-0)\n                                               )\n                                              )\n                                              (call -relay- (\"op\" \"identity\") [$result-0] result-fix-0)\n                                             )\n                                            )\n                                           )\n                                          )\n                                          (xor\n                                           (match result-fix-0.$.[0]! false\n                                            (ap \"resource not found: timeout exceeded\" $error-0)\n                                           )\n                                           (seq\n                                            (call -relay- (\"registry\" \"merge_keys\") [$resources] merge_result)\n                                            (xor\n                                             (match merge_result.$.success! true\n                                              (ap merge_result.$.key! $result)\n                                             )\n                                             (ap merge_result.$.error! $error-0)\n                                            )\n                                           )\n                                          )\n                                         )\n                                         (call -relay- (\"op\" \"identity\") [$result] result-fix)\n                                        )\n                                       )\n                                      )\n                                     )\n                                     (call -relay- (\"op\" \"identity\") [$error-0] push-to-stream-44)\n                                    )\n                                    (ap push-to-stream-44 $error_get)\n                                   )\n                                   (seq\n                                    (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 3])\n                                    (call -relay- (\"op\" \"noop\") [])\n                                   )\n                                  )\n                                  (xor\n                                   (seq\n                                    (match result-fix []\n                                     (seq\n                                      (fold $error_get e-0-0\n                                       (seq\n                                        (ap e-0-0 $error)\n                                        (next e-0-0)\n                                       )\n                                      )\n                                      (ap false $success)\n                                     )\n                                    )\n                                    (call -relay- (\"op\" \"noop\") [])\n                                   )\n                                   (seq\n                                    (seq\n                                     (seq\n                                      (call provider_node_id (\"peer\" \"timestamp_sec\") [] t-1)\n                                      (call provider_node_id (\"trust-graph\" \"get_weight\") [result-fix.$.[0].owner_peer_id! t-1] weight)\n                                     )\n                                     (call provider_node_id (\"registry\" \"republish_key\") [result-fix.$.[0]! weight t-1] result-1)\n                                    )\n                                    (xor\n                                     (seq\n                                      (match result-1.$.success! false\n                                       (ap result-1.$.error! $error)\n                                      )\n                                      (call -relay- (\"op\" \"noop\") [])\n                                     )\n                                     (seq\n                                      (seq\n                                       (seq\n                                        (call provider_node_id (\"peer\" \"timestamp_sec\") [] t-2)\n                                        (call provider_node_id (\"trust-graph\" \"get_weight\") [%init_peer_id% t-2] weight-0)\n                                       )\n                                       (call provider_node_id (\"registry\" \"put_host_record\") [resource_id value [] service_id t [] signature.$.signature.[0]! weight-0 t-2] result-2)\n                                      )\n                                      (xor\n                                       (seq\n                                        (match result-2.$.success! false\n                                         (seq\n                                          (ap result-2.$.error! $error)\n                                          (ap false $success)\n                                         )\n                                        )\n                                        (call -relay- (\"op\" \"noop\") [])\n                                       )\n                                       (seq\n                                        (seq\n                                         (seq\n                                          (seq\n                                           (seq\n                                            (call provider_node_id (\"op\" \"string_to_b58\") [resource_id] k-0)\n                                            (call provider_node_id (\"kad\" \"neighborhood\") [k-0 [] []] nodes)\n                                           )\n                                           (par\n                                            (fold nodes n-1\n                                             (par\n                                              (seq\n                                               (xor\n                                                (xor\n                                                 (seq\n                                                  (seq\n                                                   (seq\n                                                    (call n-1 (\"peer\" \"timestamp_sec\") [] t-3)\n                                                    (call n-1 (\"trust-graph\" \"get_weight\") [result-fix.$.[0].owner_peer_id! t-3] weight-1)\n                                                   )\n                                                   (call n-1 (\"registry\" \"republish_key\") [result-fix.$.[0]! weight-1 t-3] result-3)\n                                                  )\n                                                  (xor\n                                                   (match result-3.$.success! false\n                                                    (ap result-3.$.error! $error)\n                                                   )\n                                                   (seq\n                                                    (seq\n                                                     (seq\n                                                      (call n-1 (\"peer\" \"timestamp_sec\") [] t-4)\n                                                      (call n-1 (\"trust-graph\" \"get_weight\") [result-2.$.record.[0].peer_id! t-4] weight-2)\n                                                     )\n                                                     (call n-1 (\"registry\" \"propagate_host_record\") [result-2 t-4 weight-2] result-4)\n                                                    )\n                                                    (xor\n                                                     (match result-4.$.success! true\n                                                      (ap true $successful)\n                                                     )\n                                                     (ap result-4.$.error! $error)\n                                                    )\n                                                   )\n                                                  )\n                                                 )\n                                                 (call n-1 (\"op\" \"noop\") [])\n                                                )\n                                                (seq\n                                                 (call -relay- (\"op\" \"noop\") [])\n                                                 (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 4])\n                                                )\n                                               )\n                                               (call provider_node_id (\"op\" \"noop\") [])\n                                              )\n                                              (next n-1)\n                                             )\n                                            )\n                                            (null)\n                                           )\n                                          )\n                                          (new $status-0\n                                           (new $result-5\n                                            (seq\n                                             (seq\n                                              (seq\n                                               (par\n                                                (seq\n                                                 (seq\n                                                  (call provider_node_id (\"math\" \"sub\") [1 1] sub-0)\n                                                  (call provider_node_id (\"op\" \"noop\") [$successful.$.[sub-0]!])\n                                                 )\n                                                 (ap \"ok\" $status-0)\n                                                )\n                                                (call provider_node_id (\"peer\" \"timeout\") [6000 \"timeout\"] $status-0)\n                                               )\n                                               (call provider_node_id (\"op\" \"identity\") [$status-0.$.[0]!] stat-0)\n                                              )\n                                              (xor\n                                               (match stat-0 \"ok\"\n                                                (ap true $result-5)\n                                               )\n                                               (ap false $result-5)\n                                              )\n                                             )\n                                             (call provider_node_id (\"op\" \"identity\") [$result-5] result-fix-1)\n                                            )\n                                           )\n                                          )\n                                         )\n                                         (ap result-fix-1.$.[0]! $success)\n                                        )\n                                        (call -relay- (\"op\" \"noop\") [])\n                                       )\n                                      )\n                                     )\n                                    )\n                                   )\n                                  )\n                                 )\n                                )\n                               )\n                               (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 5])\n                              )\n                             )\n                             (call %init_peer_id% (\"op\" \"identity\") [$success.$.[0]!] identity)\n                            )\n                            (xor\n                             (match identity false\n                              (ap \"provider hasn't registered: timeout exceeded\" $error)\n                             )\n                             (call %init_peer_id% (\"op\" \"noop\") [])\n                            )\n                           )\n                           (call %init_peer_id% (\"op\" \"identity\") [$success] success-fix)\n                          )\n                         )\n                        )\n                       )\n                      )\n                      (xor\n                       (call %init_peer_id% (\"callbackSrv\" \"response\") [success-fix.$.[0]! $error])\n                       (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 6])\n                      )\n                     )\n                     (call %init_peer_id% (\"errorHandlingSrv\" \"error\") [%last_error% 7])\n                    )\n    ";
    return (0, v3_1.callFunction)(args, {
        "functionName": "registerNodeProvider",
        "arrow": {
            "tag": "arrow",
            "domain": {
                "tag": "labeledProduct",
                "fields": {
                    "provider_node_id": {
                        "tag": "scalar",
                        "name": "string"
                    },
                    "resource_id": {
                        "tag": "scalar",
                        "name": "string"
                    },
                    "value": {
                        "tag": "scalar",
                        "name": "string"
                    },
                    "service_id": {
                        "tag": "option",
                        "type": {
                            "tag": "scalar",
                            "name": "string"
                        }
                    }
                }
            },
            "codomain": {
                "tag": "unlabeledProduct",
                "items": [
                    {
                        "tag": "scalar",
                        "name": "bool"
                    },
                    {
                        "tag": "array",
                        "type": {
                            "tag": "scalar",
                            "name": "string"
                        }
                    }
                ]
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
exports.registerNodeProvider = registerNodeProvider;
