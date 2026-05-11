/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║         WAVEBOX SELF-LEARNING AI ENGINE  v2.0                   ║
 * ║                                                                  ║
 * ║  Fully autonomous — zero external AI APIs required.             ║
 * ║                                                                  ║
 * ║  Architecture:                                                   ║
 * ║  1. Tokenizer      — normalise + tokenise input                 ║
 * ║  2. TF-IDF Engine  — term frequency / inverse doc frequency     ║
 * ║  3. Cosine Sim     — vector similarity matching                 ║
 * ║  4. Intent Classifier — weighted intent detection               ║
 * ║  5. N-gram Model   — bigram/trigram response generation         ║
 * ║  6. Confidence     — knows when it's sure vs uncertain          ║
 * ║  7. Reinforcement  — thumbs up/down updates weights in DB       ║
 * ║  8. Continuous Learning — every conversation trains the model   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SVC      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ok  = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const err = (msg: string, s = 400) => new Response(JSON.stringify({ error: msg }), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ═══════════════════════════════════════════════════════════════════
// 1. TOKENIZER
// ═══════════════════════════════════════════════════════════════════

const STOP_WORDS = new Set([
  "a","an","the","is","it","in","on","at","to","for","of","and","or","but",
  "i","me","my","you","your","we","our","they","their","this","that","with",
  "do","did","does","be","been","was","were","are","have","has","had","will",
  "can","could","would","should","may","might","shall","not","no","yes","so",
  "if","as","by","from","up","about","into","through","during","before","after",
  "what","which","who","how","when","where","why","please","just","also","very",
  "get","got","go","going","want","need","like","know","think","tell","show",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

function ngrams(tokens: string[], n: number): string[] {
  const result: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    result.push(tokens.slice(i, i + n).join(" "));
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// 2. TF-IDF ENGINE
// ═══════════════════════════════════════════════════════════════════

function computeTF(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const total = tokens.length || 1;
  const tf = new Map<string, number>();
  for (const [t, c] of freq) tf.set(t, c / total);
  return tf;
}

function computeIDF(docs: string[][]): Map<string, number> {
  const N = docs.length;
  const df = new Map<string, number>();
  for (const doc of docs) {
    const seen = new Set(doc);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log((N + 1) / (d + 1)) + 1);
  return idf;
}

function tfidfVector(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = computeTF(tokens);
  const vec = new Map<string, number>();
  for (const [t, tfVal] of tf) {
    vec.set(t, tfVal * (idf.get(t) ?? 1));
  }
  return vec;
}

// ═══════════════════════════════════════════════════════════════════
// 3. COSINE SIMILARITY
// ═══════════════════════════════════════════════════════════════════

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, magA = 0, magB = 0;
  for (const [t, v] of a) {
    dot  += v * (b.get(t) ?? 0);
    magA += v * v;
  }
  for (const [, v] of b) magB += v * v;
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ═══════════════════════════════════════════════════════════════════
// 4. INTENT CLASSIFIER
// ═══════════════════════════════════════════════════════════════════

interface Intent {
  intent: string;
  examples: string[];
  response: string;
  weight: number;
}

function classifyIntent(
  queryTokens: string[],
  intents: Intent[],
  idf: Map<string, number>
): { intent: Intent; score: number } | null {
  const queryVec = tfidfVector(queryTokens, idf);
  let best: { intent: Intent; score: number } | null = null;

  for (const intent of intents) {
    // Build combined example document
    const exampleTokens = intent.examples.flatMap(e => tokenize(e));
    const exampleVec = tfidfVector(exampleTokens, idf);
    const sim = cosineSim(queryVec, exampleVec) * intent.weight;

    // Also check direct keyword overlap (boost exact matches)
    const overlap = queryTokens.filter(t => intent.examples.some(e => e.includes(t))).length;
    const score = sim + (overlap * 0.15);

    if (!best || score > best.score) {
      best = { intent, score };
    }
  }

  return best && best.score > 0.05 ? best : null;
}

// ═══════════════════════════════════════════════════════════════════
// 5. KNOWLEDGE BASE RETRIEVAL (TF-IDF + Cosine)
// ═══════════════════════════════════════════════════════════════════

interface KnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  helpful_count: number;
  bad_count: number;
}

function retrieveKnowledge(
  queryTokens: string[],
  knowledge: KnowledgeEntry[],
  idf: Map<string, number>
): { entry: KnowledgeEntry; score: number } | null {
  if (knowledge.length === 0) return null;

  const queryVec = tfidfVector(queryTokens, idf);
  let best: { entry: KnowledgeEntry; score: number } | null = null;

  for (const entry of knowledge) {
    const entryTokens = tokenize(entry.question + " " + entry.answer);
    const entryVec = tfidfVector(entryTokens, idf);
    const sim = cosineSim(queryVec, entryVec);

    // Weight by feedback: helpful_count boosts, bad_count penalises
    const feedbackWeight = 1 + (entry.helpful_count * 0.1) - (entry.bad_count * 0.2);
    const score = sim * Math.max(0.1, feedbackWeight);

    if (!best || score > best.score) {
      best = { entry, score };
    }
  }

  return best && best.score > 0.15 ? best : null;
}

// ═══════════════════════════════════════════════════════════════════
// 6. N-GRAM RESPONSE GENERATOR
// ═══════════════════════════════════════════════════════════════════

interface Ngram {
  context: string;
  next: string;
  weight: number;
}

function generateFromNgrams(
  seedTokens: string[],
  ngramMap: Map<string, { next: string; weight: number }[]>,
  maxWords = 40
): string {
  if (seedTokens.length === 0 || ngramMap.size === 0) return "";

  const result = [...seedTokens.slice(-2)];

  for (let i = 0; i < maxWords; i++) {
    const context2 = result.slice(-2).join(" ");
    const context1 = result.slice(-1).join(" ");

    const candidates = ngramMap.get(context2) ?? ngramMap.get(context1) ?? [];
    if (candidates.length === 0) break;

    // Weighted random selection
    const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosen = candidates[0].next;
    for (const c of candidates) {
      rand -= c.weight;
      if (rand <= 0) { chosen = c.next; break; }
    }

    result.push(chosen);
    if ([".", "!", "?"].includes(chosen)) break;
  }

  return result.slice(seedTokens.length).join(" ");
}

// ═══════════════════════════════════════════════════════════════════
// 7. CONTEXT-AWARE RESPONSE BUILDER
// ═══════════════════════════════════════════════════════════════════

function buildContextualResponse(
  query: string,
  queryTokens: string[],
  history: { role: string; content: string }[],
  intentResult: { intent: Intent; score: number } | null,
  knowledgeResult: { entry: KnowledgeEntry; score: number } | null,
  ngramGenerated: string
): { response: string; confidence: number; source: string } {

  // Check conversation context — did user ask a follow-up?
  const lastAssistant = history.filter(h => h.role === "assistant").slice(-1)[0]?.content ?? "";
  const isFollowUp = history.length > 2 && queryTokens.some(t =>
    ["more","else","also","another","what about","tell me","explain","how","why"].includes(t)
  );

  // Priority 1: High-confidence knowledge base match (learned from real users)
  if (knowledgeResult && knowledgeResult.score > 0.45) {
    return {
      response: knowledgeResult.entry.answer,
      confidence: knowledgeResult.score,
      source: "knowledge_base"
    };
  }

  // Priority 2: Intent match with good confidence
  if (intentResult && intentResult.score > 0.12) {
    let response = intentResult.intent.response;

    // Personalise based on context
    if (isFollowUp && lastAssistant) {
      response = response; // could add "Also, " prefix in future
    }

    return {
      response,
      confidence: intentResult.score,
      source: "intent_classifier"
    };
  }

  // Priority 3: Weaker knowledge match
  if (knowledgeResult && knowledgeResult.score > 0.08) {
    return {
      response: knowledgeResult.entry.answer,
      confidence: knowledgeResult.score,
      source: "knowledge_weak"
    };
  }

  // Priority 4: N-gram generated response (if meaningful)
  if (ngramGenerated && ngramGenerated.split(" ").length > 5) {
    return {
      response: `Based on what I've learned: ${ngramGenerated}`,
      confidence: 0.3,
      source: "ngram_model"
    };
  }

  // Priority 5: Intelligent fallback with partial understanding
  const partialMatch = getPartialMatch(queryTokens);
  if (partialMatch) {
    return { response: partialMatch, confidence: 0.2, source: "partial_match" };
  }

  return {
    response: "I'm still learning about that! 🤔 I can help with radio & TV streaming, wallet & payments, account setup, and advertising on Wavebox. Could you rephrase your question?",
    confidence: 0,
    source: "fallback"
  };
}

function getPartialMatch(tokens: string[]): string | null {
  const map: Record<string, string> = {
    "pay":      "For payments, go to Wallet → choose Crypto USDT (min $10) or Card via Paystack (min $5).",
    "money":    "Your wallet balance is shown on the Wallet page. You can deposit via Crypto or Card.",
    "music":    "Browse thousands of music radio stations by country or genre on the home page!",
    "news":     "We have News radio stations and TV channels worldwide. Browse by the News category!",
    "sport":    "Sports radio and TV channels available! Browse the Sports category on radio or TV tab.",
    "free":     "Yes! Wavebox is completely free to listen and watch. Wallet is only needed for advertising.",
    "app":      "Wavebox works in your browser at wavebox.site. An Android app is also available!",
    "problem":  "Sorry to hear that! Contact us at +254706499848 or describe your issue and I'll help.",
    "error":    "If you're seeing an error, try refreshing the page. Still stuck? Contact +254706499848.",
    "slow":     "If streaming is slow, try a different station or check your internet connection.",
    "offline":  "If a station is offline, tap the next station. We auto-retry multiple stream URLs!",
    "account":  "Create a free account at wavebox.site/auth with your email and password.",
    "password": "To reset your password, use the forgot password option on the sign-in page.",
    "admin":    "The admin dashboard is at /admin. Only the admin account has access.",
    "africa":   "We have radio and TV stations from all African countries! Select your country to browse.",
    "swahili":  "Tunasaidia kwa Kiswahili pia! Niulize chochote kuhusu Wavebox.",
  };

  for (const token of tokens) {
    for (const [key, response] of Object.entries(map)) {
      if (token.includes(key) || key.includes(token)) return response;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// 8. LEARNING ENGINE — train from new conversations
// ═══════════════════════════════════════════════════════════════════

async function trainFromConversation(
  supa: ReturnType<typeof createClient>,
  question: string,
  answer: string
): Promise<void> {
  try {
    // Extract bigrams and trigrams from the answer and store them
    const tokens = tokenize(answer);
    if (tokens.length < 3) return;

    const pairs: { context: string; next: string }[] = [];

    // Bigrams
    for (let i = 0; i < tokens.length - 1; i++) {
      pairs.push({ context: tokens[i], next: tokens[i + 1] });
    }
    // Trigrams
    for (let i = 0; i < tokens.length - 2; i++) {
      pairs.push({ context: `${tokens[i]} ${tokens[i + 1]}`, next: tokens[i + 2] });
    }

    // Batch upsert ngrams
    for (const pair of pairs.slice(0, 50)) { // limit per conversation
      await supa.rpc("upsert_ngram", {
        _context: pair.context,
        _next: pair.next,
      }).catch(() => {});
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: any = {};
  try { body = await req.json(); } catch {}

  const action = body.action || "chat";
  const supa = createClient(SUPA_URL, SVC);

  // ── CHAT ────────────────────────────────────────────────────────
  if (action === "chat") {
    const userMessage = String(body.message || "").trim().slice(0, 800);
    if (!userMessage) return err("message required");

    const history: { role: string; content: string }[] = Array.isArray(body.history)
      ? body.history.slice(-8)
      : [];

    // Load all data in parallel
    const [intentsRes, knowledgeRes, ngramsRes] = await Promise.all([
      supa.from("chatbot_intents").select("intent, examples, response, weight").order("weight", { ascending: false }),
      supa.from("chatbot_knowledge").select("id, question, answer, helpful_count, bad_count").order("helpful_count", { ascending: false }).limit(200),
      supa.from("chatbot_ngrams").select("context, next, weight").limit(2000),
    ]);

    const intents: Intent[]          = (intentsRes.data || []) as Intent[];
    const knowledge: KnowledgeEntry[] = (knowledgeRes.data || []) as KnowledgeEntry[];
    const ngramRows: Ngram[]          = (ngramsRes.data || []) as Ngram[];

    // Build n-gram lookup map
    const ngramMap = new Map<string, { next: string; weight: number }[]>();
    for (const row of ngramRows) {
      const arr = ngramMap.get(row.context) ?? [];
      arr.push({ next: row.next, weight: row.weight });
      ngramMap.set(row.context, arr);
    }

    // Tokenize query
    const queryTokens = tokenize(userMessage);

    // Build IDF from all documents (intents + knowledge)
    const allDocs = [
      ...intents.map(i => tokenize(i.examples.join(" ") + " " + i.response)),
      ...knowledge.map(k => tokenize(k.question + " " + k.answer)),
      queryTokens,
    ];
    const idf = computeIDF(allDocs);

    // Run classifiers
    const intentResult   = classifyIntent(queryTokens, intents, idf);
    const knowledgeResult = retrieveKnowledge(queryTokens, knowledge, idf);

    // Generate from n-gram model using query tokens as seed
    const ngramGenerated = generateFromNgrams(queryTokens.slice(0, 2), ngramMap, 30);

    // Build final response
    const { response, confidence, source } = buildContextualResponse(
      userMessage, queryTokens, history,
      intentResult, knowledgeResult, ngramGenerated
    );

    // Store conversation + train model asynchronously
    const storePromise = supa.from("chatbot_conversations").insert({
      question: userMessage,
      answer: response,
      helpful: null,
      ai_model: `self-v2/${source}/${confidence.toFixed(2)}`,
    });

    const trainPromise = trainFromConversation(supa, userMessage, response);

    await Promise.all([storePromise, trainPromise]).catch(() => {});

    return ok({ reply: response, confidence, source });
  }

  // ── FEEDBACK ────────────────────────────────────────────────────
  if (action === "feedback") {
    const { question, answer, helpful } = body;
    if (!question || !answer) return err("missing fields");

    try {
      // Update conversation
      await supa.from("chatbot_conversations")
        .update({ helpful })
        .eq("question", question)
        .eq("answer", answer);

      if (helpful === true) {
        // Reinforce: add/boost in knowledge base
        const { data: existing } = await supa.from("chatbot_knowledge")
          .select("id, helpful_count")
          .eq("question", question)
          .maybeSingle();

        if (existing) {
          await supa.from("chatbot_knowledge")
            .update({ helpful_count: existing.helpful_count + 1, answer, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supa.from("chatbot_knowledge")
            .insert({ question, answer, helpful_count: 1, bad_count: 0 });
        }

        // Also train n-grams from this good answer
        await trainFromConversation(supa, question, answer);

      } else if (helpful === false) {
        // Penalise: increment bad_count
        const { data: existing } = await supa.from("chatbot_knowledge")
          .select("id, bad_count")
          .eq("question", question)
          .maybeSingle();

        if (existing) {
          await supa.from("chatbot_knowledge")
            .update({ bad_count: existing.bad_count + 1, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        }
      }
    } catch {}

    return ok({ ok: true });
  }

  // ── TRAIN (admin endpoint to bulk-train from past conversations) ─
  if (action === "train") {
    try {
      // Pull all helpful conversations and reinforce knowledge
      const { data: helpful } = await supa.from("chatbot_conversations")
        .select("question, answer")
        .eq("helpful", true)
        .limit(500);

      let trained = 0;
      for (const conv of (helpful || [])) {
        const { data: existing } = await supa.from("chatbot_knowledge")
          .select("id, helpful_count")
          .eq("question", conv.question)
          .maybeSingle();

        if (existing) {
          await supa.from("chatbot_knowledge")
            .update({ helpful_count: existing.helpful_count + 1, answer: conv.answer })
            .eq("id", existing.id);
        } else {
          await supa.from("chatbot_knowledge")
            .insert({ question: conv.question, answer: conv.answer, helpful_count: 1 });
        }
        await trainFromConversation(supa, conv.question, conv.answer);
        trained++;
      }

      return ok({ ok: true, trained });
    } catch (e) {
      return err(String(e), 500);
    }
  }

  // ── STATS (how smart is the AI right now?) ───────────────────────
  if (action === "stats") {
    const [kRes, nRes, cRes, iRes] = await Promise.all([
      supa.from("chatbot_knowledge").select("id", { count: "exact", head: true }),
      supa.from("chatbot_ngrams").select("id", { count: "exact", head: true }),
      supa.from("chatbot_conversations").select("id", { count: "exact", head: true }),
      supa.from("chatbot_intents").select("id", { count: "exact", head: true }),
    ]);

    return ok({
      knowledge_entries: kRes.count ?? 0,
      ngram_patterns:    nRes.count ?? 0,
      conversations:     cRes.count ?? 0,
      intents:           iRes.count ?? 0,
      model_version:     "self-v2",
      capabilities:      ["tfidf", "cosine_similarity", "intent_classification", "ngram_generation", "reinforcement_learning"],
    });
  }

  return err("unknown action");
});
