// Paystack webhook — receives payment events and credits wallet automatically
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const body = await req.text();

  const sig = req.headers.get("x-paystack-signature") || "";
  const expected = createHmac("sha512", SECRET).update(body).digest("hex");
  if (sig !== expected) {
    console.error("Invalid Paystack webhook signature");
    return json({ error: "invalid signature" }, 401);
  }

  let event: any;
  try { event = JSON.parse(body); } catch { return json({ error: "invalid json" }, 400); }

  if (event.event !== "charge.success") return json({ ok: true, skipped: event.event });

  const reference = event.data?.reference as string;
  if (!reference) return json({ error: "no reference" }, 400);

  const supa = createClient(SUPA_URL, SVC);

  const { data: row } = await supa
    .from("wallet_payments")
    .select("*")
    .eq("external_id", reference)
    .maybeSingle();

  if (!row) return json({ error: "payment not found" }, 404);
  if (row.status === "finished") return json({ ok: true, already: true });

  await supa.from("wallet_payments").update({ status: "finished", raw: event.data }).eq("id", row.id);
  const { error: rpcErr } = await supa.rpc("credit_deposit", { _payment_id: row.id });

  if (rpcErr) return json({ error: rpcErr.message }, 500);

  return json({ ok: true });
});
