# Origin and rights notice

This standalone export is licensed under MIT, Copyright (c) 2026 Katja Gries, with owner approval recorded on 29 October 2026. Existing source notices are preserved. The private GraceWays Education platform, student records, identity management and administration are excluded. No rights to that platform are proposed or granted here.

All copied files originate in the standalone math-feedback-demo-v0.1. Exact source digests and export changes are recorded in PROVENANCE.json. Original code comments are retained. No third-party runtime packages, external fonts or images are included.

Earlier derivation of the standalone demo (paths relative to the private platform, documentation only; no runtime access):

| Demo module | Earlier source | Original SHA-256 |
|---|---|---|
| src/learning-ai-provider.mjs | education-student-record-v0.1/src/learning-ai-provider.mjs | 6a57bd80ef75893366946494219bb2b0dc1db5799e02b489a940c0d7dfd825e2 |
| src/errors.mjs | grace-ai-education-v0.3-nebius/contracts/errors.mjs | 99a52c99a24c517955ebc5c3c99a06625438588be6f918e7060de8253d01bdbf |
| src/config.mjs | grace-ai-education-v0.3-nebius/provider/nebius/config.mjs | cc3dc92f92364353d9ea025aa386c980f452c9ab08e03bc69810c51ad17a7ad4 |

The fourth audited historical candidate, the platform learning-provider test file, is not included in this export; local math, workflow and hosting tests are included instead. Earlier internal reports and private absolute paths are excluded.

New export code: server.mjs provides jury authentication and session isolation; app.mjs adapts the local routing shell to an explicit origin; the proven standalone real provider is included; hosted live mode requires explicit dual-flag activation and an installation-wide persistent allowance. Browser changes add login expiry handling, session/logout information and persistent consumed-budget display. These changes do not modify the original demo or its running servers.

data/showcase.json contains the safe projection of one synthetic historical Nebius run, its original recorded decision and a separately labelled English translation. The mathematical verification covers the submitted equations and solution set; free-form AI explanations remain unverified, including claims about intermediate steps not submitted. The owner approved publication of this curated synthetic material as part of this export. No trademark rights or rights to excluded platform code are granted.

The optional src/nebius-provider.mjs is copied from the standalone demo, not another private platform module. tests/nebius-provider.test.mjs retains its existing transport-mock checks and adds export-specific persistent-budget checks. src/persistent-live-budget.mjs is new export-only code. Jury hosting remains simulation by default. The MIT license does not authorize use of the owner's provider credentials or credits.
