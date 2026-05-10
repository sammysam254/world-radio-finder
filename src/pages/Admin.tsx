import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, ArrowUp, ArrowDown, LogOut, Upload, Check, X, Menu, Radio, ScrollText, Star, Wallet, Users, ChevronRight, Home } from "lucide-react";

type Ad = { id: string; kind: "video_file" | "video_url" | "monetag_url"; title: string; payload: string; sequence: number; active: boolean };
type Marquee = { id: string; text: string; position: string; active: boolean; sequence: number };
type Session = { id: string; country: string | null; city: string | null; started_at: string; last_seen_at: string; seconds_total: number };
type AdvAd = { id: string; user_id: string; title: string; kind: string; payload: string; daily_impressions: number; status: string; rejection_reason: string | null; created_at: string };
type Withdrawal = { id: string; user_id: string; amount_usd_cents: number; pay_network: string | null; destination: any; status: string; created_at: string; admin_note: string | null };

const SECTIONS = [
  { id: "ads",         label: "House Ads",   icon: Radio },
  { id: "marquees",    label: "Marquees",    icon: ScrollText },
  { id: "reviews",     label: "Review Ads",  icon: Star },
  { id: "withdrawals", label: "Withdrawals", icon: Wallet },
  { id: "listeners",   label: "Listeners",   icon: Users },
];

const Admin = () => {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("ads");
  const [ads, setAds] = useState<Ad[]>([]);
  const [adTab, setAdTab] = useState("video_url");
  const [title, setTitle] = useState("");
  const [urlVal, setUrlVal] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [marquees, setMarquees] = useState<Marquee[]>([]);
  const [mText, setMText] = useState("");
  const [mPos, setMPos] = useState<"top" | "bottom">("top");
  const [sessions, setSessions] = useState<Session[]>([]);
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
  const refresh = async () => { const { data } = await supabase.from("ads").select("*").order("sequence"); setAds((data || []) as Ad[]); };
  const refreshMarquees = async () => { const { data } = await supabase.from("marquee_texts").select("*").order("position").order("sequence"); setMarquees((data || []) as Marquee[]); };
  const refreshSessions = async () => { const { data } = await supabase.from("listener_sessions").select("*").order("last_seen_at", { ascending: false }).limit(200); setSessions((data || []) as Session[]); };
  const refreshAdv = async () => { const { data } = await supabase.from("advertiser_ads").select("*").order("created_at", { ascending: false }); setAdvAds((data || []) as AdvAd[]); };
  const refreshWithdrawals = async () => { const { data } = await supabase.from("wallet_payments").select("*").eq("kind", "withdrawal").order("created_at", { ascending: false }); setWithdrawals((data || []) as Withdrawal[]); };

  const resolveWithdrawal = async (id: string, approve: boolean) => {
    const note = prompt(approve ? "Note (optional)" : "Reason (optional)") || "";
    const { error } = await supabase.rpc("admin_resolve_withdrawal", { _payment_id: id, _approve: approve, _note: note });
    if (error) toast.error(error.message); else toast.success(approve ? "Approved" : "Rejected & refunded");
    refreshWithdrawals();
  };

  const sendViaPaystack = async (id: string) => {
    if (!confirm("Send via Paystack Transfer?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "initiate", payment_id: id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed");
      toast.success(`Transfer initiated! Code: ${data.transfer_code}`);
      refreshWithdrawals();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const signOut = async () => { await supabase.auth.signOut(); nav("/auth", { replace: true }); };

  const addAd = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    try {
      let payload = ""; let kind: Ad["kind"];
      if (adTab === "video_file") {
        if (!file) { toast.error("Pick a video file"); return; }
        const path = `${userId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("ads").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("ads").getPublicUrl(path);
        payload = pub.publicUrl; kind = "video_file";
      } else if (adTab === "video_url") {
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
  const removeAd = async (id: string) => { if (!confirm("Delete?")) return; await supabase.from("ads").delete().eq("id", id); refresh(); };
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

  const goTo = (id: string) => { setActiveSection(id); setMenuOpen(false); };

  if (loading) return <div className="min-h-screen grid place-items-center text-sm">Loading…</div>;
  if (!isAdmin) return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card className="max-w-sm w-full p-6 space-y-3 text-center">
        <h1 className="text-xl font-bold">Not authorized</h1>
        <Button onClick={signOut} variant="outline" className="w-full">Sign out</Button>
      </Card>
    </div>
  );

  const ActiveIcon = SECTIONS.find(s => s.id === activeSection)?.icon || Radio;
  const activeLabel = SECTIONS.find(s => s.id === activeSection)?.label || "";

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-background border-b flex items-center gap-3 px-4 py-3 shrink-0">
        <button onClick={() => setMenuOpen(true)} className="p-1.5 rounded-md hover:bg-muted transition-colors">
          <Menu className="h-5 w-5" />
        </button>
        <ActiveIcon className="h-4 w-4 text-primary shrink-0" />
        <span className="font-semibold text-sm flex-1">{activeLabel}</span>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => nav("/")} className="gap-1 text-muted-foreground">
            <Home className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1 text-muted-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hamburger drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-64 bg-background border-r flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-4 border-b">
              <span className="font-bold">Admin Panel</span>
              <button onClick={() => setMenuOpen(false)} className="p-1 rounded-md hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
              {SECTIONS.map(s => {
                const Icon = s.icon;
                const active = activeSection === s.id;
                return (
                  <button key={s.id} onClick={() => goTo(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{s.label}</span>
                    {active && <ChevronRight className="h-4 w-4" />}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t">
              <Button variant="outline" onClick={signOut} className="w-full gap-2">
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      {/* Page content */}
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-4">

        {activeSection === "ads" && (
          <>
            <Card className="p-4 space-y-3">
              <h2 className="font-semibold">Add new ad</h2>
              <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
              <Tabs value={adTab} onValueChange={setAdTab}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="video_url" className="text-xs">Video URL</TabsTrigger>
                  <TabsTrigger value="video_file" className="text-xs">Upload</TabsTrigger>
                  <TabsTrigger value="monetag_url" className="text-xs">Monetag</TabsTrigger>
                </TabsList>
                <TabsContent value="video_url" className="pt-3">
                  <Input placeholder="https://… or YouTube" value={urlVal} onChange={e => setUrlVal(e.target.value)} />
                </TabsContent>
                <TabsContent value="video_file" className="pt-3">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm">
                    <input type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
                    <Upload className="h-4 w-4" /> {file ? file.name : "Choose video file"}
                  </label>
                </TabsContent>
                <TabsContent value="monetag_url" className="pt-3">
                  <Input placeholder="Monetag URL" value={urlVal} onChange={e => setUrlVal(e.target.value)} />
                </TabsContent>
              </Tabs>
              <Button onClick={addAd} disabled={saving} className="w-full">{saving ? "Saving…" : "Add Ad"}</Button>
            </Card>
            <Card className="p-4">
              <h2 className="font-semibold mb-3">Ad Sequence ({ads.length})</h2>
              {ads.length === 0 && <p className="text-sm text-muted-foreground">No ads yet.</p>}
              <div className="space-y-2">
                {ads.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2 p-3 rounded-xl border">
                    <div className="text-xs font-mono w-5 text-muted-foreground shrink-0">#{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.kind}</div>
                    </div>
                    <button onClick={() => toggleActive(a.id, a.active)}
                      className={`text-xs px-2 py-1 rounded-full shrink-0 ${a.active ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
                      {a.active ? "On" : "Off"}
                    </button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => move(a.id, -1)}><ArrowUp className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => move(a.id, 1)}><ArrowDown className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeAd(a.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {activeSection === "marquees" && (
          <>
            <Card className="p-4 space-y-3">
              <h2 className="font-semibold">Add marquee text</h2>
              <Input placeholder="Marquee text…" value={mText} onChange={e => setMText(e.target.value)} />
              <div className="flex gap-2">
                <select value={mPos} onChange={e => setMPos(e.target.value as any)}
                  className="flex-1 border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </select>
                <Button onClick={addMarquee}>Add</Button>
              </div>
            </Card>
            <Card className="p-4 space-y-2">
              <h2 className="font-semibold mb-2">All marquees ({marquees.length})</h2>
              {marquees.length === 0 && <p className="text-sm text-muted-foreground">No marquees.</p>}
              {marquees.map(m => (
                <div key={m.id} className="flex items-center gap-2 p-3 border rounded-xl">
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${m.position === "top" ? "bg-blue-500/15 text-blue-600" : "bg-purple-500/15 text-purple-600"}`}>{m.position}</span>
                  <Input defaultValue={m.text} className="flex-1 text-sm"
                    onBlur={e => e.target.value !== m.text && updateMarquee(m.id, { text: e.target.value })} />
                  <button onClick={() => updateMarquee(m.id, { active: !m.active })}
                    className={`text-xs px-2 py-1 rounded-full shrink-0 ${m.active ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
                    {m.active ? "On" : "Off"}
                  </button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => deleteMarquee(m.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </Card>
          </>
        )}

        {activeSection === "reviews" && (
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Submitted Ads ({advAds.length})</h2>
            {advAds.length === 0 && <p className="text-sm text-muted-foreground">No submissions.</p>}
            <div className="space-y-3">
              {advAds.map(a => (
                <div key={a.id} className="border rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.kind} · {a.daily_impressions}/day · {new Date(a.created_at).toLocaleDateString()}</div>
                      <a href={a.payload} target="_blank" rel="noreferrer" className="text-xs text-primary underline break-all line-clamp-1">{a.payload}</a>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${a.status === "approved" ? "bg-green-500/15 text-green-600" : a.status === "rejected" ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-600"}`}>{a.status}</span>
                  </div>
                  {a.status === "pending_review" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" className="gap-1" onClick={() => reviewAd(a.id, "approved")}><Check className="h-3 w-3" /> Approve</Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => reviewAd(a.id, "rejected")}><X className="h-3 w-3" /> Reject</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeSection === "withdrawals" && (
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Withdrawals ({withdrawals.length})</h2>
            {withdrawals.length === 0 && <div className="text-sm text-muted-foreground">No requests.</div>}
            <div className="space-y-3">
              {withdrawals.map(w => (
                <div key={w.id} className="border rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">${(w.amount_usd_cents/100).toFixed(2)} · {w.pay_network}</div>
                      <div className="text-xs text-muted-foreground">User: {w.user_id.slice(0,8)}…</div>
                      <div className="text-xs truncate">To: {typeof w.destination === "object" ? w.destination?.details || JSON.stringify(w.destination) : w.destination}</div>
                      <div className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</div>
                      {w.admin_note && <div className="text-xs text-amber-600">Note: {w.admin_note}</div>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${w.status === "finished" ? "bg-green-500/15 text-green-600" : w.status === "failed" ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-600"}`}>{w.status}</span>
                  </div>
                  {w.status === "pending" && (
                    <div className="space-y-2">
                      <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 gap-1" onClick={() => sendViaPaystack(w.id)}>💸 Send via Paystack</Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => resolveWithdrawal(w.id, true)}><Check className="h-3 w-3" /> Mark paid</Button>
                        <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => resolveWithdrawal(w.id, false)}><X className="h-3 w-3" /> Reject</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeSection === "listeners" && (
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Recent Listeners ({sessions.length})</h2>
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 border rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                    {(s.country || "?").slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{s.country || "Unknown"}{s.city ? ` · ${s.city}` : ""}</div>
                    <div className="text-xs text-muted-foreground">{Math.floor(s.seconds_total/60)}m {s.seconds_total%60}s · {new Date(s.last_seen_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

      </div>
    </div>
  );
};

export default Admin;
