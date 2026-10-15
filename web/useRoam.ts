import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import * as chain from "./chain";
import { approveDemo, Entry, freshDemo, money, seconds, Trip, units } from "./model";
export type Modal = "create" | "fund" | "pay" | "lock" | "recover" | "close" | "help" | null;
const initialEntry = (): Entry => ({ id: crypto.randomUUID(), title: "Trip funded", detail: "Your demo travel budget is ready", amount: "1000000000", kind: "in", time: Date.now() });
function stored<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } }
export function useRoam() {
  const [mode, setMode] = useState<"demo" | "chain">("demo");
  const [demo, setDemo] = useState<Trip>(() => stored("roamsafe:demo:v1", freshDemo()));
  const [demoHistory, setDemoHistory] = useState<Entry[]>(() => stored("roamsafe:history:v1", [initialEntry()]));
  const [wallet, setWallet] = useState<chain.InjectedWallet | null>(null);
  const [liveTrips, setLiveTrips] = useState<Trip[]>([]);
  const [selected, setSelected] = useState("");
  const [liveHistory, setLiveHistory] = useState<Entry[]>([]);
  const [section, setSection] = useState("Overview");
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [clock, setClock] = useState(seconds());
  const [version, setVersion] = useState(0);
  const trip = mode === "demo" ? demo : liveTrips.find(t => t.address === selected) ?? liveTrips[0];
  useEffect(() => { localStorage.setItem("roamsafe:demo:v1", JSON.stringify(demo)); }, [demo]);
  useEffect(() => { localStorage.setItem("roamsafe:history:v1", JSON.stringify(demoHistory)); }, [demoHistory]);
  useEffect(() => { const t = setInterval(() => setClock(seconds()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!wallet) return;
    const reset = () => { setWallet(null); setLiveTrips([]); setLiveHistory([]); setNotice("Wallet changed. Reconnect to load its trips."); };
    wallet.on?.("accountChanged", reset); wallet.on?.("disconnect", reset);
    return () => { wallet.removeListener?.("accountChanged", reset); wallet.removeListener?.("disconnect", reset); };
  }, [wallet]);
  useEffect(() => {
    let stale = false;
    if (mode !== "chain" || !wallet || !trip) { setLiveHistory([]); return; }
    chain.client(wallet).connection.getSignaturesForAddress(new PublicKey(trip.address), { limit: 25 }).then(rows => {
      if (!stale) setLiveHistory(rows.map(row => ({
        id: row.signature, signature: row.signature, title: row.err ? "Transaction failed" : "Confirmed transaction",
        detail: row.signature.slice(0, 20) + "…", kind: row.err ? "blocked" : "system", time: (row.blockTime || seconds()) * 1000
      })));
    }).catch(() => { if (!stale) setLiveHistory([]); });
    return () => { stale = true; };
  }, [mode, wallet, trip?.address, version]);
  async function refresh(w = wallet) {
    if (!w) return [];
    const trips = await chain.loadTrips(w); setLiveTrips(trips); setVersion(v => v + 1); return trips;
  }
  async function connect() {
    setError(""); setBusy(true);
    try {
      const w = chain.injected();
      if (!w) throw new Error("Install Phantom or Solflare to connect, or explore all actions in Demo mode.");
      await w.connect(); setWallet(w); setMode("chain"); await refresh(w);
    } catch (err) { setError(chain.explanation(err)); } finally { setBusy(false); }
  }
  async function reload() { setBusy(true); setError(""); try { await refresh(); } catch (e) { setError(chain.explanation(e)); } finally { setBusy(false); } }
  function changeMode(next: "demo" | "chain") {
    setMode(next); setError(""); setNotice("");
    if (next === "chain" && wallet) reload();
  }
  function open(next: Modal) { setError(""); setNotice(""); setModal(next); }
  function record(e: Omit<Entry, "id" | "time">) { setDemoHistory(old => [{ ...e, id: crypto.randomUUID(), time: Date.now() }, ...old].slice(0, 100)); }
  function resetDemo() { setDemo(freshDemo()); setDemoHistory([initialEntry()]); setNotice("Demo reset. Try payments of 25, then 80, then 60 tokens."); setError(""); }
  async function submit(data: FormData) {
    if (!modal || modal === "help" || busy) return;
    const kind = modal;
    setBusy(true); setError("");
    try {
      if (kind === "create") {
        const reserve = String(data.get("reserve"));
        const input = {
          name: String(data.get("name") || "").trim(), mint: String(data.get("mint") || "").trim(),
          startTs: Math.floor(new Date(String(data.get("start"))).getTime() / 1000),
          endTs: Math.floor(new Date(String(data.get("end"))).getTime() / 1000),
          dailyLimit: units(String(data.get("daily"))), maxTxAmount: units(String(data.get("maximum"))),
          emergencyReserve: reserve === "0" ? 0n : units(reserve), recoveryAuthority: String(data.get("guardian") || "").trim()
        };
        if (!input.name || !Number.isFinite(input.startTs) || !Number.isFinite(input.endTs) || input.endTs <= input.startTs) throw new Error("Choose a name and an end date after the start date.");
        if (mode === "demo") {
          setDemo({ ...freshDemo(), name: input.name, startTs: input.startTs, endTs: input.endTs, dayWindowStart: input.startTs,
            dailyLimit: String(input.dailyLimit), maxTxAmount: String(input.maxTxAmount), emergencyReserve: String(input.emergencyReserve), balance: "0" });
          setDemoHistory([{ id: crypto.randomUUID(), title: "Trip created", detail: input.name + " · ready to fund", kind: "system", time: Date.now() }]);
        } else {
          if (!wallet) throw new Error("Connect your wallet first.");
          await chain.createTrip(wallet, input); const trips = await refresh(); if (trips[0]) setSelected(trips[0].address);
        }
        setSection("Overview"); setNotice("Your trip is ready. Add funds to start traveling.");
      } else {
        if (!trip || trip.closed) throw new Error("Create an open trip first.");
        const amount = kind === "pay" || kind === "fund" ? units(String(data.get("amount"))) : 0n;
        const recipient = String(data.get("recipient") || "").trim();
        if (mode === "chain") {
          if (!wallet) throw new Error("Connect your wallet first.");
          await chain.action(wallet, trip, kind, amount, recipient); await refresh();
          setNotice("Transaction confirmed on Solana.");
        } else {
          if (kind === "pay") {
            if (!recipient) throw new Error("Enter a merchant name.");
            setDemo(approveDemo(trip, amount));
            record({ title: recipient, detail: "Payment approved · all rules passed", amount: String(amount), kind: "out" });
          } else if (kind === "fund") {
            if (BigInt(trip.balance) + amount > 18_446_744_073_709_551_615n) throw new Error("Vault exceeds the supported token range.");
            setDemo({ ...trip, balance: String(BigInt(trip.balance) + amount) });
            record({ title: "Funds added", detail: "Demo wallet → trip vault", amount: String(amount), kind: "in" });
          } else if (kind === "lock") {
            setDemo({ ...trip, locked: true }); record({ title: "Emergency lock enabled", detail: "All future payments are stopped", kind: "system" });
          } else if (kind === "recover") {
            if (!trip.locked && seconds() <= trip.endTs) throw new Error("Lock the trip or wait until it ends before recovering.");
            setDemo({ ...trip, balance: "0" }); record({ title: "Funds recovered", detail: "Returned to the recorded owner", amount: trip.balance, kind: "out" });
          } else {
            if (!trip.locked && seconds() <= trip.endTs) throw new Error("Lock the trip or wait until it ends before closing.");
            if (BigInt(trip.balance) !== 0n) throw new Error("Recover all tokens before closing.");
            setDemo({ ...trip, closed: true }); record({ title: "Trip closed", detail: "Vault and trip account closed", kind: "system" });
          }
          const messages = { pay: "Payment approved. Your trip budget is up to date.", fund: "Funds added to the trip vault.", lock: "Trip locked. You can now recover the remaining balance.", recover: "Remaining funds returned to the owner.", close: "Trip closed." };
          setNotice(messages[kind]);
        }
      }
      setModal(null);
    } catch (err) {
      const message = chain.explanation(err); setError(message);
      if (kind === "pay" && mode === "demo") record({ title: "Payment blocked", detail: message, kind: "blocked" });
    } finally { setBusy(false); }
  }
  return { mode, changeMode, wallet, connect, reload, liveTrips, selected, setSelected, section, setSection, modal, setModal, open,
    busy, notice, setNotice, error, setError, clock, trip, history: mode === "demo" ? demoHistory : liveHistory, resetDemo, submit };
}
export type Roam = ReturnType<typeof useRoam>;
