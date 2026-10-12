import { useEffect, useState } from "react";
import { Layout, Amoeba } from "@/components/layout/Layout";
import { PortalDecor } from "@/components/layout/PortalDecor";
import { useAuth } from "@/context/auth-context";
import { fetchProfile, type Profile } from "@/services/auth.service";
import { Countdown } from "@/features/home/components/Countdown";

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchProfile(user.uid).then(setProfile);
  }, [user]);

  const name = profile?.username || profile?.full_name || user?.email?.split("@")[0] || "hacker";

  return (
    <Layout portal>
      <section className="panel chapter portal">
        <PortalDecor />
        <Amoeba tone="violet" size="sm" style={{ top: "18%", left: "6%", animationDelay: "-2s, -5s" }} />
        <Amoeba tone="gold" size="tiny" style={{ bottom: "18%", right: "8%", animationDelay: "-6s, -1s" }} />
        <span className="eyebrow">Hacker Hub</span>
        <h1 className="chapter-title">Welcome, {name}</h1>
        <p className="chapter-sub">Applications open on October 12. Wait until then.</p>
        <Countdown />
      </section>
    </Layout>
  );
};

export default Dashboard;