import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
<<<<<<< HEAD

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
=======

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
>>>>>>> 1a52c8932ec24f958acd5aa91975d3e6dbba2b50

const isYouTube = (u: string) => /youtu\.?be/.test(u);
const ytEmbed = (u: string) => {
  const m = u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=0&controls=1&modestbranding=1&playsinline=1&rel=0` : u;
};

// ─── Preloader: silently loads next ad in background ───────────────────────
class AdPreloader {
  private cache = new Map<string, HTMLVideoElement | HTMLIFrameElement>();

  preload(ad: Ad) {
    if (this.cache.has(ad.id)) return;
    if (ad.kind === "video_url" && !isYouTube(ad.payload)) {
      const v = document.createElement("video");
      v.src = ad.payload;
      v.preload = "auto";
      v.muted = false;
      v.style.display = "none";
      v.load();
      document.body.appendChild(v);
      this.cache.set(ad.id, v);
    } else if (ad.kind === "video_file") {
      const v = document.createElement("video");
      v.src = ad.payload;
      v.preload = "auto";
      v.muted = false;
      v.style.display = "none";
      v.load();
      document.body.appendChild(v);
      this.cache.set(ad.id, v);
    }
    // YouTube and monetag: preload iframe silently in background
    else if (ad.kind === "video_url" && isYouTube(ad.payload)) {
      const iframe = document.createElement("iframe");
      iframe.src = ytEmbed(ad.payload).replace("autoplay=1", "autoplay=0");
      iframe.style.display = "none";
      iframe.style.width = "1px";
      iframe.style.height = "1px";
      iframe.allow = "autoplay";
      document.body.appendChild(iframe);
      this.cache.set(ad.id, iframe);
    }
  }

  getVideo(adId: string): HTMLVideoElement | null {
    const el = this.cache.get(adId);
    return el instanceof HTMLVideoElement ? el : null;
  }

  cleanup(adId: string) {
    const el = this.cache.get(adId);
    if (el) { el.remove(); this.cache.delete(adId); }
  }

  cleanupAll() {
    this.cache.forEach(el => el.remove());
    this.cache.clear();
  }
}

const preloader = new AdPreloader();

interface Props {
  onAdComplete?: () => void;
  onSkippable?: () => void;
  /** seconds until skip button shows — default 20 for monetag, 5 for others */
  skipAfter?: number;
}

export const AdSlot = ({ onAdComplete, onSkippable, skipAfter }: Props) => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [secsShown, setSecsShown] = useState(0);
  const [monetagReady, setMonetagReady] = useState(false);
  const tickRef = useRef<number | null>(null);
  const advanceRef = useRef<number | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const monetagIframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch ads once
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
<<<<<<< HEAD
      // Preload all ads in background immediately
      list.forEach(ad => preloader.preload(ad));
    })();
    return () => preloader.cleanupAll();
  }, []);

  const ad = ads[idx];

  // Per-ad timer + skip logic
  useEffect(() => {
    if (loading || ads.length === 0 || !ad) return;
    setSecsShown(0);
    setMonetagReady(false);
    if (tickRef.current) clearInterval(tickRef.current);
    if (advanceRef.current) clearTimeout(advanceRef.current);

    // Skip threshold: monetag = 20s, others = skipAfter prop or 5s
    const skipThreshold = ad.kind === "monetag_url" ? 20 : (skipAfter ?? 5);

    tickRef.current = window.setInterval(() => {
      setSecsShown(s => {
        const n = s + 1;
        if (n >= skipThreshold) onSkippable?.();
=======
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
>>>>>>> 1a52c8932ec24f958acd5aa91975d3e6dbba2b50
        return n;
      });
    }, 1000);

<<<<<<< HEAD
    // For monetag: inject into iframe inline (no new tab), auto-skip after 20s
    if (ad.kind === "monetag_url") {
      setMonetagReady(true);
      advanceRef.current = window.setTimeout(() => next(), 20_000);
    } else {
      // video/YouTube: if preloaded video exists, inject it directly
      const cached = preloader.getVideo(ad.id);
      if (cached && videoContainerRef.current) {
        cached.style.display = "block";
        cached.style.width = "100%";
        cached.style.height = "100%";
        cached.style.objectFit = "contain";
        cached.style.position = "absolute";
        cached.style.inset = "0";
        cached.muted = false;
        cached.controls = false;
        cached.playsInline = true;
        videoContainerRef.current.appendChild(cached);
        cached.play().catch(() => {});
        cached.onended = () => next();
      }
      // Auto-advance fallback after 30s
      advanceRef.current = window.setTimeout(() => next(), 30_000);
    }

    // Preload the NEXT ad in background right now
    const nextAd = ads[(idx + 1) % ads.length];
    if (nextAd) preloader.preload(nextAd);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (advanceRef.current) clearTimeout(advanceRef.current);
      // Remove injected cached video from container
      if (videoContainerRef.current) {
        const v = videoContainerRef.current.querySelector("video");
        if (v) { v.pause(); v.style.display = "none"; document.body.appendChild(v); }
      }
=======
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
>>>>>>> 1a52c8932ec24f958acd5aa91975d3e6dbba2b50
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, loading, ads.length]);

  const next = () => {
<<<<<<< HEAD
    if (!ads.length) { onAdComplete?.(); return; }
    const nextIdx = idx + 1;
    if (nextIdx >= ads.length) {
      saveIdx(0);
      onAdComplete?.();
    } else {
      saveIdx(nextIdx);
      setIdx(nextIdx);
    }
  };

  if (loading) return (
    <div className="w-full h-full bg-black grid place-items-center text-white/60 text-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading ad…</span>
      </div>
    </div>
  );

  if (ads.length === 0) return <NoAdsFallback onSkippable={onSkippable} onAdComplete={onAdComplete} />;

  if (!ad) return null;

  // ── Monetag URL — plays INSIDE the app in an iframe, no new tab ──
  if (ad.kind === "monetag_url") {
    return (
      <div className="relative w-full h-full bg-black flex flex-col">
        <div className="absolute top-2 left-3 z-10 text-[10px] uppercase tracking-widest text-white/50 bg-black/60 px-2 py-1 rounded">
          Ad · {Math.max(0, 20 - secsShown)}s
        </div>
        {monetagReady && (
          <iframe
            ref={monetagIframeRef}
            src={ad.payload}
            className="flex-1 w-full border-0"
            allow="autoplay; fullscreen; payment; microphone; camera"
            allowFullScreen
            title={ad.title}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        )}
        {!monetagReady && (
          <div className="flex-1 grid place-items-center">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }

  // ── YouTube embed ──
  if (ad.kind === "video_url" && isYouTube(ad.payload)) {
    return (
      <div className="relative w-full h-full bg-black">
        <div className="absolute top-2 left-3 z-10 text-[10px] uppercase tracking-widest text-white/50 bg-black/60 px-2 py-1 rounded">
          Ad
        </div>
        <iframe
          key={ad.id}
          src={ytEmbed(ad.payload)}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen"
          allowFullScreen
          title={ad.title}
        />
      </div>
    );
  }

  // ── Video file / direct URL — with preloaded cache ──
  return (
    <div ref={videoContainerRef} className="relative w-full h-full bg-black">
      <div className="absolute top-2 left-3 z-10 text-[10px] uppercase tracking-widest text-white/50 bg-black/60 px-2 py-1 rounded">
        Ad
      </div>
      {/* Fallback video element — used if cache miss */}
      {!preloader.getVideo(ad.id) && (
        <video
          key={ad.id}
          src={ad.payload}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          onEnded={next}
          style={{ position: "absolute", inset: 0 }}
        />
      )}
=======
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
>>>>>>> 1a52c8932ec24f958acd5aa91975d3e6dbba2b50
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
