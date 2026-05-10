import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const SYSTEM_PROMPT = `You are Wavebox Assistant, a helpful AI chatbot for Wavebox (wavebox.site) — a live radio, TV and news streaming app.

## About Wavebox
Wavebox lets users listen to live radio stations and watch live TV channels from around the world.

## Features
- Radio: Browse thousands of live stations by country and genre (News, Sports, Music, Talk)
- TV: Watch live TV channels by country
- Live Chat: Chat with other listeners in real-time
- Wallet: Deposit using Crypto (USDT) or Card (Visa/Mastercard via Paystack)
- Advertise: Businesses can advertise on Wavebox
- User Accounts: Sign up to access wallet, profile, chat

## Pages
- / : Main player with search, country filter, genre tabs
- /auth : Sign up or log in
- /profile : View profile and wallet balance
- /wallet : Deposit funds, view transactions
- /advertise : Advertise your business
- /terms and /privacy : Legal pages

## Wallet & Payments
- Crypto USDT via NowPayments — TRON, Ethereum, BNB, Polygon, Solana
- Card via Paystack — Visa & Mastercard
- Minimum deposit $5, $1 platform fee
- Balance in USD

## Stack
- React + TypeScript + Tailwind + shadcn/ui
- Supabase backend
- Cloudflare hosting at wavebox.site

Be helpful, friendly and concise. If unsure, say so.`;

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
      let learnedContext = "";
      const { data: learned } = await supa.from("chatbot_knowledge").select("question, answer").order("helpful_count", { ascending: false }).limit(10);
      if (learned?.length) {
        learnedContext = "\n\n## Learned Q&A:\n" + learned.map((l: any) => `Q: ${l.question}\nA: ${l.answer}`).join("\n\n");
      }
      const messages = [...history.slice(-10), { role: "user", content: userMessage }];
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1024, system: SYSTEM_PROMPT + learnedContext, messages }),
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "Sorry, I could not generate a response.";
      await supa.from("chatbot_conversations").insert({ question: userMessage, answer: reply, helpful: null }).catch(() => {});
      return json({ reply });
    } catch (e: any) {
      return json({ error: e.message }, 500);
    }
  }

  if (action === "feedback") {
    const { question, answer, helpful } = body;
    if (!question || !answer) return json({ error: "question and answer required" }, 400);
    if (helpful) {
      const { data: existing } = await supa.from("chatbot_knowledge").select("id, helpful_count").eq("question", question).maybeSingle();
      if (existing) {
        await supa.from("chatbot_knowledge").update({ helpful_count: existing.helpful_count + 1, answer }).eq("id", existing.id);
      } else {
        await supa.from("chatbot_knowledge").insert({ question, answer, helpful_count: 1 });
      }
    }
    await supa.from("chatbot_conversations").update({ helpful }).eq("question", question).eq("answer", answer);
    return json({ ok: true });
  }

  return json({ error: "unknown action" }, 400);
});
