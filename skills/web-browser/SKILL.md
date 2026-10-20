---
name: web-browser
description: "Allows to interact with web pages by performing actions such as clicking buttons, filling out forms, and navigating links. It works by remote controlling Chromium-based browsers (Helium/Chrome/Chromium) using the Chrome DevTools Protocol (CDP). When Claude needs to browse the web, it can use this skill to do so."
license: Stolen from Mario
---

# Web Browser Skill

Minimal CDP tools for collaborative site exploration.

## Start Browser (Helium on NixOS)

```bash
./scripts/start.js              # Fresh profile
./scripts/start.js --profile    # Copy your profile (cookies, logins)
```

Start the browser on `:9222` with remote debugging.

Environment variables:
- `BROWSER`: command to launch (defaults to `helium`).
- `HELIUM_PROFILE_DIR`: profile source when using `--profile` (defaults to `~/.config/net.imput.helium`).

## Navigate

```bash
./scripts/nav.js https://example.com
./scripts/nav.js https://example.com --new
```

Navigate current tab or open new tab.

## Evaluate JavaScript

```bash
./scripts/eval.js 'document.title'
./scripts/eval.js 'document.querySelectorAll("a").length'
./scripts/eval.js 'JSON.stringify(Array.from(document.querySelectorAll("a")).map(a => ({ text: a.textContent.trim(), href: a.href })).filter(link => !link.href.startsWith("https://")))'
```

Execute JavaScript in active tab (async context).  Be careful with string escaping, best to use single quotes.

## Screenshot

```bash
./scripts/screenshot.js
```

Screenshot current viewport, returns temp file path

## Pick Elements

```bash
./scripts/pick.js "Click the submit button"
```

Interactive element picker. Click to select, Cmd/Ctrl+Click for multi-select, Enter to finish.

## Dismiss Cookie Dialogs

```bash
./scripts/dismiss-cookies.js          # Accept cookies
./scripts/dismiss-cookies.js --reject # Reject cookies (where possible)
```

Automatically dismisses EU cookie consent dialogs.

Run after navigating to a page:
```bash
./scripts/nav.js https://example.com && ./scripts/dismiss-cookies.js
```

## Background Logging (Console + Errors + Network)

Automatically started by `start.js` and writes JSONL logs to:

```
~/.cache/agent-web/logs/YYYY-MM-DD/<targetId>.jsonl
```

Manually start:
```bash
./scripts/watch.js
```

Tail latest log:
```bash
./scripts/logs-tail.js           # dump current log and exit
./scripts/logs-tail.js --follow  # keep following
```

Summarize network responses:
```bash
./scripts/net-summary.js
```

## Troubleshooting

### Helium won't start with remote debugging
Helium merges into an existing session if one is already running — it ignores `--remote-debugging-port` and prints "Opening in existing browser session". The user must close Helium first, or use a different browser via `BROWSER=brave`.

### Brave as alternative
Brave is available on this system. Use a unique `--user-data-dir` to avoid session conflicts:
```bash
brave --remote-debugging-port=9222 --user-data-dir=/tmp/brave-debug-profile --no-first-run --disable-features=ProfilePicker http://localhost:8000/ &
```
Then wait a few seconds and use `nav.js`, `screenshot.js`, `eval.js` as normal.

### Authentication
When the app requires login, always ask the user to log in via the browser UI — do not try to automate login with curl or scripting.
