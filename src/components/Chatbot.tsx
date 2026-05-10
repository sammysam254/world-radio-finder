import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Loader2, ThumbsUp, ThumbsDown } from "lucide-react";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How do I deposit?",
  "What payment methods?",
  "How to listen to radio?",
  "What is Wavebox?",
];

const Chatbot = () => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I am the Wavebox Assistant 👋 Ask me anything about radio, TV, payments, your account and more!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  const send = async (message?: string) => {
    const msg = (message || input).trim();
    if (!msg || loading) return;
    setInput("");
    setShowSuggestions(false);
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
        content: data.reply || data.error || "Sorry, something went wrong."
      }]);
    } catch {
      setMsgs(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    }
    setLoading(false);
  };

  const giveFeedback = async (index: number, helpful: boolean) => {
    if (feedback[index]) return;
    setFeedback(prev => ({ ...prev, [index]: helpful ? "up" : "down" }));
    const assistantMsg = msgs[index];
    const userMsg = msgs[index - 1];
    if (!assistantMsg || !userMsg) return;
    fetch(`${SUPA_URL}/functions/v1/chatbot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY },
      body: JSON.stringify({ action: "feedback", question: userMsg.content, answer: assistantMsg.content, helpful }),
    }).catch(() => {});
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:scale-110 transition-transform"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-4 z-50 flex flex-col bg-background border rounded-2xl shadow-2xl overflow-hidden"
          style={{ width: "min(340px, calc(100vw - 2rem))", height: "520px" }}
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-sm">Wavebox Assistant</div>
              <div className="text-xs opacity-75 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                Online · Learns from every chat
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`rounded-2xl px-3 py-2 text-sm max-w-[85%] leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}>
                  {m.content}
                </div>
                {m.role === "assistant" && i > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Helpful?</span>
                    <button onClick={() => giveFeedback(i, true)} className={`p-1 rounded transition-colors ${feedback[i] === "up" ? "text-green-500" : "text-muted-foreground hover:text-green-500"}`}>
                      <ThumbsUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => giveFeedback(i, false)} className={`p-1 rounded transition-colors ${feedback[i] === "down" ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}>
                      <ThumbsDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            {showSuggestions && msgs.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-xs border rounded-full px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t flex gap-2 shrink-0">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask anything..."
              className="text-sm"
              disabled={loading}
            />
            <Button size="icon" onClick={() => send()} disabled={loading || !input.trim()} className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
