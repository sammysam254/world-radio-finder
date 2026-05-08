// NowPayments integration: list USDT currencies/networks, create payment, check status, IPN webhook
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NP_API = "https://api.nowpayments.io/v1";
const NP_KEY = Deno.env.get("NOWPAYMENTS_API_KEY") ?? "";
const NP_IPN = Deno.env.get("NOWPAYMENTS_IPN_SECRET") ?? "";
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function np(path: string, init: RequestInit = {}) {
  const r = await fetch(`${NP_API}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), "x-api-key": NP_KEY, "Content-Type": "application/json" },
  });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

// Static list of USDT networks NowPayments supports (codes are NP currency codes)
const USDT_OPTIONS = [
  { code: "usdttrc20", network: "TRON (TRC20)" },
  { code: "usdterc20", network: "Ethereum (ERC20)" },
  { code: "usdtbsc",   network: "BNB Smart Chain (BEP20)" },
  { code: "usdtmatic", network: "Polygon" },
  { code: "usdtsol",   network: "Solana" },
  { code: "usdtarb",   network: "Arbitrum" },
  { code: "usdtop",    network: "Optimism" },
  { code: "usdtton",   network: "TON" },
  { code: "usdtalgo",  network: "Algorand" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || (req.method === "POST" ? "create" : "currencies");

  try {
    if (action === "currencies") {
      // Filter to only those NowPayments currently has enabled
      const r = await np("/currencies");
      const enabled: string[] = (r.body?.currencies || []).map((s: string) => s.toLowerCase());
      const list = USDT_OPTIONS.filter(o => enabled.length === 0 || enabled.includes(o.code));
      return json({ currencies: list.length ? list : USDT_OPTIONS });
    }

    if (action === "ipn") {
      // Webhook from NowPayments
      const text = await req.text();
      const data = JSON.parse(text);
      const supa = createClient(SUPA_URL, SVC);
      const extId = String(data.payment_id || data.invoice_id || "");
      const status = String(data.payment_status || "").toLowerCase();
      if (!extId) return json({ ok: false }, 400);

      const { data: row } = await supa.from("wallet_payments").select("*").eq("external_id", extId).maybeSingle();
      if (!row) return json({ ok: false }, 404);

      await supa.from("wallet_payments").update({ status, raw: data }).eq("id", row.id);
      if (["finished", "confirmed", "sending"].includes(status) && row.status !== "finished") {
        await supa.rpc("credit_deposit", { _payment_id: row.id });
      }
      return json({ ok: true });
    }

    if (action === "status") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "id required" }, 400);
      const supa = createClient(SUPA_URL, SVC);
      const { data: row } = await supa.from("wallet_payments").select("*").eq("id", id).maybeSingle();
      if (!row) return json({ error: "not found" }, 404);
      if (row.external_id) {
        const r = await np(`/payment/${row.external_id}`);
        if (r.ok) {
          const status = String(r.body.payment_status || "").toLowerCase();
          await supa.from("wallet_payments").update({ status, raw: r.body }).eq("id", row.id);
          if (["finished", "confirmed", "sending"].includes(status) && row.status !== "finished") {
            await supa.rpc("credit_deposit", { _payment_id: row.id });
          }
          return json({ status, payment: r.body });
        }
      }
      return json({ status: row.status });
    }

    if (action === "create") {
      const auth = req.headers.get("Authorization") || "";
      const userClient = createClient(SUPA_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "unauthorized" }, 401);

      const body = await req.json();
      const usd = Number(body.amount_usd);
      const pay_currency = String(body.pay_currency || "");
      if (!(usd >= 5)) return json({ error: "min $5" }, 400);
      if (!pay_currency) return json({ error: "pay_currency required" }, 400);

      const supa = createClient(SUPA_URL, SVC);
      const grossCents = Math.round(usd * 100);
      const feeCents = 100;
      const netCents = grossCents - feeCents;

      // Insert pending row first
      const { data: payRow, error: insErr } = await supa.from("wallet_payments").insert({
        user_id: user.id, provider: "nowpayments", kind: "deposit",
        amount_usd_cents: grossCents, fee_cents: feeCents, net_cents: netCents,
        pay_currency, status: "pending",
      }).select().single();
      if (insErr) return json({ error: insErr.message }, 500);

      const orderId = payRow.id;
      const r = await np("/payment", {
        method: "POST",
        body: JSON.stringify({
          price_amount: usd,
          price_currency: "usd",
          pay_currency,
          order_id: orderId,
          order_description: `Wavebox wallet deposit ${orderId}`,
          ipn_callback_url: `${SUPA_URL}/functions/v1/nowpayments?action=ipn`,
        }),
      });
      if (!r.ok) {
        await supa.from("wallet_payments").update({ status: "failed", raw: r.body }).eq("id", orderId);
        return json({ error: r.body?.message || "create failed", details: r.body }, 500);
      }
      const expires = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      const updated = {
        external_id: String(r.body.payment_id),
        pay_address: r.body.pay_address,
        pay_amount: String(r.body.pay_amount),
        pay_network: r.body.network || pay_currency,
        status: "waiting",
        expires_at: expires,
        raw: r.body,
      };
      await supa.from("wallet_payments").update(updated).eq("id", orderId);
      return json({ id: orderId, ...updated });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
