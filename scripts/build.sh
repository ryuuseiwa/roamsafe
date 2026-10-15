#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd "$(dirname "$0")/.."
npm install --no-audit --no-fund
mkdir -p target/deploy web
if [ ! -f target/deploy/roamsafe-keypair.json ]; then
  solana-keygen new --no-bip39-passphrase --silent -o target/deploy/roamsafe-keypair.json
fi
anchor keys sync
node scripts/sync-program.mjs
anchor build --arch v0
cp target/idl/roamsafe.json web/idl.json
