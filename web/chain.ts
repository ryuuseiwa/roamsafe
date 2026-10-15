import { AnchorProvider, BN, Program, Idl } from "@anchor-lang/core";
import { Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getAccount, getMint, getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idl from "./idl.json";
import deployment from "./deployment.json";
import { Trip } from "./model";

export type InjectedWallet = {
  publicKey: PublicKey | null;
  connect(): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
  on?(event: string, callback: (...args: any[]) => void): void;
  removeListener?(event: string, callback: (...args: any[]) => void): void;
};
const env = (import.meta as any).env;
export const rpc: string = env.VITE_RPC_URL || (env.PROD ? deployment.rpcUrl : "http://127.0.0.1:8899");
export const configuredMint: string = env.VITE_TOKEN_MINT || (env.PROD ? deployment.mint : "");
export const programId = idl.address;
export function injected(): InjectedWallet | undefined {
  return (window as any).phantom?.solana ?? (window as any).solflare ?? (window as any).solana;
}
export function client(wallet: InjectedWallet) {
  if (!wallet.publicKey) throw new Error("Connect a Solana wallet first.");
  if (!/localhost|127\.0\.0\.1|devnet/.test(rpc)) throw new Error("This MVP supports localnet and devnet only.");
  const connection = new Connection(rpc, "confirmed");
  const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed", preflightCommitment: "confirmed" });
  const program: any = new Program(idl as Idl, provider);
  return { connection, provider, program, owner: wallet.publicKey };
}
const common = { tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId };
export function explanation(err: any): string {
  if (err?.error?.errorMessage) return err.error.errorMessage;
  if (err?.code === 4001) return "You cancelled the transaction in your wallet.";
  return err?.message ?? String(err);
}
export async function loadTrips(wallet: InjectedWallet): Promise<Trip[]> {
  const { connection, program, owner } = client(wallet);
  const info = await connection.getAccountInfo(program.programId);
  if (!info?.executable) throw new Error("RoamSafe is not deployed on this network. Run the local setup steps in README.md.");
  const groups = await Promise.all([8, 40].map(offset =>
    program.account.trip.all([{ memcmp: { offset, bytes: owner.toBase58() } }])
  ));
  const accounts = [...new Map(groups.flat().map((row: any) => [row.publicKey.toBase58(), row])).values()];
  return Promise.all(accounts.map(async ({ publicKey, account: a }: any) => {
    const vault = await getAssociatedTokenAddress(a.mint, publicKey, true);
    const balance = (await getAccount(connection, vault)).amount;
    return {
      address: publicKey.toBase58(), vault: vault.toBase58(), name: localStorage.getItem("roamsafe:name:" + publicKey.toBase58()) || "My trip",
      owner: a.owner.toBase58(), recoveryAuthority: a.recoveryAuthority.toBase58(), mint: a.mint.toBase58(),
      tripId: a.tripId.toString(), startTs: a.startTs.toNumber(), endTs: a.endTs.toNumber(),
      dailyLimit: a.dailyLimit.toString(), maxTxAmount: a.maxTxAmount.toString(), emergencyReserve: a.emergencyReserve.toString(),
      spentToday: a.spentToday.toString(), totalSpent: a.totalSpent.toString(), dayWindowStart: a.dayWindowStart.toNumber(),
      locked: a.locked, balance: balance.toString()
    } satisfies Trip;
  })).then(trips => trips.sort((a, b) => Number(b.tripId) - Number(a.tripId)));
}
export async function createTrip(wallet: InjectedWallet, input: {
  name: string; mint: string; startTs: number; endTs: number; dailyLimit: bigint; maxTxAmount: bigint; emergencyReserve: bigint; recoveryAuthority: string
}) {
  const { connection, program, owner } = client(wallet);
  const mint = new PublicKey(input.mint);
  const mintState = await getMint(connection, mint);
  if (mintState.decimals !== 6) throw new Error("Choose a legacy SPL mint with 6 decimals.");
  const tripId = new BN(Date.now());
  const [trip] = PublicKey.findProgramAddressSync([Buffer.from("trip"), owner.toBuffer(), tripId.toArrayLike(Buffer, "le", 8)], program.programId);
  const vault = await getAssociatedTokenAddress(mint, trip, true);
  const signature = await program.methods.initializeTrip({
    tripId, startTs: new BN(input.startTs), endTs: new BN(input.endTs),
    dailyLimit: new BN(input.dailyLimit.toString()), maxTxAmount: new BN(input.maxTxAmount.toString()),
    emergencyReserve: new BN(input.emergencyReserve.toString()),
    recoveryAuthority: input.recoveryAuthority ? new PublicKey(input.recoveryAuthority) : owner
  }).accountsStrict({ owner, mint, trip, vault, ...common }).rpc();
  localStorage.setItem("roamsafe:name:" + trip.toBase58(), input.name);
  return signature as string;
}
export async function action(wallet: InjectedWallet, t: Trip, kind: "fund" | "pay" | "lock" | "recover" | "close", amount = 0n, recipient = ""): Promise<string> {
  const { program, owner } = client(wallet);
  const trip = new PublicKey(t.address), vault = new PublicKey(t.vault), mint = new PublicKey(t.mint);
  const recordedOwner = new PublicKey(t.owner);
  const ownerAta = await getAssociatedTokenAddress(mint, recordedOwner);
  if (kind === "fund") {
    return program.methods.fundTrip(new BN(amount.toString())).accountsStrict({ owner, trip, vault, ownerAta, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
  }
  if (kind === "pay") {
    const merchant = new PublicKey(recipient);
    const merchantAta = await getAssociatedTokenAddress(mint, merchant);
    return program.methods.spendFromTrip(new BN(amount.toString())).accountsStrict({ owner, trip, vault, mint, merchant, merchantAta, ...common }).rpc();
  }
  if (kind === "lock") return program.methods.emergencyLock().accountsStrict({ authority: owner, trip }).rpc();
  if (kind === "recover") return program.methods.recoverRemainingFunds().accountsStrict({ authority: owner, owner: recordedOwner, trip, vault, mint, ownerAta, ...common }).rpc();
  return program.methods.closeTrip().accountsStrict({ owner, trip, vault, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
}
export function explorer(signature: string) {
  return "https://explorer.solana.com/tx/" + signature + (rpc.includes("devnet") ? "?cluster=devnet" : "?cluster=custom&customUrl=" + encodeURIComponent(rpc));
}
