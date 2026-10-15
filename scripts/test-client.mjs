import { createServer } from "vite";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { Wallet } = require("@anchor-lang/core");
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } = require("@solana/web3.js");
const { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount } = require("@solana/spl-token");
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(homedir() + "/.config/solana/id.json", "utf8"))));
const guardian = Keypair.generate();
const merchant = Keypair.generate();
const ownerWallet = new Wallet(payer), guardianWallet = new Wallet(guardian);
const useDevnet = process.argv.includes("--devnet");
if (useDevnet) process.env.VITE_RPC_URL = "https://api.devnet.solana.com";
const data = new Map();
globalThis.window = {};
globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", ssr: { noExternal: ["@anchor-lang/core"] } });
try {
  const chain = await server.ssrLoadModule("/web/chain.ts");
  const connection = new Connection(useDevnet ? "https://api.devnet.solana.com" : "http://127.0.0.1:8899", "confirmed");
  if (useDevnet) {
    await sendAndConfirmTransaction(connection, new Transaction().add(SystemProgram.transfer({
      fromPubkey: payer.publicKey, toPubkey: guardian.publicKey, lamports: 20_000_000
    })), [payer]);
  } else {
    for (const key of [payer.publicKey, guardian.publicKey]) {
      const sig = await connection.requestAirdrop(key, 2_000_000_000);
      await connection.confirmTransaction(sig, "confirmed");
    }
  }
  const mint = useDevnet
    ? new PublicKey(JSON.parse(readFileSync("web/deployment.json", "utf8")).mint)
    : await createMint(connection, payer, payer.publicKey, null, 6);
  const ownerAta = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
  await mintTo(connection, payer, mint, ownerAta.address, payer, 1_000_000_000n);
  const ownerBalanceBefore = (await getAccount(connection, ownerAta.address)).amount;
  const now = Math.floor(Date.now() / 1000);
  await chain.createTrip(ownerWallet, { name: "Client smoke trip", mint: mint.toBase58(), startTs: now - 60, endTs: now + 3600,
    dailyLimit: 150_000_000n, maxTxAmount: 100_000_000n, emergencyReserve: 200_000_000n, recoveryAuthority: guardian.publicKey.toBase58() });
  let trip = (await chain.loadTrips(ownerWallet)).find(t => t.name === "Client smoke trip");
  assert.ok(trip); console.log("PASS: wallet client creates and reads a real Trip PDA.");
  await chain.action(ownerWallet, trip, "fund", 1_000_000_000n);
  await chain.action(ownerWallet, trip, "pay", 25_000_000n, merchant.publicKey.toBase58());
  trip = (await chain.loadTrips(ownerWallet)).find(t => t.address === trip.address);
  assert.equal(trip.balance, "975000000"); console.log("PASS: funding and merchant payment update actual vault balance.");
  await assert.rejects(() => chain.action(ownerWallet, trip, "pay", 101_000_000n, merchant.publicKey.toBase58()), /MaxTransactionExceeded/);
  console.log("PASS: client surfaces the program's payment cap rejection.");
  const guardianTrip = (await chain.loadTrips(guardianWallet)).find(t => t.address === trip.address);
  assert.ok(guardianTrip); console.log("PASS: guardian finds its assigned trip.");
  await chain.action(guardianWallet, guardianTrip, "lock");
  await assert.rejects(() => chain.action(ownerWallet, trip, "pay", 5_000_000n, merchant.publicKey.toBase58()), /TripLocked/);
  console.log("PASS: guardian lock stops owner payments.");
  await chain.action(guardianWallet, guardianTrip, "recover");
  assert.equal((await getAccount(connection, ownerAta.address)).amount, ownerBalanceBefore - 25_000_000n);
  console.log("PASS: guardian recovery sends tokens to the original owner.");
  await chain.action(ownerWallet, trip, "close");
  assert.equal((await chain.loadTrips(ownerWallet)).find(t => t.address === trip.address), undefined);
  console.log("PASS: owner closes the empty trip through the wallet client.");
  if (useDevnet) {
    const remaining = await connection.getBalance(guardian.publicKey);
    if (remaining > 10_000) await sendAndConfirmTransaction(connection, new Transaction().add(SystemProgram.transfer({
      fromPubkey: guardian.publicKey, toPubkey: payer.publicKey, lamports: remaining - 5_000
    })), [guardian]);
    console.log("PASS: unused guardian devnet SOL returned to the CLI wallet.");
  }
} finally { await server.close(); }
