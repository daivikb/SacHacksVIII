import { useEffect, useState } from "react";
import { Layout, Amoeba } from "@/components/layout/Layout";
import { PortalDecor } from "@/components/layout/PortalDecor";
import { useAuth } from "@/context/auth-context";
import { fetchProfile, type Profile } from "@/services/auth.service";
import { Countdown } from "@/features/home/components/Countdown";
import { useNavigate } from "react-router";
import { useGlitchTriggers } from "@/hooks/useGlitchTriggers";
import { fetchApplicationStatus, type ApplicationStatus } from "@/services/application.service";

/** "loading" until Firestore answers; null means the user hasn't applied. */
type StatusState = ApplicationStatus | null | "loading";

const STATUS_DISPLAY: Record<ApplicationStatus | "none", { label: string; dot: string }> = {
  none: { label: "Not submitted", dot: "bg-red-400" },
  pending: { label: "Pending...", dot: "bg-blue-400" },
  approved: { label: "Accepted", dot: "bg-green-400" },
  rejected: { label: "Not accepted", dot: "bg-white/40" },
};

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<StatusState>("loading");

  useEffect(() => {
    if (!user) return;
    let active = true;
    setStatus("loading");
    // Both read users/{uid}: the profile for the greeting, and its
    // `application` field for whether (and how) they've applied.
    void fetchProfile(user.uid).then((p) => { if (active) setProfile(p); });
    void fetchApplicationStatus(user.uid).then((s) => { if (active) setStatus(s); });
    return () => { active = false; };
  }, [user]);

  const name = profile?.username || profile?.full_name || user?.email?.split("@")[0] || "hacker";
  
  const loading = status === "loading";
  const submitted = !loading && status !== null;
  const display = STATUS_DISPLAY[loading || status === null ? "none" : status];

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
        <p className="chapter-sub">
          {submitted ? "Thanks for applying! Your status updates here." : "Applications open! Apply now!"}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          {/* Same pill style + glitch hover as the nav's Hacker Hub button, sized up */}
          {/* Only offer Apply once we know they haven't — one application per account. */}
          {!loading && !submitted && (
            <button
              type="button"
              className="nav-cta cursor-pointer !px-7 !py-3 !text-base"
              {...applyTriggers}
              onClick={toApplicationForm}
            >
              Apply
            </button>
          )}
          <span
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2.5 font-sans text-sm text-[var(--cream)]"
            aria-live="polite"
          >
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${loading ? "bg-white/30 animate-pulse" : display.dot}`}
            />
            Status: {loading ? "Checking..." : display.label}
          </span>
        </div>
        <Countdown />
      </section>
    </Layout>
  );
};

export default Dashboard;