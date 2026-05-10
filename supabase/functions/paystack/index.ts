import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KES_PER_USD = Number(Deno.env.get("KES_PER_USD") || "130");

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function ps(path: string, init: RequestInit = {}) {
  const r = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
  });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  let action = url.searchParams.get("action") || "init";
  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try { body = await req.json(); if (body.action) action = String(body.action); } catch {}
  }

  try {
    if (action === "init") {
      const auth = req.headers.get("Authorization") || "";
      const uc = createClient(SUPA_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data: { user } } = await uc.auth.getUser();
      if (!user?.email) return json({ error: "unauthorized" }, 401);

      // Accept amount_kes directly — user entered KES amount
      const amountKes = Math.round(Number(body.amount_kes));
      const isAdmin = body.is_admin === true;
      if (!isAdmin && amountKes < 1300) return json({ error: "Minimum deposit is $10 (KES 1300)" }, 400);

      // Convert to USD for wallet credit (after $1 fee)
      const usdGross = amountKes / KES_PER_USD;
      const usdNet = usdGross - 1; // $1 platform fee
      if (usdNet <= 0) return json({ error: "Amount too low after fees" }, 400);

      const supa = createClient(SUPA_URL, SVC);

      const { data: payRow, error: insErr } = await supa.from("wallet_payments").insert({
        user_id: user.id, provider: "paystack", kind: "deposit",
        amount_usd_cents: Math.round(usdGross * 100),
        fee_cents: 100,
        net_cents: Math.round(usdNet * 100),
        pay_currency: "kes",
        pay_network: "all",
        status: "pending",
      }).select().single();
      if (insErr) return json({ error: insErr.message }, 500);

      // Amount in KES cents (kobo) — whole integer, NO currency field
      const amountKobo = amountKes * 100;
      const reference = "WB" + payRow.id.replace(/-/g, "").slice(0, 16) + Date.now().toString().slice(-6);

      const r = await ps("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: user.email,
          amount: amountKobo,
          reference,
          callback_url: "https://wavebox.site/wallet",
          metadata: { payment_id: payRow.id, user_id: user.id, amount_kes: amountKes, amount_usd: usdNet },
        }),
      });

      if (!r.ok || !r.body?.status) {
        await supa.from("wallet_payments").update({ status: "failed", raw: r.body }).eq("id", payRow.id);
        return json({ error: r.body?.message || "Paystack init failed", details: r.body }, 500);
      }

      await supa.from("wallet_payments").update({
        external_id: reference, status: "waiting", raw: r.body.data,
        expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      }).eq("id", payRow.id);

      return json({
        id: payRow.id,
        access_code: r.body.data.access_code,
        authorization_url: r.body.data.authorization_url,
        reference,
        amount_kes: amountKes,
        usd_to_credit: usdNet.toFixed(2),
      });
    }

    if (action === "verify") {
      const id = url.searchParams.get("id") || String(body.id || "");
      if (!id) return json({ error: "id required" }, 400);
      const supa = createClient(SUPA_URL, SVC);
      const { data: row } = await supa.from("wallet_payments").select("*").eq("id", id).maybeSingle();
      if (!row) return json({ error: "not found" }, 404);
      if (!row.external_id) return json({ status: row.status });
      const r = await ps(`/transaction/verify/${row.external_id}`);
      const status = r.body?.data?.status as string;
      if (status === "success" && row.status !== "finished") {
        await supa.from("wallet_payments").update({ status: "finished", raw: r.body.data }).eq("id", id);
        await supa.rpc("credit_deposit", { _payment_id: id });
        return json({ status: "finished" });
      }
      const newStatus = status === "failed" ? "failed" : status === "abandoned" ? "expired" : "waiting";
      await supa.from("wallet_payments").update({ status: newStatus, raw: r.body?.data || r.body }).eq("id", id);
      return json({ status: newStatus });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
