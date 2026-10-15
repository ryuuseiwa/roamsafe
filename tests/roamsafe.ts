import * as anchor from "@anchor-lang/core";
import { assert } from "chai";
import {
  createMint, createAccount, getAccount, getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

describe("RoamSafe · real SPL transfers", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program: any = anchor.workspace.Roamsafe;
  const owner = provider.wallet.publicKey;
  const payer = (provider.wallet as anchor.Wallet).payer;
  const guardian = Keypair.generate();
  const stranger = Keypair.generate();
  const merchant = Keypair.generate().publicKey;
  const unit = 1_000_000;
  const bn = (n: number) => new anchor.BN(n);
  let mint: PublicKey, ownerAta: PublicKey, merchantAta: PublicKey;
  let sequence = Date.now();
  const common = { tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId };
  type T = { trip: PublicKey; vault: PublicKey };
  const now = () => Math.floor(Date.now() / 1000);

  before(async () => {
    mint = await createMint(provider.connection, payer, owner, null, 6);
    ownerAta = (await getOrCreateAssociatedTokenAccount(provider.connection, payer, mint, owner)).address;
    merchantAta = (await getOrCreateAssociatedTokenAccount(provider.connection, payer, mint, merchant)).address;
    await mintTo(provider.connection, payer, mint, ownerAta, payer, 100_000 * unit);
    for (const key of [guardian.publicKey, stranger.publicKey]) {
      const sig = await provider.connection.requestAirdrop(key, 1_000_000_000);
      await provider.connection.confirmTransaction(sig, "confirmed");
    }
  });

  async function create(overrides: Record<string, any> = {}, fund = 1000): Promise<T> {
    const tripId = bn(sequence++);
    const [trip] = PublicKey.findProgramAddressSync([Buffer.from("trip"), owner.toBuffer(), tripId.toArrayLike(Buffer, "le", 8)], program.programId);
    const vault = await getAssociatedTokenAddress(mint, trip, true);
    await program.methods.initializeTrip({
      tripId, startTs: bn(now() - 60), endTs: bn(now() + 3600),
      dailyLimit: bn(150 * unit), maxTxAmount: bn(100 * unit), emergencyReserve: bn(200 * unit),
      recoveryAuthority: guardian.publicKey, ...overrides
    }).accountsStrict({ owner, mint, trip, vault, ...common }).rpc();
    if (fund) await deposit({ trip, vault }, fund);
    return { trip, vault };
  }
  function deposit(t: T, amount: number) {
    return program.methods.fundTrip(bn(amount * unit)).accountsStrict({ owner, ...t, ownerAta, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
  }
  function spend(t: T, amount: number, extra = {}) {
    return program.methods.spendFromTrip(bn(amount * unit)).accountsStrict({ owner, ...t, mint, merchant, merchantAta, ...common, ...extra }).rpc();
  }
  function lock(t: T, signer?: Keypair) {
    const builder = program.methods.emergencyLock().accountsStrict({ trip: t.trip, authority: signer?.publicKey ?? owner });
    return (signer ? builder.signers([signer]) : builder).rpc();
  }
  function recover(t: T, signer?: Keypair, extra = {}) {
    const builder = program.methods.recoverRemainingFunds().accountsStrict({
      authority: signer?.publicKey ?? owner, owner, ...t, mint, ownerAta, ...common, ...extra
    });
    return (signer ? builder.signers([signer]) : builder).rpc();
  }
  function close(t: T) {
    return program.methods.closeTrip().accountsStrict({ owner, ...t, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
  }
  async function reject(action: () => Promise<unknown>, code: string) {
    let caught: any;
    try { await action(); } catch (err) { caught = err; }
    assert.exists(caught, "expected transaction to fail");
    assert.include(caught.error?.errorCode?.code ?? String(caught), code);
  }
  async function snapshot(t: T) {
    const state = await program.account.trip.fetch(t.trip);
    return JSON.stringify({
      state, vault: (await getAccount(provider.connection, t.vault)).amount.toString(),
      owner: (await getAccount(provider.connection, ownerAta)).amount.toString(),
      merchant: (await getAccount(provider.connection, merchantAta)).amount.toString()
    });
  }
  async function rejectsUnchanged(t: T, amount: number, code: string) {
    const before = await snapshot(t);
    await reject(() => spend(t, amount), code);
    assert.equal(await snapshot(t), before, "rejection must not change token balances or trip state");
  }

  it("runs the Demo Day sequence, recovers to owner, and closes both accounts", async () => {
    const t = await create();
    const merchantBefore = (await getAccount(provider.connection, merchantAta)).amount;
    await spend(t, 25); await spend(t, 80);
    assert.equal((await getAccount(provider.connection, merchantAta)).amount - merchantBefore, BigInt(105 * unit));
    await rejectsUnchanged(t, 60, "DailyLimitExceeded");
    await lock(t);
    await rejectsUnchanged(t, 5, "TripLocked");
    const before = (await getAccount(provider.connection, ownerAta)).amount;
    await recover(t);
    assert.equal((await getAccount(provider.connection, ownerAta)).amount - before, BigInt(895 * unit));
    assert.equal((await getAccount(provider.connection, t.vault)).amount, 0n);
    await close(t);
    assert.isNull(await provider.connection.getAccountInfo(t.trip));
    assert.isNull(await provider.connection.getAccountInfo(t.vault));
  });
  it("rejects invalid dates", () => reject(() => create({ endTs: bn(now() - 100) }), "InvalidTripWindow"));
  it("rejects zero daily limit", () => reject(() => create({ dailyLimit: bn(0) }), "InvalidLimit"));
  it("rejects zero maximum", () => reject(() => create({ maxTxAmount: bn(0) }), "InvalidLimit"));
  it("rejects zero deposit", async () => { const t = await create(); await reject(() => deposit(t, 0), "InvalidAmount"); });
  it("rejects zero payment without mutations", async () => { await rejectsUnchanged(await create(), 0, "InvalidAmount"); });
  it("rejects a payment above the transaction cap", async () => { await rejectsUnchanged(await create(), 101, "MaxTransactionExceeded"); });
  it("allows the exact daily cap and rejects the next base unit", async () => {
    const t = await create(); await spend(t, 100); await spend(t, 50);
    await rejectsUnchanged(t, 0.000001, "DailyLimitExceeded");
  });
  it("protects the emergency reserve", async () => { await rejectsUnchanged(await create({}, 250), 51, "EmergencyReserveViolation"); });
  it("allows a payment leaving exactly the reserve", async () => {
    const t = await create({}, 250); await spend(t, 50);
    assert.equal((await getAccount(provider.connection, t.vault)).amount, BigInt(200 * unit));
  });
  it("rejects insufficient balance", async () => { await rejectsUnchanged(await create({ emergencyReserve: bn(0) }, 10), 11, "InsufficientVaultBalance"); });
  it("rejects spending before the trip starts", async () => {
    await rejectsUnchanged(await create({ startTs: bn(now() + 1000), endTs: bn(now() + 2000) }), 1, "TripNotActive");
  });
  it("rejects spending after expiry and allows owner recovery", async () => {
    const t = await create({ startTs: bn(now() - 2000), endTs: bn(now() - 1000) });
    await rejectsUnchanged(t, 1, "TripNotActive");
    await recover(t); await close(t);
  });
  it("rejects early recovery and close", async () => {
    const t = await create();
    await reject(() => recover(t), "RecoveryNotAllowed");
    await reject(() => close(t), "CloseNotAllowed");
  });
  it("will not close a nonempty locked vault", async () => {
    const t = await create(); await lock(t); await reject(() => close(t), "VaultNotEmpty");
  });
  it("allows guardian lock and recovery exclusively to recorded owner", async () => {
    const t = await create(); await lock(t, guardian);
    const guardianAta = (await getOrCreateAssociatedTokenAccount(provider.connection, payer, mint, guardian.publicKey)).address;
    await reject(() => recover(t, guardian, { owner: guardian.publicKey, ownerAta: guardianAta }), "ConstraintAddress");
    const balance = (await getAccount(provider.connection, ownerAta)).amount;
    await recover(t, guardian);
    assert.equal((await getAccount(provider.connection, ownerAta)).amount - balance, BigInt(1000 * unit));
  });
  it("rejects unauthorized lock and recovery", async () => {
    const t = await create();
    await reject(() => lock(t, stranger), "UnauthorizedRecoveryAuthority");
    await lock(t);
    await reject(() => recover(t, stranger), "UnauthorizedRecoveryAuthority");
  });
  it("rejects a noncanonical vault even with the right authority and mint", async () => {
    const t = await create();
    const fakeVault = await createAccount(provider.connection, payer, mint, t.trip, Keypair.generate());
    await reject(() => spend({ ...t, vault: fakeVault }, 1), "ConstraintAssociated");
    await lock(t);
    await reject(() => close({ ...t, vault: fakeVault }), "ConstraintAssociated");
    assert.isNotNull(await provider.connection.getAccountInfo(t.trip));
  });
});
