# pgmq-inspect OpenAPI document

`pgmq-inspect.openapi.json` is a verbatim copy of `pgmq-inspect/test/golden/openapi.json` from
`mori://shinzui/pgmq-hs` at commit `d6750a6` (`pgmq-inspect` 0.1.0.0), copied 2026-10-21. It is
byte-identical to the document the running server serves at `/openapi.json`.

Refresh: copy the golden again, run `bun run --filter @keiro-ui/client-pgmq generate` (writes
`src/generated/schema.d.ts`), run the package's tests (the parity test keeps the zod mirrors
honest), and update the commit and date above.
