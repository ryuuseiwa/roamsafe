import { assert } from "chai";
import { approveDemo, dailySpent, freshDemo, units } from "../web/model";
describe("Demo rules and exact token amounts", () => {
  it("parses exact six-decimal base units", () => { assert.equal(units("0.000001"), 1n); assert.equal(units("25.5"), 25_500_000n); });
  it("rejects invalid amounts instead of rounding them", () => {
    for (const v of ["0", "-1", "NaN", "1e3", "0.0000001", "18446744073709.551616"]) assert.throws(() => units(v));
  });
  it("accepts 25 and 80 and blocks the next 60 without mutating state", () => {
    const start = freshDemo(); const a = approveDemo(start, units("25")); const b = approveDemo(a, units("80"));
    assert.equal(b.balance, "895000000"); assert.equal(b.spentToday, "105000000");
    assert.throws(() => approveDemo(b, units("60")), "Daily limit");
    assert.equal(start.balance, "1000000000"); assert.equal(b.balance, "895000000");
  });
  it("protects the reserve and honors locking", () => {
    const t = { ...freshDemo(), balance: "250000000" };
    assert.throws(() => approveDemo(t, units("51")), "reserve");
    assert.equal(approveDemo(t, units("50")).balance, "200000000");
    assert.throws(() => approveDemo({ ...t, locked: true }, 1n), "locked");
  });
  it("resets at the exact 24-hour boundary", () => {
    const t = { ...freshDemo(), startTs: 0, endTs: 200000, dayWindowStart: 100, spentToday: "150000000" };
    assert.equal(dailySpent(t, 86499), 150000000n);
    assert.equal(dailySpent(t, 86500), 0n);
    assert.equal(approveDemo(t, units("1"), 86500).spentToday, "1000000");
  });
  it("rejects payments outside the trip and after closure", () => {
    const t = freshDemo(); assert.throws(() => approveDemo(t, 1n, t.startTs - 1), "dates");
    assert.throws(() => approveDemo(t, 1n, t.endTs + 1), "dates");
    assert.throws(() => approveDemo({ ...t, closed: true }, 1n), "closed");
  });
});
