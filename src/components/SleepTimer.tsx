import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Moon, X } from "lucide-react";
import { toast } from "sonner";

type Props = { onStop: () => void };

const OPTIONS = [5, 10, 15, 30, 45, 60, 90];

export const SleepTimer = ({ onStop }: Props) => {
  const [open, setOpen] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endRef = useRef<number | null>(null);

  const start = (mins: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    endRef.current = Date.now() + mins * 60 * 1000;
    setMinutesLeft(mins);
    setOpen(false);
    toast.success(`Sleep timer set for ${mins} minutes`);
    timerRef.current = setInterval(() => {
      const left = Math.ceil(((endRef.current || 0) - Date.now()) / 60000);
      if (left <= 0) {
        clearInterval(timerRef.current!);
        setMinutesLeft(null);
        onStop();
        toast("Sleep timer: playback stopped");
      } else {
        setMinutesLeft(left);
      }
    }, 10000);
  };

  const cancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setMinutesLeft(null);
    toast("Sleep timer cancelled");
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen(o => !o)} title="Sleep timer"
        className={minutesLeft ? "text-primary" : "text-muted-foreground"}>
        <Moon className="h-4 w-4" />
      </Button>
      {minutesLeft && (
        <span className="absolute -top-1 -right-1 text-[9px] bg-primary text-primary-foreground rounded-full px-1 font-bold">
          {minutesLeft}m
        </span>
      )}
      {open && (
        <div className="absolute bottom-10 right-0 bg-background border rounded-xl shadow-xl p-3 z-50 w-44 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Stop after…</div>
          {OPTIONS.map(m => (
            <button key={m} onClick={() => start(m)}
              className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
              {m} minutes
            </button>
          ))}
          {minutesLeft && (
            <button onClick={cancel}
              className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors flex items-center gap-1">
              <X className="h-3 w-3" /> Cancel ({minutesLeft}m left)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
