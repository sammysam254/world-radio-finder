import { useEffect, useRef, useState } from "react";
import { Users, Radio, Tv } from "lucide-react";

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
  : `${n}`;

export default function LiveStatsBar() {
  const [radioListeners, setRadioListeners] = useState(142300);
  const [tvViewers, setTvViewers]           = useState(389700);
  const [radioFlash, setRadioFlash]         = useState<"up"|"down"|null>(null);
  const [tvFlash, setTvFlash]               = useState<"up"|"down"|null>(null);
  const timerRef = useRef<number|null>(null);

  useEffect(() => {
    const tick = () => {
      // Radio fluctuates ±0.5%
      setRadioListeners(prev => {
        const swing = Math.floor(prev * 0.005);
        const delta = Math.floor((Math.random() - 0.48) * swing * 2);
        const next  = Math.max(100, prev + delta);
        setRadioFlash(delta > 0 ? "up" : delta < 0 ? "down" : null);
        setTimeout(() => setRadioFlash(null), 700);
        return next;
      });
      // TV fluctuates ±0.8%
      setTvViewers(prev => {
        const swing = Math.floor(prev * 0.008);
        const delta = Math.floor((Math.random() - 0.47) * swing * 2);
        const next  = Math.max(100, prev + delta);
        setTvFlash(delta > 0 ? "up" : delta < 0 ? "down" : null);
        setTimeout(() => setTvFlash(null), 700);
        return next;
      });
      const delay = 2500 + Math.random() * 2000;
      timerRef.current = window.setTimeout(tick, delay);
    };
    timerRef.current = window.setTimeout(tick, 2500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="flex items-center justify-center gap-4 flex-wrap py-2 px-4 border-b border-border/30"
      style={{ background: "hsl(240 14% 8% / 0.8)" }}>

      {/* Live dot */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-[10px] uppercase tracking-widest text-red-400 font-semibold">Live Now</span>
      </div>

      {/* Radio */}
      <div className={`flex items-center gap-1.5 transition-colors duration-300 ${radioFlash === "up" ? "text-emerald-400" : radioFlash === "down" ? "text-red-400" : "text-foreground"}`}>
        <Radio className="h-3 w-3 text-primary" />
        <span className="text-xs font-bold tabular-nums">{fmt(radioListeners)}</span>
        <span className="text-[10px] text-muted-foreground">radio listeners</span>
        {radioFlash && (
          <span className={`text-[10px] font-bold ${radioFlash === "up" ? "text-emerald-400" : "text-red-400"}`}>
            {radioFlash === "up" ? "▲" : "▼"}
          </span>
        )}
      </div>

      <span className="text-border/60 text-xs">·</span>

      {/* TV */}
      <div className={`flex items-center gap-1.5 transition-colors duration-300 ${tvFlash === "up" ? "text-emerald-400" : tvFlash === "down" ? "text-red-400" : "text-foreground"}`}>
        <Tv className="h-3 w-3 text-primary" />
        <span className="text-xs font-bold tabular-nums">{fmt(tvViewers)}</span>
        <span className="text-[10px] text-muted-foreground">TV viewers</span>
        {tvFlash && (
          <span className={`text-[10px] font-bold ${tvFlash === "up" ? "text-emerald-400" : "text-red-400"}`}>
            {tvFlash === "up" ? "▲" : "▼"}
          </span>
        )}
      </div>

      {/* Total */}
      <span className="text-border/60 text-xs">·</span>
      <div className="flex items-center gap-1.5">
        <Users className="h-3 w-3 text-accent" />
        <span className="text-xs font-bold tabular-nums text-accent">
          {fmt(radioListeners + tvViewers)}
        </span>
        <span className="text-[10px] text-muted-foreground">total</span>
      </div>
    </div>
  );
}
