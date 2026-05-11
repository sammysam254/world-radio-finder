import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown, Brain, Loader2 } from "lucide-react";

const SUPA_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  "https://uwbjvhrqqknukfzzzsii.supabase.co";
const SUPA_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3Ymp2aHJxcWtudWtmenp6c2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjEyODYsImV4cCI6MjA5NDA5NzI4Nn0.z0Ad3sRnDiXPsXnJEvyE94ZtlrBDJ8QGTOmesJVAXmo";

type Msg = {
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  source?: string;
};

type AiStats = {
  knowledge_entries: number;
  ngram_patterns: number;
  conversations: number;
  intents: number;
};

const SUGGESTIONS = [
  "How do I deposit?",
  "How to listen to radio?",
  "Kenyan TV channels?",
  "How to withdraw?",
];

const SOURCE_LABELS: Record<string, string> = {
  knowledge_base:     "learned",
  intent_classifier:  "intent",
  knowledge_weak:     "partial",
  ngram_model:        "generated",
  partial_match:      "matched",
  fallback:           "learning…",
};

export default function Chatbot() {
  const [open, setOpen]           = useState(false);
  const [msgs, setMsgs]           = useState<Msg[]>([{
    role: "assistant",
    content: "Hi! 👋 I'm the Wavebox AI — I learn from every conversation. Ask me anything about radio, TV, payments or your account!",
  }]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [feedback, setFeedback]   = useState<Record<number, "up" | "down">>({});
  const [showSugg, setShowSugg]   = useState(true);
  const [stats, setStats]         = useState<AiStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  // Load AI stats when chat opens
  useEffect(() => {
    if (!open || stats) return;
    fetch(`${SUPA_URL}/functions/v1/chatbot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY },
      body: JSON.stringify({ action: "stats" }),
    })
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {});
  }, [open]);

  const send = async (message?: string) => {
    const msg = (message ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setShowSugg(false);

    const history = msgs.map(m => ({ role: m.role, content: m.content }));
    setMsgs(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await fetch(`${SUPA_URL}/functions/v1/chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPA_KEY },
        body: JSON.stringify({ action: "chat", message: msg, history }),
      });
      const data = await res.json();
      setMsgs(prev => [...prev, {
        role: "assistant",
        content: data.reply || data.error || "Sorry, something went wrong.",
        confidence: data.confidence,
        source: data.source,
      }]);
      // Refresh stats after each message (AI is learning)
      if (stats) {
        setStats(s => s ? { ...s, conversations: s.conversations + 1 } : s);
      }
    } catch {
      setMsgs(prev => [...prev, {
        role: "assistant",
        content: "Connection error. Please try again.",
      }]);
    }
    setLoading(false);
  };

  const giveFeedback = async (index: number, helpful: boolean) => {
    if (feedback[index]) return;
    setFeedback(prev => ({ ...prev, [index]: helpful ? "up" : "down" }));

    const assistantMsg = msgs[index];
    const userMsg      = msgs[index - 1];
    if (!assistantMsg || !userMsg) return;

    fetch(`${SUPA_URL}/functions/v1/chatbot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY },
      body: JSON.stringify({
        action: "feedback",
        question: userMsg.content,
        answer: assistantMsg.content,
        helpful,
      }),
    })
      .then(() => {
        // Update stats: thumbs up grows knowledge
        if (helpful && stats) {
          setStats(s => s ? { ...s, knowledge_entries: s.knowledge_entries + 1 } : s);
        }
      })
      .catch(() => {});
  };

  const confidenceColor = (c?: number) => {
    if (!c) return "text-muted-foreground/40";
    if (c > 0.5) return "text-green-500/60";
    if (c > 0.2) return "text-yellow-500/60";
    return "text-orange-500/60";
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform"
        style={{ background: "var(--gradient-primary)" }}
        aria-label="Open AI chat"
      >
        {open ? <X className="h-6 w-6 text-white" /> : <MessageCircle className="h-6 w-6 text-white" />}
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-4 z-50 flex flex-col bg-background border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
          style={{ width: "min(360px, calc(100vw - 2rem))", height: "560px" }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ background: "var(--gradient-primary)" }}
          >
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-white">Wavebox AI</div>
              <div className="text-xs text-white/75 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block animate-pulse" />
                Self-learning · No external APIs
              </div>
            </div>
            <button
              onClick={() => setShowStats(s => !s)}
              className="text-white/70 hover:text-white transition-colors text-xs px-2 py-1 rounded-full bg-white/10 hover:bg-white/20"
            >
              {showStats ? "Chat" : "Stats"}
            </button>
          </div>

          {/* Stats panel */}
          {showStats && stats && (
            <div className="p-4 space-y-3 border-b border-border/40 bg-muted/30 shrink-0">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Model Status</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Knowledge entries", value: stats.knowledge_entries, color: "text-green-500" },
                  { label: "N-gram patterns",   value: stats.ngram_patterns,   color: "text-blue-500" },
                  { label: "Conversations",      value: stats.conversations,    color: "text-purple-500" },
                  { label: "Intent classes",     value: stats.intents,          color: "text-orange-500" },
                ].map(s => (
                  <div key={s.label} className="bg-background rounded-xl p-3 border border-border/40">
                    <div className={`text-xl font-black ${s.color}`}>{s.value.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground bg-background rounded-xl p-3 border border-border/40">
                <span className="font-semibold text-foreground">Engine:</span> TF-IDF + Cosine Similarity + Intent Classifier + N-gram Generator + Reinforcement Learning
              </div>
            </div>
          )}

          {/* Messages */}
          {!showStats && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {msgs.map((m, i) => (
                <div key={i} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm max-w-[88%] leading-relaxed whitespace-pre-line ${
                      m.role === "user"
                        ? "text-white rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                    style={m.role === "user" ? { background: "var(--gradient-primary)" } : undefined}
                  >
                    {m.content}
                  </div>

                  {/* Source + confidence badge + feedback */}
                  {m.role === "assistant" && i > 0 && (
                    <div className="flex items-center gap-2 px-1">
                      {m.source && (
                        <span className={`text-[10px] font-mono ${confidenceColor(m.confidence)}`}>
                          {SOURCE_LABELS[m.source] ?? m.source}
                          {m.confidence ? ` ${Math.round(m.confidence * 100)}%` : ""}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground/50">·</span>
                      <span className="text-xs text-muted-foreground/50">Helpful?</span>
                      <button
                        onClick={() => giveFeedback(i, true)}
                        className={`p-0.5 rounded transition-colors ${feedback[i] === "up" ? "text-green-500" : "text-muted-foreground/50 hover:text-green-500"}`}
                        title="Good answer — AI will learn this"
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => giveFeedback(i, false)}
                        className={`p-0.5 rounded transition-colors ${feedback[i] === "down" ? "text-red-500" : "text-muted-foreground/50 hover:text-red-500"}`}
                        title="Bad answer — AI will unlearn this"
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex items-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="text-xs text-muted-foreground ml-1">thinking…</span>
                  </div>
                </div>
              )}

              {/* Suggestion chips */}
              {showSugg && msgs.length === 1 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs border border-border/60 rounded-full px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}

          {/* Input */}
          {!showStats && (
            <div className="p-3 border-t border-border/40 flex gap-2 shrink-0">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                placeholder="Ask anything…"
                className="text-sm"
                disabled={loading}
              />
              <Button
                size="icon"
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="shrink-0"
                style={{ background: "var(--gradient-primary)" }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
