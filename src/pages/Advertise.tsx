import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

type AdvAd = {
  id: string; title: string; kind: "video_url" | "video_file" | "monetag_url"; payload: string;
  daily_impressions: number; cost_per_impression_cents: number; status: string; rejection_reason: string | null;
};

const Advertise = () => {
  const nav = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [ads, setAds] = useState<AdvAd[]>([]);
  const [tab, setTab] = useState("video_url");
  const [title, setTitle] = useState("");
  const [urlVal, setUrlVal] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [perDay, setPerDay] = useState("10");
  const [saving, setSaving] = useState(false);

  const load = async (id: string) => {
    const { data: w } = await supabase.from("wallets").select("balance_cents").eq("user_id", id).maybeSingle();
    setBalance(w?.balance_cents || 0);
    const { data } = await supabase.from("advertiser_ads").select("*").eq("user_id", id).order("created_at", { ascending: false });
    setAds((data || []) as AdvAd[]);
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { nav("/auth", { replace: true }); return; }
      setUid(session.user.id);
      load(session.user.id);
    })();
  }, [nav]);

  const dailyCostCents = (parseInt(perDay || "0", 10) || 0) * 50;

  const submit = async () => {
    if (!uid) return;
    if (!title.trim()) { toast.error("Title required"); return; }
    const n = parseInt(perDay, 10);
    if (!(n > 0)) { toast.error("Times per day must be > 0"); return; }
    if (dailyCostCents > balance) { toast.error("Top up your wallet to cover at least one day"); return; }

    setSaving(true);
    try {
      let payload = ""; let kind: AdvAd["kind"];
      if (tab === "video_file") {
        if (!file) { toast.error("Choose a file"); return; }
        const path = `${uid}/adv-${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("ads").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("ads").getPublicUrl(path);
        payload = pub.publicUrl; kind = "video_file";
      } else {
        if (!urlVal.trim()) { toast.error("URL required"); return; }
        payload = urlVal.trim(); kind = tab as any;
      }
      const { error } = await supabase.from("advertiser_ads").insert({
        user_id: uid, title: title.trim(), kind, payload,
        daily_impressions: n, cost_per_impression_cents: 50, status: "pending_review",
      });
      if (error) throw error;
      toast.success("Submitted for admin review");
      setTitle(""); setUrlVal(""); setFile(null);
      load(uid);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this ad?")) return;
    await supabase.from("advertiser_ads").delete().eq("id", id);
    if (uid) load(uid);
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <button onClick={() => nav("/")} className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Advertise</h1>
          <Link to="/wallet" className="text-sm underline">Wallet: ${(balance/100).toFixed(2)}</Link>
        </div>
        <p className="text-sm text-muted-foreground">Submit an ad for review. Each appearance costs $0.50 and is deducted from your wallet.</p>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">New ad</h2>
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="video_url">Video URL</TabsTrigger>
              <TabsTrigger value="video_file">Upload</TabsTrigger>
              <TabsTrigger value="monetag_url">URL ad</TabsTrigger>
            </TabsList>
            <TabsContent value="video_url" className="pt-3">
              <Input placeholder="https://example.com/ad.mp4 or YouTube link" value={urlVal} onChange={(e) => setUrlVal(e.target.value)} />
            </TabsContent>
            <TabsContent value="video_file" className="pt-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm">
                <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
                <Upload className="h-4 w-4" /> {file ? file.name : "Choose video file"}
              </label>
            </TabsContent>
            <TabsContent value="monetag_url" className="pt-3">
              <Input placeholder="https://your-ad-link..." value={urlVal} onChange={(e) => setUrlVal(e.target.value)} />
            </TabsContent>
          </Tabs>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Times shown per day</label>
              <Input type="number" min="1" value={perDay} onChange={(e) => setPerDay(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Daily cost</label>
              <div className="h-10 grid place-items-start pt-2 font-mono">${(dailyCostCents/100).toFixed(2)}</div>
            </div>
          </div>
          <Button onClick={submit} disabled={saving} className="w-full">{saving ? "Submitting…" : "Submit for review"}</Button>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-2">Your ads</h2>
          {ads.length === 0 && <div className="text-sm text-muted-foreground">None yet.</div>}
          <div className="space-y-2">
            {ads.map((a) => (
              <div key={a.id} className="flex items-center gap-2 border rounded-md p-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.kind} · {a.daily_impressions}/day</div>
                  {a.rejection_reason && <div className="text-xs text-red-500">Rejected: {a.rejection_reason}</div>}
                </div>
                <span className={`text-xs px-2 py-1 rounded ${a.status === "approved" ? "bg-green-500/15 text-green-600" : a.status === "rejected" ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-600"}`}>{a.status.replace("_", " ")}</span>
                <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Advertise;
