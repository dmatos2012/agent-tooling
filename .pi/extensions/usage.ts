import type { ExtensionAPI, ExtensionCommandContext, SessionEntry } from "@mariozechner/pi-coding-agent";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { Text } from "@mariozechner/pi-tui";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { readFileSync } from "fs";


const modelMultipliers: Record<string, number> = {
    'claude-haiku-4.5': 0.33,
    'claude-opus-4.5': 3,
    'claude-opus-4.6': 3,
    'claude-opus-4.6-fast-mode-preview': 30,
    'claude-sonnet-4': 1,
    'claude-sonnet-4.5': 1,
    'claude-sonnet-4.6': 1,
    'gemini-2.5-pro': 1,
    'gemini-3-flash': 0.33,
    'gemini-3-pro': 1,
    'gemini-3.1-pro': 1,
    'gpt-4.1': 0,
    'gpt-4o': 0,
    'gpt-5-mini': 0,
    'gpt-5.1': 1,
    'gpt-5.1-codex': 1,
    'gpt-5.1-codex-mini': 0.33,
    'gpt-5.1-codex-max': 1,
    'gpt-5.2': 1,
    'gpt-5.2-codex': 1,
    'gpt-5.3-codex': 1,
    'gpt-5.4': 1,
    'gpt-5.4-mini': 0.33,
    'grok-code-fast-1': 0.25,
    'raptor-mini': 0,
};

const SESSION_ROOT = path.join(os.homedir(), ".pi", "agent", "sessions");
const now = new Date();


/**
* Reads the file path and parses it into a `Date` obj
* @param {string} p - Session file path
*/
function getDateFromSessionFilePath(p: string): Date {
    const datetime = p.split("_")[0];
    // Apparently is not valid ISO format, so we just use the date
    const [datePartStr, timePart] = datetime.split("T");
    // replace - in time part with :, but not the ms part (what a mess)
    const timePartStr = timePart.replace(/-(\d+)Z$/, '.$1Z').replace(/-/g, ':')
    const new_time = datePartStr + "T" + timePartStr;
    // FIXME: Dates in PI are UTC, account for it
    return new Date(new_time)

}


/**
* Walks through session directory with optionally a start_date.
* If its not provided, it will just return sessions from current month
* @param {string} dir - The directory to walk through
* @param {string} [start_date] - Optional start date in ISO format (e.g., "2024-06-01T00:00:00Z")
*/
async function walkDir(dir: string, start_date: string | null = null): Promise<string[]> {
    const candidates: string[] = [];
    const beginning_month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
    for (const ent of entries) {
        if (ent.isFile() && ent.name.endsWith(".jsonl")) {
            const p = path.join(ent.parentPath, ent.name);
            const basename = path.basename(p);
            const file_date = getDateFromSessionFilePath(basename);
            const filter_date = start_date ? new Date(start_date) : beginning_month;
            if (file_date >= filter_date) {
                candidates.push(p);
            }
        }
    }
    return candidates;
}

/**
 * shows model usage based on the amount of requests sent to provider
 * The calculations are based on Github Copilot subscription
 * @param {ExtensionCommandContext} ctx - Extension Context
*/
async function showModelCount(ctx: ExtensionCommandContext): Promise<void> {
    // FIXME: Dates in PI are UTC, account for it
    const session_files: Array<string> = await walkDir(SESSION_ROOT);
    // const session_files: Array<string> = await walkDir(SESSION_ROOT, "2026-04-03");
    var modelRequests: Record<string, number> = {};
    for (const name in modelMultipliers) {
        // Initialize them all with count of 0
        modelRequests[name] = 0;
    }
    for (const file of session_files) {
        const lines = readFileSync(file, "utf8").trim().split("\n");
        for (const line of lines) {
            try {
                const entry: SessionEntry = JSON.parse(line);
                if (entry.type === "message") {
                    const msg: AgentMessage = entry.message;
                    switch (msg.role) {
                        case "assistant":
                            // Only count those which answer is `text` once, not `toolResult` or `call`, `code`.
                            if (msg.content.some(c => c.type === "text")) {
                                // we might have here content[type] == toolCall which should not count
                                if (msg.model in modelRequests) {
                                    modelRequests[msg.model] += 1;
                                } else {
                                    continue;
                                    // why is there a mismatch between my copilot subscription and the names?
                                    // only for gemini pro-preview
                                }
                            }

                    }
                }
            } catch (e) {
                console.error("Failed to parse line: ", line, " in file: ", file, " error: ", e);
            }
        }
    }

    var total = 0;
    for (const [name, modelCount] of Object.entries(modelRequests)) {
        // console.log(`Model: ${name}, Count: ${modelCount}, Multiplier: ${modelMultipliers[name]}, Total for model: ${modelMultipliers[name] * modelCount}`);
        total += modelMultipliers[name] * modelCount;
    }

    var modelBreakdown = "";
    Object.entries(modelRequests).filter(([_, count]) => count > 0).forEach(([name, count]) => {
        modelBreakdown += `${name} => ${count}\n`
    });
    const endMessage = `Total requests messages this month : ${total}\n${modelBreakdown}`;
    if (ctx.hasUI) {
        ctx.ui.setWidget("custom-widget", (tui, theme) => new Text(theme.fg("accent", endMessage), 0, 0));
    }
}

export default function(pi: ExtensionAPI) {
    pi.registerCommand("usage", {
        description: "Find usage for this month",
        handler: async (_args, ctx) => {
            await showModelCount(ctx);

        },
    });
}
