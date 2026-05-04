# AGENTS

## Scope

These instructions are repo-specific. Follow them when working inside `/Users/microwavedev/workspace/microwave-hub/geesome-libs`.

## Project Shape

- `geesome-libs` is shared library code used by other GeeSome repos.
- Changes here can affect `geesome-node` and `geesome-ui` even when those repos are not open in the current task.

## Workflow

- Use `npm install` for dependency setup.
- Run `npm test` after meaningful code changes.
- Preserve public helper behavior unless the user explicitly asked for a breaking contract change.
- If you change Fluence Aqua sources under `src/fluenceService/aqua/`, update generated outputs with `npm run compile-fluence`.

## Safety

- Prefer additive changes over silent behavioral rewrites in shared helpers.
- Call out downstream consumer impact whenever function signatures, serialization, hashing, crypto, or transport helpers change.
