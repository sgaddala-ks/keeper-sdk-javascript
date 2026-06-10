import {
    getShareObjectsMessage,
    getTeamMembersMessage,
    normal64Bytes,
    webSafe64FromBytes,
    type Auth,
    type Records,
} from '@keeper-security/keeperapi'

export type ShareTeamEntry = {
    team_uid: string
    name: string
    enterprise_id?: number
}

export type ShareObjectsSnapshot = {
    enterprises: Map<number, string>
    teams: Map<string, ShareTeamEntry>
}

function teamUidFromShareTeam(team: Records.IShareTeam): string | null {
    if (!team.teamUid) return null
    if (team.teamUid instanceof Uint8Array) return webSafe64FromBytes(team.teamUid)
    if (typeof team.teamUid === 'string') return team.teamUid
    return null
}

function addShareTeams(target: Map<string, ShareTeamEntry>, list: Records.IShareTeam[] | null | undefined): void {
    for (const team of list || []) {
        const team_uid = teamUidFromShareTeam(team)
        if (!team_uid) continue
        target.set(team_uid, {
            team_uid,
            name: (team.teamname || team_uid).trim() || team_uid,
            enterprise_id: team.enterpriseId ?? undefined,
        })
    }
}

/** Teams and enterprise names from vault/get_share_objects (Keeper Commander contacts cache). */
export async function fetchShareObjects(auth: Auth): Promise<ShareObjectsSnapshot> {
    const response = await auth.executeRest(getShareObjectsMessage({}))
    const enterprises = new Map<number, string>()
    for (const entry of response.shareEnterpriseNames || []) {
        if (entry.enterpriseId == null) continue
        enterprises.set(entry.enterpriseId, (entry.enterprisename || '').trim())
    }

    const teams = new Map<string, ShareTeamEntry>()
    addShareTeams(teams, response.shareTeams)
    addShareTeams(teams, response.shareMCTeams)
    return { enterprises, teams }
}

export async function resolvePrimaryEnterpriseId(auth: Auth): Promise<number | undefined> {
    let enterpriseId = auth.accountSummary?.license?.enterpriseId ?? undefined
    if (enterpriseId != null) return enterpriseId
    try {
        await auth.loadAccountSummary()
    } catch {
        return undefined
    }
    return auth.accountSummary?.license?.enterpriseId ?? undefined
}

export async function fetchTeamMemberEmails(auth: Auth, teamUid: string): Promise<string[]> {
    const response = await auth.executeRest(
        getTeamMembersMessage({
            teamUid: normal64Bytes(teamUid),
        })
    )
    const emails: string[] = []
    for (const user of response.enterpriseUser || []) {
        const email = (user.email || user.enterpriseUsername || '').trim()
        if (email) emails.push(email)
    }
    emails.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    return emails
}
