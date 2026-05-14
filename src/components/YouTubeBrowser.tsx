import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Play, Loader2 } from "lucide-react";

const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || "";

type YTVideo = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  isLive: boolean;
};

type Props = {
  onClose: () => void;
  initialTab?: "search" | "news" | "live";
};

const NEWS_CHANNELS = [
  "UCupvZG-5ko_eiXAupbDfxWw",
  "UCNye-wNBqNL5ZzHSJj3l8Bg",
  "UCIALMKvObZNtJ6AmdCLP7Hg",
  "UChBQgieUidXV1CmDxSdRm3g",
  "UCqBJ47FjJcl61fmSbcadAVg",
  "UCKVsdeoHExltrWMuK0hOWmg",
  "UCt3SE-Mvs3WwP7UW-PiFdqQ",
  "UCTJhJBE8DYqS6tXZ0SfFiuA",
];

export const YouTubeBrowser = ({ onClose, initialTab = "search" }: Props) => {
  const [tab, setTab] = useState<"search" | "news" | "live">(initialTab);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YTVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<YTVideo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = async (q: string, opts: Record<string, string> = {}) => {
    if (!q.trim() && !opts.channelId) return;
    setLoading(true);
    setResults([]);
    try {
      const params = new URLSearchParams({
        part: "snippet",
        maxResults: "20",
        key: YT_API_KEY,
        type: "video",
        q,
        ...opts,
      });
      const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      const data = await r.json();
      if (data.error) { console.error("YT API error:", data.error.message); setLoading(false); return; }
      const videos: YTVideo[] = (data.items || [])
        .filter((item: any) => item.id?.videoId)
        .map((item: any) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
          isLive: item.snippet.liveBroadcastContent === "live",
        }));
      setResults(videos);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchLiveNews = async () => {
    setLoading(true);
    setResults([]);
    const all: YTVideo[] = [];
    await Promise.allSettled(
      NEWS_CHANNELS.map(async (channelId) => {
        try {
          const params = new URLSearchParams({
            part: "snippet", channelId, eventType: "live",
            type: "video", maxResults: "3", key: YT_API_KEY,
          });
          const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
          const data = await r.json();
          (data.items || []).forEach((item: any) => {
            if (item.id?.videoId && !all.find(v => v.id === item.id.videoId)) {
              all.push({
                id: item.id.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails?.medium?.url || "",
                isLive: true,
              });
            }
          });
        } catch {}
      })
    );
    setResults(all);
    setLoading(false);
  };

  const fetchYTLive = async () => {
    setLoading(true);
    setResults([]);
    const queries = ["live radio stream", "live music 24/7", "live news stream", "live tv channel", "radio en vivo live"];
    const all: YTVideo[] = [];
    await Promise.allSettled(
      queries.map(async (q) => {
        try {
          const params = new URLSearchParams({
            part: "snippet", q, eventType: "live",
            type: "video", maxResults: "5", key: YT_API_KEY,
          });
          const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
          const data = await r.json();
          (data.items || []).forEach((item: any) => {
            if (item.id?.videoId && !all.find(v => v.id === item.id.videoId)) {
              all.push({
                id: item.id.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails?.medium?.url || "",
                isLive: true,
              });
            }
          });
        } catch {}
      })
    );
    setResults(all);
    setLoading(false);
  };

  useEffect(() => {
    if (tab === "news") fetchLiveNews();
    else if (tab === "live") fetchYTLive();
    else setTimeout(() => inputRef.current?.focus(), 100);
  }, [tab]);

  const YTIcon = () => (
    <svg className="h-5 w-5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
      <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white"/>
    </svg>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <YTIcon />
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
        <div className="shrink-0 bg-black relative">
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
              <p className="text-gray-400 text-xs truncate">{playing.channelTitle}</p>
            </div>
            <button onClick={() => setPlaying(null)} className="shrink-0 p-1 bg-white/10 rounded-full hover:bg-white/20">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Search bar */}
      {tab === "search" && !playing && (
        <div className="px-4 py-3 shrink-0 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doSearch(query)}
                placeholder="Search music, radio, news..."
                className="pl-9"
              />
            </div>
            <Button onClick={() => doSearch(query)} disabled={loading || !query.trim()}
              className="bg-red-500 hover:bg-red-600 text-white shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["live radio", "live music", "lofi 24/7", "jazz radio", "gospel live", "reggae"].map(s => (
              <button key={s} onClick={() => { setQuery(s); doSearch(s); }}
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

        {!loading && results.length === 0 && tab === "search" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <YTIcon />
            <p className="text-sm">Search or tap a suggestion above</p>
          </div>
        )}

        {!loading && results.length === 0 && tab !== "search" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <p className="text-sm">No live streams found right now</p>
            <Button size="sm" variant="outline" onClick={tab === "news" ? fetchLiveNews : fetchYTLive}>Retry</Button>
          </div>
        )}

        <div className="divide-y divide-border/30">
          {results.map(v => (
            <button key={v.id} onClick={() => setPlaying(v)}
              className={`w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left ${playing?.id === v.id ? "bg-red-500/10" : ""}`}>
              <div className="relative shrink-0 w-28 h-16 rounded-lg overflow-hidden bg-muted">
                {v.thumbnail
                  ? <img src={v.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                  : <div className="w-full h-full flex items-center justify-center"><YTIcon /></div>
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
