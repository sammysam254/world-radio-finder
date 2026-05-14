import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Radio, Tv, Play, Loader2 } from "lucide-react";

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
  "UCupvZG-5ko_eiXAupbDfxWw", // CNN
  "UCNye-wNBqNL5ZzHSJj3l8Bg", // Al Jazeera
  "UCIALMKvObZNtJ6AmdCLP7Hg", // BBC News
  "UCXIJgqnII2ZOINSWNOGFThA", // Fox News
  "UCLXo7UDZvByw2ixzpQCufnA", // Vox
  "UChBQgieUidXV1CmDxSdRm3g", // Citizen TV Kenya
  "UCqBJ47FjJcl61fmSbcadAVg", // NTV Kenya
  "UCKVsdeoHExltrWMuK0hOWmg", // KTN News
  "UCt3SE-Mvs3WwP7UW-PiFdqQ", // K24
  "UCTJhJBE8DYqS6tXZ0SfFiuA", // CGTN Africa
  "UCOGnQBpKifYsBmCMeVMbvjQ", // DW News
];

export const YouTubeBrowser = ({ onClose, initialTab = "search" }: Props) => {
  const [tab, setTab] = useState<"search" | "news" | "live">(initialTab);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YTVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = async (q: string, type?: string) => {
    if (!q.trim() && !type) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        part: "snippet",
        maxResults: "20",
        key: YT_API_KEY,
        type: "video",
        ...(type === "live" ? { eventType: "live", type: "video" } : {}),
        ...(type === "news" ? { channelId: NEWS_CHANNELS[Math.floor(Math.random() * NEWS_CHANNELS.length)], eventType: "live", type: "video" } : {}),
        ...(q ? { q } : { q: type === "live" ? "live stream radio music" : "live news" }),
      });
      const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      const data = await r.json();
      if (data.items) {
        setResults(data.items.map((item: any) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
          isLive: item.snippet.liveBroadcastContent === "live",
        })));
      }
    } catch {}
    setLoading(false);
  };

  const fetchLiveNews = async () => {
    setLoading(true);
    try {
      const allResults: YTVideo[] = [];
      await Promise.allSettled(
        NEWS_CHANNELS.slice(0, 5).map(async (channelId) => {
          const params = new URLSearchParams({
            part: "snippet",
            channelId,
            eventType: "live",
            type: "video",
            maxResults: "2",
            key: YT_API_KEY,
          });
          const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
          const data = await r.json();
          if (data.items) {
            data.items.forEach((item: any) => {
              allResults.push({
                id: item.id.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
                isLive: true,
              });
            });
          }
        })
      );
      setResults(allResults);
    } catch {}
    setLoading(false);
  };

  const fetchYTLive = async () => {
    setLoading(true);
    const queries = ["live radio", "live music stream", "live news today", "live tv stream", "radio en vivo"];
    const allResults: YTVideo[] = [];
    await Promise.allSettled(
      queries.map(async (q) => {
        const params = new URLSearchParams({
          part: "snippet", q, eventType: "live", type: "video", maxResults: "4", key: YT_API_KEY,
        });
        const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
        const data = await r.json();
        if (data.items) {
          data.items.forEach((item: any) => {
            if (!allResults.find(v => v.id === item.id.videoId)) {
              allResults.push({
                id: item.id.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails?.medium?.url,
                isLive: true,
              });
            }
          });
        }
      })
    );
    setResults(allResults);
    setLoading(false);
  };

  useEffect(() => {
    if (tab === "news") fetchLiveNews();
    else if (tab === "live") fetchYTLive();
    else if (tab === "search") {
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [tab]);

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-background shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <svg className="h-5 w-5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
            <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white"/>
          </svg>
          <span className="font-bold text-sm">YouTube</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b shrink-0 overflow-x-auto">
        {([
          { id: "search", label: "🔍 Search" },
          { id: "news",   label: "📺 Live News" },
          { id: "live",   label: "🎙️ YouTube Live" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${tab === t.id ? "bg-red-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      {tab === "search" && (
        <div className="px-4 py-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && search(query)}
              placeholder="Search YouTube — music, radio, news..."
              className="pl-9 pr-20"
            />
            <Button size="sm" onClick={() => search(query)} disabled={loading || !query.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 bg-red-500 hover:bg-red-600 text-white text-xs px-3">
              Search
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {["live radio", "live music", "lofi hip hop", "jazz radio", "gospel", "reggae live"].map(s => (
              <button key={s} onClick={() => { setQuery(s); search(s); }}
                className="text-xs px-3 py-1 rounded-full border border-border/60 text-muted-foreground hover:bg-muted transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Playing iframe */}
      {playing && (
        <div className="shrink-0 relative bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${playing}?autoplay=1&playsinline=1`}
            className="w-full aspect-video"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
          <button onClick={() => setPlaying(null)}
            className="absolute top-2 right-2 p-1 bg-black/70 rounded-full text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-red-500" />
          </div>
        )}
        {!loading && results.length === 0 && tab === "search" && (
          <div className="text-center py-16 text-muted-foreground">
            <svg className="h-12 w-12 mx-auto mb-3 text-red-500/30" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
              <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white"/>
            </svg>
            <p className="text-sm">Search for music, radio, news and more</p>
          </div>
        )}
        <div className="divide-y divide-border/20">
          {results.map(v => (
            <button key={v.id} onClick={() => setPlaying(v.id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left">
              <div className="relative shrink-0">
                <img src={v.thumbnail} alt="" className="w-24 h-14 object-cover rounded-lg bg-muted" />
                {v.isLive && (
                  <span className="absolute bottom-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1 rounded">LIVE</span>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Play className="h-6 w-6 text-white drop-shadow" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium line-clamp-2 leading-snug">{v.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{v.channelTitle}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
