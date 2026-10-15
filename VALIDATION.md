# Validation
Verified on October 15, 2026, on this Windows PC using Ubuntu/WSL, Node 24.10.0, Anchor CLI 1.2.0, and Solana CLI 3.1.10.

- Anchor SBPF v0 build and generated IDL: passed.
- Rust policy tests: 8 passed, including checked overflows and the exact 24-hour reset boundary.
- Local Solana integration tests: 18 passed with real SPL token balances.
- Demo/amount tests: 6 passed.
- Dashboard wallet-client lifecycle: 7 checks passed against the local validator. This invokes web/chain.ts directly with local keypair signers: create/read, deposit/pay, cap rejection, guardian discovery, guardian lock, recovery to the original owner, and owner closure.
- TypeScript checks and Vite production build: passed.
- Dashboard render smoke check: passed.
- Local HTTP response: 200.
- AI110 PawPal repository: unchanged.
- Browser interaction and visual QA: not verified; no browser connection was available.
- Hosted publication: pending explicit permission to upload source to the private Sites repository. No application source was uploaded.
- Mainnet: no deployment or mainnet transactions.

Run scripts/test-client.mjs only while scripts/localnet.sh is running. It uses local test funds and the local CLI wallet. Stop that validator before running the isolated Anchor test suite.

The project is a Demo Day MVP and has not had an independent security audit.
