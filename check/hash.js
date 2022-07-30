import crypto from "crypto";
import { sha256 as hasher } from 'multiformats/hashes/sha2';
import * as json from 'multiformats/codecs/json';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';


import * as Block from 'multiformats/block'
import * as codec from '@ipld/dag-cbor'

const value = { foo: 'bar' }

// encode a block
let block = await Block.encode({ value, codec, hasher })

// you can also decode blocks from their binary state
block = await Block.decode({ bytes: block.bytes, codec, hasher })

// if you have the cid you can also verify the hash on decode
block = await Block.create({ bytes: block.bytes, cid: block.cid, codec, hasher });

console.log('block', block);