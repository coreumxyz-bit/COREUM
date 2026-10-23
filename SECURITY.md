# Security

Please report vulnerabilities privately — do not open a public issue.

- Use GitHub's private vulnerability reporting: **Security → Report a vulnerability** on this repository, or
- message us on X: [@0xcoreum](https://x.com/0xcoreum).

Include what you found, how to reproduce it and what an attacker could do with it. We will reply as soon as we can and
credit you once a fix is out, if you want.

## In scope

- The Worker API (`api/src`) — job handling, commit–reveal, ledger, admin routes, rate limits.
- The site's API gateway and server routes (`web/app/api`).
- The `CoreumVerdicts` contract (`api/contracts/CoreumVerdicts.sol`) and the sealing/anchoring scripts.
- `coreumd.mjs` and `verify-coreum.mjs`.

## Out of scope

- The models' answers themselves (a wrong verdict is a correctness issue — open a normal issue).
- Third-party services: Cloudflare, Vercel, GeckoTerminal, Robinhood Chain, Pons, X.
- Social engineering and denial-of-service.

We never DM first and never ask for keys, seed phrases or funds.
