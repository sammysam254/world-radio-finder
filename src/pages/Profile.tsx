import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, Wallet, Megaphone, Shield } from "lucide-react";

const Profile = () => {
  const nav = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setEmail(session.user.email || null);
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
        setIsAdmin(!!roles?.some((r: any) => r.role === "admin"));
        const { data: w } = await supabase.from("wallets").select("balance_cents").eq("user_id", session.user.id).maybeSingle();
        setBalance(w?.balance_cents || 0);
      }
      setLoading(false);
    })();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  };

  if (loading) return <div className="min-h-screen grid place-items-center">Loading…</div>;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-md mx-auto space-y-4">
        <button onClick={() => nav("/")} className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>
        <h1 className="text-2xl font-bold">Profile</h1>

        {!email ? (
          <Card className="p-6 space-y-4 text-center">
            <p className="text-muted-foreground">Sign in or create an account</p>
            <Link to="/auth"><Button className="w-full">Sign in / Sign up</Button></Link>
            <p className="text-xs text-muted-foreground">After signing in you'll be returned to the homepage.</p>
          </Card>
        ) : (
          <>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Signed in as</div>
              <div className="font-semibold truncate">{email}</div>
            </Card>
            <Card className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Wallet balance</div>
                <div className="text-2xl font-black">${(balance/100).toFixed(2)}</div>
              </div>
              <Link to="/wallet"><Button variant="outline" size="sm"><Wallet className="h-4 w-4 mr-1" /> Manage</Button></Link>
            </Card>
            <div className="grid grid-cols-1 gap-2">
              <Link to="/advertise"><Button variant="outline" className="w-full justify-start"><Megaphone className="h-4 w-4 mr-2" /> Create / Manage ads</Button></Link>
              {isAdmin && <Link to="/admin"><Button variant="outline" className="w-full justify-start"><Shield className="h-4 w-4 mr-2" /> Admin dashboard</Button></Link>}
              <Button variant="outline" onClick={signOut} className="w-full justify-start"><LogOut className="h-4 w-4 mr-2" /> Sign out</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
