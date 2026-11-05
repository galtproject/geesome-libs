import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {CID} from 'multiformats/cid';
import ipfsHelper from '../src/ipfsHelper.js';
import Path from 'node:path';
import JsIpfsService from '../src/JsIpfsService.js';
import JsIpfsServiceNode from '../src/JsIpfsServiceNode.js';

const cid = CID.parse('bafkreidlq2zhh7zu7tqz224aj37vup2xi6w2j2vcf4outqa6klo3pb23jm');
const result = (path = '') => ({cid, path, fileSize: 1});
function stub(overrides = {}) {
  const calls = {pins: 0};
  const node = {id: async () => ({}), swarm: {connect: async () => undefined}, stop: async () => undefined,
    pin: {add: async () => { calls.pins++; }, ls: async function* () { yield {cid, type: 'recursive'}; }}, ...overrides};
  return {node, calls};
}
function deferred() {
  let resolve, reject;
  const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve: (value?) => resolve(value), reject: error => reject(error)};
}

describe('Kubo GC-safe pinned imports', () => {
  for (const waitForPin of [false, true]) {
    it(`awaits pinned file import with waitForPin=${waitForPin} and preserves the CID/output contract`, async () => {
      const imported = deferred(), entered = deferred();
      const abort = new AbortController(), headers = {'x-test': 'value'};
      const {node, calls} = stub({add: async (data, options) => {
        assert.equal(data, '1');
        assert.deepEqual(options, {pin: true, cidVersion: 1, timeout: 321, signal: abort.signal, headers});
        entered.resolve();
        return imported.promise;
      }});
      const service = new JsIpfsService(node, 'kubo');
      let finished = false;
      const pending = service.saveFile('1', {waitForPin, timeout: 321, signal: abort.signal, headers,
        pin: false, cidVersion: 0, rawLeaves: false, chunker: 'different'}).then(value => { finished = true; return value; });
      await entered.promise;
      assert.equal(finished, false);
      imported.resolve(result());
      assert.deepEqual(await pending, {id: cid.toString(), path: '/ipfs/' + cid.toString(), size: 1});
      assert.equal(calls.pins, 0);
    });
  }

  it('forwards saveFileByData transport options and removes its stream error listener after success', async () => {
    const content = Readable.from(['1']), abort = new AbortController();
    const {node, calls} = stub({add: async (data, options) => {
      assert.equal(data.content, content);
      assert.equal(options.signal, abort.signal);
      assert.equal(options.timeout, 500);
      assert.equal(options.pin, true);
      return result();
    }});
    const service = new JsIpfsService(node, 'kubo');
    const before = content.listenerCount('error');
    assert.equal((await service.saveFileByData(content, {timeout: 500, signal: abort.signal}) as any).id, cid.toString());
    assert.equal(content.listenerCount('error'), before);
    assert.equal(calls.pins, 0);
  });

  it('converts string data to bytes and waits for a pinned import', async () => {
    const {node} = stub({add: async (data, options) => {
      assert(Buffer.isBuffer(data.content));
      assert.equal(data.content.toString(), '1');
      assert.equal(options.pin, true);
      return result();
    }});
    assert.equal((await new JsIpfsService(node, 'kubo').saveFileByData('1') as any).id, cid.toString());
  });

  it('rejects an import/pin failure without returning success or launching a second pin', async () => {
    const failure = new Error('import pin failed');
    const {node, calls} = stub({add: async () => { throw failure; }});
    const service = new JsIpfsService(node, 'kubo');
    await assert.rejects(service.saveFile('1', {waitForPin: false}), error => error === failure);
    assert.equal(calls.pins, 0);
  });

  it('rejects stream errors and consumes later importer failure without retaining its listener', async () => {
    const imported = deferred(), content = new Readable({read() {}});
    const {node} = stub({add: () => imported.promise});
    const service = new JsIpfsService(node, 'kubo');
    const failure = new Error('input failed');
    const pending = service.saveFileByData(content, {waitForPin: true});
    content.emit('error', failure);
    await assert.rejects(pending, error => error === failure);
    imported.reject(new Error('import subsequently rejected'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(content.listenerCount('error'), 0);
  });

  it('pins browser file imports inside the same RPC', async () => {
    const {node, calls} = stub({add: async (_data, options) => {
      assert.equal(options.pin, true);
      assert.equal(options.timeout, 44);
      return result();
    }});
    const saved = await new JsIpfsService(node, 'kubo').saveBrowserFile({name: 'file'}, {timeout: 44});
    assert.equal(saved.id, cid.toString());
    assert.equal(calls.pins, 0);
  });

  for (const rootPath of ['', Path.resolve('test'), Path.resolve('test').replace(/^\/+/, '')]) {
    it(`fully consumes a pinned wrapped directory before publishing root ${JSON.stringify(rootPath)}`, async () => {
      const finish = deferred(), entered = deferred(), abort = new AbortController();
      let fullyConsumed = false;
      const {node, calls} = stub({addAll: async function* (_source, options) {
        assert.deepEqual(options, {pin: true, cidVersion: 1, wrapWithDirectory: true, timeout: 222, signal: abort.signal});
        yield result('child.txt');
        yield result(rootPath);
        entered.resolve();
        await finish.promise;
        fullyConsumed = true;
      }});
      const service = new JsIpfsServiceNode(node, 'kubo');
      let completed = false;
      const pending = service.saveDirectory('test', {timeout: 222, signal: abort.signal,
        waitForPin: false, pin: false, wrapWithDirectory: false}).then(value => { completed = true; return value; });
      await entered.promise;
      assert.equal(completed, false);
      finish.resolve();
      assert.equal((await pending).id, cid.toString());
      assert.equal(fullyConsumed, true);
      assert.equal(calls.pins, 0);
    });
  }

  it('rejects a late directory importer failure even after observing the root', async () => {
    const failure = new Error('final pin failed');
    const {node, calls} = stub({addAll: async function* () { yield result(); throw failure; }});
    await assert.rejects(new JsIpfsServiceNode(node, 'kubo').saveDirectory('test'), error => error === failure);
    assert.equal(calls.pins, 0);
  });

  it('rejects a directory import without a root instead of publishing a child', async () => {
    const {node} = stub({addAll: async function* () { yield result('child.txt'); }});
    await assert.rejects(new JsIpfsServiceNode(node, 'kubo').saveDirectory('test'), /directory_import_root_missing/);
  });
  it('confirms the matching recursive pin using the same deadline and signal', async () => {
    const abort = new AbortController();
    const {node} = stub({add: async () => result(), pin: {ls: async function* (options) {
      assert.equal(options.paths.length, 1);
      assert(options.paths[0].equals(cid));
      assert.deepEqual({...options, paths: undefined}, {paths: undefined, type: 'recursive', timeout: 123, signal: abort.signal});
      yield {cid, type: 'recursive'};
    }}});
    await new JsIpfsService(node, 'kubo').saveFile('1', {timeout: 123, signal: abort.signal});
  });

  it('fails closed when an apparent import success has no matching recursive pin', async () => {
    const {node} = stub({add: async () => result(), pin: {ls: async function* () { yield {cid, type: 'direct'}; }}});
    await assert.rejects(new JsIpfsService(node, 'kubo').saveFile('1'), /kubo_import_pin_unconfirmed/);
  });

  it('consumes pin confirmation to the end and rejects a late stream error', async () => {
    const failure = new Error('pin listing failed late');
    const {node} = stub({add: async () => result(), pin: {ls: async function* () { yield {cid, type: 'recursive'}; throw failure; }}});
    await assert.rejects(new JsIpfsService(node, 'kubo').saveFile('1'), error => error === failure);
  });

  for (const waitForPin of [false, true]) {
    it(`pins DAG-CBOR objects atomically with waitForPin=${waitForPin} and preserves their CID`, async () => {
      const imported = deferred(), entered = deferred(), abort = new AbortController();
      const object = {z: 2, a: 1};
      const objectCid = CID.parse(await ipfsHelper.getIpldHashFromObject(object));
      const {node, calls} = stub({dag: {put: async (data, options) => {
        assert.deepEqual(Object.keys(data), ['a', 'z']);
        assert.deepEqual(options, {storeCodec: 'dag-cbor', hashAlg: 'sha2-256', pin: true, timeout: 456, signal: abort.signal});
        entered.resolve();
        return imported.promise;
      }}, pin: {ls: async function* () { yield {cid: objectCid, type: 'recursive'}; }}});
      let completed = false;
      const pending = new JsIpfsService(node, 'kubo').saveObject(object, {waitForPin, timeout: 456, signal: abort.signal,
        pin: false, storeCodec: 'different', hashAlg: 'different'}).then(value => { completed = true; return value; });
      await entered.promise;
      assert.equal(completed, false);
      imported.resolve(objectCid);
      assert.equal(await pending, objectCid.toString());
      assert.equal(calls.pins, 0);
    });
  }

  it('does not publish an apparent DAG put success without its recursive pin', async () => {
    const {node} = stub({dag: {put: async () => cid}, pin: {ls: async function* () {}}});
    await assert.rejects(new JsIpfsService(node, 'kubo').saveObject({a: 1}), /kubo_import_pin_unconfirmed/);
  });

  it('propagates DAG put errors without launching a second pin', async () => {
    const failure = new Error('DAG put/pin failed');
    const {node, calls} = stub({dag: {put: async () => { throw failure; }}});
    await assert.rejects(new JsIpfsService(node, 'kubo').saveObject({a: 1}), error => error === failure);
    assert.equal(calls.pins, 0);
  });

});
