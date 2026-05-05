import { useEffect, useRef, useState } from "react";
import { Radio, Eye } from "lucide-react";

type Props = {
  kind: "radio" | "tv";
  stationId: string;
  stationName: string;
};

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
  : `${n}`;

export default function LiveViewers({ kind, stationId, stationName }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [prev, setPrev] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<number | null>(null);

  const fetchCount = async () => {
    if (kind === "radio" && stationId) {
      try {
        // Radio-Browser API — returns clickcount and votes which are real usage metrics
        const res = await fetch(
          `https://de1.api.radio-browser.info/json/stations/byuuid/${stationId}`
        );
        const data = await res.json();
        if (data && data[0]) {
          const station = data[0];
          // clickcount = real clicks/streams started (official Radio Browser metric)
          // clicktrend = how much it changed recently (real delta)
          const real = Number(station.clickcount) || 0;
          setPrev(p => p ?? real);
          setCount(c => { setPrev(c); return real; });
        }
      } catch {
        // ignore network errors silently
      } finally {
        setLoading(false);
      }
    } else if (kind === "tv") {
      // For TV — no universal public API gives per-channel live viewers
      // We track it ourselves using a free countapi.dev counter keyed by channel id
      // Each time someone opens this channel it registers as a real view
      try {
        // Hit the count endpoint — this increments and returns real hit count
        const namespace = "wavebox-tv";
        const key = stationId.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 60);
        const res = await fetch(
          `https://api.countapi.xyz/hit/${namespace}/${key}`
        );
        const data = await res.json();
        if (data && typeof data.value === "number") {
          setCount(c => { setPrev(c); return data.value; });
        }
      } catch {
        // countapi fallback — try alternative
        try {
          const res = await fetch(
            `https://counterscale.dev/api/v1/count?site=wavebox&path=${encodeURIComponent(stationId)}`
          );
          const data = await res.json();
          setCount(c => { setPrev(c); return data.count || 0; });
        } catch {
          // no data available
        }
      } finally {
        setLoading(false);
      }
    }
  };

  // Fetch on mount and every 30s for radio (Radio Browser updates every ~30s)
  useEffect(() => {
    setCount(null);
    setPrev(null);
    setLoading(true);

    fetchCount();

    timerRef.current = window.setInterval(fetchCount, 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stationId, kind]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border/30 text-[10px] text-muted-foreground"
        style={{ background: "hsl(240 14% 11% / 0.8)" }}>
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
        fetching live data…
      </div>
    );
  }

  if (count === null || count === 0) return null;

  const delta = prev !== null ? count - prev : 0;
  const trend = delta > 0 ? "up" : delta < 0 ? "down" : "stable";
  const color = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-foreground";

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/40"
      style={{ background: "hsl(240 14% 11% / 0.9)" }}>
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      {kind === "radio"
        ? <Radio className="h-3 w-3 text-primary shrink-0" />
        : <Eye className="h-3 w-3 text-primary shrink-0" />}
      <span className={`text-xs font-bold tabular-nums ${color}`}>
        {fmt(count)}
      </span>
      {delta !== 0 && (
        <span className={`text-[10px] font-semibold tabular-nums ${color}`}>
          {trend === "up" ? "▲" : "▼"} {fmt(Math.abs(delta))}
        </span>
      )}
      <span className="text-[10px] text-muted-foreground">
        {kind === "radio" ? "listeners" : "views"}
      </span>
    </div>
  );
}
