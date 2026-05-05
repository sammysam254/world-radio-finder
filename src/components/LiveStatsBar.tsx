import { useEffect, useRef, useState } from "react";
import { Users, Radio, Tv } from "lucide-react";

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
  : `${n}`;

type Stats = {
  stations: number;
  clicks: number;
};

export default function LiveStatsBar() {
  const [radio, setRadio] = useState<Stats | null>(null);
  const [tvHits, setTvHits] = useState<number | null>(null);
  const [radioFlash, setRadioFlash] = useState<"up" | "down" | null>(null);
  const prevRadio = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const fetchRadioStats = async () => {
    try {
      // Radio Browser official stats API — real global numbers
      const res = await fetch("https://de1.api.radio-browser.info/json/stats");
      const data = await res.json();
      const clicks = Number(data.clicks_last_hour) || 0;
      const stations = Number(data.stations) || 0;

      if (prevRadio.current !== null) {
        const delta = clicks - prevRadio.current;
        setRadioFlash(delta > 0 ? "up" : delta < 0 ? "down" : null);
        setTimeout(() => setRadioFlash(null), 800);
      }
      prevRadio.current = clicks;
      setRadio({ stations, clicks });
    } catch {
      // silently ignore
    }
  };

  const fetchTvStats = async () => {
    try {
      // Use countapi to track total TV opens on Wavebox
      const res = await fetch("https://api.countapi.xyz/get/wavebox-tv/total-views");
      const data = await res.json();
      if (typeof data.value === "number") setTvHits(data.value);
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    fetchRadioStats();
    fetchTvStats();
    timerRef.current = window.setInterval(() => {
      fetchRadioStats();
      fetchTvStats();
    }, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (!radio) return null;

  return (
    <div className="flex items-center justify-center gap-3 flex-wrap py-1.5 px-4 border-b border-border/30 text-[11px]"
      style={{ background: "hsl(240 14% 8% / 0.9)" }}>

      {/* Live dot */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="uppercase tracking-widest text-red-400 font-semibold text-[10px]">Live</span>
      </div>

      {/* Radio — real clicks last hour from Radio Browser */}
      <div className={`flex items-center gap-1.5 transition-colors duration-300 ${radioFlash === "up" ? "text-emerald-400" : radioFlash === "down" ? "text-red-400" : "text-foreground"}`}>
        <Radio className="h-3 w-3 text-primary" />
        <span className="font-bold tabular-nums">{fmt(radio.clicks)}</span>
        <span className="text-muted-foreground">radio streams/hr</span>
        {radioFlash && (
          <span className={`font-bold ${radioFlash === "up" ? "text-emerald-400" : "text-red-400"}`}>
            {radioFlash === "up" ? "▲" : "▼"}
          </span>
        )}
      </div>

      <span className="text-border/60">·</span>

      {/* Stations count */}
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="font-bold text-foreground tabular-nums">{fmt(radio.stations)}</span>
        <span>stations live</span>
      </div>

      {tvHits !== null && (
        <>
          <span className="text-border/60">·</span>
          <div className="flex items-center gap-1.5">
            <Tv className="h-3 w-3 text-primary" />
            <span className="font-bold tabular-nums">{fmt(tvHits)}</span>
            <span className="text-muted-foreground">TV views</span>
          </div>
        </>
      )}
    </div>
  );
}
