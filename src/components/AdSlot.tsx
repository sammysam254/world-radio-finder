import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Ad = {
  id: string;
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
 * AdSlot:
 * - Loads all ads up front and pre-fetches video files (link rel=preload) for instant start.
 * - Plays video with sound (unmuted).
 * - Renders Monetag links INSIDE an iframe (no new tab) — auto-skips after 20s.
 * - URL ads (any non-completing) auto-skip after 20s; videos that finish early advance via onEnded.
 * - Skip becomes available after 5s.
 */
export const AdSlot = ({ onAdComplete, onSkippable }: Props) => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [idx, setIdx] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const tickRef = useRef<number | null>(null);
  const skipRef = useRef<number | null>(null);
  const advanceRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load + preload
  useEffect(() => {
    (async () => {
      const [adminRes, advRes] = await Promise.all([
        supabase.from("ads").select("*").eq("active", true).order("sequence", { ascending: true }),
        supabase.from("advertiser_ads").select("id,kind,title,payload").eq("status", "approved"),
      ]);
      const adminAds = ((adminRes.data || []) as any[]).map((a) => ({
        id: a.id, kind: a.kind, title: a.title, payload: a.payload, sequence: a.sequence ?? 0,
      })) as Ad[];
      const advAds = ((advRes.data || []) as any[]).map((a, i) => ({
        id: a.id, kind: a.kind, title: a.title, payload: a.payload, sequence: 1000 + i,
      })) as Ad[];
      const list = [...adminAds, ...advAds];
      setAds(list);
      const start = list.length ? loadIdx() % list.length : 0;
      setIdx(start);
      setLoading(false);

      // Preload all direct video URLs/files
      list.forEach((a) => {
        if ((a.kind === "video_url" && !isYouTube(a.payload)) || a.kind === "video_file") {
          const link = document.createElement("link");
          link.rel = "preload";
          link.as = "video";
          link.href = a.payload;
          document.head.appendChild(link);
        }
      });
    })();
  }, []);

  const clearTimers = () => {
    if (tickRef.current) window.clearTimeout(tickRef.current);
    if (skipRef.current) window.clearTimeout(skipRef.current);
    if (advanceRef.current) window.clearTimeout(advanceRef.current);
  };

  useEffect(() => {
    if (loading || ads.length === 0) return;
    clearTimers();
    // Skippable after 5s
    skipRef.current = window.setTimeout(() => onSkippable?.(), 5000) as unknown as number;
    // For URL/iframe ads, auto-skip after 20s. Direct video files advance via onEnded; we still cap at 60s.
    const ad = ads[idx];
    const cap = (ad.kind === "monetag_url" || (ad.kind === "video_url" && isYouTube(ad.payload))) ? 20000 : 60000;
    advanceRef.current = window.setTimeout(() => next(), cap) as unknown as number;

    // Try to play with sound
    const v = videoRef.current;
    if (v && (ad.kind === "video_file" || (ad.kind === "video_url" && !isYouTube(ad.payload)))) {
      v.muted = false;
      v.volume = 1;
      v.play().catch(() => {
        // autoplay-with-sound blocked → fall back muted
        v.muted = true;
        v.play().catch(() => {});
      });
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, loading, ads.length]);

  const next = () => {
    const nextIdx = idx + 1;
    if (!ads.length || nextIdx >= ads.length) {
      saveIdx(0);
      onAdComplete?.();
    } else {
      saveIdx(nextIdx);
      setIdx(nextIdx);
    }
  };

  if (loading) return <div className="w-full h-full bg-black grid place-items-center text-white/60 text-sm">Loading ad…</div>;
  if (ads.length === 0) return <NoAdsFallback onSkippable={onSkippable} onAdComplete={onAdComplete} />;

  const ad = ads[idx];

  if (ad.kind === "video_url" && isYouTube(ad.payload)) {
    return (
      <iframe
        key={ad.id}
        src={ytEmbed(ad.payload)}
        className="w-full h-full"
        allow="autoplay; fullscreen"
        allowFullScreen
        title={ad.title}
      />
    );
  }
  if (ad.kind === "video_url" || ad.kind === "video_file") {
    return (
      <video
        ref={videoRef}
        key={ad.id}
        src={ad.payload}
        className="w-full h-full object-contain bg-black"
        autoPlay
        playsInline
        preload="auto"
        onEnded={next}
      />
    );
  }
  // monetag → embed in iframe directly inside the player; auto-skip after 20s
  return (
    <iframe
      key={ad.id}
      src={ad.payload}
      className="w-full h-full bg-black"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      title={ad.title}
    />
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
