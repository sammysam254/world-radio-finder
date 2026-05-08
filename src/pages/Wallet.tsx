import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

type Tx = { id: string; kind: string; amount_cents: number; status: string; note: string | null; created_at: string };
type CryptoOpt = { code: string; network: string };
type CryptoPayment = {
  id: string; pay_address: string; pay_amount: string; pay_currency: string;
  pay_network: string; expires_at: string; status: string;
};

const Wallet = () => {
  const nav = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [cryptos, setCryptos] = useState<CryptoOpt[]>([]);
  const [chosenCrypto, setChosenCrypto] = useState<string>("");

  // deposit
  const [depositUsd, setDepositUsd] = useState("5");
  const [busy, setBusy] = useState(false);
  const [cryptoPay, setCryptoPay] = useState<CryptoPayment | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [paystackUrl, setPaystackUrl] = useState<string | null>(null);
  const [paystackId, setPaystackId] = useState<string | null>(null);

  // withdraw
  const [withdrawUsd, setWithdrawUsd] = useState("5");
  const [wMethod, setWMethod] = useState("crypto");
  const [wDest, setWDest] = useState("");

  const load = async (id: string) => {
    const { data: w } = await supabase.from("wallets").select("balance_cents").eq("user_id", id).maybeSingle();
    setBalance(w?.balance_cents || 0);
    const { data: t } = await supabase.from("wallet_transactions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50);
    setTxs((t || []) as Tx[]);
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { nav("/auth", { replace: true }); return; }
      setUid(session.user.id);
      const { data: existing } = await supabase.from("wallets").select("user_id").eq("user_id", session.user.id).maybeSingle();
      if (!existing) await supabase.from("wallets").insert({ user_id: session.user.id, balance_cents: 0 });
      load(session.user.id);
      // Load crypto options via direct fetch (SDK invoke only supports POST)
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const { data: { session: sess } } = await supabase.auth.getSession();
        const res = await fetch(`${supabaseUrl}/functions/v1/nowpayments?action=currencies`, {
          headers: {
            apikey: supabaseKey,
            Authorization: sess ? `Bearer ${sess.access_token}` : `Bearer ${supabaseKey}`,
          },
        });
        const data = await res.json();
        if (data?.currencies && data.currencies.length > 0) {
          setCryptos(data.currencies);
          setChosenCrypto(data.currencies[0]?.code || "");
        } else {
          throw new Error("empty");
        }
      } catch {
        const fb = [
          { code: "usdttrc20", network: "TRON (TRC20)" },
          { code: "usdterc20", network: "Ethereum (ERC20)" },
          { code: "usdtbsc",   network: "BNB Smart Chain (BEP20)" },
          { code: "usdtmatic", network: "Polygon" },
          { code: "usdtsol",   network: "Solana" },
        ];
        setCryptos(fb);
        setChosenCrypto(fb[0].code);
      }
    })();
  }, [nav]);

  // Countdown for crypto payment
  useEffect(() => {
    if (!cryptoPay) return;
    const tick = () => {
      const ms = new Date(cryptoPay.expires_at).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.round(ms / 1000)));
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [cryptoPay]);

  // Poll status while payment open
  useEffect(() => {
    if (!cryptoPay || !uid) return;
    const t = window.setInterval(async () => {
      try {
        const r = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nowpayments?action=status&id=${cryptoPay.id}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } },
        );
        const j = await r.json();
        if (["finished", "confirmed"].includes(j.status)) {
          toast.success("Crypto deposit credited!");
          setCryptoPay(null);
          load(uid);
        } else if (["failed", "expired"].includes(j.status) || secondsLeft <= 0) {
          if (secondsLeft <= 0) {
            setCryptoPay(null);
            toast.error("Payment window expired");
          }
        }
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
      const { data, error } = await supabase.functions.invoke("nowpayments", {
        body: { amount_usd: usd, pay_currency: chosenCrypto },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCryptoPay(data);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  const startPaystackDeposit = async (channel: "card" | "bank" | "mobile_money") => {
    const usd = parseFloat(depositUsd);
    if (!(usd >= 5)) { toast.error("Min $5"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("paystack", {
        body: { amount_usd: usd, channel },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPaystackUrl(data.authorization_url);
      setPaystackId(data.id);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  const verifyPaystack = async () => {
    if (!paystackId) return;
    setBusy(true);
    try {
      const { data } = await supabase.functions.invoke("paystack", {
        body: {}, method: "POST",
      } as any);
      // call verify via URL
      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack?action=verify&id=${paystackId}`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } },
      );
      const j = await r.json();
      if (j.status === "finished") { toast.success("Deposit credited!"); setPaystackUrl(null); setPaystackId(null); if (uid) load(uid); }
      else toast(`Status: ${j.status}`);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  const requestWithdraw = async () => {
    if (!uid) return;
    const usd = parseFloat(withdrawUsd);
    const cents = Math.round(usd * 100);
    if (!(cents > 0) || cents > balance) { toast.error("Invalid amount"); return; }
    if (!wDest.trim()) { toast.error("Provide destination details"); return; }
    setBusy(true);
    try {
      // Debit immediately, refund on rejection
      const { error: e1 } = await supabase.from("wallet_transactions").insert({
        user_id: uid, kind: "withdrawal", amount_cents: -cents, status: "pending",
        note: `Withdrawal via ${wMethod}: ${wDest}`,
      });
      if (e1) throw e1;
      await supabase.rpc("adjust_wallet", { _user_id: uid, _delta_cents: -cents });
      const { error: e2 } = await supabase.from("wallet_payments").insert({
        user_id: uid, provider: wMethod === "crypto" ? "nowpayments" : "paystack",
        kind: "withdrawal", amount_usd_cents: cents, net_cents: cents, fee_cents: 0,
        pay_network: wMethod, status: "pending", destination: { method: wMethod, details: wDest },
      });
      if (e2) throw e2;
      toast.success("Withdrawal requested. Awaiting admin approval.");
      setWDest(""); load(uid);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-md mx-auto space-y-4">
        <button onClick={() => nav("/profile")} className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>
        <h1 className="text-2xl font-bold">Wallet</h1>

        <Card className="p-6 text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Balance</div>
          <div className="text-4xl font-black mt-1">${(balance/100).toFixed(2)}</div>
        </Card>

        {/* Active crypto payment */}
        {cryptoPay && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Pay with USDT · {cryptoPay.pay_network}</div>
              <div className="text-xs font-mono">
                {secondsLeft > 0 ? `expires in ${Math.floor(secondsLeft/60)}:${(secondsLeft%60).toString().padStart(2,"0")}` : "expired"}
              </div>
            </div>
            <div className="text-sm">Send <b>{cryptoPay.pay_amount}</b> {cryptoPay.pay_currency.toUpperCase()} to:</div>
            <div className="bg-muted rounded p-2 break-all text-xs font-mono flex items-center gap-2">
              <span className="flex-1">{cryptoPay.pay_address}</span>
              <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(cryptoPay.pay_address); toast.success("Copied"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-center bg-white p-3 rounded">
              <QRCodeSVG value={cryptoPay.pay_address} size={180} />
            </div>
            <div className="text-xs text-muted-foreground">Status: {cryptoPay.status} · We'll auto-credit when confirmed.</div>
            <Button variant="outline" onClick={() => setCryptoPay(null)} className="w-full">Close</Button>
          </Card>
        )}

        {/* Active paystack window */}
        {paystackUrl && (
          <Card className="p-2 space-y-2">
            <div className="font-semibold px-2 pt-2">Complete payment</div>
            <iframe src={paystackUrl} className="w-full h-[420px] rounded" />
            <div className="flex gap-2 px-2 pb-2">
              <Button onClick={verifyPaystack} disabled={busy} className="flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "I've paid – verify"}</Button>
              <Button variant="outline" onClick={() => { setPaystackUrl(null); setPaystackId(null); }}>Cancel</Button>
            </div>
          </Card>
        )}

        {!cryptoPay && !paystackUrl && (
          <Card className="p-4 space-y-3">
            <div>
              <div className="font-semibold">Deposit</div>
              <div className="text-xs text-muted-foreground">Min $5 · $1 fee · the rest is credited.</div>
            </div>
            <Input type="number" min="5" step="1" value={depositUsd} onChange={(e) => setDepositUsd(e.target.value)} />
            <Tabs defaultValue="crypto">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="crypto">Crypto (USDT)</TabsTrigger>
                <TabsTrigger value="paystack">Card / Bank / MoMo</TabsTrigger>
              </TabsList>
              <TabsContent value="crypto" className="pt-3 space-y-2">
                <label className="text-xs text-muted-foreground">Network</label>
                <select value={chosenCrypto} onChange={(e) => setChosenCrypto(e.target.value)} className="w-full h-10 rounded-md border bg-background px-2 text-sm">
                  {cryptos.map(c => <option key={c.code} value={c.code}>USDT — {c.network}</option>)}
                </select>
                <Button onClick={startCryptoDeposit} disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay with crypto"}</Button>
              </TabsContent>
              <TabsContent value="paystack" className="pt-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" onClick={() => startPaystackDeposit("card")} disabled={busy}>Card</Button>
                  <Button variant="outline" onClick={() => startPaystackDeposit("bank")} disabled={busy}>Bank</Button>
                  <Button variant="outline" onClick={() => startPaystackDeposit("mobile_money")} disabled={busy}>Mobile money</Button>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        )}

        <Card className="p-4 space-y-2">
          <div className="font-semibold">Withdraw</div>
          <div className="text-xs text-muted-foreground">Withdrawals require admin approval.</div>
          <Input type="number" min="1" step="1" value={withdrawUsd} onChange={(e) => setWithdrawUsd(e.target.value)} placeholder="Amount USD" />
          <select value={wMethod} onChange={(e) => setWMethod(e.target.value)} className="w-full h-10 rounded-md border bg-background px-2 text-sm">
            <option value="crypto">Crypto (USDT address)</option>
            <option value="bank">Bank account</option>
            <option value="mobile_money">Mobile money</option>
          </select>
          <Input value={wDest} onChange={(e) => setWDest(e.target.value)} placeholder={wMethod === "crypto" ? "USDT address + network" : wMethod === "bank" ? "Bank name, acc no, name" : "Provider + phone number"} />
          <Button variant="outline" onClick={requestWithdraw} disabled={busy} className="w-full">Request withdrawal</Button>
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
                <div className={`font-mono ${t.amount_cents >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {t.amount_cents >= 0 ? "+" : ""}${(t.amount_cents/100).toFixed(2)}
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
