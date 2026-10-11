import { useCallback, useEffect, useState } from "react";
import { Check, FileBadge, FlaskConical, RefreshCw, ShieldCheck, Users, X } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PortalDecor } from "@/components/layout/PortalDecor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAdminWorkspace,
  issueCertification,
  reviewApplication,
  type AdminWorkspace,
} from "@/services/admin.service";

const EMPTY: AdminWorkspace = { applications: [], teams: [], demos: [], members: [], certifications: [] };

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workspace, setWorkspace] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [certificateTitles, setCertificateTitles] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAdminWorkspace();
    setLoading(false);
    if (result.error) {
      toast({ title: "Couldn't load control room", description: result.error, variant: "destructive" });
      return;
    }
    if (result.data) setWorkspace(result.data);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const actor = user?.uid ?? "admin";

  const review = async (id: string, status: "approved" | "rejected") => {
    const error = await reviewApplication(id, status, actor);
    if (error) toast({ title: "Review failed", description: error, variant: "destructive" });
    else void load();
  };

  const certify = async (memberId: string) => {
    const title = certificateTitles[memberId]?.trim() || "HackRx Participant";
    const error = await issueCertification(memberId, actor, title);
    if (error) toast({ title: "Certificate failed", description: error, variant: "destructive" });
    else {
      toast({ title: "Certification assigned" });
      setCertificateTitles((current) => ({ ...current, [memberId]: "" }));
      void load();
    }
  };

  const approved = workspace.applications.filter((application) => application.status === "approved").length;

  return (
    <Layout portal>
      <main className="admin-portal">
        <PortalDecor />
        <header className="admin-header">
          <div>
            <span className="eyebrow">Admin control room</span>
            <h1 className="chapter-title">HackRx operations</h1>
            <p className="chapter-sub">Review the event from application to certification.</p>
          </div>
          <Button className="admin-refresh" onClick={() => void load()} disabled={loading} aria-label="Refresh admin data">
            <RefreshCw className={loading ? "admin-spin" : ""} /> Refresh
          </Button>
        </header>

        <section className="admin-metrics" aria-label="Event totals">
          <article><ShieldCheck /><strong>{workspace.applications.length}</strong><span>Applications</span></article>
          <article><Check /><strong>{approved}</strong><span>Approved</span></article>
          <article><Users /><strong>{workspace.teams.length}</strong><span>Teams</span></article>
          <article><FlaskConical /><strong>{workspace.demos.length}</strong><span>Demos</span></article>
        </section>

        <section className="admin-section">
          <div className="admin-section-title"><ShieldCheck /><div><h2>Applications</h2><p>Approve or reject submitted applications.</p></div></div>
          <div className="admin-list">
            {workspace.applications.map((application) => (
              <article className="admin-row" key={application.id}>
                <div><strong>{application.full_name}</strong><span>{application.email} · {application.institution || "No institution"}</span></div>
                <span className={`admin-status is-${application.status}`}>{application.status}</span>
                <div className="admin-actions">
                  <Button size="icon" onClick={() => void review(application.id, "approved")} aria-label={`Approve ${application.full_name}`}><Check /></Button>
                  <Button size="icon" variant="destructive" onClick={() => void review(application.id, "rejected")} aria-label={`Reject ${application.full_name}`}><X /></Button>
                </div>
              </article>
            ))}
            {!loading && workspace.applications.length === 0 && <p className="admin-empty">No applications submitted yet.</p>}
          </div>
        </section>

        <div className="admin-columns">
          <section className="admin-section">
            <div className="admin-section-title"><Users /><div><h2>Formed teams</h2><p>Teams appear here as participants form them.</p></div></div>
            <div className="admin-list compact">
              {workspace.teams.map((team) => <article className="admin-row" key={team.id}><div><strong>{team.name}</strong><span>{team.track || "Track not selected"}</span></div></article>)}
              {!loading && workspace.teams.length === 0 && <p className="admin-empty">No teams formed yet.</p>}
            </div>
          </section>
          <section className="admin-section">
            <div className="admin-section-title"><FlaskConical /><div><h2>Demo submissions</h2><p>All project demos and review states.</p></div></div>
            <div className="admin-list compact">
              {workspace.demos.map((demo) => <article className="admin-row" key={demo.id}><div><strong>{demo.title}</strong><span>{demo.status}</span></div>{demo.demo_url && <a href={demo.demo_url} target="_blank" rel="noreferrer">Open demo</a>}</article>)}
              {!loading && workspace.demos.length === 0 && <p className="admin-empty">No demos submitted yet.</p>}
            </div>
          </section>
        </div>

        <section className="admin-section">
          <div className="admin-section-title"><FileBadge /><div><h2>Members & certifications</h2><p>Registered members stay listed here; assign credentials when ready.</p></div></div>
          <div className="admin-list">
            {workspace.members.map((member) => (
              <article className="admin-row member-row" key={member.id}>
                <div><strong>{member.full_name || member.username || "New member"}</strong><span>{member.email || "Email unavailable"}</span></div>
                <Input value={certificateTitles[member.id] ?? ""} onChange={(event) => setCertificateTitles((current) => ({ ...current, [member.id]: event.target.value }))} placeholder="HackRx Participant" aria-label={`Certification title for ${member.full_name || "member"}`} />
                <Button onClick={() => void certify(member.id)}><FileBadge /> Assign</Button>
              </article>
            ))}
            {!loading && workspace.members.length === 0 && <p className="admin-empty">No registered members yet.</p>}
          </div>
        </section>
      </main>
    </Layout>
  );
};

export default AdminDashboard;