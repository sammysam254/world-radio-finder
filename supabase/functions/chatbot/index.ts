import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const SYSTEM_PROMPT = `You are Wavebox Assistant, a smart and friendly AI for Wavebox (wavebox.site) — a live radio, TV and streaming app based in Kenya.

ABOUT WAVEBOX:
Wavebox lets users listen to live radio and watch live TV from around the world, with a focus on Kenya and Africa.

FEATURES:
- Live Radio: thousands of stations by country and genre (News, Sports, Music, Talk)
- Live TV: TV channels by country
- Live Chat: real-time chat with other listeners
- Wallet: deposit using Crypto USDT or Card (Visa/Mastercard via Paystack)
- Advertising: businesses can advertise on the platform
- User accounts with profiles

PAGES:
- / : Main player — search, country filter, genre tabs, radio and TV
- /auth : Sign up or log in
- /profile : Profile, wallet balance, admin link
- /wallet : Deposit funds (Crypto or Card), transaction history
- /advertise : Advertise your business
- /terms : Terms of service
- /privacy : Privacy policy
- /admin : Admin panel (admin only)

PAYMENTS:
- Crypto USDT via NowPayments — TRON TRC20, Ethereum ERC20, BNB BEP20, Polygon, Solana
- Card via Paystack — Visa and Mastercard charged in KES
- Minimum deposit $5, $1 platform fee, balance in USD
- Withdrawals: Crypto within 24hrs, instant via Paystack Transfer

TECHNICAL:
- React + TypeScript + Tailwind CSS + shadcn/ui frontend
- Supabase for database, auth and edge functions
- Cloudflare CDN at wavebox.site
- Lovable.dev for deployment

PERSONALITY:
- Friendly, helpful, concise
- Speak naturally like a human assistant
- If you don't know something, say so honestly
- You learn from every conversation and get smarter over time
- Answer any question — not just about Wavebox, be generally helpful`;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(SUPA_URL, SVC);
  let body: any = {};
  try { body = await req.json(); } catch {}
  const action = body.action || "chat";

  if (action === "chat") {
    const userMessage = String(body.message || "").trim();
    if (!userMessage) return json({ error: "message required" }, 400);
    const history = body.history || [];

    try {
      // Load learned knowledge
      let learnedContext = "";
      const { data: learned } = await supa
        .from("chatbot_knowledge")
        .select("question, answer")
        .order("helpful_count", { ascending: false })
        .limit(15);
      if (learned?.length) {
        learnedContext = "\n\nLEARNED FROM USERS:\n" +
          learned.map((l: any) => `Q: ${l.question}\nA: ${l.answer}`).join("\n---\n");
      }

      const messages = [
        ...history.slice(-12),
        { role: "user", content: userMessage }
      ];

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: SYSTEM_PROMPT + learnedContext,
          messages,
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const reply = data.content?.[0]?.text || "Sorry I could not answer that.";

      // Save conversation
      await supa.from("chatbot_conversations")
        .insert({ question: userMessage, answer: reply, helpful: null })
        .catch(() => {});

      return json({ reply });
    } catch (e: any) {
      return json({ error: e.message }, 500);
    }
  }

  if (action === "feedback") {
    const { question, answer, helpful } = body;
    if (!question || !answer) return json({ error: "missing fields" }, 400);
    if (helpful) {
      const { data: ex } = await supa.from("chatbot_knowledge")
        .select("id, helpful_count").eq("question", question).maybeSingle();
      if (ex) {
        await supa.from("chatbot_knowledge")
          .update({ helpful_count: ex.helpful_count + 1, answer }).eq("id", ex.id);
      } else {
        await supa.from("chatbot_knowledge")
          .insert({ question, answer, helpful_count: 1 });
      }
    }
    await supa.from("chatbot_conversations")
      .update({ helpful }).eq("question", question).eq("answer", answer);
    return json({ ok: true });
  }

  return json({ error: "unknown action" }, 400);
});
