import { useEffect, useState } from "react";
import { Music2 } from "lucide-react";

type Props = { stationUrl?: string; stationName: string };

export const NowPlaying = ({ stationUrl, stationName }: Props) => {
  const [track, setTrack] = useState<string | null>(null);

  useEffect(() => {
    if (!stationUrl) return;
    // Try to fetch station metadata via Radio Browser API
    const fetchMeta = async () => {
      try {
        // Radio Browser supports stream metadata for some stations
        const encoded = encodeURIComponent(stationName);
        const r = await fetch(`https://de1.api.radio-browser.info/json/stations/byname/${encoded}?limit=1`);
        const data = await r.json();
        if (data?.[0]?.tags) {
          // Tags can contain genre/format info
        }
      } catch {}
    };
    fetchMeta();
    const interval = setInterval(fetchMeta, 30000);
    return () => clearInterval(interval);
  }, [stationUrl, stationName]);

  if (!track) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground animate-in fade-in">
      <Music2 className="h-3 w-3 shrink-0" />
      <span className="truncate">{track}</span>
    </div>
  );
};
