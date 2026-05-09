import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Tx = { id: string; kind: string; amount_cents: number; status: string; note: string | null; created_at: string };
type CryptoOpt = { code: string; network: string };
type CryptoPayment = {
  id: string; pay_address: string; pay_amount: string; pay_currency: string;
  pay_network: string; expires_at: string; status: string;
};

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const KES_PER_USD = 130;

const Wallet = () => {
  const nav = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [cryptos, setCryptos] = useState<CryptoOpt[]>([]);
  const [chosenCrypto, setChosenCrypto] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [depositTab, setDepositTab] = useState<"crypto" | "card" | "mpesa">("crypto");
  const [depositUsd, setDepositUsd] = useState("5");
  const [depositKes, setDepositKes] = useState("650");
  const [cryptoPay, setCryptoPay] = useState<CryptoPayment | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [paystackUrl, setPaystackUrl] = useState<string | null>(null);
  const [paystackId, setPaystackId] = useState<string | null>(null);
  const [withdrawUsd, setWithdrawUsd] = useState("5");
  const [wMethod, setWMethod] = useState("mobile_money");
  const [wDest, setWDest] = useState("");
  const [wResult, setWResult] = useState<{ ok: boolean; message: string } | null>(null);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth" });

  const load = async (id: string) => {
    const { data: w } = await supabase.from("wallets").select("balance_cents").eq("user_id", id).maybeSingle();
    setBalance(w?.balance_cents || 0);
    const { data: t } = await supabase.from("wallet_transactions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50);
    setTxs((t || []) as Tx[]);
  };

  const callFn = async (fn: string, body: object, token: string) => {
    const res = await fetch(`${SUPA_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || data?.message || `Error ${res.status}`);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { nav("/auth", { replace: true }); return; }
      setUid(session.user.id);
      const { data: existing } = await supabase.from("wallets").select("user_id").eq("user_id", session.user.id).maybeSingle();
      if (!existing) await supabase.from("wallets").insert({ user_id: session.user.id, balance_cents: 0 });
      load(session.user.id);
      try {
        const res = await fetch(`${SUPA_URL}/functions/v1/nowpayments?action=currencies`, {
          headers: { apikey: SUPA_KEY, Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (data?.currencies?.length > 0) { setCryptos(data.currencies); setChosenCrypto(data.currencies[0].code); return; }
      } catch {}
      const fb = [
        { code: "usdttrc20", network: "TRON (TRC20)" },
        { code: "usdterc20", network: "Ethereum (ERC20)" },
        { code: "usdtbsc",   network: "BNB Smart Chain (BEP20)" },
        { code: "usdtmatic", network: "Polygon" },
        { code: "usdtsol",   network: "Solana" },
      ];
      setCryptos(fb); setChosenCrypto(fb[0].code);
    })();
  }, [nav]);

  useEffect(() => {
    if (!cryptoPay) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((new Date(cryptoPay.expires_at).getTime() - Date.now()) / 1000)));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [cryptoPay]);

  useEffect(() => {
    if (!cryptoPay || !uid) return;
    const t = window.setInterval(async () => {
      try {
        const r = await fetch(`${SUPA_URL}/functions/v1/nowpayments?action=status&id=${cryptoPay.id}`, { headers: { apikey: SUPA_KEY } });
        const j = await r.json();
        if (["finished", "confirmed"].includes(j.status)) { toast.success("Crypto deposit credited!"); setCryptoPay(null); load(uid); }
        else if (secondsLeft <= 0) { setCryptoPay(null); toast.error("Payment window expired"); }
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [cryptoPay, uid, secondsLeft]);

  const startCryptoDeposit = async () => {
    const usd = parseFloat(depositUsd);
    if (!(usd >= 5)) { toast.error("Min $5"); return; }
    if (!chosenCrypto) { toast.error("Select a network"); return; }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");
      const data = await callFn("nowpayments", { amount_usd: usd, pay_currency: chosenCrypto }, session.access_token);
      if (!data.pay_address) throw new Error("No payment address returned — check NowPayments API key");
      setCryptoPay(data);
      scrollTop();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  const startPaystackDeposit = async (channel: "card" | "mobile_money") => {
    const usd = channel === "mobile_money"
      ? Math.round((Number(depositKes) / KES_PER_USD) * 100) / 100
      : parseFloat(depositUsd);
    if (!(usd >= 5)) { toast.error(channel === "mobile_money" ? "Min KES 650" : "Min $5"); return; }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");
      const data = await callFn("paystack", { amount_usd: usd, channel }, session.access_token);
      if (!data.authorization_url) throw new Error("No payment URL returned");
      setPaystackId(data.id);
      setPaystackUrl(data.authorization_url);
      scrollTop();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  const verifyPaystackById = async (id: string) => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${SUPA_URL}/functions/v1/paystack?action=verify&id=${id}`, {
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${session?.access_token ?? SUPA_KEY}` },
      });
      const j = await r.json();
      if (j.status === "finished") {
        toast.success("Deposit credited!");
        setPaystackUrl(null); setPaystackId(null);
        if (uid) load(uid);
      } else {
        toast.error(`Payment status: ${j.status}. Complete payment first.`);
      }
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  const verifyPaystack = async () => { if (paystackId) verifyPaystackById(paystackId); };

  const requestWithdraw = async () => {
    if (!uid) return;
    const usd = parseFloat(withdrawUsd);
    if (!(usd >= 1)) { toast.error("Minimum withdrawal is $1"); return; }
    if (!wDest.trim()) { toast.error("Provide destination details"); return; }
    setBusy(true);
    setWResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");
      if (wMethod === "crypto") {
        const cents = Math.round(usd * 100);
        const { error: e1 } = await supabase.from("wallet_transactions").insert({ user_id: uid, kind: "withdrawal", amount_cents: -cents, status: "pending", note: `Crypto withdrawal: ${wDest}` });
        if (e1) throw e1;
        await supabase.rpc("adjust_wallet", { _user_id: uid, _delta_cents: -cents });
        await supabase.from("wallet_payments").insert({ user_id: uid, provider: "nowpayments", kind: "withdrawal", amount_usd_cents: cents, net_cents: cents, fee_cents: 0, pay_network: "crypto", status: "pending", destination: { method: "crypto", details: wDest } });
        setWResult({ ok: true, message: "Crypto withdrawal submitted. Will be processed within 24 hours." });
      } else {
        const data = await callFn("paystack-transfer", { action: "withdraw", amount_usd: usd, method: wMethod, details: wDest }, session.access_token);
        setWResult({ ok: true, message: data.message || "Withdrawal sent! Should arrive within minutes." });
      }
      setWDest("");
      load(uid);
    } catch (e: any) {
      const msg = e.message || "Failed";
      setWResult({ ok: false, message: msg });
    }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div ref={topRef} className="max-w-md mx-auto space-y-4">
        <button onClick={() => nav("/profile")} className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>
        <h1 className="text-2xl font-bold">Wallet</h1>

        <Card className="p-6 text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Balance</div>
          <div className="text-4xl font-black mt-1">${(balance/100).toFixed(2)}</div>
        </Card>

        {cryptoPay && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Pay USDT · {cryptoPay.pay_network}</div>
              <div className="text-xs font-mono text-orange-500">
                {secondsLeft > 0 ? `${Math.floor(secondsLeft/60)}:${(secondsLeft%60).toString().padStart(2,"0")} left` : "expired"}
              </div>
            </div>
            <div className="text-sm">Send exactly <b>{cryptoPay.pay_amount} {cryptoPay.pay_currency?.toUpperCase()}</b> to:</div>
            <div className="bg-muted rounded p-3 break-all text-xs font-mono flex items-start gap-2">
              <span className="flex-1">{cryptoPay.pay_address}</span>
              <Button size="icon" variant="ghost" className="shrink-0 h-6 w-6" onClick={() => { navigator.clipboard.writeText(cryptoPay.pay_address); toast.success("Copied!"); }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-xs bg-yellow-500/10 text-yellow-600 rounded p-2">⚠ Send only on <b>{cryptoPay.pay_network}</b> network.</div>
            <div className="text-xs text-muted-foreground">Status: {cryptoPay.status} · Auto-credited when confirmed.</div>
            <Button variant="outline" onClick={() => setCryptoPay(null)} className="w-full">Close</Button>
          </Card>
        )}

        {paystackUrl && !cryptoPay && (() => {
          setTimeout(() => {
            const w = window as any;
            if (w._paystackOpened) return;
            w._paystackOpened = true;
            if (w.PaystackPop) {
              const handler = w.PaystackPop.setup({
                key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "",
                authorization_url: paystackUrl,
                callback: () => { w._paystackOpened = false; verifyPaystack(); },
                onClose: () => { w._paystackOpened = false; },
              });
              handler.openIframe();
            }
          }, 100);
          return (
            <Card className="p-4 space-y-3">
              <div className="font-semibold">Payment in progress</div>
              <p className="text-sm text-muted-foreground">Paystack checkout opens automatically. If not, tap below.</p>
              <Button onClick={() => {
                const w = window as any;
                w._paystackOpened = false;
                if (w.PaystackPop) {
                  w._paystackOpened = true;
                  const handler = w.PaystackPop.setup({
                    key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "",
                    authorization_url: paystackUrl,
                    callback: () => { w._paystackOpened = false; verifyPaystack(); },
                    onClose: () => { w._paystackOpened = false; },
                  });
                  handler.openIframe();
                }
              }} className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open Payment"}
              </Button>
              <div className="flex gap-2">
                <Button onClick={verifyPaystack} disabled={busy} variant="outline" className="flex-1">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "I have paid"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setPaystackUrl(null); setPaystackId(null); }}>Cancel</Button>
              </div>
            </Card>
          );
        })()}

        {!cryptoPay && !paystackUrl && (
          <Card className="p-4 space-y-3">
            <div className="font-semibold">Deposit</div>

            {/* Flat 3-tab switcher — no nested Tabs component */}
            <div className="grid grid-cols-3 gap-1 bg-muted rounded-lg p-1">
              {(["crypto", "card", "mpesa"] as const).map(tab => (
                <button key={tab} onClick={() => setDepositTab(tab)}
                  className={`rounded-md py-1.5 text-xs font-medium transition-colors ${depositTab === tab ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>
                  {tab === "crypto" ? "🔗 Crypto" : tab === "card" ? "💳 Card" : "📱 M-Pesa"}
                </button>
              ))}
            </div>

            {/* USD input for Crypto and Card */}
            {(depositTab === "crypto" || depositTab === "card") && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Amount in USD</label>
                <Input type="number" min="5" step="1" value={depositUsd} onChange={(e) => setDepositUsd(e.target.value)} placeholder="Amount in USD" />
                <div className="text-xs text-muted-foreground">Min $5 · $1 fee · balance credited in USD</div>
              </div>
            )}

            {/* KES input for M-Pesa only */}
            {depositTab === "mpesa" && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Amount in KES</label>
                <Input type="number" min="500" step="50" value={depositKes}
                  onChange={(e) => setDepositKes(e.target.value)}
                  placeholder="Amount in KES" />
                <div className="text-xs text-muted-foreground">
                  ≈ ${(Number(depositKes) / KES_PER_USD).toFixed(2)} USD credited · min KES 650
                </div>
              </div>
            )}

            {/* Tab actions */}
            {depositTab === "crypto" && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Select network</label>
                <select value={chosenCrypto} onChange={(e) => setChosenCrypto(e.target.value)} className="w-full h-10 rounded-md border bg-background px-2 text-sm">
                  {cryptos.map(c => <option key={c.code} value={c.code}>USDT — {c.network}</option>)}
                </select>
                <Button onClick={startCryptoDeposit} disabled={busy} className="w-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get payment address"}
                </Button>
              </div>
            )}
            {depositTab === "card" && (
              <Button onClick={() => startPaystackDeposit("card")} disabled={busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay with Card"}
              </Button>
            )}
            {depositTab === "mpesa" && (
              <Button onClick={() => startPaystackDeposit("mobile_money")} disabled={busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay with M-Pesa"}
              </Button>
            )}
          </Card>
        )}

        <Card className="p-4 space-y-3">
          <div>
            <div className="font-semibold">Withdraw</div>
            <div className="text-xs text-muted-foreground">M-Pesa/bank sent instantly · Crypto within 24hrs · $1 fee</div>
          </div>
          <Input type="number" min="1" step="1" value={withdrawUsd} onChange={(e) => setWithdrawUsd(e.target.value)} placeholder="Amount in USD" />
          <select value={wMethod} onChange={(e) => { setWMethod(e.target.value); setWResult(null); }} className="w-full h-10 rounded-md border bg-background px-2 text-sm">
            <option value="mobile_money">📱 M-Pesa</option>
            <option value="bank">🏦 Bank account</option>
            <option value="crypto">🔗 Crypto (USDT)</option>
          </select>
          <Input value={wDest} onChange={(e) => setWDest(e.target.value)}
            placeholder={wMethod === "crypto" ? "USDT address + network" : wMethod === "mobile_money" ? "M-Pesa phone (e.g. 0712345678)" : "bank_code|account_number"} />
          {wResult && (
            <div className={`text-sm rounded p-2 ${wResult.ok ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
              {wResult.ok ? "✅ " : "❌ "}{wResult.message}
              {!wResult.ok && <div className="text-xs mt-1 text-muted-foreground">If this keeps failing, try again in 1 hour or contact support.</div>}
            </div>
          )}
          <Button onClick={requestWithdraw} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : wMethod === "crypto" ? "Submit withdrawal" : "Send now via Paystack"}
          </Button>
        </Card>

        <Card className="p-4">
          <div className="font-semibold mb-2">Recent transactions</div>
          {txs.length === 0 && <div className="text-xs text-muted-foreground">No activity yet.</div>}
          <div className="space-y-1 text-sm">
            {txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-border/50 py-1.5">
                <div className="min-w-0">
                  <div className="font-medium capitalize">{t.kind.replace("_", " ")}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.note}</div>
                </div>
                <div className={`font-mono text-sm shrink-0 ml-2 ${t.amount_cents >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {t.amount_cents >= 0 ? "+" : ""}${(Math.abs(t.amount_cents)/100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Wallet;
