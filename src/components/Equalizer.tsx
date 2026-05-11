import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";

export type EQPreset = "normal" | "bass" | "treble" | "vocal" | "flat";

const PRESETS: { id: EQPreset; label: string; emoji: string }[] = [
  { id: "normal",  label: "Normal",  emoji: "🎵" },
  { id: "bass",    label: "Bass+",   emoji: "🔊" },
  { id: "treble",  label: "Treble+", emoji: "✨" },
  { id: "vocal",   label: "Vocal",   emoji: "🎤" },
  { id: "flat",    label: "Flat",    emoji: "📊" },
];

type Props = { preset: EQPreset; onChange: (p: EQPreset) => void };

export const Equalizer = ({ preset, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen(o => !o)} title="Equalizer"
        className={preset !== "normal" ? "text-primary" : "text-muted-foreground"}>
        <SlidersHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute bottom-10 right-0 bg-background border rounded-xl shadow-xl p-3 z-50 w-40 space-y-1">
          <div className="text-xs font-semibold text-muted-foreground mb-2">Equalizer</div>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => { onChange(p.id); setOpen(false); }}
              className={`w-full text-left text-sm px-2 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${preset === p.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Apply EQ preset to an Audio element via Web Audio API
let audioCtx: AudioContext | null = null;
let bassFilter: BiquadFilterNode | null = null;
let trebleFilter: BiquadFilterNode | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let connected = false;

export const applyEQPreset = (audio: HTMLAudioElement, preset: EQPreset) => {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (!bassFilter) {
      bassFilter = audioCtx.createBiquadFilter();
      bassFilter.type = "lowshelf";
      bassFilter.frequency.value = 200;
    }
    if (!trebleFilter) {
      trebleFilter = audioCtx.createBiquadFilter();
      trebleFilter.type = "highshelf";
      trebleFilter.frequency.value = 3000;
    }
    if (!connected) {
      try {
        sourceNode = audioCtx.createMediaElementSource(audio);
        sourceNode.connect(bassFilter);
        bassFilter.connect(trebleFilter);
        trebleFilter.connect(audioCtx.destination);
        connected = true;
      } catch {}
    }
    switch (preset) {
      case "bass":   bassFilter.gain.value = 8;  trebleFilter.gain.value = 0;  break;
      case "treble": bassFilter.gain.value = 0;  trebleFilter.gain.value = 8;  break;
      case "vocal":  bassFilter.gain.value = -2; trebleFilter.gain.value = 4;  break;
      case "flat":   bassFilter.gain.value = -3; trebleFilter.gain.value = -3; break;
      default:       bassFilter.gain.value = 0;  trebleFilter.gain.value = 0;  break;
    }
  } catch {}
};
