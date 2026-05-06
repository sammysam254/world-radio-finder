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
const loadIdx = () => {
  try { return parseInt(localStorage.getItem(PROGRESS_KEY) || "0", 10) || 0; } catch { return 0; }
};
const saveIdx = (i: number) => { try { localStorage.setItem(PROGRESS_KEY, String(i)); } catch {} };

const isYouTube = (u: string) => /youtu\.?be/.test(u);
const ytEmbed = (u: string) => {
  const m = u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1` : u;
};

interface Props {
  /** Called when an ad is fully done so the parent can close the break and resume. */
  onAdComplete?: () => void;
  /** Called the moment the user has watched at least 5 seconds (parent enables Skip). */
  onSkippable?: () => void;
}

/**
 * AdSlot — plays admin-managed ads in sequence.
 * - video_file / video_url: rendered in <video> or YouTube iframe
 * - monetag_url: opened in a new tab; player keeps a placeholder for 8s, then continues
 * - After 5 seconds without interaction, auto-advances to next ad
 * - When the whole sequence completes, calls onAdComplete()
 */
export const AdSlot = ({ onAdComplete, onSkippable }: Props) => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [idx, setIdx] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [secsShown, setSecsShown] = useState(0);
  const tickRef = useRef<number | null>(null);
  const advanceRef = useRef<number | null>(null);
  const monetagFiredRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ads")
        .select("*")
        .eq("active", true)
        .order("sequence", { ascending: true });
      const list = (data || []) as Ad[];
      setAds(list);
      const start = list.length ? loadIdx() % list.length : 0;
      setIdx(start);
      setLoading(false);
    })();
  }, []);

  // Per-ad: tick seconds, fire skippable@5s, auto-advance@8s if no interaction
  useEffect(() => {
    if (loading || ads.length === 0) return;
    setSecsShown(0);
    monetagFiredRef.current = false;
    if (tickRef.current) window.clearInterval(tickRef.current);
    if (advanceRef.current) window.clearTimeout(advanceRef.current);

    tickRef.current = window.setInterval(() => {
      setSecsShown((s) => {
        const n = s + 1;
        if (n === 5) onSkippable?.();
        return n;
      });
    }, 1000);

    // Auto-advance per ad after 8s (videos that finish earlier will advance via onEnded)
    advanceRef.current = window.setTimeout(() => next(), 8000);

    // Monetag: open in new tab once
    const ad = ads[idx];
    if (ad?.kind === "monetag_url" && !monetagFiredRef.current) {
      monetagFiredRef.current = true;
      try { window.open(ad.payload, "_blank", "noopener,noreferrer"); } catch {}
    }

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (advanceRef.current) window.clearTimeout(advanceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, loading, ads.length]);

  const next = () => {
    setAds((curr) => {
      if (!curr.length) { onAdComplete?.(); return curr; }
      const nextIdx = idx + 1;
      if (nextIdx >= curr.length) {
        saveIdx(0);
        onAdComplete?.();
      } else {
        saveIdx(nextIdx);
        setIdx(nextIdx);
      }
      return curr;
    });
  };

  if (loading) {
    return <div className="w-full h-full bg-black grid place-items-center text-white/60 text-sm">Loading ad…</div>;
  }
  if (ads.length === 0) {
    return <NoAdsFallback onSkippable={onSkippable} onAdComplete={onAdComplete} />;
  }

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
        key={ad.id}
        src={ad.payload}
        className="w-full h-full object-contain bg-black"
        autoPlay
        muted
        playsInline
        onEnded={next}
      />
    );
  }
  // monetag — show banner while the new tab loads, then advance
  return (
    <div className="w-full h-full bg-black grid place-items-center text-center p-6 text-white">
      <div>
        <div className="opacity-60 text-xs uppercase tracking-[0.2em] mb-2">Sponsored</div>
        <div className="text-lg font-semibold">{ad.title}</div>
        <div className="opacity-60 text-xs mt-3">Opening sponsor in a new tab…</div>
      </div>
    </div>
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
        <div className="opacity-60 text-xs mt-2">Admins can add ads at /admin</div>
      </div>
    </div>
  );
};

export default AdSlot;
