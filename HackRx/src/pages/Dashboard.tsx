import { useEffect, useState } from "react";
import { Layout, Amoeba } from "@/components/layout/Layout";
import { PortalDecor } from "@/components/layout/PortalDecor";
import { useAuth } from "@/context/auth-context";
import { fetchProfile, type Profile } from "@/services/auth.service";
import { Countdown } from "@/features/home/components/Countdown";
import { useNavigate } from "react-router";
import { useGlitchTriggers } from "@/hooks/useGlitchTriggers";

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchProfile(user.uid).then(setProfile);
  }, [user]);

  const name = profile?.username || profile?.full_name || user?.email?.split("@")[0] || "hacker";
  
  const submission = false;

  const navigate = useNavigate();
  const applyTriggers = useGlitchTriggers();
  const toApplicationForm = () => {
    navigate("/apply")
  }

  return (
    <Layout portal>
      <section className="panel chapter portal">
        <PortalDecor />
        <Amoeba tone="violet" size="sm" style={{ top: "18%", left: "6%", animationDelay: "-2s, -5s" }} />
        <Amoeba tone="gold" size="tiny" style={{ bottom: "18%", right: "8%", animationDelay: "-6s, -1s" }} />
        <span className="eyebrow">Hacker Hub</span>
        <h1 className="chapter-title">Welcome, {name}</h1>
        <p className="chapter-sub">Applications open! Apply now!</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          {/* Same pill style + glitch hover as the nav's Hacker Hub button, sized up */}
          <button
            type="button"
            className="nav-cta cursor-pointer !px-7 !py-3 !text-base"
            {...applyTriggers}
            onClick={toApplicationForm}
          >
            Apply
          </button>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2.5 font-sans text-sm text-[var(--cream)]">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${submission ? "bg-blue-400" : "bg-red-400"}`}
            />
            Status: {submission ? "Pending..." : "Not submitted"}
          </span>
        </div>
        <Countdown />
      </section>
    </Layout>
  );
};

export default Dashboard;