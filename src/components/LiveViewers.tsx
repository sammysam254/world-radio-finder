import { useEffect, useRef, useState } from "react";
import { Radio, Tv, Users, Eye } from "lucide-react";

type Props = {
  kind: "radio" | "tv";
  stationId: string;
  stationName: string;
};

type Snapshot = {
  count: number;
  delta: number; // positive = rise, negative = drop
  trend: "up" | "down" | "stable";
};

// Simulate realistic viewer counts that fluctuate naturally
const BASE_RADIO = () => Math.floor(Math.random() * 8000) + 500;
const BASE_TV    = () => Math.floor(Math.random() * 25000) + 1000;

const stationBases = new Map<string, number>();

const getBase = (id: string, kind: "radio" | "tv") => {
  if (!stationBases.has(id)) {
    stationBases.set(id, kind === "radio" ? BASE_RADIO() : BASE_TV());
  }
  return stationBases.get(id)!;
};

// Generate a realistic next count — small random walk
const nextCount = (current: number): number => {
  const swing = Math.floor(current * 0.04); // up to 4% change per tick
  const change = Math.floor((Math.random() - 0.48) * swing); // slight upward bias
  return Math.max(1, current + change);
};

const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K`
    : `${n}`;

export default function LiveViewers({ kind, stationId, stationName }: Props) {
  const [snap, setSnap] = useState<Snapshot>(() => {
    const base = getBase(stationId, kind);
    return { count: base, delta: 0, trend: "stable" };
  });
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevRef = useRef(snap.count);
  const intervalRef = useRef<number | null>(null);

  // Reset when station changes
  useEffect(() => {
    const base = getBase(stationId, kind);
    const initial = { count: base, delta: 0, trend: "stable" as const };
    setSnap(initial);
    prevRef.current = base;
    setFlash(null);
  }, [stationId, kind]);

  // Tick every 3–5 seconds for natural feel
  useEffect(() => {
    const tick = () => {
      setSnap(prev => {
        const next = nextCount(prev.count);
        const delta = next - prev.count;
        const trend: "up" | "down" | "stable" =
          delta > 0 ? "up" : delta < 0 ? "down" : "stable";

        if (trend !== "stable") {
          setFlash(trend);
          setTimeout(() => setFlash(null), 800);
        }

        return { count: next, delta, trend };
      });
    };

    // randomise interval between 3s and 5s for realism
    const schedule = () => {
      const delay = 3000 + Math.random() * 2000;
      intervalRef.current = window.setTimeout(() => {
        tick();
        schedule();
      }, delay);
    };
    schedule();

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [stationId]);

  const color =
    snap.trend === "up"
      ? "text-emerald-400"
      : snap.trend === "down"
      ? "text-red-400"
      : "text-muted-foreground";

  const bgFlash =
    flash === "up"
      ? "bg-emerald-500/10"
      : flash === "down"
      ? "bg-red-500/10"
      : "";

  const arrow =
    snap.trend === "up" ? "▲" : snap.trend === "down" ? "▼" : "●";

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/40 transition-all duration-500 ${bgFlash}`}
      style={{ background: "hsl(240 14% 11% / 0.9)" }}
    >
      {/* Pulsing live dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>

      {/* Icon */}
      {kind === "radio"
        ? <Radio className="h-3 w-3 text-primary shrink-0" />
        : <Eye className="h-3 w-3 text-primary shrink-0" />}

      {/* Count */}
      <span className={`text-xs font-bold tabular-nums transition-colors duration-300 ${color}`}>
        {fmt(snap.count)}
      </span>

      {/* Trend arrow + delta */}
      {snap.delta !== 0 && (
        <span className={`text-[10px] font-semibold tabular-nums transition-colors duration-300 ${color}`}>
          {arrow} {fmt(Math.abs(snap.delta))}
        </span>
      )}

      <span className="text-[10px] text-muted-foreground">
        {kind === "radio" ? "listeners" : "viewers"}
      </span>
    </div>
  );
}
