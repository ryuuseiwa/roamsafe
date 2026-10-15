import * as anchor from "@anchor-lang/core";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

async function main() {
  const rpc = process.env.ANCHOR_PROVIDER_URL ?? "http://127.0.0.1:8899";
  if (!/localhost|127\.0\.0\.1/.test(rpc)) throw new Error("This faucet script only operates on localnet.");
  const connection = new Connection(rpc, "confirmed");
  const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.ANCHOR_WALLET ?? homedir() + "/.config/solana/id.json", "utf8"))));
  const recipient = process.argv[2] ? new PublicKey(process.argv[2]) : payer.publicKey;
  if (await connection.getBalance(payer.publicKey) < 1_000_000_000) {
    const sig = await connection.requestAirdrop(payer.publicKey, 10_000_000_000);
    await connection.confirmTransaction(sig, "confirmed");
  }
  if (!recipient.equals(payer.publicKey)) {
    const sig = await connection.requestAirdrop(recipient, 2_000_000_000);
    await connection.confirmTransaction(sig, "confirmed");
  }
  const mint = await createMint(connection, payer, payer.publicKey, null, 6);
  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, recipient);
  await mintTo(connection, payer, mint, ata.address, payer, 10_000_000_000n);
  writeFileSync(".env.local", "VITE_RPC_URL=" + rpc + "\nVITE_TOKEN_MINT=" + mint.toBase58() + "\n");
  console.log("Local test mint:", mint.toBase58());
  console.log("Funded wallet:", recipient.toBase58(), "with 10,000 test tokens.");
  console.log("Restart npm run dev to load this mint. No mainnet funds are involved.");
}
main().catch(err => { console.error(err); process.exitCode = 1; });
