import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Tx = { id: string; kind: string; amount_cents: number; status: string; note: string | null; created_at: string };

const Wallet = () => {
  const nav = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [depositUsd, setDepositUsd] = useState("5");
  const [withdrawUsd, setWithdrawUsd] = useState("5");
  const [busy, setBusy] = useState(false);

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
      // ensure wallet row exists (do NOT reset balance if it already exists)
      const { data: existing } = await supabase.from("wallets").select("user_id").eq("user_id", session.user.id).maybeSingle();
      if (!existing) {
        await supabase.from("wallets").insert({ user_id: session.user.id, balance_cents: 0 });
      }
      load(session.user.id);
    })();
  }, [nav]);

  const deposit = async () => {
    if (!uid) return;
    const usd = parseFloat(depositUsd);
    if (!(usd >= 5)) { toast.error("Minimum deposit is $5"); return; }
    setBusy(true);
    try {
      const grossCents = Math.round(usd * 100);
      const feeCents = 100;
      const netCents = grossCents - feeCents;
      // simulate
      await supabase.from("wallet_transactions").insert({ user_id: uid, kind: "deposit", amount_cents: grossCents, note: `Simulated deposit $${usd.toFixed(2)}` });
      await supabase.from("wallet_transactions").insert({ user_id: uid, kind: "fee", amount_cents: -feeCents, note: "Deposit fee $1.00" });
      await supabase.rpc("adjust_wallet", { _user_id: uid, _delta_cents: netCents });
      toast.success(`Credited $${(netCents/100).toFixed(2)}`);
      load(uid);
    } catch (e: any) {
      toast.error(e.message || "Deposit failed");
    } finally { setBusy(false); }
  };

  const withdraw = async () => {
    if (!uid) return;
    const usd = parseFloat(withdrawUsd);
    const cents = Math.round(usd * 100);
    if (!(cents > 0) || cents > balance) { toast.error("Invalid amount"); return; }
    setBusy(true);
    try {
      await supabase.from("wallet_transactions").insert({ user_id: uid, kind: "withdrawal", amount_cents: -cents, status: "pending", note: `Simulated withdrawal $${usd.toFixed(2)}` });
      await supabase.rpc("adjust_wallet", { _user_id: uid, _delta_cents: -cents });
      toast.success("Withdrawal requested (simulated)");
      load(uid);
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

        <Card className="p-4 space-y-2">
          <div className="font-semibold">Deposit (simulated)</div>
          <div className="text-xs text-muted-foreground">Min $5 · $1 fee · the rest is credited.</div>
          <div className="flex gap-2">
            <Input type="number" min="5" step="1" value={depositUsd} onChange={(e) => setDepositUsd(e.target.value)} />
            <Button onClick={deposit} disabled={busy}>Deposit</Button>
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="font-semibold">Withdraw (simulated)</div>
          <div className="flex gap-2">
            <Input type="number" min="1" step="1" value={withdrawUsd} onChange={(e) => setWithdrawUsd(e.target.value)} />
            <Button variant="outline" onClick={withdraw} disabled={busy}>Withdraw</Button>
          </div>
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
