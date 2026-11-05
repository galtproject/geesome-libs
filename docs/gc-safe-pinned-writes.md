# Kubo pinned writes (#164)

## Contents
- Contract and scope
- Implementation
- Verification
- Downstream integration

## Contract and scope
Kubo file, wrapped-directory and DAG-CBOR object helpers import with `pin: true`, wait for import completion and confirm the matching recursive pin with a read-only `pin.ls` call. Import and pin therefore use Kubo's native importer/GC coordination, without an unpinned interval followed by a second pin RPC. This guarantee is specific to Kubo; the Helia import/pinning behavior is preserved and is not claimed to have the same native GC contract.

The existing CIDv1, directory wrapping and `{id, path, size}` result remain unchanged. `waitForPin` is still accepted; Kubo now always waits for the pinned import, including when the flag is false or omitted. Failures in import or pinning reject rather than publishing a successful result.

## Implementation
- Files, byte/string data, paths, URLs, browser files and DAG-CBOR objects use pinned Kubo import. Byte/string data now forwards its options. Object codec and hash remain `dag-cbor` and `sha2-256`.
- Import options forward only `timeout`, `signal` and `headers`; callers cannot disable pinning or change established CID/wrapping defaults through these helper options.
- Directory import fully consumes the async iterator before returning its identified root. A missing root or a late iterator/pinning error rejects.
- Stream error subscriptions are removed once the underlying data import settles, and a later importer rejection is consumed after an earlier stream error.
- RPC clients may ignore late command-error trailers after receiving a CID. All these Kubo helpers therefore fully consume a read-only recursive pin listing and require its matching CID before returning. Missing pins and late confirmation errors fail closed. CID comparison normalizes CID versions.
- Confirmation adds one read RPC in place of the old separate pin write. It does not protect against an external client explicitly unpinning afterward; backend lifecycle exclusion remains responsible for managed retirement.
- Explicit pin operations and unrelated import APIs are outside this change.

## Verification
The focused stub suite verifies pinned-import arguments, both legacy wait modes, stable file/object CIDs, transport options, stream errors/listener cleanup, directory root variants/full completion, absent pins and late iterator/confirmation failure handling. `npm test` covers the existing Helia helper behavior as well. Validation on this compatibility base: 19 focused cases passed; full `npm test` passed with 52 passing and 2 pending. The larger master base was also exercised with 58 passing and 2 pending before scope was narrowed. Real Kubo GC/import concurrency verification belongs to the downstream backend integration; stub tests do not establish runtime GC safety by themselves.

## Downstream integration
The backend must propagate its existing RPC deadline and fence-loss cancellation into import options now that no separate pin RPC is made for these helpers. Update the dependency only after this commit is available, then run real Kubo tests before rollout. No production mutation is part of this library change.

This compatibility branch starts from the consumer's existing `420754a` and adds only the pinned-import patch. It excludes unrelated browser E2EE recovery/device changes from newer master, preserving the consumer's cryptographic helper behavior. The PR targets master using the shared ancestor; merging keeps its existing additions while the consumer can pin the reviewed compatibility commit. Kubo RPC access must permit recursive `pin.ls` for confirmation. Root pin metadata is not a full availability audit of arbitrary linked DAGs.
