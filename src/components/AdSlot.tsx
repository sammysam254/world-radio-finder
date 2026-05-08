import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Ad = {
  id: string;
  source: "admin" | "advertiser";
  kind: "video_file" | "video_url" | "monetag_url";
  title: string;
  payload: string;
  sequence: number;
};

const PROGRESS_KEY = "wavebox.adProgress.v1";
const loadIdx = () => { try { return parseInt(localStorage.getItem(PROGRESS_KEY) || "0", 10) || 0; } catch { return 0; } };
const saveIdx = (i: number) => { try { localStorage.setItem(PROGRESS_KEY, String(i)); } catch {} };

const isYouTube = (u: string) => /youtu\.?be/.test(u);
const ytEmbed = (u: string) => {
  const m = u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1&controls=0&modestbranding=1&playsinline=1&rel=0` : u;
};

interface Props {
  onAdComplete?: () => void;
  onSkippable?: () => void;
}

/**
 * AdSlot — single ad per commercial break.
 * - All ads (admin + approved advertiser ads) are merged and rotated by sequence,
 *   one shown per break, persisted across breaks via localStorage.
 * - Advertiser ads charge the advertiser's wallet via RPC on display; if the
 *   charge fails (no funds / cap hit), the ad is skipped to the next.
 */
export const AdSlot = ({ onAdComplete, onSkippable }: Props) => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [current, setCurrent] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const skipRef = useRef<number | null>(null);
  const advanceRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);

  // Load + preload
  useEffect(() => {
    (async () => {
      const [adminRes, advRes] = await Promise.all([
        supabase.from("ads").select("*").eq("active", true).order("sequence", { ascending: true }),
        supabase.from("advertiser_ads").select("id,kind,title,payload,created_at").eq("status", "approved").order("created_at", { ascending: true }),
      ]);
      const adminAds = ((adminRes.data || []) as any[]).map((a) => ({
        id: a.id, source: "admin" as const, kind: a.kind, title: a.title, payload: a.payload, sequence: a.sequence ?? 0,
      })) as Ad[];
      const advAds = ((advRes.data || []) as any[]).map((a, i) => ({
        id: a.id, source: "advertiser" as const, kind: a.kind, title: a.title, payload: a.payload, sequence: 1000 + i,
      })) as Ad[];
      const list = [...adminAds, ...advAds];
      setAds(list);
      setLoading(false);

      // Preload direct video URLs
      list.forEach((a) => {
        if ((a.kind === "video_url" && !isYouTube(a.payload)) || a.kind === "video_file") {
          const link = document.createElement("link");
          link.rel = "preload"; link.as = "video"; link.href = a.payload;
          document.head.appendChild(link);
        }
      });
    })();
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick the next ad to show, advancing rotation index. Charge advertisers.
  useEffect(() => {
    if (loading) return;
    (async () => {
      if (ads.length === 0) { setCurrent(null); return; }
      let startIdx = loadIdx() % ads.length;
      // Try up to N ads to find one we can show (advertiser charge may fail)
      for (let attempts = 0; attempts < ads.length; attempts++) {
        const idx = (startIdx + attempts) % ads.length;
        const ad = ads[idx];
        if (ad.source === "advertiser") {
          const { data, error } = await supabase.rpc("charge_advertiser_impression", { _ad_id: ad.id });
          if (error || data === null) continue; // skip — no funds or cap reached
        }
        saveIdx((idx + 1) % ads.length);
        setCurrent(ad);
        return;
      }
      // Nothing chargeable — fall back to first admin ad
      const fallback = ads.find(a => a.source === "admin") || null;
      setCurrent(fallback);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, ads]);

  const clearTimers = () => {
    if (skipRef.current) window.clearTimeout(skipRef.current);
    if (advanceRef.current) window.clearTimeout(advanceRef.current);
  };

  useEffect(() => {
    if (!current) return;
    clearTimers();
    skipRef.current = window.setTimeout(() => onSkippable?.(), 5000) as unknown as number;
    const cap = (current.kind === "monetag_url" || (current.kind === "video_url" && isYouTube(current.payload))) ? 20000 : 60000;
    advanceRef.current = window.setTimeout(() => finish(), cap) as unknown as number;

    const v = videoRef.current;
    if (v && (current.kind === "video_file" || (current.kind === "video_url" && !isYouTube(current.payload)))) {
      v.muted = false; v.volume = 1;
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onAdComplete?.();
  };

  if (loading) return <div className="w-full h-full bg-black grid place-items-center text-white/60 text-sm">Loading ad…</div>;
  if (!current) return <NoAdsFallback onSkippable={onSkippable} onAdComplete={finish} />;

  if (current.kind === "video_url" && isYouTube(current.payload)) {
    return (
      <iframe key={current.id} src={ytEmbed(current.payload)} className="w-full h-full"
        allow="autoplay; fullscreen" allowFullScreen title={current.title} />
    );
  }
  if (current.kind === "video_url" || current.kind === "video_file") {
    return (
      <video ref={videoRef} key={current.id} src={current.payload}
        className="w-full h-full object-contain bg-black"
        autoPlay playsInline preload="auto" onEnded={finish} />
    );
  }
  return (
    <iframe key={current.id} src={current.payload} className="w-full h-full bg-black"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms" title={current.title} />
  );
};

const NoAdsFallback = ({ onSkippable, onAdComplete }: { onSkippable?: () => void; onAdComplete?: () => void }) => {
  useEffect(() => {
    onSkippable?.();
    const t = setTimeout(() => onAdComplete?.(), 5000);
    return () => clearTimeout(t);
  }, [onSkippable, onAdComplete]);
  return (
    <div className="w-full h-full bg-black grid place-items-center text-center p-6 text-white">
      <div>
        <div className="opacity-60 text-xs uppercase tracking-[0.2em] mb-2">Advertisement</div>
        <div className="font-semibold">No ads configured.</div>
      </div>
    </div>
  );
};

export default AdSlot;
