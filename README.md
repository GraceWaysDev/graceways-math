# GraceWays Math

Standalone mathematics feedback demo. The deterministic checker alone verifies supported linear/quadratic equations, complete real solution sets and submitted equivalent steps. AI explanations remain unverified. UNKNOWN stops before provider dispatch. Feedback requires an explicit human decision before a deterministic follow-up task is released.

This standalone export is licensed under MIT, Copyright (c) 2026 Katja Gries; see LICENSE and NOTICE.md. The owner approved this license on 29 October 2026. No private Education packages are required or licensed by this export.

## Requirements and server configuration

Node.js 24 or newer; no package installation or third-party runtime dependencies.

Set these process environment variables using your operating system or hosting secret configuration:

| Variable | Setting |
|---|---|
| PUBLIC_ORIGIN | Exact HTTPS origin in production; for local use http://127.0.0.1:4197 |
| PORT | 4197 locally; Render supplies its port |
| DATA_DIR | Absolute writable persistent directory, separate from source files |
| JURY_ACCESS_CODE | Your randomly generated access code, at least 32 characters |
| SESSION_SECRET | Independent random secret, at least 32 characters; keep stable across restarts |

Do not put secret values in source code, frontend files, shell history or logs. Startup does not print credentials. Use synthetic inputs only. Each sign-in creates an isolated visitor session, valid for 24 hours. Log out on shared computers. Opening a new browser profile creates an independent session.

## Simulation — default jury mode

From the export root:

```powershell
node server.mjs --local
```

Open http://127.0.0.1:4197/login and enter your jury access code. Interactive responses are visibly labelled as simulation. The curated Nebius example is separately labelled as saved evidence and remains read-only, including its existing human decision. English translation is identified separately and the German original is preserved.

For production with HTTPS configured, run `node server.mjs` without `--local`. render.yaml uses this default. Merely setting a Nebius key never activates live mode. No key is needed or read in simulation.

## Optional Nebius mode — operator activation only

Use a separate deployment/process and its own persistent DATA_DIR, not the hosted jury simulation. Supply your own NEBIUS_API_KEY solely in the server process environment. No browser/API request can change the provider mode or credential. Keep the access code private: an authenticated visitor in this explicitly activated instance can consume its single shared allowance.

For local operation, with the variables above and your own key already configured:

```powershell
node server.mjs --local --nebius-live-once --acknowledge-credit-use
```

For an intentionally activated HTTPS server:

```text
node server.mjs --nebius-live-once --acknowledge-credit-use
```

Starting only constructs the adapter; it performs no catalogue or inference request and does not read the key. An authenticated user must explicitly press the live button. Both activation flags are required. Never add them to the jury Render start command by default.

Fixed model: `nvidia/nemotron-3-super-120b-a12b`. Official endpoints retained from the existing standalone adapter:

- GET https://api.tokenfactory.nebius.com/v1/models — at most once.
- POST https://api.tokenfactory.nebius.com/v1/chat/completions — at most once, only when the exact model is available.

Limits: max_tokens 2048; enable_thinking=false; catalogue timeout 15 seconds and body 200,000 bytes; inference timeout 25 seconds and body 100,000 bytes; request at most 45,000 characters; reserved token budget at most 30,000. No retry, alternate model, redirect following or simulation fallback. finish_reason must be stop. Binding, schema, usage, evidence quotes and checker verdict are validated. Optional NEBIUS_MODEL_ID cannot select a different model.

The server-wide allowance is claimed before dispatch and persisted in DATA_DIR/nebius-once.claim. Safe counts are stored separately; no request, key or authorization header enters these budget files. All sessions share this allowance. Restarting with the same DATA_DIR preserves consumption, including after failure or crash. Do not delete these markers, change DATA_DIR or create another instance to bypass an allowance. If a crash leaves no final count receipt, consumption is known but exact completed calls are unknown: stop and investigate; do not retry automatically.

Successful feedback is stored before display and remains HUMAN_REVIEW. Only the person viewing the full bound feedback may approve/reject it. That decision releases a deterministic follow-up without another inference call. The optional TASK adapter contract is included and mock-tested; the one-shot live workflow deliberately blocks additional TASK-generation calls.

## Offline tests and export verification

```powershell
node --import ./scripts/no-network.mjs --test tests/*.test.mjs
node scripts/verify-export.mjs
```

Provider tests inject synthetic credentials and transport mocks; they never read a real key or contact Nebius. Loopback HTTP is used only for server tests. Historical live evidence is not a live validation of this export. Existing historical decisions are never changed by tests.

## Hosting availability during judging

Keep the hosted jury preview, its persistent storage and a valid jury access code available continuously until the evaluation phase ends. Do not expire the shared access code, suspend/delete the service or remove the curated evidence before judging is complete. Individual 24-hour sessions may expire; jury members must be able to sign in again. The owner must confirm the official end date, fund hosting through that date and name a contact for access problems. Agree retention/deletion only after the judging period. No end date is inferred here.

See INSTALL.en.md for the deployment sequence and cost baseline. The MIT license is active for this export. No upload, deployment or live call has been performed.
