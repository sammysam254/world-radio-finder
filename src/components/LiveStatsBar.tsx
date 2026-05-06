import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
  : `${n}`;

export default function LiveStatsBar() {
  const [clicks, setClicks] = useState(0);
  const [stations, setStations] = useState(0);
  const [flash, setFlash] = useState<"up"|"down"|null>(null);
  const prevClicks = useRef(0);
  const timerRef = useRef<number|null>(null);

  const fetch_ = async () => {
    try {
      const r = await fetch("https://de1.api.radio-browser.info/json/stats");
      const d = await r.json();
      const c = Number(d.clicks_last_hour)||0;
      const s = Number(d.stations)||0;
      if (prevClicks.current) {
        setFlash(c > prevClicks.current ? "up" : c < prevClicks.current ? "down" : null);
        setTimeout(()=>setFlash(null), 800);
      }
      prevClicks.current = c;
      setClicks(c);
      setStations(s);
    } catch {}
  };

  useEffect(()=>{
    fetch_();
    timerRef.current = window.setInterval(fetch_, 30000);
    return ()=>{ if(timerRef.current) clearInterval(timerRef.current); };
  },[]);

  return (
    <div className="flex items-center justify-center gap-3 flex-wrap py-1.5 px-4 border-b border-border/30 text-[11px]"
      style={{background:"hsl(240 14% 8% / 0.9)"}}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70"/>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"/>
      </span>
      <span className="uppercase tracking-widest text-red-400 font-semibold text-[10px]">Live</span>
      <span className="text-border/60">·</span>
      <div className={`flex items-center gap-1.5 transition-colors duration-300 ${flash==="up"?"text-emerald-400":flash==="down"?"text-red-400":"text-foreground"}`}>
        <Radio className="h-3 w-3 text-primary"/>
        <span className="font-bold tabular-nums">{stations>0 ? fmt(clicks) : "—"}</span>
        <span className="text-muted-foreground">streams/hr</span>
        {flash && <span className="font-bold">{flash==="up"?"▲":"▼"}</span>}
      </div>
      <span className="text-border/60">·</span>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="font-bold text-foreground tabular-nums">{stations>0 ? fmt(stations) : "—"}</span>
        <span>stations</span>
      </div>
    </div>
  );
}
