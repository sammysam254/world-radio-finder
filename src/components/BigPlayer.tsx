import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  List,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Radio as RadioIcon,
  SkipBack,
  SkipForward,
  Tv as TvIcon,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export type PlaylistItem = {
  id: string;
  name: string;
  subtitle?: string;
  logo?: string;
  dead?: boolean;
};

type Props = {
  kind: "radio" | "tv";
  title: string;
  subtitle?: string;
  artwork?: string;
  playing: boolean;
  buffering: boolean;
  playError: string | null;
  netQuality: "low" | "mid" | "high";
  videoEl: React.ReactNode;
  volume: number;
  muted: boolean;
  onVolumeChange: (v: number) => void;
  onMuteToggle: () => void;
  onClose: () => void;
  onTogglePlay: () => void;
  onSkip: (dir: 1 | -1) => void;
  onFullscreen: () => void;
  playlist: PlaylistItem[];
  currentId: string;
  onSelect: (id: string) => void;
};

export default function BigPlayer({
  kind, title, subtitle, artwork, playing, buffering, playError,
  netQuality, videoEl, volume, muted, onVolumeChange, onMuteToggle,
  onClose, onTogglePlay, onSkip, onFullscreen, playlist, currentId, onSelect,
}: Props) {
  const [listOpen, setListOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [hudVolume, setHudVolume] = useState<number | null>(null);
  const [hudBrightness, setHudBrightness] = useState<number | null>(null);
  const brightnessRef = useRef(1);
  const tvSurfaceRef = useRef<HTMLDivElement | null>(null);
  const hudTimer = useRef<number | null>(null);

  const showHud = (k: "vol" | "bri", val: number) => {
    if (k === "vol") setHudVolume(val);
    else setHudBrightness(val);
    if (hudTimer.current) window.clearTimeout(hudTimer.current);
    hudTimer.current = window.setTimeout(() => {
      setHudVolume(null); setHudBrightness(null);
    }, 900);
  };

  useEffect(() => {
    if (kind !== "tv") return;
    const el = tvSurfaceRef.current;
    if (!el) return;
    let startY = 0, startX = 0, side: "left" | "right" | null = null, startVal = 0, active = false;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const rect = el.getBoundingClientRect();
      startY = t.clientY; startX = t.clientX;
      side = t.clientX - rect.left < rect.width / 2 ? "left" : "right";
      startVal = side === "right" ? volume : brightnessRef.current;
      active = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!active || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dy = startY - t.clientY;
      const dx = Math.abs(t.clientX - startX);
      if (Math.abs(dy) < 10 || dx > Math.abs(dy)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const ratio = dy / rect.height;
      if (side === "right") {
        const next = Math.min(100, Math.max(0, Math.round(startVal + ratio * 150)));
        onVolumeChange(next); showHud("vol", next);
      } else {
        const next = Math.min(1, Math.max(0.2, +(startVal + ratio * 1.2).toFixed(2)));
        brightnessRef.current = next;
        el.style.filter = `brightness(${next})`;
        showHud("bri", Math.round(next * 100));
      }
    };
    const onEnd = () => { active = false; side = null; };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [kind, volume, onVolumeChange]);

  const filtered = playlist.filter(
    (p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="fixed z-50 flex flex-col bg-background overflow-hidden" style={{top:"36px",left:0,right:0,bottom:0}}>

      {/* ── Slim top bar — navigation only ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 glass shrink-0" style={{minHeight:48}}>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {kind === "radio" ? <RadioIcon className="h-3 w-3" /> : <TvIcon className="h-3 w-3" />}
          {kind === "radio" ? "Now Playing" : "Now Watching"}
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => setListOpen(o => !o)} aria-label="List" className={listOpen ? "text-primary" : ""}>
            <List className="h-4 w-4" />
          </Button>
          {kind === "tv" && (
            <Button variant="ghost" size="icon" onClick={onFullscreen} aria-label="Fullscreen">
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Minimise">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Artwork / Video — grows to fill all space between topbar and controls ── */}
      <div className="flex-1 min-h-0 relative overflow-hidden bg-black">

        {kind === "tv" ? (
          <div ref={tvSurfaceRef} className="absolute inset-0 flex items-center justify-center bg-black select-none touch-none">
            {/* The <video> element from Index.tsx renders here via CSS fixed positioning */}
            {videoEl}
            {buffering && (
              <div className="absolute inset-0 grid place-items-center bg-black/50 z-10">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            )}
            {hudVolume !== null && (
              <div className="absolute top-1/2 right-5 -translate-y-1/2 px-4 py-2 rounded-2xl bg-black/70 backdrop-blur text-sm flex items-center gap-2 pointer-events-none z-20">
                <Volume2 className="h-4 w-4" /> {hudVolume}%
              </div>
            )}
            {hudBrightness !== null && (
              <div className="absolute top-1/2 left-5 -translate-y-1/2 px-4 py-2 rounded-2xl bg-black/70 backdrop-blur text-sm pointer-events-none z-20">
                ☀ {hudBrightness}%
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6"
            style={{ background: "var(--gradient-card)" }}>
            <div className="h-56 w-56 sm:h-72 sm:w-72 rounded-3xl overflow-hidden grid place-items-center shrink-0"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
              {artwork ? (
                <img src={artwork} alt="" className="h-full w-full object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
              ) : (
                <RadioIcon className="h-20 w-20 text-primary-foreground" />
              )}
            </div>
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-black truncate max-w-[80vw]">{title}</h3>
              {subtitle && <p className="text-sm text-muted-foreground mt-1 truncate max-w-[80vw]">{subtitle}</p>}
            </div>
            {playing && (
              <div className="flex items-end h-7 gap-0.5">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span key={i} className="equalizer-bar" style={{ animationDelay: `${i * 0.07}s` }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Playlist overlay */}
        {listOpen && (
          <div className="absolute inset-0 z-30 bg-background/97 backdrop-blur-xl flex flex-col">
            <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-border/60 shrink-0">
              <input autoFocus value={filter} onChange={e => setFilter(e.target.value)}
                placeholder={kind === "radio" ? "Search stations…" : "Search channels…"}
                className="flex-1 h-10 px-4 rounded-full bg-secondary/60 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              <Button variant="ghost" size="icon" onClick={() => setListOpen(false)}>
                <ChevronDown className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {filtered.map(p => {
                const active = p.id === currentId;
                return (
                  <button key={p.id} onClick={() => { onSelect(p.id); setListOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/30 transition-colors hover:bg-secondary/40 ${active ? "bg-primary/10" : ""} ${p.dead ? "opacity-50" : ""}`}>
                    <div className="h-10 w-10 rounded-lg bg-secondary overflow-hidden grid place-items-center shrink-0">
                      {p.logo
                        ? <img src={p.logo} alt="" className="h-full w-full object-cover" onError={e => ((e.target as HTMLImageElement).style.display = "none")} />
                        : kind === "radio" ? <RadioIcon className="h-5 w-5 text-muted-foreground" /> : <TvIcon className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold truncate ${active ? "text-primary" : ""}`}>{p.name}</div>
                      {p.subtitle && <div className="text-xs text-muted-foreground truncate">{p.subtitle}{p.dead ? " · offline" : ""}</div>}
                    </div>
                    {active && playing && <Pause className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="text-center text-muted-foreground py-12 text-sm">No matches.</div>}
            </div>
          </div>
        )}
      </div>

      {/* ══ BOTTOM CONTROLS — fixed height, always visible ══ */}
      <div className="shrink-0 border-t border-border/60 glass px-5 pt-4 pb-6 flex flex-col gap-4"
        style={{ background: "hsl(240 14% 9% / 0.97)" }}>

        {/* Station name */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            {netQuality === "low" ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
            <span className="uppercase tracking-widest">{netQuality}</span>
          </div>
          <div className="font-bold text-base leading-tight truncate">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</div>}
          {playError && <div className="text-xs text-destructive mt-1 truncate">{playError}</div>}
        </div>

        {/* Prev / Play / Next */}
        <div className="flex items-center justify-center gap-10">
          <button onClick={() => onSkip(-1)} aria-label="Previous"
            className="h-14 w-14 flex items-center justify-center rounded-full text-foreground hover:text-primary transition-colors">
            <SkipBack className="h-7 w-7" />
          </button>

          <button onClick={onTogglePlay} aria-label="Play/Pause"
            className="h-20 w-20 flex items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
            style={{ background: "var(--gradient-primary)" }}>
            {buffering
              ? <Loader2 className="h-9 w-9 animate-spin text-primary-foreground" />
              : playing
              ? <Pause className="h-9 w-9 text-primary-foreground" />
              : <Play className="h-9 w-9 text-primary-foreground" />}
          </button>

          <button onClick={() => onSkip(1)} aria-label="Next"
            className="h-14 w-14 flex items-center justify-center rounded-full text-foreground hover:text-primary transition-colors">
            <SkipForward className="h-7 w-7" />
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3">
          <button onClick={onMuteToggle} aria-label="Mute" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <Slider value={[muted ? 0 : volume]} max={100} step={1}
            onValueChange={v => onVolumeChange(v[0])} className="flex-1" />
        </div>
      </div>
    </div>
  );
}
