import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Loader2, ThumbsUp, ThumbsDown } from "lucide-react";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Message = { role: "user" | "assistant"; content: string };

const Chatbot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm the Wavebox Assistant 👋 Ask me anything about the app — radio, TV, wallet, payments or anything else!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await fetch(`${SUPA_URL}/functions/v1/chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPA_KEY },
        body: JSON.stringify({ action: "chat", message: msg, history }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || "Sorry, something went wrong." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I am having trouble connecting. Please try again." }]);
    }
    setLoading(false);
  };

  const sendFeedback = async (index: number, helpful: boolean) => {
    if (feedback[index]) return;
    setFeedback(prev => ({ ...prev, [index]: helpful ? "up" : "down" }));
    const assistantMsg = messages[index];
    const userMsg = messages[index - 1];
    if (!assistantMsg || !userMsg) return;
    await fetch(`${SUPA_URL}/functions/v1/chatbot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY },
      body: JSON.stringify({ action: "feedback", question: userMsg.content, answer: assistantMsg.content, helpful }),
    }).catch(() => {});
  };

  return (
    <>
      <button onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)] bg-background border rounded-2xl shadow-2xl flex flex-col" style={{ height: "480px" }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-primary text-primary-foreground rounded-t-2xl">
            <MessageCircle className="h-5 w-5" />
            <div>
              <div className="font-semibold text-sm">Wavebox Assistant</div>
              <div className="text-xs opacity-75">Ask me anything</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`rounded-2xl px-3 py-2 text-sm max-w-[85%] ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                  {m.content}
                </div>
                {m.role === "assistant" && i > 0 && (
                  <div className="flex gap-1 mt-1">
                    <button onClick={() => sendFeedback(i, true)} className={`p-1 rounded-full transition-colors ${feedback[i] === "up" ? "text-green-500" : "text-muted-foreground hover:text-green-500"}`}>
                      <ThumbsUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => sendFeedback(i, false)} className={`p-1 rounded-full transition-colors ${feedback[i] === "down" ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}>
                      <ThumbsDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-muted-foreground text-xs">Typing...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask something..." className="text-sm" disabled={loading} />
            <Button size="icon" onClick={send} disabled={loading || !input.trim()} className="shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
