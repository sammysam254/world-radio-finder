import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEVICE_KEY = "wavebox_device_id";

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export type StationPlay = {
  station_id: string;
  station_name: string;
  station_type: "radio" | "tv";
  play_count: number;
};

export function useFavorites() {
  const [deviceId] = useState(getDeviceId);
  const [favorites, setFavorites] = useState<StationPlay[]>([]);

  // Load favorites from supabase or localStorage fallback
  useEffect(() => {
    const local = localStorage.getItem("wavebox_favs");
    if (local) {
      try { setFavorites(JSON.parse(local)); } catch {}
    }
    // Try load from supabase
    supabase.from("station_plays")
      .select("station_id, station_name, station_type, play_count")
      .eq("device_id", deviceId)
      .order("play_count", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data?.length) {
          setFavorites(data as StationPlay[]);
          localStorage.setItem("wavebox_favs", JSON.stringify(data));
        }
      });
  }, [deviceId]);

  const trackPlay = useCallback(async (stationId: string, stationName: string, type: "radio" | "tv") => {
    // Update local state immediately
    setFavorites(prev => {
      const existing = prev.find(f => f.station_id === stationId);
      let updated: StationPlay[];
      if (existing) {
        updated = prev.map(f => f.station_id === stationId ? { ...f, play_count: f.play_count + 1 } : f);
      } else {
        updated = [...prev, { station_id: stationId, station_name: stationName, station_type: type, play_count: 1 }];
      }
      updated.sort((a, b) => b.play_count - a.play_count);
      localStorage.setItem("wavebox_favs", JSON.stringify(updated));
      return updated;
    });

    // Save to supabase
    try {
      const { data: existing } = await supabase.from("station_plays")
        .select("id, play_count")
        .eq("device_id", deviceId)
        .eq("station_id", stationId)
        .maybeSingle();

      if (existing) {
        await supabase.from("station_plays")
          .update({ play_count: existing.play_count + 1, last_played: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("station_plays").insert({
          device_id: deviceId,
          station_id: stationId,
          station_name: stationName,
          station_type: type,
          play_count: 1,
          last_played: new Date().toISOString(),
        });
      }
    } catch {}
  }, [deviceId]);

  const topFavorites = favorites
    .filter(f => f.play_count > 0)
    .sort((a, b) => b.play_count - a.play_count)
    .slice(0, 10);

  return { favorites, topFavorites, trackPlay, deviceId };
}
