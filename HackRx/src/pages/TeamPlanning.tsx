import { useEffect, useState, type FormEvent } from "react";
import { CircleArrowRight, Crown, Hourglass, Send, X } from "lucide-react";
import { Layout, Amoeba } from "@/components/layout/Layout";
import { PortalDecor } from "@/components/layout/PortalDecor";
import { useAuth } from "@/context/auth-context";
import { fetchProfile, type Profile } from "@/services/auth.service";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Person = { email: string; owner: boolean; pending: boolean };

// Owner + members + pending invites can't go past this.
const MAX_TEAM_SIZE = 3;

// Shared row + icon-button styles so both lists line up the same way.
const rowClass =
    "flex items-center justify-between gap-3 rounded-[3px] border border-white/10 bg-black/25 px-3 py-2";
const iconBtnClass =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";
const removeBtnClass = `${iconBtnClass} text-red-500 hover:bg-red-500/15 hover:text-red-400`;
const joinBtnClass = `${iconBtnClass} text-[var(--sv-cyan)] hover:bg-[var(--sv-cyan)]/15`;

const SectionBox = ({
    title,
    action,
    className = "",
    children,
}: {
    title: string;
    action?: React.ReactNode; // optional control pinned to the far right of the title row
    className?: string;
    children: React.ReactNode;
}) => (
    <article className={`portal-card min-w-0 ${className}`}>
        <header className="flex items-center justify-between gap-3">
            <h2 className="!font-sans !font-bold">{title}</h2>
            {action}
        </header>
        {children}
    </article>
);

const AUTOFILL_HINT =
    "If checked, random hackers will be added to your team until it has 3 members, if it isn't already full.";

const AutofillToggle = ({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
}) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <label className="flex shrink-0 cursor-pointer select-none items-center gap-2">
                Autofill
                <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-[var(--sv-cyan)]"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    aria-describedby="autofill-hint"
                />
                <span id="autofill-hint" className="sr-only">
                    {AUTOFILL_HINT}
                </span>
            </label>
        </TooltipTrigger>
        <TooltipContent
            side="bottom"
            align="end"
            className="max-w-[240px] rounded-[3px] border-2 border-black bg-[rgba(20,8,32,.95)] font-sans text-[13px] leading-snug text-[var(--cream)] shadow-[4px_4px_0_rgba(0,0,0,.45)]"
        >
            {AUTOFILL_HINT}
        </TooltipContent>
    </Tooltip>
);

const EmptyNote = ({ children }: { children: React.ReactNode }) => (
    <p className="py-2 text-center">{children}</p>
);

const TeamSection = ({
    people,
    onRemove,
    autofill,
    onAutofillChange,
}: {
    people: Person[];
    onRemove: (email: string) => void;
    autofill: boolean;
    onAutofillChange: (checked: boolean) => void;
}) => (
    <SectionBox
        title="My Team"
        className="flex-1 !h-auto"
        action={<AutofillToggle checked={autofill} onChange={onAutofillChange} />}
    >
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SendInviteSection = ({
    people,
    onInvite,
}: {
    people: Person[];
    onInvite: (email: string) => void;
}) => {
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const full = people.length >= MAX_TEAM_SIZE;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (full) return;
        const value = email.trim().toLowerCase();
        if (!EMAIL_RE.test(value)) return setError("Enter a valid email address.");
        if (people.some((p) => p.email.toLowerCase() === value))
            return setError("That person is already on your team or invited.");
        onInvite(value);
        setEmail("");
        setError(null);
    };

    return (
        <SectionBox title="Invite Teammates" className="!h-auto">
            <form onSubmit={submit} className="flex items-center gap-2" noValidate>
                <label htmlFor="invite-email" className="sr-only">
                    Teammate email
                </label>
                <input
                    id="invite-email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="teammate@email.com"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                    }}
                    disabled={full}
                    aria-invalid={!!error}
                    aria-describedby={error ? "invite-email-error" : full ? "invite-full-note" : undefined}
                    className="h-10 min-w-0 flex-1 rounded-[3px] border px-3 text-sm placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={full}
                    className={`${joinBtnClass} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
                    title={full ? "Team is full" : "Send invite"}
                    aria-label="Send invite"
                >
                    <Send className="h-5 w-5" />
                </button>
            </form>
            {full && (
                <p id="invite-full-note">
                    Your team is full ({MAX_TEAM_SIZE}/{MAX_TEAM_SIZE}, including pending invites). Remove someone
                    or cancel an invite to add another person.
                </p>
            )}
            {error && (
                <p id="invite-email-error" role="alert" className="!text-red-400">
                    {error}
                </p>
            )}
        </SectionBox>
    );
};

const InviteSection = ({
    emails,
    onDecline,
    onJoin,
}: {
    emails: string[];
    onDecline: (email: string) => void;
    onJoin: (email: string) => void;
}) => (
    <SectionBox title="Incoming Invitations">
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

    const [autofill, setAutofill] = useState(false);

    const invitePerson = (email: string) =>
        setPeople((prev) => {
            if (prev.length >= MAX_TEAM_SIZE) return prev; // owner + members + pending already at the cap
            // Keep owner first, then pending invites, then confirmed members.
            const lastPending = prev.reduce((idx, p, i) => (p.owner || p.pending ? i : idx), -1);
            const next = [...prev];
            next.splice(lastPending + 1, 0, { email, owner: false, pending: true });
            return next;
        });
    // TODO: persist invites and the autofill preference once the backend is wired up.
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

                <div className="grid w-[86vw] grid-cols-1 items-stretch gap-6 text-left md:min-h-[72svh] md:grid-cols-2 md:gap-15">
                    <div className="flex min-w-0 flex-col gap-6">
                        <TeamSection
                            people={people}
                            onRemove={removePerson}
                            autofill={autofill}
                            onAutofillChange={setAutofill}
                        />
                        <SendInviteSection people={people} onInvite={invitePerson} />
                    </div>
                    <InviteSection emails={invites} onDecline={declineInvite} onJoin={joinTeam} />
                </div>
            </section>
        </Layout>
    );
};

export default TeamPlanning;
