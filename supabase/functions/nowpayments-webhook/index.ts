// NowPayments IPN webhook — receives payment status updates and credits wallet automatically
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IPN_SECRET = Deno.env.get("NOWPAYMENTS_IPN_SECRET") ?? "";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const body = await req.text();

  const sig = req.headers.get("x-nowpayments-sig") || "";
  if (IPN_SECRET && sig) {
    let parsed: any;
    try { parsed = JSON.parse(body); } catch { return json({ error: "invalid json" }, 400); }
    const sorted = JSON.stringify(parsed, Object.keys(parsed).sort());
    const expected = createHmac("sha512", IPN_SECRET).update(sorted).digest("hex");
    if (sig !== expected) return json({ error: "invalid signature" }, 401);
  }

  let data: any;
  try { data = JSON.parse(body); } catch { return json({ error: "invalid json" }, 400); }

  const extId = String(data.payment_id || data.invoice_id || "");
  const status = String(data.payment_status || "").toLowerCase();
  if (!extId) return json({ error: "no payment_id" }, 400);

  const supa = createClient(SUPA_URL, SVC);

  const { data: row } = await supa
    .from("wallet_payments")
    .select("*")
    .eq("external_id", extId)
    .maybeSingle();

  if (!row) return json({ error: "payment not found" }, 404);

  await supa.from("wallet_payments").update({ status, raw: data }).eq("id", row.id);

  if (["finished", "confirmed", "sending"].includes(status) && row.status !== "finished") {
    const { error: rpcErr } = await supa.rpc("credit_deposit", { _payment_id: row.id });
    if (rpcErr) return json({ error: rpcErr.message }, 500);
  }

  return json({ ok: true });
});
