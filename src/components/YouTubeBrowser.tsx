import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Play, Loader2 } from "lucide-react";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type YTVideo = { id: string; title: string; channelTitle: string; thumbnail: string; isLive: boolean };
type Props = { onClose: () => void; initialTab?: "search" | "news" | "live" };

const callYT = async (action: string, params: Record<string, string> = {}): Promise<YTVideo[]> => {
  const p = new URLSearchParams({ action, ...params });
  const r = await fetch(`${SUPA_URL}/functions/v1/youtube-live?${p}`, {
    headers: { apikey: SUPA_KEY },
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.items || [];
};

export const YouTubeBrowser = ({ onClose, initialTab = "search" }: Props) => {
  const [tab, setTab] = useState<"search" | "news" | "live">(initialTab);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YTVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<YTVideo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (fn: () => Promise<YTVideo[]>) => {
    setLoading(true); setError(null); setResults([]);
    try { setResults(await fn()); }
    catch (e: any) { setError(e.message || "Failed to load"); }
    setLoading(false);
  };

  useEffect(() => {
    if (tab === "news") load(() => callYT("news"));
    else if (tab === "live") load(() => callYT("ytlive"));
    else setTimeout(() => inputRef.current?.focus(), 100);
  }, [tab]);

  const doSearch = () => {
    if (!query.trim()) return;
    load(() => callYT("search", { q: query, maxResults: "20" }));
  };

  const YTLogo = () => (
    <svg className="h-5 w-5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
      <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white"/>
    </svg>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <YTLogo />
        <span className="font-bold flex-1">YouTube</span>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-2 border-b shrink-0">
        {([
          { id: "search", label: "🔍 Search" },
          { id: "news",   label: "📺 Live News" },
          { id: "live",   label: "🎙️ YT Live" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setPlaying(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${tab === t.id ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Player */}
      {playing && (
        <div className="shrink-0 bg-black">
          <iframe
            key={playing.id}
            src={`https://www.youtube-nocookie.com/embed/${playing.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
            className="w-full"
            style={{ aspectRatio: "16/9" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
          <div className="px-3 py-2 flex items-center justify-between gap-2 bg-black">
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{playing.title}</p>
              <p className="text-gray-400 text-xs">{playing.channelTitle}</p>
            </div>
            <button onClick={() => setPlaying(null)} className="p-1 bg-white/10 rounded-full shrink-0">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      {tab === "search" && (
        <div className="px-4 py-3 shrink-0 space-y-2 border-b">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doSearch()}
                placeholder="Search music, radio, news..." className="pl-9" />
            </div>
            <Button onClick={doSearch} disabled={loading || !query.trim()}
              className="bg-red-500 hover:bg-red-600 text-white shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["live radio", "live music", "lofi 24/7", "jazz radio", "gospel live", "reggae"].map(s => (
              <button key={s} onClick={() => { setQuery(s); load(() => callYT("search", { q: s, maxResults: "20" })); }}
                className="text-xs px-3 py-1 rounded-full border text-muted-foreground hover:bg-muted transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-red-500" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
            <p className="text-sm text-red-500">Error: {error}</p>
            <Button size="sm" variant="outline" onClick={() => {
              if (tab === "news") load(() => callYT("news"));
              else if (tab === "live") load(() => callYT("ytlive"));
            }}>Retry</Button>
          </div>
        )}
        {!loading && !error && results.length === 0 && tab === "search" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <YTLogo />
            <p className="text-sm">Search or tap a suggestion above</p>
          </div>
        )}
        {!loading && !error && results.length === 0 && tab !== "search" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <p className="text-sm">No live streams found right now</p>
            <Button size="sm" variant="outline" onClick={() => {
              if (tab === "news") load(() => callYT("news"));
              else load(() => callYT("ytlive"));
            }}>Retry</Button>
          </div>
        )}
        <div className="divide-y divide-border/30">
          {results.map(v => (
            <button key={v.id} onClick={() => setPlaying(v)}
              className={`w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left ${playing?.id === v.id ? "bg-red-500/10" : ""}`}>
              <div className="relative shrink-0 w-28 h-16 rounded-lg overflow-hidden bg-muted">
                {v.thumbnail
                  ? <img src={v.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                  : <div className="w-full h-full flex items-center justify-center"><YTLogo /></div>
                }
                {v.isLive && (
                  <span className="absolute bottom-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">● LIVE</span>
                )}
                {playing?.id === v.id && (
                  <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                      <Play className="h-3 w-3 text-white fill-white" />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2 leading-snug">{v.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{v.channelTitle}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
