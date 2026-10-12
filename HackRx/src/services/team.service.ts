/**
 * Team planning data access.
 *
 * Firestore structure:
 *
 * users/{uid}
 *   user_id      the account's uid
 *   email        sign-in email
 *   team_id      the team they're on
 *   invitations  list of team_ids that have invited this user
 *
 * teams/{teamId}
 *   team_id      same as the document id
 *   owner        uid of the party owner
 *   members      list of member uids
 *   pending      list of uids invited to the party but not joined yet
 *   autofill     whether open spots get filled with random hackers
 */

import { doc, getDoc } from "firebase/firestore";

import { db } from "@/integrations/firebase/client";

export type TeamPerson = {
    /** uid */
    id: string;
    /** The user's email, or null when their user doc couldn't be read. */
    email: string | null;
    owner: boolean;
    pending: boolean;
};

export type IncomingInvite = {
    teamId: string;
    /** Owner's email when it can be read. */
    ownerEmail: string | null;
};

export type TeamPlanningData = {
    teamId: string | null;
    autofill: boolean;
    /** Owner first, then pending invites, then members. */
    people: TeamPerson[];
    invites: IncomingInvite[];
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(str).filter((s): s is string => s !== null) : [];
/** team_id may have been typed into the console as a number. */
const idOf = (v: unknown): string | null => str(v) ?? (typeof v === "number" ? String(v) : null);

async function readDoc(path: "users" | "teams", id: string) {
    try {
        const snapshot = await getDoc(doc(db, path, id));
        return snapshot.exists() ? snapshot.data() : null;
    } catch {
        // Missing permission (e.g. another user's doc) is treated like a missing doc.
        return null;
    }
}

/** Emails for a set of uids. Unreadable users map to null. */
async function emailsFor(uids: string[]): Promise<Map<string, string | null>> {
    const unique = [...new Set(uids)];
    const users = await Promise.all(unique.map((uid) => readDoc("users", uid)));
    return new Map(unique.map((uid, i) => [uid, str(users[i]?.email)]));
}

/**
 * Loads everything the Team Planning page shows for this user:
 * their team (users/{uid}.team_id -> teams/{team_id}) and the teams
 * that have invited them (users/{uid}.invitations -> teams/{id}).
 */
export async function fetchTeamPlanning(uid: string): Promise<TeamPlanningData | null> {
    const me = await readDoc("users", uid);
    if (!me) return null;

    const teamId = idOf(me.team_id);
    const invitationIds = [...new Set(
        (Array.isArray(me.invitations) ? me.invitations : []).map(idOf).filter((s): s is string => !!s),
    )].filter((id) => id !== teamId);

    const [team, invitingTeams] = await Promise.all([
        teamId ? readDoc("teams", teamId) : Promise.resolve(null),
        Promise.all(invitationIds.map((id) => readDoc("teams", id))),
    ]);

    // No team doc yet (e.g. a code was just assigned): the user is a party of one and owns it.
    const owner = str(team?.owner) ?? (team ? null : uid);
    const pending = strList(team?.pending).filter((id) => id !== owner);
    const members = strList(team?.members).filter((id) => id !== owner && !pending.includes(id));

    const inviteOwners = invitingTeams.map((t) => str(t?.owner));
    const emails = await emailsFor([
        ...(owner ? [owner] : []),
        ...pending,
        ...members,
        ...inviteOwners.filter((o): o is string => !!o),
    ]);
    // Always know our own email, even if it's only on the auth account.
    if (str(me.email)) emails.set(uid, str(me.email));

    const person = (id: string, flags: Pick<TeamPerson, "owner" | "pending">): TeamPerson => ({
        id,
        email: emails.get(id) ?? null,
        ...flags,
    });

    return {
        teamId,
        autofill: team?.autofill === true,
        people: [
            ...(owner ? [person(owner, { owner: true, pending: false })] : []),
            ...pending.map((id) => person(id, { owner: false, pending: true })),
            ...members.map((id) => person(id, { owner: false, pending: false })),
        ],
        invites: invitationIds.map((id, i) => ({
            teamId: id,
            ownerEmail: inviteOwners[i] ? emails.get(inviteOwners[i]!) ?? null : null,
        })),
    };
}
