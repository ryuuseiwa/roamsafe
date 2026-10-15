import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getMint } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import idl from "../web/idl.json";

async function main() {
  // Fixed devnet endpoint: this script cannot use mainnet.
  const rpc = "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");
  const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.ANCHOR_WALLET ?? homedir() + "/.config/solana/id.json", "utf8"))));
  const recipient = process.argv[2] ? new PublicKey(process.argv[2]) : payer.publicKey;
  const configFile = "web/deployment.json";
  const config = existsSync(configFile) ? JSON.parse(readFileSync(configFile, "utf8")) : {};
  let mint: PublicKey;
  if (config.mint) {
    mint = new PublicKey(config.mint);
    const info = await getMint(connection, mint);
    if (info.decimals !== 6 || !info.mintAuthority?.equals(payer.publicKey)) throw new Error("The configured mint must have 6 decimals and this CLI wallet as mint authority.");
  } else {
    mint = await createMint(connection, payer, payer.publicKey, null, 6);
    // Persist the public mint immediately so retries reuse it.
    writeFileSync(configFile, JSON.stringify({ network: "devnet", rpcUrl: rpc, programId: idl.address, mint: mint.toBase58(), decimals: 6 }, null, 2) + "\n");
  }
  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, recipient);
  const signature = await mintTo(connection, payer, mint, ata.address, payer, 10_000_000_000n);
  console.log("Devnet test mint:", mint.toBase58());
  console.log("Funded wallet:", recipient.toBase58(), "with 10,000 test tokens.");
  console.log("Mint transaction:", signature);
  console.log("Use devnet SOL for transaction fees. These tokens are not USDC.");
}
main().catch(err => { console.error(err); process.exitCode = 1; });
