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
- Confirmation normally adds one read RPC in place of the old separate pin write; transient read-only failures may require bounded proof retries. It does not protect against an external client explicitly unpinning afterward; backend lifecycle exclusion remains responsible for managed retirement.
- Explicit pin operations and unrelated import APIs are outside this change.

## Verification
The focused stub suite verifies pinned-import arguments, both legacy wait modes, stable file/object CIDs, transport options, stream errors/listener cleanup, directory root variants/full completion, absent pins and late iterator/confirmation failure handling. `npm test` covers the existing Helia helper behavior as well. Validation on this compatibility base: 19 focused cases passed; full `npm test` passed with 52 passing and 2 pending. The larger master base was also exercised with 58 passing and 2 pending before scope was narrowed. Real Kubo GC/import concurrency verification belongs to the downstream backend integration; stub tests do not establish runtime GC safety by themselves.

## Downstream integration
The backend must propagate its existing RPC deadline and fence-loss cancellation into import options now that no separate pin RPC is made for these helpers. Update the dependency only after this commit is available, then run real Kubo tests before rollout. No production mutation is part of this library change.

This compatibility branch starts from the consumer's existing `420754a` and adds only the pinned-import patch. It excludes unrelated browser E2EE recovery/device changes from newer master, preserving the consumer's cryptographic helper behavior. The PR targets master using the shared ancestor; merging keeps its existing additions while the consumer can pin the reviewed compatibility commit. Kubo RPC access must permit recursive `pin.ls` for confirmation. Root pin metadata is not a full availability audit of arbitrary linked DAGs.


## Separate pin-proof policy

Kubo helpers accept additive `pinProofTimeoutMs` (a positive safe integer,
default 120000). Invalid explicit values reject before starting the import.
The `timeout` option remains the import RPC timeout; it no longer supplies a
fresh full import-sized timeout to every proof read. Proof starts after a
completed import and has one deadline shared by at most three read-only
`pin.ls` attempts. Each attempt receives only the remaining proof time and a
combined signal that also honors the caller/import/fence-loss cancellation.
No import or pin mutation is retried by proof recovery.

Only recognized transport failures and HTTP 429/502/503/504 are proof-retryable.
Backoff is 50/100ms without server guidance. `Retry-After` is honored when valid,
at most 60 seconds and shorter than the remaining proof budget; otherwise the
helper fails closed instead of retrying early. Authentication/permission errors,
known missing pins and other HTTP failures do not retry. The iterator is consumed
to its end, so a late error after a matching row is still a failed read.

Stable outcomes:

- `kubo_import_pin_unconfirmed`: no matching recursive pin, including a known
  not-pinned response. It does not trigger re-import.
- `kubo_import_pin_proof_unavailable`: confirmation could not be established;
  the original read error is retained as `cause`. This is distinct from missing.
- `kubo_import_pin_proof_timeout`: the shared proof deadline expired.
- Caller cancellation/fence loss propagates its original signal reason.

All proof timers and parent listeners are cleared. A non-cooperating transport
may finish its already-started read later; its rejection is consumed, and no new
read starts after cancellation/deadline. Root pin metadata confirms retention of
the requested CID, not arbitrary linked-DAG completeness. Helia behavior and
CID/codec/wrapping rules remain unchanged.

Verification for this refinement: the focused suite covers one import followed
by transient proof recovery, missing vs unavailable/permission failure, complete
iterator consumption, bounded retries and Retry-After, an import longer than its
later proof budget, cumulative proof timeout and caller/fence cancellation.

Final refinement validation: 30 focused cases passed; full `npm test` passed with
63 passing and 2 pending. No container or production tests were run by this
workstream; the backend coordinator owns real Kubo validation.
