import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = { stationId: string; stationName: string };

export const StationRating = ({ stationId, stationName }: Props) => {
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const KEY = `wavebox_vote_${stationId}`;

  useEffect(() => {
    const saved = localStorage.getItem(KEY) as "up" | "down" | null;
    setVoted(saved);
    supabase.from("station_ratings").select("vote, count")
      .eq("station_id", stationId)
      .then(({ data }) => {
        const up = data?.filter(r => r.vote === "up").reduce((a, b) => a + Number(b.count), 0) || 0;
        const down = data?.filter(r => r.vote === "down").reduce((a, b) => a + Number(b.count), 0) || 0;
        setLikes(up); setDislikes(down);
      });
  }, [stationId]);

  const vote = async (v: "up" | "down") => {
    if (voted) return;
    setVoted(v);
    localStorage.setItem(KEY, v);
    if (v === "up") setLikes(l => l + 1); else setDislikes(d => d + 1);
    await supabase.from("station_ratings").insert({ station_id: stationId, station_name: stationName, vote: v });
  };

  return (
    <div className="flex items-center gap-3">
      <button onClick={() => vote("up")}
        className={`flex items-center gap-1 text-xs transition-colors ${voted === "up" ? "text-green-500" : "text-muted-foreground hover:text-green-500"}`}>
        <ThumbsUp className="h-3.5 w-3.5" /> {likes > 0 && likes}
      </button>
      <button onClick={() => vote("down")}
        className={`flex items-center gap-1 text-xs transition-colors ${voted === "down" ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}>
        <ThumbsDown className="h-3.5 w-3.5" /> {dislikes > 0 && dislikes}
      </button>
    </div>
  );
};
