// Paystack integration: initialize transaction, verify
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// KES per USD rate — set KES_PER_USD in Supabase Edge Function secrets to override
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
  let bodyData: Record<string, unknown> = {};

  if (req.method === "POST") {
    try {
      bodyData = await req.json();
      if (bodyData.action && typeof bodyData.action === "string") {
        action = bodyData.action;
      }
    } catch {
      bodyData = {};
    }
  }

  try {
    if (action === "init") {
      const auth = req.headers.get("Authorization") || "";
      const userClient = createClient(SUPA_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "unauthorized" }, 401);

      const usd = Number(bodyData.amount_usd);
      const channel = String(bodyData.channel || "card");
      if (!(usd >= 5)) return json({ error: "min $5" }, 400);
      if (!user.email) return json({ error: "user email required" }, 400);

      const supa = createClient(SUPA_URL, SVC);
      const grossCents = Math.round(usd * 100);
      const feeCents = 100;
      const netCents = grossCents - feeCents;

      const { data: payRow, error: insErr } = await supa.from("wallet_payments").insert({
        user_id: user.id, provider: "paystack", kind: "deposit",
        amount_usd_cents: grossCents, fee_cents: feeCents, net_cents: netCents,
        pay_currency: channel === "card" ? "usd" : "kes",
        pay_network: channel, status: "pending",
      }).select().single();
      if (insErr) return json({ error: insErr.message }, 500);

      const isCard = channel === "card";
      const currency = isCard ? "USD" : "KES";
      const amount = isCard
        ? grossCents
        : Math.round(usd * KES_PER_USD * 100);

      const channelsMap: Record<string, string[]> = {
        card: ["card"],
        bank: ["bank", "bank_transfer"],
        mobile_money: ["mobile_money"],
      };

      const r = await ps("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: user.email,
          amount,
          currency,
          reference: payRow.id.replace(/-/g, ""),
          channels: channelsMap[channel] ?? ["card"],
          metadata: { payment_id: payRow.id, user_id: user.id, amount_usd: usd },
        }),
      });

      if (!r.ok || !r.body?.status) {
        await supa.from("wallet_payments").update({ status: "failed", raw: r.body }).eq("id", payRow.id);
        const errMsg = r.body?.message || r.body?.data?.message || "Paystack init failed. Ensure PAYSTACK_SECRET_KEY is set and international payments are enabled on your Paystack dashboard.";
        return json({ error: errMsg, details: r.body }, 500);
      }

      await supa.from("wallet_payments").update({
        external_id: r.body.data.reference, status: "waiting", raw: r.body.data,
        expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      }).eq("id", payRow.id);
      return json({ id: payRow.id, authorization_url: r.body.data.authorization_url, reference: r.body.data.reference });
    }

    if (action === "verify") {
      const id = url.searchParams.get("id") || String(bodyData.id || "");
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
