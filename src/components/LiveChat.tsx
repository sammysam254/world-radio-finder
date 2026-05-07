import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

type Comment = {
  id: string;
  channel_kind: string;
  channel_id: string;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
};

interface Props {
  channelKind: "radio" | "tv";
  channelId: string;
  className?: string;
}

const LiveChat = ({ channelKind, channelId, className }: Props) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Auth state
  useEffect(() => {
    const apply = async (uid?: string, email?: string) => {
      if (!uid) { setMe(null); return; }
      const { data: prof } = await supabase
        .from("profiles").select("display_name, email").eq("user_id", uid).maybeSingle();
      const name = prof?.display_name || email?.split("@")[0] || "User";
      setMe({ id: uid, name });
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user.id, data.session?.user.email));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => apply(s?.user.id, s?.user.email));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load + subscribe
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("channel_comments")
        .select("*")
        .eq("channel_kind", channelKind)
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled) setComments(((data || []) as Comment[]).reverse());
    })();

    const ch = supabase
      .channel(`comments:${channelKind}:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "channel_comments", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const c = payload.new as Comment;
          if (c.channel_kind !== channelKind) return;
          setComments((prev) => [...prev, c]);
        },
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [channelKind, channelId]);

  // Auto-scroll to newest
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [comments.length]);

  const send = async () => {
    if (!me || !text.trim() || sending) return;
    const body = text.trim().slice(0, 500);
    setSending(true);
    setText("");
    const { error } = await supabase.from("channel_comments").insert({
      channel_kind: channelKind,
      channel_id: channelId,
      user_id: me.id,
      display_name: me.name,
      body,
    });
    setSending(false);
    if (error) setText(body);
  };

  return (
    <div className={`flex flex-col ${className || ""}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <MessageCircle className="h-4 w-4 opacity-70" />
        <div className="text-xs uppercase tracking-wider opacity-70">Live chat</div>
        <div className="ml-auto text-[10px] opacity-50">{comments.length}</div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {comments.length === 0 && (
          <div className="text-xs opacity-50 text-center py-6">Be the first to comment.</div>
        )}
        {comments.map((c) => (
          <div key={c.id} className="text-sm leading-snug">
            <span className="font-semibold mr-2">{c.display_name}</span>
            <span className="opacity-90 break-words">{c.body}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-2">
        {me ? (
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex gap-2"
          >
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Say something…"
              maxLength={500}
              className="h-9 bg-white/5 border-white/10"
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!text.trim() || sending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <Link
            to="/auth"
            className="block text-center text-xs py-2 rounded-md bg-white/10 hover:bg-white/15"
          >
            Sign in to join the chat
          </Link>
        )}
      </div>
    </div>
  );
};

export default LiveChat;
