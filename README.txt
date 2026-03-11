Outreach Console
================

Terminal-based email outreach tool. Runs entirely on your machine — no
cloud, no SaaS, no tracking. Emails your contacts from your own Gmail
or Outlook account with per-person personalization.

Built with Node.js + Ink (React for terminals) + SQLite.


SETUP
-----

1. Install dependencies

    npm install

2. Copy the env template and fill in your OAuth credentials

    cp .env.example .env

   Gmail:  get credentials at console.cloud.google.com
           (OAuth 2.0 Client ID, Desktop app type)

   Outlook / Microsoft 365:  get credentials at portal.azure.com
           (App registration, Delegated permissions: Mail.ReadWrite,
            Mail.Send, offline_access, User.Read)

   Redirect URI for both: http://localhost:3847/oauth/callback

3. Run

    npm start


USAGE
-----

Navigation
  1-5       jump to Dashboard / Accounts / Suppression / Log / Settings
  arrows    move through lists and tabs
  Enter     select / confirm
  Esc / q   go back

Workflow
  n         new campaign
  i         import contacts (CSV or XLSX)
  s         campaign settings
  ?         help screen

Inside a campaign there are 5 tabs (1-5):
  1 Overview   stats and last run
  2 Compose    subject/body templates with live preview
  3 Contacts   imported contact list
  4 Send       readiness check + start/pause/stop
  5 Log        per-recipient email log — view exact subject and body sent

Sending modes
  Draft     creates drafts in your inbox for manual review (default)
  Dry Run   simulates the whole run, sends nothing
  Live Send sends immediately — requires compliance confirmation


CONTACT SPREADSHEETS
--------------------

Supported formats: .csv, .xlsx

Required column:   email
Optional columns:  first_name, last_name, company
                   any other column becomes a template variable

If your spreadsheet has Subject and Email Body columns, those are used
per-recipient and override any campaign-level template.

Template syntax:  {{first_name}}, {{company}}, {{any_column}}


DATA
----

Everything is stored locally in data/outreach.db (SQLite).
OAuth tokens, campaign data, send logs — all on your machine.
Nothing leaves except the emails you send.
