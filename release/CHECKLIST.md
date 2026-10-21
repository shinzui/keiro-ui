# Read-only release checklist (v0.1.0)

Executed in order by `docs/plans/18-package-the-console-for-deployment.md`; each item records its
evidence. `docs/plans/19-add-gated-operator-actions.md` may not start until the MasterPlan's
"Read-only release gate" box is checked.

- [x] EP-13 through EP-18 are Complete in the MasterPlan registry
      (`docs/masterplans/2-build-the-keiro-runtime-console.md`).
- [x] `bun run check && bun run test && bun run test:e2e` are green.
- [x] `bun run test:e2e:production` is green with tier 2 executed (not skipped), against the
      local stack and `dev/caddy/Caddyfile`.
- [x] No mutation path is reachable from the application:

  ```bash
  grep -rn -E "mutations\.(preview|execute)|/control/processors" apps/console/src && echo "FAIL: mutation path reachable" || echo "OK: no mutation path"
  ```

  prints `OK: no mutation path`, and `@keiro-ui/client-keiro/mutations` is imported nowhere in
  `apps/console/src`.

- [x] `CHANGELOG.md` has the `0.1.0` entry and `apps/console/package.json` says `0.1.0`.
- [x] `bun run release:pack` writes `release/keiro-ui-console-0.1.0.tar.gz`.
- [x] The tag exists: `git tag -a v0.1.0 -m "keiro runtime console 0.1.0 (read-only)"`.
- [x] The MasterPlan's "Read-only release gate" box is checked with the date, the tag, and the
      smoke transcript.

Reminder: the gated operator actions plan (EP-19) starts only after the last box is checked.

Executed 2026-10-21: tag `v0.1.0` on `ca2bb22`; `release/keiro-ui-console-0.1.0.tar.gz`
(`VERSION` `0.1.0+ca2bb22`, sha256
`b7409cda96ced06cb80f1f463afda8074f313ea6c06e801d6b691c8737810054`); production smoke
`9 passed` with tier 2 executed; `bun run test` 542 passed; Playwright smoke, shell, and screens
50 passed; `OK: no mutation path`.
