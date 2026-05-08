// Paystack Transfer — handles customer withdrawals via M-Pesa or bank
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

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
      body: JSON.stringify({
        type: "mobile_money",
        name,
        account_number: details.replace(/\s/g, ""),
        bank_code: "MPESA",
        currency: "KES",
      }),
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
  let action = url.searchParams.get("action") || "initiate";
  let bodyData: Record<string, unknown> = {};

  if (req.method === "POST") {
    try {
      bodyData = await req.json();
      if (bodyData.action && typeof bodyData.action === "string") action = bodyData.action;
    } catch { bodyData = {}; }
  }

  const supa = createClient(SUPA_URL, SVC);

  try {
    if (action === "initiate") {
      const auth = req.headers.get("Authorization") || "";
      const userClient = createClient(SUPA_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "unauthorized" }, 401);

      const { data: profile } = await supa.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      if (!profile?.is_admin) return json({ error: "admin only" }, 403);

      const paymentId = String(bodyData.payment_id || "");
      if (!paymentId) return json({ error: "payment_id required" }, 400);

      const { data: row } = await supa.from("wallet_payments").select("*").eq("id", paymentId).maybeSingle();
      if (!row) return json({ error: "payment not found" }, 404);
      if (row.status !== "pending") return json({ error: `Cannot initiate: status is ${row.status}` }, 400);
      if (row.kind !== "withdrawal") return json({ error: "not a withdrawal" }, 400);

      const { data: authUser } = await supa.auth.admin.getUserById(row.user_id);
      const email = authUser?.user?.email || "customer@wavebox.site";
      const { data: userProfile } = await supa.from("profiles").select("*").eq("id", row.user_id).maybeSingle();
      const name = userProfile?.display_name || userProfile?.username || email.split("@")[0];

      const dest = row.destination as any;
      const method = dest?.method || row.pay_network;
      const details = dest?.details || "";
      if (!details) return json({ error: "No destination details on withdrawal" }, 400);

      let recipientCode: string;
      try { recipientCode = await getOrCreateRecipient(method, details, name); }
      catch (e: any) { return json({ error: e.message }, 400); }

      const KES_PER_USD = Number(Deno.env.get("KES_PER_USD") || "130");
      const amountKobo = Math.round((row.amount_usd_cents / 100) * KES_PER_USD * 100);

      const r = await ps("/transfer", {
        method: "POST",
        body: JSON.stringify({
          source: "balance",
          amount: amountKobo,
          currency: "KES",
          recipient: recipientCode,
          reason: `Wavebox wallet withdrawal ${paymentId}`,
          reference: paymentId.replace(/-/g, ""),
        }),
      });

      if (!r.ok) {
        const msg = r.body?.message || "Transfer initiation failed";
        await supa.from("wallet_payments").update({ status: "failed", admin_note: msg }).eq("id", paymentId);
        return json({ error: msg, details: r.body }, 500);
      }

      await supa.from("wallet_payments").update({
        status: "processing",
        external_id: r.body.data?.transfer_code,
        raw: r.body.data,
      }).eq("id", paymentId);

      return json({ ok: true, transfer_code: r.body.data?.transfer_code, status: r.body.data?.status });
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
        const { data } = await supa.from("wallet_payments").select("*").eq("id", reference.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5")).maybeSingle();
        row = data;
      }
      if (!row) return json({ approve: false });
      const autoApproveLimit = Number(Deno.env.get("AUTO_APPROVE_LIMIT_CENTS") || "50000");
      if (row.status === "processing" && row.amount_usd_cents <= autoApproveLimit) return json({ approve: true });
      return json({ approve: false });
    }

    if (action === "webhook") {
      const event = bodyData.event as string;
      const data = bodyData.data as any;
      const transferCode = data?.transfer_code as string;
      if (!transferCode) return json({ ok: true });
      const { data: row } = await supa.from("wallet_payments").select("*").eq("external_id", transferCode).maybeSingle();
      if (!row) return json({ ok: true });
      if (event === "transfer.success") {
        await supa.from("wallet_payments").update({ status: "finished", raw: data }).eq("id", row.id);
        await supa.from("wallet_transactions").update({ status: "completed", note: `Withdrawal sent via ${row.pay_network}` }).eq("user_id", row.user_id).eq("kind", "withdrawal").eq("status", "pending");
      } else if (event === "transfer.failed" || event === "transfer.reversed") {
        await supa.from("wallet_payments").update({ status: "failed", raw: data }).eq("id", row.id);
        await supa.rpc("adjust_wallet", { _user_id: row.user_id, _delta_cents: row.amount_usd_cents });
        await supa.from("wallet_transactions").insert({ user_id: row.user_id, kind: "refund", amount_cents: row.amount_usd_cents, status: "completed", note: `Withdrawal refunded — transfer ${event.split(".")[1]}` });
      }
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
