import { useEffect, useRef, useState } from "react";
import { Radio, Eye } from "lucide-react";

type Props = { kind: "radio"|"tv"; stationId: string; stationName: string; };
const fmt = (n:number) => n>=1_000_000?`${(n/1_000_000).toFixed(1)}M`:n>=1_000?`${(n/1_000).toFixed(1)}K`:`${n}`;

export default function LiveViewers({ kind, stationId }: Props) {
  const [count, setCount] = useState<number|null>(null);
  const [prev, setPrev] = useState<number|null>(null);
  const timerRef = useRef<number|null>(null);

  const fetch_ = async () => {
    if (!stationId) return;
    try {
      if (kind === "radio") {
        const r = await fetch(`https://de1.api.radio-browser.info/json/stations/byuuid/${stationId}`);
        const d = await r.json();
        if (d?.[0]) { const n=Number(d[0].clickcount)||0; setPrev(count); setCount(n); }
      } else {
        const key = stationId.replace(/[^a-zA-Z0-9]/g,"-").slice(0,60);
        const r = await fetch(`https://api.countapi.xyz/hit/wavebox-tv/${key}`);
        const d = await r.json();
        if (typeof d.value==="number") { setPrev(count); setCount(d.value); }
      }
    } catch {}
  };

  useEffect(()=>{
    setCount(null); setPrev(null);
    fetch_();
    timerRef.current = window.setInterval(fetch_, 30000);
    return ()=>{ if(timerRef.current) clearInterval(timerRef.current); };
  },[stationId, kind]);

  if (!count) return null;

  const delta = prev!==null ? count-prev : 0;
  const trend = delta>0?"up":delta<0?"down":"stable";
  const color = trend==="up"?"text-emerald-400":trend==="down"?"text-red-400":"text-foreground";

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/40"
      style={{background:"hsl(240 14% 11% / 0.9)"}}>
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60"/>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"/>
      </span>
      {kind==="radio" ? <Radio className="h-3 w-3 text-primary shrink-0"/> : <Eye className="h-3 w-3 text-primary shrink-0"/>}
      <span className={`text-xs font-bold tabular-nums ${color}`}>{fmt(count)}</span>
      {delta!==0 && <span className={`text-[10px] font-semibold ${color}`}>{trend==="up"?"▲":"▼"} {fmt(Math.abs(delta))}</span>}
      <span className="text-[10px] text-muted-foreground">{kind==="radio"?"listeners":"views"}</span>
    </div>
  );
}
