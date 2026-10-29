# Exact publication candidate allowlist

Only these 32 files belong to the current export. The previous simulation-only ZIP is superseded by the optional-Nebius candidate. manifest.json hashes every other file, but not itself.

| Path | Purpose |
|---|---|
| `.gitignore` | Distribution metadata / documentation |
| `FILE-LIST.md` | Distribution metadata / documentation |
| `INSTALL.en.md` | Distribution metadata / documentation |
| `LICENSE` | Active MIT license, Copyright (c) 2026 Katja Gries |
| `NOTICE.md` | Distribution metadata / documentation |
| `PROVENANCE.json` | Distribution metadata / documentation |
| `README.md` | Distribution metadata / documentation |
| `app.mjs` | Server-only runtime |
| `data/showcase.json` | Authenticated read-only historical synthetic evidence |
| `manifest.json` | Distribution metadata / documentation |
| `package.json` | Distribution metadata / documentation |
| `public/replay-app.mjs` | Browser asset (no key or provider transport) |
| `public/replay.html` | Browser asset (no key or provider transport) |
| `public/style.css` | Browser asset (no key or provider transport) |
| `render.yaml` | Unapplied simulation-default hosting configuration |
| `run-store.mjs` | Server-only runtime |
| `scripts/no-network.mjs` | Offline test / verification tooling |
| `scripts/verify-export.mjs` | Offline test / verification tooling |
| `server.mjs` | Server-only runtime |
| `src/admission.mjs` | Server-only runtime |
| `src/binding.mjs` | Server-only runtime |
| `src/config.mjs` | Server-only runtime |
| `src/errors.mjs` | Server-only runtime |
| `src/learning-ai-provider.mjs` | Server-only runtime |
| `src/math.mjs` | Server-only runtime |
| `src/nebius-provider.mjs` | Optional server-only real adapter; explicit activation required |
| `src/persistent-live-budget.mjs` | Server-only persistent one-shot guard |
| `src/workflow.mjs` | Server-only runtime |
| `tests/hosting.test.mjs` | Offline test / verification tooling |
| `tests/math.test.mjs` | Offline test / verification tooling |
| `tests/nebius-provider.test.mjs` | Offline test / verification tooling |
| `tests/workflow.test.mjs` | Offline test / verification tooling |

Excluded: private Education packages, original artifact folders and internal reports, environment/credential files, historical attempt directories and backups, legacy UI, node_modules and runtime session data. Only the safe curated synthetic projection is included. The standalone Nebius adapter and its mock tests are now explicitly included; no existing live-launch scripts or private adapter modules are copied. Hosted jury startup remains simulation-only by default.
