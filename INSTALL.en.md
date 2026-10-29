# GraceWays Math: private jury deployment candidate

Prepared 29 October 2026. Nothing has been uploaded or deployed. The MIT license is active for this standalone export, Copyright (c) 2026 Katja Gries. This export is a self-contained Node application with no third-party dependencies. It is not a static website.

## Local verification

Use Node 24 or newer. No installation is required. From this folder run:

```powershell
node --import ./scripts/no-network.mjs --test tests/*.test.mjs
```

Tests use synthetic credentials and responses, temporary directories and loopback HTTP only. They never load a Nebius key. Test approvals apply only to newly generated synthetic test runs.

To preview locally, set PUBLIC_ORIGIN to http://127.0.0.1:4197, PORT to 4197 and DATA_DIR to an absolute, separate local runtime directory. Set JURY_ACCESS_CODE and SESSION_SECRET to two independent, randomly generated values of at least 32 characters in the launching process environment. Do not put them in source files, terminal history or screenshots. Then run:

```powershell
node server.mjs --local
```

Open http://127.0.0.1:4197/login. The local flag allows HTTP only on 127.0.0.1; it must never be used on Render. No existing live server needs to be stopped.

## Deployment procedure — execute only after authorization

1. The owner approved MIT licensing and publication of this export on 29 October 2026. Confirm the hosting budget, jury access-code distribution and retention period before deployment. Do not upload the parent demo folder.
2. Create a dedicated private source repository containing only this export after separate upload authorization. A public repository is not required for Render hosting.
3. In Render create a Node web service linked to that repository. Use Frankfurt, one 0.5c-512mb instance, build `node --check server.mjs`, start `node server.mjs`, Node 24, health path `/healthz`. Disable automatic deploys. The supplied render.yaml describes these settings; applying a Blueprint itself creates/deploys resources, so do not apply it before approval.
4. Attach a 1 GB persistent disk at `/var/data`; set DATA_DIR=/var/data/graceways-math. Do not mount over the application or the bundled showcase. No database is required.
5. Set PUBLIC_ORIGIN to the exact assigned HTTPS origin, e.g. https://graceways-math-jury.onrender.com, with no trailing slash. Set JURY_ACCESS_CODE to a password-manager-generated random value of at least 32 characters. Generate a separate SESSION_SECRET of at least 32 characters in Render. Do not configure a Nebius key. Keep these values out of logs and build arguments.
6. Deploy manually once. Render terminates TLS; the Node listener binds 0.0.0.0 and PORT. Only the configured Host is accepted, and every POST requires an exact Origin match. Forwarded headers are never used to choose an origin. Direct access to the internal plaintext listener must remain restricted by the hosting platform. Choose one canonical domain; aliases fail closed until configuration is deliberately changed.
7. Verify HTTPS redirect/certificate, login, secure cookie, independent sessions in two browser profiles, read-only historical evidence, one synthetic review and persistence after a controlled restart. These Render-specific checks have NOT been performed locally. Confirm health checks use the configured host. Share the HTTPS URL and jury code through an appropriate private channel.

## Data, access and limits

Only the allowlisted browser files are served. data/showcase.json is server-side and is exposed through an authenticated, read-only projection. It contains the existing synthetic Nebius response and existing approval, not a new provider result. The English translation is labelled separately; the unchanged German response remains visible. No historical approval endpoint exists. Visitors can only review their own newly created simulations.

Sessions use signed, opaque 24-hour cookies (Secure, HttpOnly, SameSite=Strict in production), separate persistent run directories and revoked-session markers on logout. Reopening the same browser session retains its runs across server restarts. Different browser profiles/sign-ins have different sessions. Tabs sharing a cookie are one session; on a shared computer sign out or use separate profiles. There is no identity-based teacher authentication: simulation approvals are demonstration actions, not verified institutional signatures.

Limits: 20 login attempts per minute globally; 500 allocated sessions; 100 successful simulations per session; 200 POST requests per cached session; 12 KB workflow bodies; 24-hour session validity. The in-memory POST/login counters reset on process restart; the 100 stored-run cap persists. None of these limits automatically enables live inference. The optional operator-activated adapter has a separate persistent installation-wide one-shot allowance. Storage errors fail closed. Expired/revoked session files remain on disk for operator-controlled retention; no automatic purge has been implemented. Agree an end date and securely remove the hosted runtime data at event closure. Do not submit real student information.

One persistent-disk instance is required. No horizontal scaling. Disk snapshots are an operational recovery aid, not an independently verified backup. Backups, retention, restoration and disk-capacity alerts remain operator responsibilities. Disk-based redeployments can briefly interrupt service.

## Costs and decisions

Official Render prices checked 29 October 2026: Hobby workspace $0/month, 0.5c-512mb web service $7/month, disk $0.25/GB/month. One service + 1 GB disk therefore has a $7.25/month baseline before taxes and overages. Hobby includes 5 GB outbound bandwidth; excess is $0.15/GB. Pro, if chosen or required for the account, adds $25/month. The default jury configuration generates no Nebius inference cost. Optional, explicitly activated live operation uses the operator's own credits; see README.md. A custom domain is optional and its registration is separate. Reconfirm the order summary before purchase.

Sources: https://render.com/pricing ; https://render.com/docs/disks ; https://render.com/docs/blueprint-spec .

MIT licensing and publication of this standalone export are approved, with Katja Gries as copyright holder. Open operational decisions: hosting budget and account/workspace eligibility; final hostname; access-code distribution; session-data retention and backup owner; deployment authorization. No private platform rights are granted.

## Optional source-code live mode and judging continuity

The standalone Nebius adapter is now included, but render.yaml still starts simulation only. See README.md for explicit dual-flag activation using the operator's own server-side key. Do not set a key or activate live mode in the default jury deployment. Keep hosting, storage, the curated evidence and jury access available through the confirmed end of judging; provide renewed sign-in after individual sessions expire. Confirm that date and fund the service before deployment.
