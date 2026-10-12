import { useEffect, useState } from "react";
import { CircleArrowRight, Crown, Hourglass, X } from "lucide-react";
import { Layout, Amoeba } from "@/components/layout/Layout";
import { PortalDecor } from "@/components/layout/PortalDecor";
import { useAuth } from "@/context/auth-context";
import { fetchProfile, type Profile } from "@/services/auth.service";

type Person = { email: string; owner: boolean; pending: boolean };

// Shared row + icon-button styles so both lists line up the same way.
const rowClass =
    "flex items-center justify-between gap-3 rounded-[3px] border border-white/10 bg-black/25 px-3 py-2";
const iconBtnClass =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";
const removeBtnClass = `${iconBtnClass} text-red-500 hover:bg-red-500/15 hover:text-red-400`;
const joinBtnClass = `${iconBtnClass} text-[var(--sv-cyan)] hover:bg-[var(--sv-cyan)]/15`;

const SectionBox = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <article className="portal-card min-w-0">
        <h2 className="!font-sans !font-bold">{title}</h2>
        {children}
    </article>
);

const EmptyNote = ({ children }: { children: React.ReactNode }) => (
    <p className="py-2 text-center">{children}</p>
);

const TeamSection = ({
    people,
    onRemove,
}: {
    people: Person[];
    onRemove: (email: string) => void;
}) => (
    <SectionBox title="Team">
        {people.length === 0 ? (
            <EmptyNote>No teammates yet.</EmptyNote>
        ) : (
            <ul className="flex flex-col gap-2">
                {people.map((person) => (
                    <li key={person.email} className={rowClass}>
                        <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{person.email}</span>
                            {person.pending && (
                                <Hourglass
                                    className="h-4 w-4 shrink-0 text-[var(--sv-yellow)]"
                                    aria-label="Pending invitation"
                                >
                                    <title>Pending invitation</title>
                                </Hourglass>
                            )}
                        </span>

                        {person.owner ? (
                            // Same 32px slot as the remove button so the crown lines up with the red crosses.
                            <span className={`${iconBtnClass} text-[var(--sv-yellow)]`} title="Owner">
                                <Crown className="h-5 w-5" aria-label="Owner" />
                            </span>
                        ) : (
                            <button
                                type="button"
                                className={removeBtnClass}
                                title={person.pending ? "Cancel invitation" : "Remove member"}
                                aria-label={`${person.pending ? "Cancel invitation for" : "Remove"} ${person.email}`}
                                onClick={() => onRemove(person.email)}
                            >
                                <X className="h-5 w-5" strokeWidth={3} />
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        )}
    </SectionBox>
);

const InviteSection = ({
    emails,
    onDecline,
    onJoin,
}: {
    emails: string[];
    onDecline: (email: string) => void;
    onJoin: (email: string) => void;
}) => (
    <SectionBox title="Invitations">
        {emails.length === 0 ? (
            <EmptyNote>No pending invitations.</EmptyNote>
        ) : (
            <ul className="flex flex-col gap-2">
                {emails.map((email) => (
                    <li key={email} className={rowClass}>
                        <span className="min-w-0 truncate">{email}</span>
                        <span className="flex shrink-0 items-center gap-1">
                            <button
                                type="button"
                                className={removeBtnClass}
                                title="Decline invite"
                                aria-label={`Decline invite from ${email}`}
                                onClick={() => onDecline(email)}
                            >
                                <X className="h-5 w-5" strokeWidth={3} />
                            </button>
                            <button
                                type="button"
                                className={joinBtnClass}
                                title="Leave current team and join"
                                aria-label={`Leave current team and join ${email}`}
                                onClick={() => onJoin(email)}
                            >
                                <CircleArrowRight className="h-6 w-6" />
                            </button>
                        </span>
                    </li>
                ))}
            </ul>
        )}
    </SectionBox>
);

const TeamPlanning = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);

    useEffect(() => {
        if (!user) return;
        fetchProfile(user.uid).then(setProfile);
    }, [user]);

    // Sample data for now — swap for real team/invite data once the backend is wired up.
    // Ensure owner at top, followed by any pending
    const [people, setPeople] = useState<Person[]>([
        { email: "alex@hackrx.dev", owner: true, pending: false },
        { email: "leo@hackrx.dev", owner: false, pending: true },
        { email: "maya@hackrx.dev", owner: false, pending: false },
        { email: "sophia@hackrx.dev", owner: false, pending: false },
    ]);
    const [invites, setInvites] = useState<string[]>([
        "jordan@hackrx.dev",
        "priya@hackrx.dev",
        "sam@hackrx.dev",
    ]);

    const removePerson = (email: string) =>
        setPeople((prev) => prev.filter((p) => p.email !== email));
    const declineInvite = (email: string) =>
        setInvites((prev) => prev.filter((e) => e !== email));
    const joinTeam = (email: string) => {
        // TODO: leave current team and join the inviting team via the backend.
        setInvites((prev) => prev.filter((e) => e !== email));
    };

    return (
        <Layout portal>
            <section className="panel chapter portal" style={{ "padding": 0 }}>
                <PortalDecor />
                <Amoeba tone="violet" size="sm" style={{ top: "18%", left: "6%", animationDelay: "-2s, -5s" }} />
                <Amoeba tone="gold" size="tiny" style={{ bottom: "18%", right: "8%", animationDelay: "-6s, -1s" }} />

                <div className="grid w-[86vw] grid-cols-1 items-stretch gap-6 text-left md:min-h-[72svh] md:grid-cols-2 md:gap-10">
                    <TeamSection people={people} onRemove={removePerson} />
                    <InviteSection emails={invites} onDecline={declineInvite} onJoin={joinTeam} />
                </div>
            </section>
        </Layout>
    );
};

export default TeamPlanning;
