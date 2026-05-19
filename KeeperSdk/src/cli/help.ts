import type { CliCommandDefinition, CliHelpDoc } from './types'
import { KEEPER_VAULT_SURFACE } from './vaultSurface'

const SECTION_ORDER: (keyof CliHelpDoc)[] = [
    'synopsis',
    'description',
    'arguments',
    'options',
    'environment',
    'keeperSdk',
    'seeAlso',
    'note',
]

const SECTION_LABELS: Partial<Record<keyof CliHelpDoc, string>> = {
    synopsis: 'SYNOPSIS',
    description: 'DESCRIPTION',
    arguments: 'ARGUMENTS',
    options: 'OPTIONS',
    environment: 'ENVIRONMENT',
    keeperSdk: 'KEEPER SDK',
    seeAlso: 'SEE ALSO',
    note: 'NOTE',
}

export function formatDetailedHelp(doc: CliHelpDoc): string {
    const parts: string[] = [doc.title.trim()]
    for (const key of SECTION_ORDER) {
        const body = doc[key]
        if (typeof body !== 'string' || !body.trim()) continue
        const label = SECTION_LABELS[key]
        if (label) {
            parts.push('')
            parts.push(label)
        }
        parts.push(body.trim())
    }
    if (doc.appendVaultSurface) {
        parts.push('')
        parts.push(KEEPER_VAULT_SURFACE)
    }
    return `${parts.join('\n')}\n`
}

export function formatDetailedHelpForCommand(def: CliCommandDefinition): string {
    return formatDetailedHelp(def.help)
}

export function getDetailedHelpPageForRegistry(
    commands: Iterable<CliCommandDefinition>,
    name: string
): string | null {
    const key = name.toLowerCase()
    for (const def of commands) {
        if (def.name === key) return formatDetailedHelpForCommand(def)
        if (def.aliases?.some((a) => a.toLowerCase() === key)) {
            return formatDetailedHelpForCommand(def)
        }
    }
    return null
}

export function formatAllCommandsSummary(commands: readonly CliCommandDefinition[]): string {
    const sorted = [...commands].sort((a, b) => a.name.localeCompare(b.name))
    const w = Math.max(...sorted.map((c) => c.name.length), 8)
    let out = 'Supported commands:\n\n'
    for (const c of sorted) {
        out += `  ${c.name.padEnd(w)}  ${c.description}\n`
    }
    out +=
        '\nOptions use GNU-style syntax: `--name`, `--name=value`, short flags (`-p` or `-rf` when each letter is a switch), and `--` ends options.\n'
    out += 'Quoted arguments and `\\` escapes are supported.\n\n'
    out +=
        'Run `help <command>` for a short summary, or `command --help` / `command -h` for full documentation.\n'
    return out
}

export function formatShortCommandSummary(def: CliCommandDefinition): string {
    return `${def.name} — ${def.description}\n  Usage: ${def.usage}\n`
}
