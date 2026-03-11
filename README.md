# Outreach Console

A beautiful, local-first terminal UI for permission-based email outreach.  
**Draft-first by default. No spam. No scraping. Just clean, ethical outreach.**

```
  ██████╗ ██╗   ██╗████████╗██████╗ ███████╗ █████╗  ██████╗██╗  ██╗
  ██╔══██╗██║   ██║╚══██╔══╝██╔══██╗██╔════╝██╔══██╗██╔════╝██║  ██║
  ╚═════╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
```

---

## Quick Start (5 minutes)

### 1. Clone & install

```bash
git clone <this-repo>
cd outreach-console
npm install
```

### 2. Configure credentials

```bash
cp .env.example .env
# Then edit .env with your OAuth credentials (see below)
```

### 3. Run

```bash
npm start
# or
npm run tui
```

That's it. An animated terminal UI opens immediately.

---

## Setting Up OAuth (Required for sending)

You need credentials from ONE provider. Both are free.

### Gmail / Google Workspace

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create or select a project
3. **APIs & Services → Library** → enable the **Gmail API**
4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Desktop app**
6. Under **Authorized redirect URIs** add: `http://localhost:3847/oauth/callback`
7. Copy the **Client ID** and **Client Secret** into `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```

### Microsoft 365 / Outlook

1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active Directory → App registrations**
2. **New registration** — name it anything, select **"Accounts in any organizational directory and personal Microsoft accounts"**
3. **Redirect URI**: platform = **Web**, URI = `http://localhost:3847/oauth/callback`
4. **Certificates & secrets → New client secret** — copy the Value
5. **API permissions → Add permission → Microsoft Graph → Delegated**:
   - `Mail.ReadWrite`, `Mail.Send`, `offline_access`, `User.Read`
6. Click **Grant admin consent** (if available)
7. Copy into `.env`:
   ```
   MICROSOFT_CLIENT_ID=your-app-id
   MICROSOFT_CLIENT_SECRET=your-secret-value
   ```

---

## Terminal UI Guide

### Launching

```bash
npm start
```

An animated splash screen appears, then the Dashboard loads automatically.

### Navigation (universal)

| Key | Action |
|-----|--------|
| `↑ ↓` | Move up / down in lists |
| `Enter` | Select / confirm / open |
| `Esc` or `q` | Go back / cancel |
| `1` `2` `3` `4` `5` | Quick jump to Dashboard / Accounts / Suppression / Log / Settings |
| `?` or `h` | Open help screen |
| `Ctrl+C` | Quit |

### Dashboard (press `1`)

Shows:
- Campaign count, recipients, sent/drafted, failed
- Running campaign banner with live progress
- Connected accounts
- Quick stats at a glance

### Creating a Campaign

1. Press `n` from anywhere or select **New Campaign**
2. Type a campaign name, press `Enter`
3. Choose a sending mode:
   - **Draft Mode** — creates drafts for review (recommended)
   - **Dry Run** — simulates without sending
   - **Live Send** — sends real emails (requires compliance confirmation)
4. Campaign opens automatically

### Inside a Campaign (tabs 1–4)

#### Tab 1 — Overview
Stats summary and last run results.

#### Tab 2 — Compose
View your subject and body templates with a live preview against the first contact.

**Template variables:**
```
{{first_name}}   — recipient's first name
{{last_name}}    — last name
{{company}}      — company/organization
{{email}}        — email address
{{any_column}}   — any column from your spreadsheet
```

**To edit templates**, press `S` to open Settings, navigate to Subject/Body and press `Enter`.

#### Tab 3 — Contacts
Browse imported contacts with status per row.  
Press `←` / `→` to page through large lists.

#### Tab 4 — Send
- Readiness checklist (account, templates, contacts, compliance)
- Sending mode display
- Start / Pause / Resume / Stop controls

### Importing Contacts

From a campaign, press `i` to open the import screen.

1. Type the full path to your CSV or XLSX file
   - Example: `~/Desktop/contacts.csv`
2. Press `Enter` — the file is parsed and validated
3. Review the summary (valid rows, duplicates removed, invalid emails removed)
4. Press `y` to confirm import

**Supported columns:** `email` (required), `first_name`, `last_name`, `company`, plus any custom columns.  
Custom columns become template variables automatically (e.g. a column `role` becomes `{{role}}`).

**Sample file:** `examples/sample-contacts.csv`

### Running a Campaign

1. Open campaign → **Send tab** (key `4`)
2. Verify the checklist — all 5 items must be ✓
3. Confirm compliance (key `s` → navigate to Compliance → `Enter` to toggle)
4. Press `Space` or `Enter` — a confirmation dialog appears
5. Confirm to start

**Controls while running:**
| Key | Action |
|-----|--------|
| `p` | Pause |
| `r` | Resume |
| `s` | Stop immediately |

The send queue uses:
- Configurable delay between emails (default 2 seconds + up to 30% random jitter)
- Exponential backoff on rate-limit errors (429/503)
- Auto-pause if failure rate exceeds 30%
- Suppression list checked per recipient before sending

### Accounts (press `2`)

- View connected accounts
- Press `a` to add a new account (opens browser for OAuth)
- Press `Enter` on an account to disconnect it
- Supports Gmail and Microsoft 365 simultaneously

### Suppression List (press `3`)

Emails here are **permanently skipped** across all campaigns.

| Key | Action |
|-----|--------|
| `a` | Add email to suppression list |
| `d` | Remove selected email |

### Audit Log (press `4`)

Every action is logged with timestamp, action type, and entity. Auto-refreshes every 5 seconds.

### Settings (press `5`, or `S` inside a campaign)

Edit campaign fields inline:
- Campaign name, subject template, body template, footer
- Throttle delay, max retries, sending mode
- Compliance confirmation toggle

---

## Sending Modes Explained

| Mode | What happens | Safe? |
|------|-------------|-------|
| **Draft** | Creates drafts in your email inbox. You review and send manually. | ✅ Default, safest |
| **Dry Run** | Simulates the entire run, logs everything, sends nothing. | ✅ Great for testing |
| **Live Send** | Emails are sent immediately and cannot be recalled. | ⚠ Requires compliance confirmation |

**The compliance confirmation is mandatory for all modes** and requires you to affirm that recipients are permission-based, relationship-based, or school-approved.

---

## Data & Privacy

- Everything is stored **locally** in `data/outreach.db` (SQLite)
- OAuth tokens are stored encrypted in the local database
- No data is sent to any third party
- No tracking pixels are added to emails

---

## File Structure

```
outreach-console/
├── src/
│   ├── tui/            # Terminal UI (Ink/React)
│   │   ├── index.tsx   # Entry point
│   │   ├── App.tsx     # Screen router
│   │   ├── screens/    # All UI screens
│   │   ├── components/ # Reusable UI components
│   │   ├── hooks/      # React hooks
│   │   └── theme.ts    # Colors, gradients, drawing
│   └── lib/
│       ├── db/         # Drizzle ORM + SQLite schema
│       ├── providers/  # Gmail + Microsoft adapters
│       ├── queue/      # Send queue engine
│       ├── templates/  # Personalization engine
│       └── parser/     # CSV/XLSX parser
├── examples/           # Sample contacts files
├── tests/              # Unit tests
├── data/               # SQLite database (auto-created)
├── .env.example        # Credential template
└── README.md
```

---

## Running Tests

```bash
node --test --import tsx/esm tests/templates.test.ts tests/parser.test.ts
```

All 12 tests should pass.

---

## Requirements

- Node.js 18+
- macOS, Linux, or Windows (WSL recommended on Windows)
- A Gmail or Microsoft 365 account
- OAuth credentials (free, see setup above)
