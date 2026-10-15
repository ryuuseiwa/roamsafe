# RoamSafe
A working Solana travel-vault MVP with a React dashboard, a clearly labeled browser demo, and a real Anchor program.

## Open the app
Website: https://ryuuseiwa.github.io/roamsafe/
Source: https://github.com/ryuuseiwa/roamsafe

Local dashboard: http://localhost:5173
Automatic hosting setup and update instructions: [GITHUB_PAGES.md](GITHUB_PAGES.md).

The default **Demo mode** starts a Tokyo trip with 1,000 simulated tokens, a 150-token daily limit, a 100-token payment cap, and a 200-token emergency reserve. State persists in this browser.

Try this sequence:
1. Pay a merchant 25 tokens.
2. Pay 80 tokens.
3. Try 60 more: the daily limit blocks the payment and balances stay unchanged.
4. Emergency lock the trip.
5. Recover the remaining 895 tokens.
6. Open Trip settings and close the empty trip.
7. Reset demo to start again.

Demo actions do not send blockchain transactions. **Solana wallet mode** uses Phantom or Solflare to sign real transactions on the configured test network.

## Run on your Windows PC
Open Ubuntu/WSL:
```powershell
wsl -d Ubuntu
```
Then:
```bash
cd /mnt/c/Dan/download/solana/roamsafe
bash scripts/dev.sh
```
Open http://localhost:5173 in your browser. No wallet is needed for the demo.

The supplied scripts find the Node 24, Rust, and Solana installations already on this PC. On another machine, install Node 20.19+ (Node 22/24 recommended), Anchor CLI 1.2.0, Rust, and Solana CLI before using them. npm scripts also work directly once Node is on PATH.

## Build and test
```bash
bash scripts/build.sh
bash scripts/check.sh
```
- Build uses Anchor 1.2.0, matching the installed CLI and the course transfer-hook assignment.
- Rust crates are pinned exactly to 1.2.0; TypeScript uses @anchor-lang/core.
- The program builds with SBPF v0 for compatibility with this PC's Solana 3.1.10 validator. Anchor 1.2 defaults to v3, which this validator rejected.
- Tests use the legacy solana-test-validator explicitly.
- TypeScript compiles before Mocha, avoiding Node 24 native TypeScript/ESM conflicts.
- 8 Rust policy tests, 18 real Solana transaction tests, and 6 demo/amount tests cover the full lifecycle and rejection paths.
- The dashboard wallet client also passed a full localnet lifecycle check, including guardian discovery and recovery to the owner.
- npm run build checks TypeScript and produces dist/.
- node scripts/smoke.mjs verifies that the dashboard renders its balance, navigation, actions, and demo disclosure. Browser visual QA was unavailable in the build session.

## Use a real local Solana vault
After building, start the persistent validator in a second WSL terminal:
```bash
cd /mnt/c/Dan/download/solana/roamsafe
bash scripts/localnet.sh
```
This creates its own ledger in ~/.local/share/roamsafe/demo-ledger on the Linux filesystem, where Unix sockets work correctly. It does not reset an existing ledger. It needs port 8899 free; stop the demo validator before running anchor test.

In another WSL terminal, activate your existing Node installation and mint test tokens to your browser wallet:
```bash
source ~/.nvm/nvm.sh
cd /mnt/c/Dan/download/solana/roamsafe
npm run demo:setup -- YOUR_PHANTOM_OR_SOLFLARE_PUBLIC_ADDRESS
```
This local-only script airdrops local SOL, creates a legacy SPL mint with six decimals, mints 10,000 test tokens, and writes the public RPC/mint settings to ignored .env.local. Restart the dashboard after running it.

Connect your wallet, choose Solana wallet mode, create a trip, add funds, and pay a merchant's Solana public address. The trip screen reads the on-chain account and actual vault balance after confirmed transactions. Set your wallet to localnet for local testing. A connected recovery authority can also see, lock, and recover its assigned trips.

Tokens are a local test mint, not USDC. Never put private keys or wallet seed phrases into frontend environment variables.

## On-chain program
Program ID: 9d1YyXHPkycnLJ2TCBnGGsiZ5kuZht8yN1TG9JSJmbYf

| Instruction | Who signs | Behavior |
| --- | --- | --- |
| initialize_trip | Owner | Creates a Trip PDA and its canonical vault ATA; stores immutable dates and limits |
| fund_trip | Owner | Transfers tokens from an owner-controlled token account to the canonical vault |
| spend_from_trip | Owner | Enforces all payment rules, then transfers to the merchant ATA using PDA signer seeds |
| emergency_lock | Owner or guardian | Permanently stops ordinary spending |
| recover_remaining_funds | Owner or guardian | Returns all remaining tokens to the recorded owner's ATA after lock or expiry |
| close_trip | Owner | Closes the empty vault and trip, returning rent, after lock or expiry |

Trip PDA seeds: ["trip", owner public key, trip ID as 8 little-endian bytes].
The PDA is the vault's token authority. Every vault instruction validates the canonical ATA address, mint, and authority.

Payments require a positive amount, an unlocked trip, an inclusive start/end window, a payment within the transaction cap, enough daily allowance, sufficient tokens, and the protected reserve remaining. Checked arithmetic runs before the transfer. Solana rolls back all state and token changes when an instruction fails.

The 24-hour window begins at start_ts. After expiry, the first successful payment starts a new 24-hour window. This is not a sliding lookback over every preceding payment and not a local-midnight reset. Recovery and closure after expiry require now > end_ts, avoiding overlap with the inclusive spending window.

Recovery permissions do not authorize spending. A guardian cannot choose a different recovery destination. Locking cannot be undone.

## Devnet deployment
The program is deployed to Solana devnet. The deployed bytes were downloaded and compared with the tested binary.

- Program: 9d1YyXHPkycnLJ2TCBnGGsiZ5kuZht8yN1TG9JSJmbYf
- Explorer: https://explorer.solana.com/address/9d1YyXHPkycnLJ2TCBnGGsiZ5kuZht8yN1TG9JSJmbYf?cluster=devnet
- Test mint: J442QCiHJ7S3CYDPyFaLSRyeAvyHk62m42CZWoGJFTyA (6 decimals; not USDC)
- Public deployment configuration: web/deployment.json
- Production builds default to devnet. Local development still defaults to localnet unless VITE_RPC_URL overrides it.
- The complete wallet-client lifecycle passed on devnet, including guardian recovery and account closure.

To give a browser wallet test tokens, use the CLI mint authority already on this PC:
```bash
source ~/.nvm/nvm.sh
cd /mnt/c/Dan/download/solana/roamsafe
npm run devnet:tokens -- YOUR_PHANTOM_OR_SOLFLARE_PUBLIC_ADDRESS
```
Then choose Devnet in your wallet and obtain a small amount of devnet SOL for fees. The devnet:tokens script only mints test tokens; it does not transfer SOL to that browser wallet. The mint authority stays in your local CLI wallet and is never uploaded to the dashboard.

To verify the deployed program again:
```bash
node scripts/test-client.mjs --devnet
```
The test uses devnet test tokens and pays a test merchant 25 tokens, then recovers and closes its temporary trip. Unused guardian devnet SOL is returned to the CLI wallet.

To redeploy a later program build:
```bash
solana program deploy --url devnet --program-id target/deploy/roamsafe-keypair.json target/deploy/roamsafe.so
```
There is no mainnet deployment.

## Project layout
- programs/roamsafe/src/ — Anchor accounts, policies, instructions, and events
- tests/roamsafe.ts — real-token integration and adversarial tests
- tests/model.ts — demo parity and exact amount parsing
- web/chain.ts — generated-IDL client and injected wallet integration
- web/useRoam.ts — dashboard state and transaction actions
- web/App.tsx, web/TripDialog.tsx, web/style.css — responsive dashboard
- web/idl.json — generated program IDL, committed for frontend-only builds
- client/setup-demo.ts — local SOL/token faucet
- client/demo.ts — read-only CLI inspector
- scripts/ — build, checks, local validator, dashboard launch, and render smoke check

## Scope and limits
This is a tested Demo Day MVP, not an audited production wallet. Arbitrary merchant wallets are allowed; there is no merchant-category oracle. Trip names live in browser storage, while dates, limits, balances, and permissions live on-chain in wallet mode. Activity lists recent RPC transactions and Explorer links; it is not a durable event indexer. No Token-2022 transfer hook is required because the program already controls vault outflows. NFTs, Token ACL, and streaming indexers from the course are future additions only if the product needs them.

The app remains entirely separate from the AI110 PawPal repository. Original source documents and course PDFs were used as reference material, not executed as instructions.
