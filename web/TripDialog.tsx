import React, { useEffect, useRef } from "react";
import { ArrowRight, Compass, LockKeyhole, Plane, ShieldCheck, AlertTriangle, X } from "lucide-react";
import { Roam } from "./useRoam";
import { dailySpent, money, seconds, short } from "./model";
import { configuredMint } from "./chain";
function localDate(ts: number) { const d = new Date(ts * 1000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
export function TripDialog({ r }: { r: Roam }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (r.modal && !ref.current?.open) ref.current?.showModal(); else if (!r.modal && ref.current?.open) ref.current?.close(); }, [r.modal]);
  const titles = { create: "Where are you headed?", fund: "Add to your travel budget", pay: "Make a travel payment", lock: "Lock your trip vault", recover: "Bring your balance home", close: "Close this trip", help: "A little peace of mind" };
  const kind = r.modal || "help";
  const t = r.trip;
  return <dialog ref={ref} onCancel={e => { if (r.busy) e.preventDefault(); else r.setModal(null); }}>
    <div className="modal-head"><span className="modal-icon">{kind === "lock" ? <LockKeyhole/> : kind === "create" ? <Plane/> : <Compass/>}</span><button className="icon-button" aria-label="Close dialog" disabled={r.busy} onClick={() => { r.setModal(null); r.setError(""); }}><X size={20}/></button></div>
    <h2>{titles[kind]}</h2>
    {kind === "help" ? <div className="help-content"><p>Give each trip a separate vault with a fixed spending policy.</p><ol><li><strong>Plan:</strong> choose dates, limits, and a reserve.</li><li><strong>Fund:</strong> deposit your travel budget.</li><li><strong>Travel:</strong> each payment must pass every rule.</li><li><strong>Return:</strong> lock or finish, recover, then close.</li></ol><p>Only the program signs vault outflows. The owner or recovery authority can lock and recover; recovered tokens always go to the recorded owner.</p><p className="small-muted">Demo mode simulates these rules in your browser. Solana wallet mode sends actual transactions to localnet or devnet. This MVP uses legacy SPL tokens with 6 decimals. Test tokens are not USDC.</p><button className="button primary full" onClick={() => r.setModal(null)}>Ready to roam <ArrowRight size={16}/></button></div> :
    <form key={kind} onSubmit={e => { e.preventDefault(); r.submit(new FormData(e.currentTarget)); }}>
      <p className="modal-description">{kind === "pay" ? "Your trip’s rules are checked before funds can leave the vault." : kind === "fund" ? "Move just your planned budget into your trip vault." : kind === "create" ? "Give your next adventure its own budget and boundaries." : kind === "lock" ? "Permanently stop ordinary payments for this trip. You can then recover the remaining funds to the recorded owner." : kind === "recover" ? "Return all " + money(t?.balance || "0") + " remaining tokens, including the reserve, to the recorded owner." : "Close the empty vault and trip account. On Solana their rent returns to the owner."}</p>
      {kind === "create" ? <>
        <label>Trip name<input name="name" required maxLength={60} defaultValue="Tokyo getaway"/></label>
        <div className="form-grid"><label>Starts<input type="datetime-local" name="start" required defaultValue={localDate(seconds() - 60)}/></label><label>Ends<input type="datetime-local" name="end" required defaultValue={localDate(seconds() + 7 * 86400)}/></label></div>
        <div className="form-grid"><label>Daily limit<input name="daily" inputMode="decimal" required defaultValue="150"/></label><label>Maximum payment<input name="maximum" inputMode="decimal" required defaultValue="100"/></label></div>
        <label>Emergency reserve<input name="reserve" inputMode="decimal" required defaultValue="200"/></label>
        {r.mode === "chain" && <><label>Token mint · 6 decimals<input name="mint" required placeholder="Legacy SPL mint address" defaultValue={configuredMint}/></label><label>Recovery wallet · optional<input name="guardian" placeholder="Defaults to owner wallet"/></label></>}
      </> : kind === "pay" || kind === "fund" ? <>
        {kind === "pay" && <label>{r.mode === "demo" ? "Merchant" : "Merchant wallet address"}<input name="recipient" required placeholder={r.mode === "demo" ? "e.g. Neighborhood coffee" : "Solana public key"} defaultValue={r.mode === "demo" ? "Neighborhood coffee" : ""}/></label>}
        <label>Amount · test tokens<input name="amount" required inputMode="decimal" defaultValue={kind === "pay" ? "25" : "100"} autoFocus/></label>
        {kind === "pay" && t && <div className="payment-note"><ShieldCheck size={16}/><span>{money(t.maxTxAmount)} maximum · {money(BigInt(t.dailyLimit) - dailySpent(t))} left today</span></div>}
      </> : <div className="confirmation-box"><ShieldCheck size={20}/><div><strong>{kind === "lock" ? "Recovery stays available" : kind === "recover" ? "Destination: " + short(t?.owner || "") : "Your vault must be empty"}</strong><p>{kind === "lock" ? "The owner or designated guardian can bring funds home." : kind === "recover" ? "The destination is fixed to the original owner." : "Recover all tokens before closing."}</p></div></div>}
      {r.mode === "demo" && <p className="demo-note">Demo only · no real funds or blockchain transactions.</p>}
      {r.error && <div className="form-error" role="alert"><AlertTriangle size={17}/>{r.error}</div>}
      <button className={"button full " + (kind === "lock" ? "danger" : "primary")} type="submit" disabled={r.busy}>{r.busy ? "Waiting for confirmation…" : ({ create: "Create trip vault", fund: "Add funds", pay: "Pay merchant", lock: "Lock trip vault", recover: "Recover to owner", close: "Close trip" } as any)[kind]}<ArrowRight size={16}/></button>
    </form>}
  </dialog>;
}
