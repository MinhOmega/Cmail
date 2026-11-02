# Cmail

<img src="public/icon-96.png" alt="Cmail" width="72">

**Cmail** is a self-hosted email inbox for custom domains, built on Cloudflare. Mailboxes, calendar, booking, Drive and AI agents in a single Worker. Send and receive with Cloudflare Email, **Resend**, or **AWS SES** — DNS stays on Cloudflare either way.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MinhOmega/Cmail)

## What this fork adds

This is the [MinhOmega/Cmail](https://github.com/MinhOmega/Cmail) fork of Mailflare. Beyond upstream, it ships:

- **No license gates.** Upstream's Paymug licensing is gone. Capabilities are plain deployment vars: `ENABLE_BRANDING`, `ENABLE_MULTIUSER`, `ENABLE_SHARED_MAILBOXES`, `ENABLE_FORWARDING`.
- **Verification code extraction.** Inbound mail is scanned for one-time codes (regex first, Workers AI fallback) and the reader shows a copyable code chip — handy for login OTPs.
- **Unified all-mailboxes view.** One list across every mailbox, with live unread counts.
- **Web Push, phone-first.** The whole Web Push chain (service worker, VAPID subscribe, notification deep-links, app badge) plus a one-tap enable prompt for installed PWAs. Set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` and users get native alerts for new mail.
- **Admin sending quota card.** Sent / failed / waiting counters from the outbound queue, plus live Cloudflare Email Routing status per sending domain, fetched from the Cloudflare API.
- **Failed-send visibility.** Failed deliveries stay in Sent with a red chip and the provider's error; a five-minute cron fails stuck jobs and re-enqueues lost queue messages.
- **Fork-first self-update.** The admin update card reads versions from `GITHUB_UPDATE_REPO` (this fork), not upstream — no accidental tree replacement. Set it up once with `scripts/set-update-secrets.sh`.
- **Accent color branding** and multi-worker routes for several instances.

## Deploy

1. **Deploy the app.** Click **Deploy to Cloudflare** above. Keep the app name `cmail`, or it will break.
2. **Finish setup.** Open the app at `/setup` and create your admin account.
3. **Connect a domain.** Add a domain from the same Cloudflare account, then create your first mailbox.

> **`CF_TOKEN` is required.** Create a scoped [Cloudflare API token](https://github.com/MinhOmega/Cmail/issues/24#issuecomment-5523686105) with these permissions:
>
> - All accounts: Email Sending:Edit, DNS Settings:Edit, Email Routing Addresses:Edit
> - All zones: DNS Settings:Edit, Email Routing Rules:Edit, Zone Settings:Edit, DNS:Edit

More options: [deployment guide](docs/deployment.md), including Web Push secrets, the admin self-update secrets and AI-agent setup.

## Features

- **Email**: custom domain mailboxes, personal or shared, with access you control. Routing rules store, forward, reject or sort incoming mail.
- **Calendar**: repeating events with time zones and reminders; attendees get email invitations.
- **Booking**: share a public link so anyone can book a free time on your calendar.
- **Drive**: store and share files.
- **AI agents**: search mail, draft replies and manage events. Connect other AI tools over MCP.
- **Import**: bring in mail from IMAP, Gmail Takeout, `.eml` and `.mbox` files.
- **34 languages**, including Tiếng Việt.

## Under the hood

- **Databases**: Cloudflare D1 (default), PostgreSQL, MySQL, Turso / libSQL, or a local SQLite file. Set `DATABASE_URL` to switch. See [Databases](docs/databases.md).
- **File storage**: Cloudflare R2, Backblaze B2 or AWS S3.
- **Hosting**: Cloudflare Workers or a single Docker container.
- **Search**: FTS5 index (SQLite) with LIKE fallbacks elsewhere; Gmail-style query operators.
- **JMAP** and a scoped REST API for external clients.

## Cost

You can receive and send mail for free.

- **Receiving**: Cloudflare Email Routing is free.
- **Sending**: use the free tier of Resend (3,000 emails a month) or Amazon SES. Cloudflare's own sending needs the $5/month Paid Worker plan.

## Local development

```bash
cp .dev.vars.example .dev.vars
npm install
npm run db:migrate:local
npm run dev
```

Add your Cloudflare credentials to `.dev.vars`, then open [localhost:3000](http://localhost:3000). `npm run db:seed` loads sample data.

- `npm run build` — build the Worker
- `npm run deploy` — build and deploy
- `node --test tests/*.test.mjs` — test suite (no Workers bindings needed)
- `npx tsc --noEmit` — real type checking (the build skips type errors)

A schema change needs a migration for each database dialect — see [AGENTS.md](AGENTS.md).

## Self-host with Docker

Runs as one container on any server, with SQLite and local files.

```bash
cp .env.docker.example .env.docker
docker compose up -d --build
```

See [self-hosting](docs/self-hosting.md).

## Documentation

- [Deployment and configuration](docs/deployment.md)
- [Databases](docs/databases.md)
- [Sending and receiving providers](docs/providers.md)
- [API and integrations](docs/api.md)
- [Email assistant and MCP](docs/email-assistant-and-mcp.md)
- [Spam protection](docs/spam-protection.md)
- [Adding a language](docs/localization.md)
- [Troubleshooting](docs/troubleshooting.md)

## Credits & license

Based on [Mailflare](https://github.com/hieunc229/mailflare) by [@hieunc229](https://github.com/hieunc229) — thank you for the excellent foundation. This fork carries the project forward with its own customizations and is released under the same [AGPL-3.0 license](LICENSE).
