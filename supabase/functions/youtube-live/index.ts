// Resolves the current live videoId for a YouTube channel ID.
// Uses YOUTUBE_API_KEY (server-side secret). Caches results for 60s in memory.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const cache = new Map<string, { videoId: string | null; ts: number }>();
const TTL = 60_000; // 60s

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const channelId = url.searchParams.get("channelId");
    if (!channelId) {
      return new Response(JSON.stringify({ error: "channelId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cached = cache.get(channelId);
    if (cached && Date.now() - cached.ts < TTL) {
      return new Response(JSON.stringify({ videoId: cached.videoId, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!KEY) {
      return new Response(JSON.stringify({ error: "YOUTUBE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const api = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${KEY}`;
    const r = await fetch(api);
    const data = await r.json();
    if (!r.ok) {
      console.error("YouTube API error", data);
      return new Response(JSON.stringify({ videoId: null, error: data?.error?.message || "api_error" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const videoId: string | null = data.items?.[0]?.id?.videoId || null;
    cache.set(channelId, { videoId, ts: Date.now() });
    return new Response(JSON.stringify({ videoId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("youtube-live error", e);
    return new Response(JSON.stringify({ videoId: null, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
