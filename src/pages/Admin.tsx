import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, ArrowUp, ArrowDown, LogOut, Upload, Check, X } from "lucide-react";

type Ad = {
  id: string;
  kind: "video_file" | "video_url" | "monetag_url";
  title: string; payload: string; sequence: number; active: boolean;
};
type Marquee = { id: string; text: string; position: string; active: boolean; sequence: number };
type Session = { id: string; session_key: string; country: string | null; city: string | null; user_agent: string | null; started_at: string; last_seen_at: string; seconds_total: number };
type AdvAd = { id: string; user_id: string; title: string; kind: string; payload: string; daily_impressions: number; status: string; rejection_reason: string | null; created_at: string };
type Withdrawal = { id: string; user_id: string; amount_usd_cents: number; pay_network: string | null; destination: any; status: string; created_at: string; admin_note: string | null };

const Admin = () => {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Ads
  const [ads, setAds] = useState<Ad[]>([]);
  const [tab, setTab] = useState("video_url");
  const [title, setTitle] = useState(""); const [urlVal, setUrlVal] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Marquees
  const [marquees, setMarquees] = useState<Marquee[]>([]);
  const [mText, setMText] = useState(""); const [mPos, setMPos] = useState<"top" | "bottom">("top");

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);

  // Advertiser ads
  const [advAds, setAdvAds] = useState<AdvAd[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { nav("/auth", { replace: true }); return; }
      setUserId(session.user.id);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const admin = !!roles?.some((r) => r.role === "admin");
      setIsAdmin(admin);
      setLoading(false);
      if (admin) refreshAll();
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (!s) nav("/auth", { replace: true }); });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  const refreshAll = () => { refresh(); refreshMarquees(); refreshSessions(); refreshAdv(); refreshWithdrawals(); };
  const refresh = async () => {
    const { data } = await supabase.from("ads").select("*").order("sequence");
    setAds((data || []) as Ad[]);
  };
  const refreshMarquees = async () => {
    const { data } = await supabase.from("marquee_texts").select("*").order("position").order("sequence");
    setMarquees((data || []) as Marquee[]);
  };
  const refreshSessions = async () => {
    const { data } = await supabase.from("listener_sessions").select("*").order("last_seen_at", { ascending: false }).limit(200);
    setSessions((data || []) as Session[]);
  };
  const refreshAdv = async () => {
    const { data } = await supabase.from("advertiser_ads").select("*").order("created_at", { ascending: false });
    setAdvAds((data || []) as AdvAd[]);
  };
  const refreshWithdrawals = async () => {
    const { data } = await supabase.from("wallet_payments").select("*").eq("kind", "withdrawal").order("created_at", { ascending: false });
    setWithdrawals((data || []) as Withdrawal[]);
  };
  const resolveWithdrawal = async (id: string, approve: boolean) => {
    const note = prompt(approve ? "Note (optional)" : "Reason (optional)") || "";
    const { error } = await supabase.rpc("admin_resolve_withdrawal", { _payment_id: id, _approve: approve, _note: note });
    if (error) toast.error(error.message); else toast.success(approve ? "Approved" : "Rejected & refunded");
    refreshWithdrawals();
  };

  const signOut = async () => { await supabase.auth.signOut(); nav("/auth", { replace: true }); };

  const addAd = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    try {
      let payload = ""; let kind: Ad["kind"];
      if (tab === "video_file") {
        if (!file) { toast.error("Pick a video file"); return; }
        const path = `${userId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("ads").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("ads").getPublicUrl(path);
        payload = pub.publicUrl; kind = "video_file";
      } else if (tab === "video_url") {
        if (!urlVal.trim()) { toast.error("URL required"); return; }
        payload = urlVal.trim(); kind = "video_url";
      } else {
        if (!urlVal.trim()) { toast.error("URL required"); return; }
        payload = urlVal.trim(); kind = "monetag_url";
      }
      const seq = ads.length ? Math.max(...ads.map(a => a.sequence)) + 1 : 1;
      const { error } = await supabase.from("ads").insert({ title: title.trim(), kind, payload, sequence: seq, active: true, created_by: userId });
      if (error) throw error;
      toast.success("Ad added"); setTitle(""); setUrlVal(""); setFile(null); refresh();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setSaving(false); }
  };
  const move = async (id: string, dir: -1 | 1) => {
    const i = ads.findIndex(a => a.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= ads.length) return;
    const a = ads[i], b = ads[j];
    await supabase.from("ads").update({ sequence: b.sequence }).eq("id", a.id);
    await supabase.from("ads").update({ sequence: a.sequence }).eq("id", b.id);
    refresh();
  };
  const toggleActive = async (id: string, active: boolean) => { await supabase.from("ads").update({ active: !active }).eq("id", id); refresh(); };
  const remove = async (id: string) => { if (!confirm("Delete?")) return; await supabase.from("ads").delete().eq("id", id); refresh(); };

  const addMarquee = async () => {
    if (!mText.trim()) return;
    const seq = marquees.filter(m => m.position === mPos).length + 1;
    await supabase.from("marquee_texts").insert({ text: mText.trim(), position: mPos, sequence: seq, active: true });
    setMText(""); refreshMarquees();
  };
  const updateMarquee = async (id: string, patch: Partial<Marquee>) => { await supabase.from("marquee_texts").update(patch).eq("id", id); refreshMarquees(); };
  const deleteMarquee = async (id: string) => { await supabase.from("marquee_texts").delete().eq("id", id); refreshMarquees(); };

  const reviewAd = async (id: string, status: "approved" | "rejected") => {
    const reason = status === "rejected" ? prompt("Reason?") || "Rejected" : null;
    await supabase.from("advertiser_ads").update({ status, rejection_reason: reason }).eq("id", id);
    refreshAdv();
  };

  if (loading) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (!isAdmin) return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <Card className="max-w-md p-6 space-y-3">
        <h1 className="text-xl font-bold">Not authorized</h1>
        <Button onClick={signOut} variant="outline">Sign out</Button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin</h1>
          <Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Sign out</Button>
        </div>

        <Tabs defaultValue="ads">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="ads">House ads</TabsTrigger>
            <TabsTrigger value="marquees">Marquees</TabsTrigger>
            <TabsTrigger value="reviews">Review ads</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="listeners">Listeners</TabsTrigger>
          </TabsList>

          <TabsContent value="ads" className="space-y-4 pt-4">
            <Card className="p-4 space-y-3">
              <h2 className="font-semibold">Add new ad</h2>
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="video_url">Video URL</TabsTrigger>
                  <TabsTrigger value="video_file">Upload video</TabsTrigger>
                  <TabsTrigger value="monetag_url">Monetag URL</TabsTrigger>
                </TabsList>
                <TabsContent value="video_url" className="pt-3"><Input placeholder="https://… or YouTube" value={urlVal} onChange={(e) => setUrlVal(e.target.value)} /></TabsContent>
                <TabsContent value="video_file" className="pt-3">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm">
                    <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
                    <Upload className="h-4 w-4" /> {file ? file.name : "Choose file"}
                  </label>
                </TabsContent>
                <TabsContent value="monetag_url" className="pt-3"><Input placeholder="Monetag URL" value={urlVal} onChange={(e) => setUrlVal(e.target.value)} /></TabsContent>
              </Tabs>
              <Button onClick={addAd} disabled={saving} className="w-full">{saving ? "Saving…" : "Add"}</Button>
            </Card>
            <Card className="p-4">
              <h2 className="font-semibold mb-3">Sequence ({ads.length})</h2>
              <div className="space-y-2">
                {ads.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded-md border">
                    <div className="text-xs w-6 text-muted-foreground">#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.kind} · {a.payload}</div>
                    </div>
                    <button onClick={() => toggleActive(a.id, a.active)} className={`text-xs px-2 py-1 rounded ${a.active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{a.active ? "Active" : "Off"}</button>
                    <Button variant="ghost" size="icon" onClick={() => move(a.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => move(a.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="marquees" className="space-y-4 pt-4">
            <Card className="p-4 space-y-3">
              <h2 className="font-semibold">Add marquee text</h2>
              <Input placeholder="Marquee text" value={mText} onChange={(e) => setMText(e.target.value)} />
              <div className="flex gap-2">
                <select value={mPos} onChange={(e) => setMPos(e.target.value as any)} className="border rounded-md px-2 text-sm bg-background">
                  <option value="top">Top</option><option value="bottom">Bottom</option>
                </select>
                <Button onClick={addMarquee}>Add</Button>
              </div>
            </Card>
            <Card className="p-4 space-y-2">
              {marquees.map((m) => (
                <div key={m.id} className="flex items-center gap-2 p-2 border rounded-md">
                  <span className="text-xs w-12 text-muted-foreground">{m.position}</span>
                  <Input defaultValue={m.text} onBlur={(e) => e.target.value !== m.text && updateMarquee(m.id, { text: e.target.value })} />
                  <button onClick={() => updateMarquee(m.id, { active: !m.active })} className={`text-xs px-2 py-1 rounded ${m.active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{m.active ? "On" : "Off"}</button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMarquee(m.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4 pt-4">
            <Card className="p-4">
              <h2 className="font-semibold mb-3">Submitted ads</h2>
              {advAds.length === 0 && <p className="text-sm text-muted-foreground">No submissions.</p>}
              <div className="space-y-2">
                {advAds.map((a) => (
                  <div key={a.id} className="border rounded-md p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{a.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{a.kind} · {a.daily_impressions}/day · {new Date(a.created_at).toLocaleString()}</div>
                        <a href={a.payload} target="_blank" rel="noreferrer" className="text-xs underline break-all">{a.payload}</a>
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-muted">{a.status}</span>
                    </div>
                    {a.status === "pending_review" && (
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={() => reviewAd(a.id, "approved")}><Check className="h-4 w-4 mr-1" /> Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => reviewAd(a.id, "rejected")}><X className="h-4 w-4 mr-1" /> Reject</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="listeners" className="space-y-4 pt-4">
            <Card className="p-4">
              <h2 className="font-semibold mb-3">Recent listeners ({sessions.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-muted-foreground"><th className="py-1">Country</th><th>City</th><th>Time spent</th><th>Last seen</th></tr></thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-t border-border/40">
                        <td className="py-1.5">{s.country || "—"}</td>
                        <td>{s.city || "—"}</td>
                        <td>{Math.floor(s.seconds_total/60)}m {s.seconds_total%60}s</td>
                        <td>{new Date(s.last_seen_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
