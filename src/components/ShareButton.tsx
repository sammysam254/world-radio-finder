import { Button } from "@/components/ui/button";
import { Share2, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Props = { stationName: string; stationUrl?: string };

export const ShareButton = ({ stationName, stationUrl }: Props) => {
  const [shared, setShared] = useState(false);

  const share = async () => {
    const text = `🎧 I'm listening to ${stationName} on Wavebox!\nhttps://wavebox.site`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Wavebox — ${stationName}`, text, url: "https://wavebox.site" });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied to clipboard!");
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={share} title="Share" className="text-muted-foreground hover:text-foreground">
      {shared ? <Check className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
    </Button>
  );
};
