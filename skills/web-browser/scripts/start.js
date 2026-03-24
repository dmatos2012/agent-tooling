#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const useProfile = process.argv[2] === "--profile";
const browserCommand = process.env["BROWSER"] ?? "helium";
const profileSource = process.env["HELIUM_PROFILE_DIR"] ??
  `${process.env["HOME"]}/.config/net.imput.helium`;

if (process.argv[2] && process.argv[2] !== "--profile") {
  console.log("Usage: start.ts [--profile]");
  console.log("\nOptions:");
  console.log(
    "  --profile  Copy your default browser profile (cookies, logins)",
  );
  console.log("\nExamples:");
  console.log("  start.ts            # Start with fresh profile");
  console.log("  start.ts --profile  # Start with your browser profile");
  process.exit(1);
}

async function isDebugEndpointUp() {
  try {
    const response = await fetch("http://localhost:9222/json/version");
    return response.ok;
  } catch {
    return false;
  }
}

// If something is already listening on :9222, reuse it instead of killing the browser.
if (await isDebugEndpointUp()) {
  console.log("✓ Browser already running on :9222 (reusing existing instance)");
  process.exit(0);
}

// Setup profile directory
execSync("mkdir -p ~/.cache/scraping", { stdio: "ignore" });

if (useProfile) {
  // Sync profile with rsync (much faster on subsequent runs)
  execSync(
    `rsync -a --delete "${profileSource}/" ~/.cache/scraping/`,
    { stdio: "pipe" },
  );
}

// Start a separate browser instance in background (detached so Node can exit).
spawn(
  browserCommand,
  [
    "--remote-debugging-port=9222",
    `--user-data-dir=${process.env["HOME"]}/.cache/scraping`,
    "--profile-directory=Default",
    "--disable-search-engine-choice-screen",
    "--no-first-run",
    "--disable-features=ProfilePicker",
    "--no-default-browser-check",
  ],
  { detached: true, stdio: "ignore" },
).unref();

// Wait for Chrome to be ready by checking the debugging endpoint
let connected = false;
for (let i = 0; i < 30; i++) {
  try {
    const response = await fetch("http://localhost:9222/json/version");
    if (response.ok) {
      connected = true;
      break;
    }
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}

if (!connected) {
  console.error("✗ Failed to connect to the browser");
  process.exit(1);
}

// Start background watcher for logs/network (detached)
const scriptDir = dirname(fileURLToPath(import.meta.url));
const watcherPath = join(scriptDir, "watch.js");
spawn(process.execPath, [watcherPath], { detached: true, stdio: "ignore" }).unref();

console.log(
  `✓ Browser started on :9222${useProfile ? " with your profile" : ""}`,
);
