const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 120_000;

const NEWS_CHANNELS = [
  "UCupvZG-5ko_eiXAupbDfxWw","UCNye-wNBqNL5ZzHSJj3l8Bg",
  "UCIALMKvObZNtJ6AmdCLP7Hg","UChBQgieUidXV1CmDxSdRm3g",
  "UCqBJ47FjJcl61fmSbcadAVg","UCKVsdeoHExltrWMuK0hOWmg",
  "UCt3SE-Mvs3WwP7UW-PiFdqQ","UCTJhJBE8DYqS6tXZ0SfFiuA",
  "UCOGnQBpKifYsBmCMeVMbvjQ","UCLLjuCopVJFpGEsGhRMrL8Q",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const KEY = Deno.env.get("YOUTUBE_API_KEY");
  if (!KEY) return new Response(JSON.stringify({ error: "YOUTUBE_API_KEY not configured" }), {
    status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "channel";

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const ytSearch = async (params: Record<string,string>) => {
    const p = new URLSearchParams({ part: "snippet", key: KEY, type: "video", ...params });
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${p}`);
    return r.json();
  };

  const mapItems = (items: any[]) => (items || [])
    .filter((i: any) => i.id?.videoId)
    .map((i: any) => ({
      id: i.id.videoId,
      title: i.snippet.title,
      channelTitle: i.snippet.channelTitle,
      thumbnail: i.snippet.thumbnails?.medium?.url || i.snippet.thumbnails?.default?.url || "",
      isLive: i.snippet.liveBroadcastContent === "live",
    }));

  // Original channel live lookup (kept for Kenya TV channels)
  if (action === "channel") {
    const channelId = url.searchParams.get("channelId");
    if (!channelId) return json({ error: "channelId required" }, 400);
    const cached = cache.get(channelId);
    if (cached && Date.now() - cached.ts < TTL) return json(cached.data);
    try {
      const data = await ytSearch({ channelId, eventType: "live", maxResults: "1" });
      cache.set(channelId, { data, ts: Date.now() });
      return json(data);
    } catch (e) { return json({ error: String(e) }, 500); }
  }

  // General search - no channelId needed
  if (action === "search") {
    const q = url.searchParams.get("q") || "live music";
    const eventType = url.searchParams.get("eventType") || "";
    const maxResults = url.searchParams.get("maxResults") || "20";
    const cacheKey = `search_${q}_${eventType}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) return json(cached.data);
    try {
      const params: Record<string,string> = { q, maxResults };
      if (eventType) params.eventType = eventType;
      const data = await ytSearch(params);
      const result = { items: mapItems(data.items || []) };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      return json(result);
    } catch (e) { return json({ error: String(e) }, 500); }
  }

  // Live news from known news channels
  if (action === "news") {
    const cacheKey = "news_live";
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) return json(cached.data);
    const all: unknown[] = [];
    await Promise.allSettled(
      NEWS_CHANNELS.map(async (channelId) => {
        try {
          const data = await ytSearch({ channelId, eventType: "live", maxResults: "2" });
          mapItems(data.items || []).forEach(v => {
            if (!all.find((a: any) => a.id === v.id)) all.push(v);
          });
        } catch {}
      })
    );
    // Fallback if no live found - search for news
    if (all.length === 0) {
      try {
        const data = await ytSearch({ q: "live news today", eventType: "live", maxResults: "20" });
        mapItems(data.items || []).forEach(v => all.push(v));
      } catch {}
    }
    const result = { items: all };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return json(result);
  }

  // YouTube Live - general live streams
  if (action === "ytlive") {
    const cacheKey = "ytlive";
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) return json(cached.data);
    const queries = [
      "live radio music", "live music stream 24/7",
      "live tv channel", "radio en vivo", "live gospel music",
    ];
    const all: unknown[] = [];
    const seen = new Set<string>();
    await Promise.allSettled(
      queries.map(async (q) => {
        try {
          const data = await ytSearch({ q, eventType: "live", maxResults: "6" });
          mapItems(data.items || []).forEach((v: any) => {
            if (!seen.has(v.id)) { seen.add(v.id); all.push(v); }
          });
        } catch {}
      })
    );
    const result = { items: all };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return json(result);
  }

  return json({ error: "unknown action" }, 400);
});
