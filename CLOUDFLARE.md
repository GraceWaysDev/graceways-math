# Separate Cloudflare trial — 30 October 2026

This is a local trial, not a deployed Cloudflare service. The published Node main branch is unchanged. No paid service, remote resource, real credential or provider call was used for this trial.

## Design

- `cloudflare/worker.mjs`: Worker entrypoint and SQLite-backed `MathDemo` Durable Object.
- `cloudflare/handler.mjs`: authentication, bounded request parsing, session isolation, read-only historical evidence and simulation routes.
- `cloudflare/sql-store.mjs`: immutable run snapshots and separate immutable decisions in SQLite. Digests and workflow checks are retained.
- The mathematics checker, binding, workflow, Nebius adapter, browser files and historical synthetic evidence are unchanged.
- All demo requests use a single Durable Object namespace name. Requests are serialized; session counters, login throttling, display tickets, logout revocation and decisions are persisted. This bounded jury demo is not a scalable school platform.
- Static assets run through the Worker first. Only the stylesheet and login/health endpoints are public; authenticated UI assets are explicitly allowlisted. Source files, SQLite state and raw evidence files are not static assets.
- The Cloudflare entrypoint cannot activate live inference, even if a Nebius key were supplied. Do not supply a Nebius key. The original opt-in Node entrypoint and adapter remain in this repository for reproducible live-mode setup.
- Simulation decisions are test actions, not authenticated institutional teacher signatures. Synthetic data only.

## Actual validation

1. 103/103 offline Node tests passed: the existing 98 plus five SQLite/Cloudflare integration tests. Tests include session separation, approval binding, immutable decisions, corruption rejection, ticket invalidation, logout, expiry, persisted login throttling and reconstruction from a file-backed SQLite database.
2. Wrangler 4.156.0 dry-run bundled the Worker successfully, including three UI assets. No remote upload occurred.
3. Miniflare 5.20261023.3-beta / workerd 1.20261023.1 ran the generated Worker bundle locally with SQLite Durable Object storage and an asset-service binding. External requests were blocked by a test outbound service.
4. HTTP checks passed in workerd: login, unauthorized requests, two isolated sessions, correct quadratic simulation, saved review display, synthetic approval, follow-up, repeated-review rejection, UI assets and UNKNOWN blocking.
5. The local workerd runtime was terminated and reconstructed with the same persistence directory. The session cookies, saved approval, follow-up and separation from the other session still worked. The curated historical Nebius record was unchanged.

Initial local tooling attempts failed because this environment restricts network-interface inspection, the first compatibility date exceeded the local runtime, and the initial Miniflare persistence options were incomplete. Those failures were corrected in the test harness; they were not counted as successful tests. The final configuration uses the locally tested compatibility date 2026-10-23.

Not yet verified: remote deployment, real account plan/remaining quotas, production HTTPS/cookies, remote persistence and actual Cloudflare CPU/resource enforcement. No browser visual re-test was performed in this environment; the existing UI files are byte-identical.

## Local trial on your computer

Use Node 24 or newer. The application's runtime still has no third-party npm dependencies. Wrangler is a development/deployment tool only. Use a separately configured terminal and port 8787; leave existing live servers and budgets untouched.

Run the offline tests first:

```powershell
node --import ./scripts/no-network.mjs --test tests/*.test.mjs
node scripts/verify-export.mjs
```

Create a local `.dev.vars` file in this trial folder using your editor. Do not commit it. Populate `JURY_ACCESS_CODE` and `SESSION_SECRET` with two independent random values of at least 32 characters, and these local settings:

```text
PUBLIC_ORIGIN="http://127.0.0.1:8787"
ALLOW_LOCAL_HTTP="true"
JURY_ACCESS_CODE="REPLACE_WITH_RANDOM_LOCAL_VALUE_AT_LEAST_32_CHARACTERS"
SESSION_SECRET="REPLACE_WITH_A_DIFFERENT_RANDOM_LOCAL_VALUE_AT_LEAST_32_CHARACTERS"
```

Then run:

```powershell
npx wrangler@4.156.0 dev --local --ip 127.0.0.1 --port 8787
```

Open `http://127.0.0.1:8787/login`. Test one simulation and a synthetic approval, stop only this trial process, start it again and reopen the same browser session. Do not delete its local Wrangler persistence folder between those checks. No Nebius key is needed.

## Remote deployment preparation — not performed

Use a new Worker named `graceways-math-trial`, with its own new SQLite Durable Object namespace. Do not attach existing Animals, Education or United Canvas storage.

1. Verify the actual Cloudflare account, Workers plan and available SQLite Durable Object allowance. Stay within the existing free allowances; do not activate a paid plan or new billing without the owner's decision.
2. Set `PUBLIC_ORIGIN` in `wrangler.jsonc` to the exact assigned HTTPS origin, and keep `ALLOW_LOCAL_HTTP` false. The placeholder origin deliberately makes an unconfigured deployment unusable.
3. Supply separate production `JURY_ACCESS_CODE` and `SESSION_SECRET` secrets through the provider's secret configuration. Do not reuse the local test values or put them in code or screenshots. Do not configure `NEBIUS_API_KEY`.
4. Confirm the intended account, Worker name, namespace migration and cost implications before deploying. `npx wrangler@4.156.0 deploy --dry-run` builds without deploying; `deploy` without that option creates remote resources and publishes the trial.
5. After an authorized deployment, test HTTPS, secure cookies, login, independent browser profiles, immutable historical evidence, a synthetic approval, persistence after redeployment and logout. Verify the free-plan limits against measured usage. Do not claim free production hosting has been confirmed until the account and those checks are complete.

Keep jury access and the saved evidence available through the end of judging. Session expiry after 24 hours does not revoke the shared sign-in code. No automatic deletion has been added: stored simulation data must be removed deliberately after the agreed retention period. The total allocation is capped at 500 sessions and 100 stored simulations/200 workflow POSTs per session; reaching a limit blocks requests rather than enabling another mode.

## Official references

- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/durable-objects/get-started/
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/workers/platform/pricing/

This trial does not change the public MIT license scope: only this standalone demo is covered. The private Education platform remains excluded.
