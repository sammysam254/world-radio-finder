const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "";
  let info: any = { ip };
  try {
    const r = await fetch(`https://ipapi.co/${ip || ""}/json/`);
    if (r.ok) {
      const j = await r.json();
      info = {
        ip: j.ip || ip,
        country: j.country_name || null,
        city: j.city || null,
        region: j.region || null,
      };
    }
  } catch {}
  return new Response(JSON.stringify(info), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
