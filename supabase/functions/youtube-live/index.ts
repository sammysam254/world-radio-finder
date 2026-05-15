// YouTube edge function - handles live channel lookup AND search
// Uses YOUTUBE_API_KEY (server-side secret)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 60_000;

const NEWS_CHANNELS = [
  "UCupvZG-5ko_eiXAupbDfxWw",
  "UCNye-wNBqNL5ZzHSJj3l8Bg",
  "UCIALMKvObZNtJ6AmdCLP7Hg",
  "UChBQgieUidXV1CmDxSdRm3g",
  "UCqBJ47FjJcl61fmSbcadAVg",
  "UCKVsdeoHExltrWMuK0hOWmg",
  "UCt3SE-Mvs3WwP7UW-PiFdqQ",
  "UCTJhJBE8DYqS6tXZ0SfFiuA",
  "UCOGnQBpKifYsBmCMeVMbvjQ",
  "UCLLjuCopVJFpGEsGhRMrL8Q",
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

  // Original channel live lookup
  if (action === "channel") {
    const channelId = url.searchParams.get("channelId");
    if (!channelId) return json({ error: "channelId required" }, 400);
    const cached = cache.get(channelId);
    if (cached && Date.now() - cached.ts < TTL) return json(cached.data);
    try {
      const api = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${KEY}`;
      const r = await fetch(api);
      const data = await r.json();
      cache.set(channelId, { data, ts: Date.now() });
      return json(data);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }

  // Search
  if (action === "search") {
    const q = url.searchParams.get("q") || "";
    const eventType = url.searchParams.get("eventType") || "";
    const maxResults = url.searchParams.get("maxResults") || "20";
    const cacheKey = `search_${q}_${eventType}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) return json(cached.data);
    try {
      const params = new URLSearchParams({
        part: "snippet", key: KEY, type: "video",
        maxResults, q,
        ...(eventType ? { eventType } : {}),
      });
      const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      const data = await r.json();
      const result = {
        items: (data.items || []).filter((i: any) => i.id?.videoId).map((i: any) => ({
          id: i.id.videoId,
          title: i.snippet.title,
          channelTitle: i.snippet.channelTitle,
          thumbnail: i.snippet.thumbnails?.medium?.url || i.snippet.thumbnails?.default?.url || "",
          isLive: i.snippet.liveBroadcastContent === "live",
        })),
      };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      return json(result);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }

  // Live news - fetch from known news channels
  if (action === "news") {
    const cacheKey = "news_live";
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) return json(cached.data);
    const all: unknown[] = [];
    await Promise.allSettled(
      NEWS_CHANNELS.map(async (channelId) => {
        try {
          const params = new URLSearchParams({
            part: "snippet", channelId, eventType: "live",
            type: "video", maxResults: "2", key: KEY,
          });
          const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
          const data = await r.json();
          (data.items || []).forEach((i: any) => {
            if (i.id?.videoId) {
              all.push({
                id: i.id.videoId,
                title: i.snippet.title,
                channelTitle: i.snippet.channelTitle,
                thumbnail: i.snippet.thumbnails?.medium?.url || "",
                isLive: true,
              });
            }
          });
        } catch {}
      })
    );
    const result = { items: all };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return json(result);
  }

  // YouTube Live - general live streams
  if (action === "ytlive") {
    const cacheKey = "ytlive";
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) return json(cached.data);
    const queries = ["live radio stream", "live music 24/7", "live news stream", "radio en vivo", "live tv stream"];
    const all: unknown[] = [];
    const seen = new Set<string>();
    await Promise.allSettled(
      queries.map(async (q) => {
        try {
          const params = new URLSearchParams({
            part: "snippet", q, eventType: "live",
            type: "video", maxResults: "5", key: KEY,
          });
          const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
          const data = await r.json();
          (data.items || []).forEach((i: any) => {
            if (i.id?.videoId && !seen.has(i.id.videoId)) {
              seen.add(i.id.videoId);
              all.push({
                id: i.id.videoId,
                title: i.snippet.title,
                channelTitle: i.snippet.channelTitle,
                thumbnail: i.snippet.thumbnails?.medium?.url || "",
                isLive: true,
              });
            }
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
