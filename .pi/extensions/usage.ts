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
  // Adding both so that the names match
  // Case for both gemini models
  'gemini-2.5-pro': 1,
  'gemini-2.5-pro-preview': 1,
  'gemini-3-flash': 0.33,
  'gemini-3-flash-preview': 0.33,
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
const EXTRA_SEARCH_DAYS = 10;

const now = new Date();
const beginning_month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));


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
  return new Date(new_time)

}


/**
* Walks through session directory with optionally a start_date.
* If its not provided, it will just return sessions from current month
* @param {string} dir - The directory to walk through
* @param {string} [filter_buffer_date] - Date used to filter whcih files to analyze
*/
async function walkDir(dir: string, filter_buffer_date: Date): Promise<string[]> {
  const candidates: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  for (const ent of entries) {
    if (ent.isFile() && ent.name.endsWith(".jsonl")) {
      const p = path.join(ent.parentPath, ent.name);
      const basename = path.basename(p);
      const file_date = getDateFromSessionFilePath(basename);
      if (file_date >= filter_buffer_date) {
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
async function showModelCount(ctx: ExtensionCommandContext, start_date: Date): Promise<void> {
  // Include 10 days before as well, in the case a session may have gone past the end of the month
  // Anything longer > 10 days, wont be counted due to this filtering.
  // In the future, we can just parse via the msg itself but it might takes much longer unnecessarily
  // when in my personal case I never use a session for that long.
  const filter_buffer_date = start_date.getTime() - (EXTRA_SEARCH_DAYS * 24 * 60 * 60 * 1000);
  const session_files: Array<string> = await walkDir(SESSION_ROOT, new Date(filter_buffer_date));
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
                const msg_date = new Date(msg.timestamp);
                // we might have here content[type] == toolCall which should not count
                if ((msg.model in modelRequests) && (msg_date >= start_date)) {
                  console.log("Message timestamp: " + msg_date);
                  console.log("Entry session file: " + file);
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
    total += modelMultipliers[name] * modelCount;
  }

  var modelBreakdown = "";
  Object.entries(modelRequests).filter(([_, count]) => count > 0).forEach(([name, count]) => {
    modelBreakdown += `${name} => ${count}\n`
  });
  const endMessage = `Total requests messages this month : ${total}\n${modelBreakdown}`;
  if (ctx.hasUI) {
    ctx.ui.setWidget("custom-widget", (_, theme) => new Text(theme.fg("accent", endMessage), 0, 0));
  }
}

export default function(pi: ExtensionAPI) {
  pi.registerCommand("usage", {
    description: "Find usage for this month",
    handler: async (args: string, ctx) => {
      // All dates are in UTC timezone.
      const start_date = args !== "" ? new Date(args) : beginning_month;
      if (isNaN(start_date.getTime())) throw new Error(`Date: ${args} cant be parsed properly`);

      await showModelCount(ctx, start_date);

    },
  });
}
