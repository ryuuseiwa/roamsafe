# Course alignment
The supplied course PDFs are background references for the requested RoamSafe implementation, not additional build instructions.

| Course topic | RoamSafe implementation |
| --- | --- |
| Week 2 Day 1: SPL / Token-2022, mints, ATAs, base units | Legacy SPL mint and canonical vault ATA; integer six-decimal amounts |
| Week 2 Day 2 and homework: transfer hooks, Token ACL, rate limits, rejected transfers | Payment rules enforced before the vault CPI; failure tests verify unchanged balances; no extra hook needed for a PDA-controlled vault |
| Week 3 Day 1 guide: Pinocchio escrow, make/take/cancel | Same program-controlled custody and PDA signing model; Anchor retained from the starter |
| Week 3 Day 2 guide: Anchor fundraiser with payout/refund | Trip lifecycle, program-controlled vault, recovery, account closure, TypeScript/Mocha tests |
| Week 4 Day 1: Metaplex Core, collections, plugins | NFT functionality is outside the travel-wallet MVP |
| Week 4 Day 2: IDLs, Codama and generated clients | Built IDL bundled with the dashboard; client account maps match deployed instructions |
| Week 7 Day 2: events, RPC backfill, Yellowstone/Geyser | Lifecycle events emitted on-chain; recent signatures shown by RPC; durable indexing deferred |

Anchor 1.2.0 is installed on this PC and appears in the transfer-hook assignment. Crates and TS client were aligned to that version, replacing the starter's older CPI API and renamed JS package. The installed Solana validator needs an SBPF v0 build.

Some reference PDFs contain image-rendered text. Their opening pages were visually inspected in addition to extracting the lecture text.
