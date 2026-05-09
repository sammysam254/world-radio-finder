// Paystack Transfer — fully automatic withdrawals, no admin interaction needed
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const KES_PER_USD = Number(Deno.env.get("KES_PER_USD") || "130");
const PLATFORM_FEE_CENTS = 100;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function ps(path: string, init: RequestInit = {}) {
  const r = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
  });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

async function getOrCreateRecipient(method: string, details: string, name: string) {
  if (method === "mobile_money") {
    const r = await ps("/transferrecipient", {
      method: "POST",
      body: JSON.stringify({ type: "mobile_money", name, account_number: details.replace(/\s/g, ""), bank_code: "MPESA", currency: "KES" }),
    });
    if (!r.ok) throw new Error(r.body?.message || "Failed to create M-Pesa recipient");
    return r.body.data.recipient_code;
  }
  if (method === "bank") {
    const parts = details.split("|");
    if (parts.length < 2) throw new Error("Bank details must be: bank_code|account_number");
    const [bank_code, account_number] = parts;
    const r = await ps("/transferrecipient", {
      method: "POST",
      body: JSON.stringify({ type: "nuban", name, account_number: account_number.trim(), bank_code: bank_code.trim(), currency: "KES" }),
    });
    if (!r.ok) throw new Error(r.body?.message || "Failed to create bank recipient");
    return r.body.data.recipient_code;
  }
  throw new Error("Unsupported method: use mobile_money or bank");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  let action = url.searchParams.get("action") || "withdraw";
  let bodyData: Record<string, unknown> = {};

  if (req.method === "POST") {
    try {
      bodyData = await req.json();
      if (bodyData.action && typeof bodyData.action === "string") action = bodyData.action;
    } catch { bodyData = {}; }
  }

  const supa = createClient(SUPA_URL, SVC);

  try {
    if (action === "withdraw") {
      const auth = req.headers.get("Authorization") || "";
      const userClient = createClient(SUPA_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "unauthorized" }, 401);

      const amountUsd = Number(bodyData.amount_usd);
      const method = String(bodyData.method || "mobile_money");
      const details = String(bodyData.details || "").trim();

      if (!(amountUsd >= 1)) return json({ error: "Minimum withdrawal is $1" }, 400);
      if (!details) return json({ error: "Destination details required" }, 400);

      const { data: wallet } = await supa.from("wallets").select("balance_cents").eq("user_id", user.id).maybeSingle();
      const balanceCents = wallet?.balance_cents || 0;
      const withdrawCents = Math.round(amountUsd * 100);
      const paystackFeeCents = Math.round((50 / KES_PER_USD) * 100);
      const totalRequired = withdrawCents + PLATFORM_FEE_CENTS + paystackFeeCents;

      if (balanceCents < totalRequired) {
        const shortfall = ((totalRequired - balanceCents) / 100).toFixed(2);
        return json({ error: `Insufficient balance. Need $${(totalRequired/100).toFixed(2)} (amount + $${(PLATFORM_FEE_CENTS/100).toFixed(2)} platform fee + $${(paystackFeeCents/100).toFixed(2)} transfer fee). Short by $${shortfall}.` }, 400);
      }

      const { data: profile } = await supa.from("profiles").select("*").eq("id", user.id).maybeSingle();
      const { data: authUser } = await supa.auth.admin.getUserById(user.id);
      const email = authUser?.user?.email || "customer@wavebox.site";
      const name = profile?.display_name || profile?.username || email.split("@")[0];

      const totalFeeCents = PLATFORM_FEE_CENTS + paystackFeeCents;
      const { error: deductErr } = await supa.rpc("adjust_wallet", { _user_id: user.id, _delta_cents: -(withdrawCents + totalFeeCents) });
      if (deductErr) return json({ error: deductErr.message }, 500);

      const { data: payRow, error: insErr } = await supa.from("wallet_payments").insert({
        user_id: user.id, provider: "paystack", kind: "withdrawal",
        amount_usd_cents: withdrawCents, fee_cents: totalFeeCents, net_cents: withdrawCents,
        pay_network: method, status: "processing", destination: { method, details },
      }).select().single();

      if (insErr) {
        await supa.rpc("adjust_wallet", { _user_id: user.id, _delta_cents: withdrawCents + totalFeeCents });
        return json({ error: insErr.message }, 500);
      }

      await supa.from("wallet_transactions").insert({
        user_id: user.id, kind: "withdrawal", amount_cents: -(withdrawCents + totalFeeCents),
        status: "pending", note: `Withdrawal via ${method}: ${details}`,
      });

      let recipientCode: string;
      try { recipientCode = await getOrCreateRecipient(method, details, name); }
      catch (e: any) {
        await supa.rpc("adjust_wallet", { _user_id: user.id, _delta_cents: withdrawCents + totalFeeCents });
        await supa.from("wallet_payments").update({ status: "failed", admin_note: e.message }).eq("id", payRow.id);
        return json({ error: e.message }, 400);
      }

      const amountKobo = Math.round((withdrawCents / 100) * KES_PER_USD * 100);

      const r = await ps("/transfer", {
        method: "POST",
        body: JSON.stringify({
          source: "balance", amount: amountKobo, currency: "KES",
          recipient: recipientCode, reason: "Wavebox withdrawal",
          reference: payRow.id.replace(/-/g, ""),
        }),
      });

      if (!r.ok) {
        const msg = r.body?.message || "Transfer failed";
        await supa.rpc("adjust_wallet", { _user_id: user.id, _delta_cents: withdrawCents + totalFeeCents });
        await supa.from("wallet_payments").update({ status: "failed", admin_note: msg, raw: r.body }).eq("id", payRow.id);
        await supa.from("wallet_transactions").update({ status: "failed" }).eq("user_id", user.id).eq("kind", "withdrawal").eq("status", "pending");
        return json({ error: msg }, 500);
      }

      await supa.from("wallet_payments").update({ status: "processing", external_id: r.body.data?.transfer_code, raw: r.body.data }).eq("id", payRow.id);
      return json({ ok: true, status: "processing", transfer_code: r.body.data?.transfer_code, message: "Withdrawal sent! Should arrive within minutes." });
    }

    if (action === "approve") {
      const transferCode = String(bodyData.transfer_code || "");
      const reference = String(bodyData.reference || "");
      let row: any = null;
      if (transferCode) {
        const { data } = await supa.from("wallet_payments").select("*").eq("external_id", transferCode).maybeSingle();
        row = data;
      }
      if (!row && reference) {
        const refId = reference.length === 32
          ? `${reference.slice(0,8)}-${reference.slice(8,12)}-${reference.slice(12,16)}-${reference.slice(16,20)}-${reference.slice(20)}`
          : reference;
        const { data } = await supa.from("wallet_payments").select("*").eq("id", refId).maybeSingle();
        row = data;
      }
      if (row && row.status === "processing") return json({ approve: true });
      return json({ approve: false });
    }

    if (action === "webhook") {
      const event = String(bodyData.event || "");
      const data = bodyData.data as any;
      const transferCode = data?.transfer_code as string;
      if (!transferCode) return json({ ok: true });
      const { data: row } = await supa.from("wallet_payments").select("*").eq("external_id", transferCode).maybeSingle();
      if (!row) return json({ ok: true });
      if (event === "transfer.success") {
        await supa.from("wallet_payments").update({ status: "finished", raw: data }).eq("id", row.id);
        await supa.from("wallet_transactions").update({ status: "completed", note: `Withdrawal sent to ${row.destination?.details || row.pay_network}` }).eq("user_id", row.user_id).eq("kind", "withdrawal").eq("status", "pending");
      } else if (event === "transfer.failed" || event === "transfer.reversed") {
        await supa.from("wallet_payments").update({ status: "failed", raw: data }).eq("id", row.id);
        const refundCents = row.amount_usd_cents + row.fee_cents;
        await supa.rpc("adjust_wallet", { _user_id: row.user_id, _delta_cents: refundCents });
        await supa.from("wallet_transactions").insert({ user_id: row.user_id, kind: "refund", amount_cents: refundCents, status: "completed", note: `Withdrawal refunded — ${event.split(".")[1]}` });
      }
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
