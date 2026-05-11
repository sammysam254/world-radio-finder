import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function generateReply(msg: string, learned: {question: string; answer: string}[]): string {
  const m = msg.toLowerCase().trim();
  for (const l of learned) {
    const q = l.question.toLowerCase();
    const words = q.split(" ").filter(w => w.length > 3);
    const matches = words.filter(w => m.includes(w)).length;
    if (matches >= 2 || (words.length === 1 && m.includes(words[0]))) return l.answer;
  }
  if (/^(hi|hello|hey|good|howdy|sup|hola|yo)\b/.test(m))
    return "Hello! 👋 Welcome to Wavebox! I can help you with radio, TV, payments, wallet, account and more. What would you like to know?";
  if (m.includes("deposit") || m.includes("add money") || m.includes("fund") || m.includes("top up"))
    return "To deposit funds go to your Wallet page and choose Crypto USDT or Pay with Card.\n\nCrypto: supports TRON, Ethereum, BNB, Polygon and Solana. Min $10, 2% fee.\n\nCard: Visa and Mastercard via Paystack. Min $10, 4% fee.\n\nYour balance is credited in USD after payment confirmation.";
  if (m.includes("crypto") || m.includes("usdt") || m.includes("tron") || m.includes("ethereum") || m.includes("blockchain"))
    return "We accept USDT crypto deposits via NowPayments. Supported networks: TRON TRC20, Ethereum ERC20, BNB Smart Chain BEP20, Polygon and Solana.\n\nGo to Wallet then Crypto tab then select network then get address then send exact amount.";
  if (m.includes("card") || m.includes("visa") || m.includes("mastercard") || m.includes("paystack"))
    return "We accept Visa and Mastercard via Paystack. Go to Wallet then Pay with Card then enter amount in USD then complete payment in the secure Paystack checkout. Minimum $10, 4% fee.";
  if (m.includes("balance") || m.includes("wallet") || m.includes("money") || m.includes("credit"))
    return "Your wallet balance is shown in USD at the top of the Wallet page. Go to Profile then Wallet to view your balance and transaction history. You can deposit using Crypto USDT or Card.";
  if (m.includes("withdraw") || m.includes("cash out") || m.includes("send money"))
    return "Withdrawals are available in the Wallet page. Select your method: M-Pesa, Bank account or Crypto USDT. Enter amount and destination details. M-Pesa and bank are sent via Paystack instantly. Crypto within 24 hours. A $1 fee applies.";
  if (m.includes("radio") || m.includes("station") || m.includes("listen") || m.includes("stream"))
    return "To listen to radio go to the home page then browse by Country or Category then tap any station to start playing. Genres available: News, Sports, Music, Talk and more. We have thousands of stations from 200+ countries!";
  if (m.includes("tv") || m.includes("television") || m.includes("watch") || m.includes("channel") || m.includes("iptv"))
    return "To watch live TV tap the TV tab on the home page then browse channels by country or category then tap any channel to start watching. We have news, sports, entertainment and movie channels from around the world.";
  if (m.includes("football") || m.includes("soccer") || m.includes("premier league") || m.includes("sport"))
    return "For sports content go to the TV tab then select Sports category. We have sports channels including beIN Sports, Sky Sports, ESPN and more. For radio browse the Sports genre in the Radio section.";
  if (m.includes("account") || m.includes("sign up") || m.includes("register") || m.includes("login") || m.includes("sign in"))
    return "To create an account go to the auth page then enter your email and password then tap Create account. Already have an account? Tap Sign in. Having an account lets you access your wallet, live chat and more.";
  if (m.includes("chat") || m.includes("message") || m.includes("comment"))
    return "Wavebox has Live Chat while listening! The chat appears on the player screen. You need to be signed in to chat. It is a great way to connect with other listeners worldwide.";
  if (m.includes("advertise") || m.includes("promotion") || m.includes("marketing"))
    return "To advertise on Wavebox visit wavebox.site/advertise. Your ads reach thousands of radio and TV listeners. Fill in the form with your ad details and we will review and activate it.";
  if (m.includes("sleep") || m.includes("timer") || m.includes("stop after") || m.includes("auto stop"))
    return "Wavebox has a Sleep Timer. Tap the moon icon in the player to set it to stop after 5, 10, 15, 30, 45, 60 or 90 minutes. Perfect for falling asleep to your favourite station!";
  if (m.includes("share") || m.includes("send to friend"))
    return "To share what you are listening to tap the Share button in the player. On mobile it opens the native share sheet. On desktop it copies the link to your clipboard.";
  if (m.includes("equalizer") || m.includes("bass") || m.includes("sound quality") || m.includes("audio"))
    return "Wavebox has a built-in Equalizer. Tap the sliders icon in the player to choose a preset: Normal, Bass+, Treble+, Vocal or Flat.";
  if (m.includes("fee") || m.includes("charge") || m.includes("cost") || m.includes("minimum"))
    return "Wavebox deposit fees: Crypto USDT is 2% fee with minimum $10. Card Visa and Mastercard is 4% fee with minimum $10. Your net USD credit equals amount deposited minus the fee.";
  if (m.includes("what is wavebox") || m.includes("about wavebox") || m.includes("wavebox"))
    return "Wavebox at wavebox.site is a free live radio and TV streaming app. You can listen to thousands of radio stations worldwide, watch live TV channels, chat with other listeners and use a wallet to access premium features. We are based in Kenya and serve listeners globally!";
  if (m.includes("kenya") || m.includes("kenyan") || m.includes("nairobi"))
    return "Wavebox has great Kenyan content! Kenyan TV channels include Citizen TV, NTV Kenya, KTN News, KTN Home, K24, KBC, TV47, Kameme TV, Ramogi TV, Inooro TV and Switch TV. For Kenyan radio select Kenya in the country filter on the radio page.";
  if (m.includes("contact") || m.includes("phone") || m.includes("reach") || m.includes("support"))
    return "You can reach Wavebox at phone number +254706499848 or visit wavebox.site. For business inquiries visit the advertise page. We are happy to help!";
  if (m.includes("thank") || m.includes("thanks") || m.includes("awesome") || m.includes("great"))
    return "You are welcome! Enjoy listening on Wavebox! If you need anything else just ask.";
  if (m.includes("help") || m.includes("problem") || m.includes("issue") || m.includes("not working"))
    return "I am here to help! I can assist with Radio and TV streaming, Deposits and payments, Account and login, Wallet and balance, and Advertising. What specific issue are you facing?";
  return "I am not sure about that specific question but I am always learning! I can help you with radio and TV streaming, wallet and payments, account and login, and app features. Could you rephrase your question?";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let body: any = {};
  try { body = await req.json(); } catch {}
  const action = body.action || "chat";

  if (action === "chat") {
    const userMessage = String(body.message || "").trim();
    if (!userMessage) return json({ error: "message required" }, 400);
    let learned: {question: string; answer: string}[] = [];
    try {
      const supa = createClient(SUPA_URL, SVC);
      const { data } = await supa.from("chatbot_knowledge").select("question, answer").order("helpful_count", { ascending: false }).limit(20);
      learned = data || [];
      const reply = generateReply(userMessage, learned);
      await supa.from("chatbot_conversations").insert({ question: userMessage, answer: reply, helpful: null }).catch(() => {});
      return json({ reply });
    } catch {
      return json({ reply: generateReply(userMessage, []) });
    }
  }

  if (action === "feedback") {
    const { question, answer, helpful } = body;
    if (!question || !answer) return json({ error: "missing fields" }, 400);
    try {
      const supa = createClient(SUPA_URL, SVC);
      if (helpful) {
        const { data: ex } = await supa.from("chatbot_knowledge").select("id, helpful_count").eq("question", question).maybeSingle();
        if (ex) {
          await supa.from("chatbot_knowledge").update({ helpful_count: ex.helpful_count + 1, answer }).eq("id", ex.id);
        } else {
          await supa.from("chatbot_knowledge").insert({ question, answer, helpful_count: 1 });
        }
      }
      await supa.from("chatbot_conversations").update({ helpful }).eq("question", question).eq("answer", answer);
    } catch {}
    return json({ ok: true });
  }

  return json({ error: "unknown action" }, 400);
});
