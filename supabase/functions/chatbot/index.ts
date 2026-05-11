import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Smart rule-based AI - no external API needed
function generateReply(msg: string, learned: {question: string; answer: string}[]): string {
  const m = msg.toLowerCase().trim();

  // Check learned knowledge first
  for (const l of learned) {
    const q = l.question.toLowerCase();
    const words = q.split(" ").filter(w => w.length > 3);
    const matches = words.filter(w => m.includes(w)).length;
    if (matches >= 2 || (words.length === 1 && m.includes(words[0]))) {
      return l.answer;
    }
  }

  // Greetings
  if (/^(hi|hello|hey|good|howdy|sup|hola|yo)\b/.test(m))
    return "Hello! 👋 Welcome to Wavebox! I can help you with radio, TV, payments, your wallet, account and anything else. What would you like to know?";

  // Deposit / payment
  if (m.includes("deposit") || m.includes("add money") || m.includes("fund") || m.includes("top up"))
    return "To deposit funds: go to your **Wallet** page → choose **Crypto (USDT)** or **Pay with Card**.\n\n• Crypto: supports TRON, Ethereum, BNB, Polygon, Solana networks. Min $10, 2% fee.\n• Card: Visa/Mastercard via Paystack. Min $10, 4% fee.\n\nYour balance is credited in USD after payment confirmation.";

  // Crypto
  if (m.includes("crypto") || m.includes("usdt") || m.includes("bitcoin") || m.includes("tron") || m.includes("ethereum"))
    return "We accept **USDT crypto deposits** via NowPayments. Supported networks:\n• TRON (TRC20) ✅\n• Ethereum (ERC20) ✅\n• BNB Smart Chain (BEP20) ✅\n• Polygon ✅\n• Solana ✅\n\nGo to Wallet → Crypto tab → select network → get address → send exact amount.";

  // Card payment
  if (m.includes("card") || m.includes("visa") || m.includes("mastercard") || m.includes("paystack"))
    return "We accept **Visa & Mastercard** via Paystack. Go to Wallet → Pay with Card → enter amount in USD → complete payment in the secure Paystack checkout. Minimum $10, 4% fee.";

  // Balance / wallet
  if (m.includes("balance") || m.includes("wallet") || m.includes("money") || m.includes("credit"))
    return "Your wallet balance is shown in USD at the top of the Wallet page. Go to **Profile → Wallet** to view your balance and transaction history. You can deposit using Crypto USDT or Card.";

  // Radio
  if (m.includes("radio") || m.includes("station") || m.includes("listen") || m.includes("stream audio"))
    return "To listen to radio:\n1. Go to the home page\n2. Browse by **Country** or **Category**\n3. Tap any station to start playing\n\nGenres available: News, Sports, Music, Talk and more. We have thousands of stations from 200+ countries!";

  // TV
  if (m.includes("tv") || m.includes("television") || m.includes("watch") || m.includes("channel") || m.includes("iptv"))
    return "To watch live TV:\n1. Tap the **TV** tab on the home page\n2. Browse channels by country or category\n3. Tap any channel to start watching\n\nWe have news, sports, entertainment and movie channels from around the world.";

  // Football / sports
  if (m.includes("football") || m.includes("soccer") || m.includes("premier league") || m.includes("sport"))
    return "For sports content:\n• Go to **TV tab** → select **Sports** category\n• We have sports channels including beIN Sports, Sky Sports, ESPN and more\n• For radio: browse **Sports** genre in the Radio section";

  // Account / signup / login
  if (m.includes("account") || m.includes("sign up") || m.includes("register") || m.includes("login") || m.includes("sign in"))
    return "To create an account:\n1. Tap the profile icon or go to **/auth**\n2. Enter your email and password\n3. Tap **Create account**\n\nAlready have an account? Tap **Sign in** instead. Having an account lets you access your wallet, live chat and more.";

  // Chat
  if (m.includes("chat") || m.includes("message") || m.includes("talk to") || m.includes("comment"))
    return "Wavebox has **Live Chat** while listening! The chat appears on the player screen. You need to be signed in to chat. It's a great way to connect with other listeners worldwide.";

  // Advertise
  if (m.includes("advertise") || m.includes("promotion") || m.includes("marketing") || m.includes("advert"))
    return "To advertise on Wavebox, visit **wavebox.site/advertise**. Your ads reach thousands of radio and TV listeners. Fill in the form with your ad details and we'll review and activate it.";

  // Sleep timer
  if (m.includes("sleep") || m.includes("timer") || m.includes("stop after") || m.includes("auto stop"))
    return "Wavebox has a **Sleep Timer** 🌙 Tap the moon icon in the player to set it to stop after 5, 10, 15, 30, 45, 60 or 90 minutes. Perfect for falling asleep to your favourite station!";

  // Share
  if (m.includes("share") || m.includes("send to friend") || m.includes("tell friend"))
    return "To share what you're listening to, tap the **Share** button (📤) in the player. On mobile it opens the native share sheet. On desktop it copies the link to your clipboard.";

  // Equalizer
  if (m.includes("equalizer") || m.includes("eq") || m.includes("bass") || m.includes("sound quality") || m.includes("audio"))
    return "Wavebox has a built-in **Equalizer** 🎛️ Tap the sliders icon in the player to choose a preset:\n• Normal (default)\n• Bass+ (more bass)\n• Treble+ (more highs)\n• Vocal (clear voices)\n• Flat (no enhancement)";

  // Fees
  if (m.includes("fee") || m.includes("charge") || m.includes("cost") || m.includes("minimum") || m.includes("minimum deposit"))
    return "Wavebox deposit fees:\n• **Crypto (USDT)**: 2% fee, minimum $10\n• **Card (Visa/Mastercard)**: 4% fee, minimum $10\n\nYour net USD credit = amount deposited minus the fee.";

  // Wavebox info
  if (m.includes("what is wavebox") || m.includes("about wavebox") || m.includes("wavebox") || m.includes("app"))
    return "**Wavebox** (wavebox.site) is a free live radio and TV streaming app. You can:\n• Listen to thousands of radio stations worldwide 🎵\n• Watch live TV channels 📺\n• Chat with other listeners 💬\n• Use a wallet to access premium features 💰\n\nWe're based in Kenya and serve listeners globally!";

  // Help
  if (m.includes("help") || m.includes("support") || m.includes("problem") || m.includes("issue") || m.includes("not working"))
    return "I'm here to help! Here's what I can assist with:\n• 🎵 Radio & TV streaming\n• 💳 Deposits & payments\n• 👤 Account & login\n• 💰 Wallet & balance\n• 📢 Advertising\n\nWhat specific issue are you facing?";

  // Contact
  if (m.includes("contact") || m.includes("phone") || m.includes("email") || m.includes("reach"))
    return "You can reach Wavebox at:\n📞 **+254706499848**\n🌐 **wavebox.site**\n📧 Visit the advertise page for business inquiries\n\nWe're happy to help!";

  // Kenya
  if (m.includes("kenya") || m.includes("kenyan") || m.includes("nairobi"))
    return "Wavebox has great Kenyan content! 🇰🇪\n\nKenyan TV channels: Citizen TV, NTV Kenya, KTN News, KTN Home, K24, KBC, TV47, Kameme TV, Ramogi TV, Inooro TV, Switch TV\n\nFor Kenyan radio: select Kenya in the country filter on the radio page.";

  // Thank you
  if (m.includes("thank") || m.includes("thanks") || m.includes("awesome") || m.includes("great"))
    return "You're welcome! 😊 Enjoy listening on Wavebox! If you need anything else, just ask.";

  // Default
  return "I'm not sure about that specific question, but I'm always learning! 🤔\n\nI can help you with:\n• Radio & TV streaming\n• Wallet & payments\n• Account & login\n• App features\n\nCould you rephrase your question?";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(SUPA_URL, SVC);
  let body: any = {};
  try { body = await req.json(); } catch {}
  const action = body.action || "chat";

  if (action === "chat") {
    const userMessage = String(body.message || "").trim();
    if (!userMessage) return json({ error: "message required" }, 400);
    try {
      // Load learned knowledge
      const { data: learned } = await supa
        .from("chatbot_knowledge")
        .select("question, answer")
        .order("helpful_count", { ascending: false })
        .limit(20);

      const reply = generateReply(userMessage, learned || []);

      // Save conversation
      await supa.from("chatbot_conversations")
        .insert({ question: userMessage, answer: reply, helpful: null })
        .catch(() => {});

      return json({ reply });
    } catch (e: any) {
      // Even if DB fails, still reply
      const reply = generateReply(userMessage, []);
      return json({ reply });
    }
  }

  if (action === "feedback") {
    const { question, answer, helpful } = body;
    if (!question || !answer) return json({ error: "missing fields" }, 400);
    try {
      if (helpful) {
        const { data: ex } = await supa.from("chatbot_knowledge")
          .select("id, helpful_count").eq("question", question).maybeSingle();
        if (ex) {
          await supa.from("chatbot_knowledge")
            .update({ helpful_count: ex.helpful_count + 1, answer }).eq("id", ex.id);
        } else {
          await supa.from("chatbot_knowledge").insert({ question, answer, helpful_count: 1 });
        }
      }
      await supa.from("chatbot_conversations")
        .update({ helpful }).eq("question", question).eq("answer", answer);
    } catch {}
    return json({ ok: true });
  }

  return json({ error: "unknown action" }, 400);
});
