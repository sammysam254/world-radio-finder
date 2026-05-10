import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are Wavebox Assistant, a smart helpful AI for Wavebox (wavebox.site) — a live radio and TV streaming app based in Kenya.

ABOUT WAVEBOX:
Wavebox lets users listen to live radio and watch live TV from around the world, focused on Kenya and Africa.

FEATURES:
- Live Radio: thousands of stations by country and genre (News, Sports, Music, Talk)
- Live TV: channels by country
- Live Chat: real-time chat with other listeners
- Wallet: deposit using Crypto USDT or Card via Paystack
- Advertising: businesses can advertise on the platform
- User accounts with profiles

PAGES:
- / : Main player with search, country filter, genre tabs
- /auth : Sign up or log in
- /profile : Profile and wallet balance
- /wallet : Deposit funds and transaction history
- /advertise : Advertise your business
- /terms and /privacy : Legal pages
- /admin : Admin panel (admin only)

PAYMENTS:
- Crypto USDT via NowPayments — TRON, Ethereum, BNB, Polygon, Solana networks
- Card via Paystack — Visa and Mastercard, charged in KES
- Minimum deposit $5, $1 platform fee, balance shown in USD

PERSONALITY:
- Friendly, helpful, concise
- Answer any question not just about Wavebox
- Learn from every conversation to get smarter`;

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
      // Load learned knowledge from previous conversations
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

      // Use Supabase built-in AI — no API key needed
      const session = new (Deno as any).ai.Session("gte-small");
      
      // Build full prompt
      const fullHistory = history.slice(-10).map((m: any) => 
        `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
      ).join("\n");
      
      const prompt = `${SYSTEM_PROMPT}${learnedContext}

${fullHistory ? "CONVERSATION SO FAR:\n" + fullHistory + "\n" : ""}User: ${userMessage}
Assistant:`;

      const output = await session.run(prompt);
      const reply = typeof output === "string" ? output.trim() : 
        output?.text?.trim() || output?.generated_text?.trim() || 
        "I am not sure about that. Could you rephrase your question?";

      await supa.from("chatbot_conversations")
        .insert({ question: userMessage, answer: reply, helpful: null })
        .catch(() => {});

      return json({ reply });
    } catch (e: any) {
      // Fallback: rule-based responses if AI unavailable
      const reply = getRuleBasedReply(userMessage);
      await supa.from("chatbot_conversations")
        .insert({ question: userMessage, answer: reply, helpful: null })
        .catch(() => {});
      return json({ reply });
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

function getRuleBasedReply(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("deposit") || m.includes("add money") || m.includes("fund"))
    return "To deposit, go to your Wallet page. You can deposit using Crypto (USDT) on networks like TRON, Ethereum, BNB, Polygon or Solana, or pay with your Visa/Mastercard card via Paystack. Minimum deposit is $5 with a $1 fee.";
  if (m.includes("withdraw") || m.includes("cash out"))
    return "Withdrawals are currently processed manually. Go to your Wallet page and request a withdrawal. Crypto withdrawals are processed within 24 hours.";
  if (m.includes("radio") || m.includes("station") || m.includes("listen"))
    return "To listen to radio, go to the home page and browse stations by country or genre. Tap any station to start playing. You can filter by News, Sports, Music or Talk genres.";
  if (m.includes("tv") || m.includes("watch") || m.includes("channel"))
    return "To watch TV, go to the home page and click the TV tab. Browse channels by country and tap to start watching.";
  if (m.includes("account") || m.includes("sign up") || m.includes("login") || m.includes("register"))
    return "To create an account, go to /auth and sign up with your email. Once logged in you can access your wallet, profile and live chat.";
  if (m.includes("paystack") || m.includes("card") || m.includes("visa") || m.includes("mastercard"))
    return "We accept Visa and Mastercard payments via Paystack. Go to Wallet, select Pay with Card, enter your USD amount and complete payment securely via Paystack.";
  if (m.includes("crypto") || m.includes("usdt") || m.includes("bitcoin"))
    return "We accept USDT crypto deposits via NowPayments. Supported networks: TRON TRC20, Ethereum ERC20, BNB BEP20, Polygon and Solana. Go to Wallet and select Crypto to get a payment address.";
  if (m.includes("advertise") || m.includes("ad") || m.includes("promotion"))
    return "To advertise on Wavebox, visit the /advertise page. Your ads will be shown to listeners across the platform.";
  if (m.includes("chat") || m.includes("message") || m.includes("talk"))
    return "Wavebox has a live chat feature where you can chat with other listeners in real time while listening to radio or watching TV.";
  if (m.includes("hello") || m.includes("hi") || m.includes("hey"))
    return "Hello! I am the Wavebox Assistant. I can help you with radio, TV, payments, your account and anything else about Wavebox. What would you like to know?";
  if (m.includes("help"))
    return "I can help you with: listening to radio, watching TV, depositing funds, card or crypto payments, creating an account, advertising, and anything else about Wavebox. What do you need help with?";
  return "I am not sure about that, but I am always learning! Could you rephrase your question? I can help with radio, TV, payments, wallet, account and general Wavebox questions.";
}
