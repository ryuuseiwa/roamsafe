import * as anchor from "@anchor-lang/core";

/**
 * Read-only starter client.
 * Run this AFTER `anchor build` and after you have created at least one trip.
 * It lists RoamSafe Trip PDA state from your configured Anchor provider cluster.
 */
async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program: any = anchor.workspace.Roamsafe;
  const trips = await program.account.trip.all();

  if (trips.length === 0) {
    console.log("No RoamSafe trips found yet. Run `anchor test` first.");
    return;
  }

  for (const row of trips) {
    const t = row.account as any;
    console.log("\nRoamSafe Trip", row.publicKey.toBase58());
    console.log(" owner:", t.owner.toBase58());
    console.log(" tripId:", t.tripId.toString());
    console.log(" start:", new Date(t.startTs.toNumber() * 1000).toISOString());
    console.log(" end:", new Date(t.endTs.toNumber() * 1000).toISOString());
    console.log(" dailyLimit:", t.dailyLimit.toString());
    console.log(" maxTxAmount:", t.maxTxAmount.toString());
    console.log(" emergencyReserve:", t.emergencyReserve.toString());
    console.log(" spentToday:", t.spentToday.toString());
    console.log(" totalSpent:", t.totalSpent.toString());
    console.log(" locked:", t.locked);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
