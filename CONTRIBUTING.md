# Contributing to Coreum

Thanks for helping. Coreum is small and early, so focused, well-explained changes are the most useful.

## Good first contributions

- **Run a community core** and report what breaks — models, hardware, timing (`node coreumd.mjs serve`).
- **Run the verifier** (`node web/public/verify-coreum.mjs`) and open an issue for anything that does not check out.
- **Token Check facts** — better on-chain signals or sources in `web/lib/token.ts`.
- **Prompt and parsing** — clearer core prompts or more robust answer parsing in `api/src/verify.js`.
- **Docs** — anything on the site or in this repo that overstates what is proven. Accuracy beats hype here.

## How to propose a change

1. Open an issue first for anything larger than a small fix, so we can agree on the approach.
2. Fork, branch from `main`, keep the change focused.
3. Make sure the site builds (`cd web && npm run build`) and the Worker parses (`node --check api/src/index.js api/src/verify.js`).
4. Explain in the PR what changed, why, and how you tested it.

## Ground rules

- Never commit secrets, keys or `.env` files.
- Do not weaken commit–reveal, the ledger hash chain or the contract's write rules without a clear write-up.
- Claims on the site must match `/evidence`. If a feature is not live, it says "not yet".
- Be kind in issues and reviews.

By contributing you agree your contributions are licensed under the [MIT License](LICENSE).
