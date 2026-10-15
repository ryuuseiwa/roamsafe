#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd "$(dirname "$0")/.."
# Keep Unix sockets and validator data on the Linux filesystem.
ledger="${ROAMSAFE_LEDGER:-$HOME/.local/share/roamsafe/demo-ledger}"
mkdir -p "$ledger"
exec solana-test-validator --quiet --ledger "$ledger" --rpc-port 8899 --bind-address 127.0.0.1 --bpf-program "$(node -p 'require("./web/idl.json").address')" target/deploy/roamsafe.so
