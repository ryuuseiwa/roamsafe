export type Entry = { id: string; title: string; detail: string; amount?: string; kind: "in" | "out" | "blocked" | "system"; time: number; signature?: string };
export type Trip = {
  address: string; vault: string; name: string; owner: string; recoveryAuthority: string; mint: string;
  tripId: string; startTs: number; endTs: number; dailyLimit: string; maxTxAmount: string;
  emergencyReserve: string; spentToday: string; totalSpent: string; dayWindowStart: number;
  locked: boolean; balance: string; closed?: boolean;
};
export const seconds = () => Math.floor(Date.now() / 1000);
export function units(value: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(value.trim())) throw new Error("Enter a positive amount with at most 6 decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  if (amount <= 0n || amount > 18_446_744_073_709_551_615n) throw new Error("Amount is outside the supported token range.");
  return amount;
}
export const money = (value: string | bigint) => (Number(value) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
export const short = (value: string) => value.length > 16 ? value.slice(0, 5) + "…" + value.slice(-5) : value;
export function freshDemo(): Trip {
  const now = seconds();
  return {
    address: "demo-trip", vault: "demo-vault", name: "Tokyo getaway", owner: "Demo traveler", recoveryAuthority: "Demo guardian",
    mint: "Test USD", tripId: String(now), startTs: now - 60, endTs: now + 7 * 86400,
    dailyLimit: "150000000", maxTxAmount: "100000000", emergencyReserve: "200000000",
    spentToday: "0", totalSpent: "0", dayWindowStart: now - 60, locked: false, balance: "1000000000"
  };
}
export function dailySpent(t: Trip, now = seconds()) {
  return now - t.dayWindowStart >= 86400 ? 0n : BigInt(t.spentToday);
}
export function approveDemo(t: Trip, amount: bigint, now = seconds()): Trip {
  if (t.closed) throw new Error("This trip has been closed. Create a new trip to continue.");
  if (t.locked) throw new Error("Trip locked. Payments are stopped; recover the remaining balance.");
  if (now < t.startTs || now > t.endTs) throw new Error("This trip is outside its spending dates.");
  if (amount <= 0n) throw new Error("Enter an amount greater than zero.");
  if (amount > BigInt(t.maxTxAmount)) throw new Error("Payment exceeds your maximum of " + money(t.maxTxAmount) + " tokens.");
  const daily = dailySpent(t, now) + amount;
  if (daily > BigInt(t.dailyLimit)) throw new Error("Daily limit reached. Only " + money(BigInt(t.dailyLimit) - dailySpent(t, now)) + " tokens remain in this 24-hour window.");
  if (amount > BigInt(t.balance)) throw new Error("Your vault has insufficient funds.");
  if (BigInt(t.balance) - amount < BigInt(t.emergencyReserve)) throw new Error("Payment would use your protected emergency reserve.");
  return {
    ...t, balance: String(BigInt(t.balance) - amount), spentToday: String(daily),
    totalSpent: String(BigInt(t.totalSpent) + amount),
    dayWindowStart: now - t.dayWindowStart >= 86400 ? now : t.dayWindowStart
  };
}
