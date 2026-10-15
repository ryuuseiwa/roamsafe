#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd "$(dirname "$0")/.."
cargo test --lib
anchor test --validator legacy --skip-build
npm run build
