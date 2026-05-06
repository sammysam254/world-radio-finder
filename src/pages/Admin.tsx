import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, ArrowUp, ArrowDown, LogOut, Upload } from "lucide-react";

type Ad = {
  id: string;
  kind: "video_file" | "video_url" | "monetag_url";
  title: string;
  payload: string;
  sequence: number;
  active: boolean;
};

const Admin = () => {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [tab, setTab] = useState("video_url");

  // form state
  const [title, setTitle] = useState("");
  const [urlVal, setUrlVal] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { nav("/auth", { replace: true }); return; }
      setUserId(session.user.id);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const admin = !!roles?.some((r) => r.role === "admin");
      setIsAdmin(admin);
      setLoading(false);
      if (admin) refresh();
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) nav("/auth", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("ads")
      .select("*")
      .order("sequence", { ascending: true });
    if (error) { toast.error(error.message); return; }
    setAds((data || []) as Ad[]);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    nav("/auth", { replace: true });
  };

  const addAd = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    try {
      let payload = "";
      let kind: Ad["kind"];
      if (tab === "video_file") {
        if (!file) { toast.error("Pick a video file"); return; }
        const path = `${userId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("ads").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("ads").getPublicUrl(path);
        payload = pub.publicUrl;
        kind = "video_file";
      } else if (tab === "video_url") {
        if (!urlVal.trim()) { toast.error("URL required"); return; }
        payload = urlVal.trim();
        kind = "video_url";
      } else {
        if (!urlVal.trim()) { toast.error("URL required"); return; }
        payload = urlVal.trim();
        kind = "monetag_url";
      }
      const seq = ads.length ? Math.max(...ads.map(a => a.sequence)) + 1 : 1;
      const { error } = await supabase.from("ads").insert({
        title: title.trim(), kind, payload, sequence: seq, active: true, created_by: userId,
      });
      if (error) throw error;
      toast.success("Ad added");
      setTitle(""); setUrlVal(""); setFile(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const move = async (id: string, dir: -1 | 1) => {
    const i = ads.findIndex(a => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ads.length) return;
    const a = ads[i], b = ads[j];
    await supabase.from("ads").update({ sequence: b.sequence }).eq("id", a.id);
    await supabase.from("ads").update({ sequence: a.sequence }).eq("id", b.id);
    refresh();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("ads").update({ active: !active }).eq("id", id);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this ad?")) return;
    await supabase.from("ads").delete().eq("id", id);
    refresh();
  };

  if (loading) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (!isAdmin) return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <Card className="max-w-md p-6 space-y-3">
        <h1 className="text-xl font-bold">Not authorized</h1>
        <p className="text-sm text-muted-foreground">Your account does not have admin access.</p>
        <Button onClick={signOut} variant="outline">Sign out</Button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ads admin</h1>
            <p className="text-sm text-muted-foreground">Ads play in sequence during commercial breaks (every 5 min).</p>
          </div>
          <Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Sign out</Button>
        </div>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Add new ad</h2>
          <Input placeholder="Title (e.g. 'Summer sale')" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="video_url">Video URL</TabsTrigger>
              <TabsTrigger value="video_file">Upload video</TabsTrigger>
              <TabsTrigger value="monetag_url">Monetag URL</TabsTrigger>
            </TabsList>
            <TabsContent value="video_url" className="pt-3">
              <Input placeholder="https://example.com/ad.mp4 or YouTube link" value={urlVal} onChange={(e) => setUrlVal(e.target.value)} />
            </TabsContent>
            <TabsContent value="video_file" className="pt-3 space-y-2">
              <label className="block">
                <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="ad-file" />
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm">
                  <Upload className="h-4 w-4" /> {file ? file.name : "Choose video file"}
                </span>
              </label>
            </TabsContent>
            <TabsContent value="monetag_url" className="pt-3">
              <Input placeholder="https://your-monetag-direct-link..." value={urlVal} onChange={(e) => setUrlVal(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-2">Direct/smart links open in a new tab during the break and the player auto-resumes.</p>
            </TabsContent>
          </Tabs>
          <Button onClick={addAd} disabled={saving} className="w-full">{saving ? "Saving…" : "Add ad"}</Button>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3">Ad sequence ({ads.length})</h2>
          {ads.length === 0 && <p className="text-sm text-muted-foreground">No ads yet.</p>}
          <div className="space-y-2">
            {ads.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded-md border">
                <div className="text-xs w-6 text-muted-foreground">#{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.kind} · {a.payload}</div>
                </div>
                <button onClick={() => toggleActive(a.id, a.active)} className={`text-xs px-2 py-1 rounded ${a.active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {a.active ? "Active" : "Off"}
                </button>
                <Button variant="ghost" size="icon" onClick={() => move(a.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => move(a.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
