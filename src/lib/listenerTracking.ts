import { supabase } from "@/integrations/supabase/client";

const KEY = "wavebox.sessionKey";

const getKey = () => {
  let k = localStorage.getItem(KEY);
  if (!k) {
    k = crypto.randomUUID();
    localStorage.setItem(KEY, k);
  }
  return k;
};

let started = false;
let startMs = 0;
let timer: number | null = null;

export const startListenerTracking = async () => {
  if (started) return;
  started = true;
  startMs = Date.now();
  const session_key = getKey();

  let geo: any = {};
  try {
    const { data } = await supabase.functions.invoke("geoip");
    geo = data || {};
  } catch {}

  const { data: { session } } = await supabase.auth.getSession();

  // upsert session row
  await supabase.from("listener_sessions").upsert(
    {
      session_key,
      user_id: session?.user.id ?? null,
      ip: geo.ip ?? null,
      country: geo.country ?? null,
      city: geo.city ?? null,
      region: geo.region ?? null,
      user_agent: navigator.userAgent.slice(0, 200),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "session_key" },
  );

  const heartbeat = async () => {
    const seconds_total = Math.round((Date.now() - startMs) / 1000);
    await supabase
      .from("listener_sessions")
      .update({ last_seen_at: new Date().toISOString(), seconds_total })
      .eq("session_key", session_key);
  };

  timer = window.setInterval(heartbeat, 30_000);
  window.addEventListener("beforeunload", () => { void heartbeat(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) startMs = Date.now() - 1000; });
};
