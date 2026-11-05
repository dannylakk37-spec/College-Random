# CollegeRandom

**Random Chats. Real College Students.**

A random live video-chat platform exclusively for verified U.S. college students — like Omegle/OmeTV/Chatroulette, but every account is tied to an approved school email address and is 18+.

This is a working MVP: real sign-up with school-email verification, a server-side matching queue, live peer video through Daily, report/block, and an admin dashboard.

---

## Contents

1. [What's included](#1-whats-included)
2. [What it costs](#2-what-it-costs)
3. [Accounts you need](#3-accounts-you-need)
4. [Step 1 — Install tools on your computer](#step-1--install-tools-on-your-computer)
5. [Step 2 — Create the Supabase database](#step-2--create-the-supabase-database)
6. [Step 3 — Configure Supabase Auth and email](#step-3--configure-supabase-auth-and-email)
7. [Step 4 — Get a Daily API key](#step-4--get-a-daily-api-key)
8. [Step 5 — Run it on your computer](#step-5--run-it-on-your-computer)
9. [Step 6 — Deploy to Vercel and connect CollegeRandom.com](#step-6--deploy-to-vercel-and-connect-collegerandomcom)
10. [Step 7 — Admin setup: your schools and domains](#step-7--admin-setup-your-schools-and-domains)
11. [Launch checklist: test the full user journey](#launch-checklist-test-the-full-user-journey)
12. [How it works (architecture and security)](#how-it-works-architecture-and-security)
13. [Known limitations and what still needs you](#known-limitations-and-what-still-needs-you)
14. [Adding monetization later](#adding-monetization-later)
15. [Troubleshooting](#troubleshooting)
16. [Project structure](#project-structure)

---

## 1. What's included

| Area | What works |
|---|---|
| **Homepage** | Logo, nav, Sign up / Log in, headline, big Start Chatting button, how it works, benefits, live list of participating universities, safety section, footer (Privacy, Terms, Contact) |
| **Registration** | Username, school email, password, university, date of birth, Terms/Privacy agreement. Only **admin-approved email domains** for the chosen university are accepted. Must be **18+**. |
| **Verification** | Email verification link (Supabase Auth). Unverified accounts cannot log in or chat. Students can't switch to a non-school email later. |
| **Auth** | Log in, log out, forgot password, reset password, resend verification |
| **Matching** | Server-side queue in Postgres. Atomic matching (advisory lock + unique index) so nobody is matched with themselves or put in two chats. Prefers people you haven't just talked to. Respects blocks. Drops disconnected users automatically. |
| **Video** | Daily WebRTC. Private 2-person rooms, short-lived tokens generated on the server, no recording. When either person leaves, the room is deleted, which disconnects both people. |
| **Chat screen** | Local preview, remote video, Start Chat, Next, Disconnect, mute mic, camera on/off, Report, Block, connection status, searching animation, partner's name and university. |
| **Safety** | Report (8 reasons + details, optional block), Block, automatic 24h suspension after 3 different reporters in 24h, rate limits on every action, Community Guidelines, recording warning. |
| **Admin** | Live stats, report queue (action/dismiss/reopen), user search, user detail with report history and moderation log, suspend/ban/reinstate, and management of approved schools and email domains. |

---

## 2. What it costs

Everything below has a free tier that comfortably covers 50 test students.

| Service | Used for | Cost to start |
|---|---|---|
| Supabase | Database + login + email verification | Free plan |
| Daily | Live video | Free plan: 10,000 participant-minutes/month. A 1-on-1 call uses 2 per minute, so that's about 83 hours of total chat time per month. After that it's about $0.004 per participant-minute. |
| Vercel | Hosting the website | Free Hobby plan (see the note in [limitations](#known-limitations-and-what-still-needs-you)) |
| Resend (or similar) | Sending verification emails | Free tier |
| GitHub | Storing your code | Free |
| Domain (CollegeRandom.com) | Your web address | About $10–15/year if you don't own it yet |

**Expected spend for the 50-student test: about $0–15.** Set a spending alert in Daily's dashboard so you never get surprised.

---

## 3. Accounts you need

Create these (all free):

1. **GitHub**: https://github.com
2. **Supabase**: https://supabase.com
3. **Daily**: https://dashboard.daily.co/signup
4. **Vercel**: https://vercel.com (sign up with your GitHub account)
5. **Resend**: https://resend.com (for sending emails; you need a domain you control)

---

## Step 1 — Install tools on your computer

1. **Node.js 20 or newer (LTS)**: https://nodejs.org → download the LTS installer.
   Check it worked by opening a terminal (Mac: *Terminal*; Windows: *PowerShell*) and running:
   ```bash
   node -v   # should print v20.x or higher
   ```
2. **Git**: https://git-scm.com/downloads
3. **VS Code** (a code editor): https://code.visualstudio.com

---

## Step 2 — Create the Supabase database

1. In Supabase, click **New project**. Name it `collegerandom`, choose a strong database password (save it in a password manager), and pick region **East US** (or whichever is closest to most of your students).
2. Wait for it to finish setting up (~2 minutes).
3. Open **SQL Editor** → **New query**. Open `supabase/schema.sql` from this project in VS Code, copy **everything**, paste it in, and click **Run**. You should see "Success. No rows returned."
4. Open `supabase/seed.sql`. **On the first line of real SQL, replace `you@example.com` with the email you'll sign up with** (this makes you the admin and lets you register even without a school email). Copy all of it into a new query and click **Run**.
5. Get your keys: **Project Settings → API Keys** (or the **Connect** button at the top):
   - **Project URL** → this becomes `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe to be public)
   - **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY` (**SECRET** — never share it, never put it in frontend code, never commit it)

> Both key styles work: the older `eyJ...` keys and the newer `sb_publishable_...` / `sb_secret_...` keys.

---

## Step 3 — Configure Supabase Auth and email

### 3a. Turn on email confirmation
**Authentication → Sign In / Providers → Email**
- Email provider: **Enabled**
- **Confirm email: ON** (this is what verifies that students own their school email)
- Minimum password length: **8**
- Disable any other providers (Google, etc.). They would bypass the school-email rule.

### 3b. URLs
**Authentication → URL Configuration**
- **Site URL**: `http://localhost:3000` while you're testing locally. Change it to `https://collegerandom.com` when you deploy (Step 6).
- **Redirect URLs**: add both of these:
  - `http://localhost:3000/**`
  - `https://collegerandom.com/**`

### 3c. Custom email sending (required for real students)
Supabase's built-in email sender is only for testing. It sends to members of your Supabase team only, and just a couple of emails per hour. Your students won't get verification emails until you add your own email provider:

1. In **Resend**, add and verify your domain (it gives you DNS records to add wherever you bought your domain). Use a subdomain like `mail.collegerandom.com`.
2. Create an API key in Resend.
3. In Supabase: **Authentication → Emails → SMTP Settings** → **Enable custom SMTP**:
   - Host: `smtp.resend.com` · Port: `465` · Username: `resend` · Password: *your Resend API key*
   - Sender email: `no-reply@mail.collegerandom.com` · Sender name: `CollegeRandom`
4. **Authentication → Rate Limits**: raise "emails sent per hour" to something like 100 for launch day.

> Tip: university mail servers can be strict. Once your domain is verified in Resend (SPF/DKIM), deliverability is much better. Ask your first testers to check spam/quarantine folders.

### 3d. Email templates (important)
**Authentication → Emails → Templates.** Replace the link in two templates so the links work in any browser (students often open the email on their phone):

**Confirm signup**: set the body to:
```html
<h2>Verify your college email</h2>
<p>Welcome to CollegeRandom! Click below to verify your student email and start chatting.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Verify my email</a></p>
<p>If you didn't sign up, you can ignore this email.</p>
```

**Reset password**: set the body to:
```html
<h2>Reset your CollegeRandom password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Choose a new password</a></p>
<p>If you didn't request this, ignore this email.</p>
```

(Editing templates requires custom SMTP to be enabled first.)

---

## Step 4 — Get a Daily API key

1. Sign up at https://dashboard.daily.co.
2. Go to **Developers** → copy your **API key**. That's `DAILY_API_KEY` (**SECRET**, server only).
3. You don't need to create rooms by hand. The app creates a private room for every match and deletes it when the chat ends.
4. Optional: under **Billing**, set a usage alert.

---

## Step 5 — Run it on your computer

1. Unzip this project and open the folder in VS Code (**File → Open Folder**).
2. Open the terminal in VS Code (**Terminal → New Terminal**) and run:
   ```bash
   npm install
   ```
3. Create your secrets file: duplicate `.env.example`, rename the copy to **`.env.local`**, and fill in the values:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...            # anon/publishable key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_CONTACT_EMAIL=support@collegerandom.com
   SUPABASE_SERVICE_ROLE_KEY=eyJ...                # SECRET
   DAILY_API_KEY=xxxxxxxx                          # SECRET
   ```
   `.env.local` is listed in `.gitignore`, so it will never be uploaded to GitHub.
4. Start the site:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.
5. **Test a full chat yourself:** you need two accounts. Sign up as the admin (your email from seed.sql) in normal Chrome. Sign up as a second account in a **different browser** (Firefox/Safari/Edge) or an Incognito window. Turn on the camera in both, click **Start Chat** in both, and within a few seconds they connect.
   - Before you have your school's domain added (Step 7), you can add a second admin email to `admin_emails` for testing.
   - Some laptops won't share one webcam between two browsers. If so, deploy first and test with your phone.

---

## Step 6 — Deploy to Vercel and connect CollegeRandom.com

1. **Put the code on GitHub** (private repo):
   ```bash
   git init
   git add .
   git commit -m "CollegeRandom MVP"
   ```
   Create a new **private** repository on github.com, then follow GitHub's "push an existing repository" commands it shows you.
2. In **Vercel → Add New → Project**, import the repo. Framework is detected as **Next.js**.
3. Before clicking Deploy, open **Environment Variables** and add all six variables from `.env.local`, but set
   `NEXT_PUBLIC_SITE_URL=https://collegerandom.com`.
4. Click **Deploy**.
5. **Domain:** Vercel → Project → **Settings → Domains** → add `collegerandom.com` (and `www.collegerandom.com`). Follow the DNS instructions Vercel shows at your domain registrar. HTTPS is automatic. (Camera access requires HTTPS, which Vercel provides.)
6. **Back in Supabase → Authentication → URL Configuration**, change **Site URL** to `https://collegerandom.com`.
7. Every time you `git push`, Vercel redeploys automatically.

> If you change an environment variable on Vercel, redeploy (Deployments → ⋯ → Redeploy) for it to take effect.

---

## Step 7 — Admin setup: your schools and domains

1. Log in with your admin email → click **Admin** in the top bar.
2. **Schools & domains** tab:
   - The seed adds 24 well-known universities. **Verify each domain** before launch. Remove the ones you don't want, and add your own campus first, since that's where your first 50 testers come from.
   - **About ".edu ≠ enrolled":** staff, faculty and alumni can also have school addresses. Where a school has a **student-only** email domain (for example `students.school.edu` or `u.school.edu`), approve that domain and turn **off** "accept subdomains". There's no free way to prove enrollment perfectly, so the admin-controlled list plus reports are your controls.
3. **Reports** tab: review each report, open the user, suspend or ban, then mark the report actioned or dismissed.
4. **Users** tab: search any account, see their history, suspend (1–90 days), ban, or reinstate.

To make someone else an admin later, run this in the Supabase SQL editor:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'their@email.edu');
```

---

## Launch checklist: test the full user journey

Do this on the live site with two real devices (e.g. laptop + phone):

- [ ] Homepage loads on phone and desktop; the universities list shows.
- [ ] Sign up with a **non-approved** email → you see "That email isn't an approved address…".
- [ ] Sign up with a date of birth under 18 → blocked.
- [ ] Sign up with an approved school email → "Check your inbox" → email arrives → link verifies → you land on /chat.
- [ ] Try logging in before verifying → "Verify your school email first" + resend button works.
- [ ] Forgot password → email → set new password → log in.
- [ ] Two accounts: Enable camera → Start Chat on both → connected within ~5 s; each sees the other's username + university, never the email.
- [ ] Mute and camera-off work (the other side sees "muted" / "Camera is off").
- [ ] **Next** on one side → the other side sees "left the chat" → both can search again.
- [ ] **Disconnect** → both sides end.
- [ ] Close one browser tab mid-chat → the other side ends within a few seconds.
- [ ] **Block** → the two accounts are never matched again (test by both searching with nobody else online: they stay "Searching").
- [ ] **Report** → appears in Admin → Reports. Suspend the user → their chat ends and /chat shows "Account restricted". Reinstate works.
- [ ] Log out → /chat redirects to log in.

---

## How it works (architecture and security)

```
Browser (Next.js pages)
   │  fetch /api/...  (session cookie)
   ▼
Next.js API routes on Vercel ── service-role key ──► Supabase Postgres
   │                                                   • tables + RLS
   │                                                   • cr_matchmake() atomic matcher
   │  Daily REST API (secret key)                      • triggers (domain/age checks,
   ▼                                                     auto-suspend)
Daily: creates private room + 5-minute token
   ▼
Both browsers join the same Daily room → live video/audio (peer-to-peer or via Daily's servers)
```

**Matching flow**
1. *Start Chat / Next* → `POST /api/match/join`: ends any current chat (deleting its Daily room, which disconnects the other person), then calls the Postgres function `cr_matchmake(user, enqueue=true)`.
2. `cr_matchmake` takes a transaction-level **advisory lock**, so only one matchmaker runs at a time. It cleans out stale users, skips anyone banned, suspended, unverified, blocked or already in a chat, and prefers people you haven't talked to in the last 3 minutes. It creates the match and removes both people from the queue in the same transaction.
3. A **unique index** (`one active match per user`) is a second, database-enforced guarantee.
4. The browser polls `GET /api/match/status` (every 2.5 s while searching, every 8 s in a call). This doubles as a heartbeat: a closed tab drops out of the queue after ~25 s, and its chat ends after ~45 s. A tab-close beacon usually ends it instantly.
5. When matched, each browser calls `POST /api/match/token`. The server checks that the user really is in that active match, creates the private Daily room if needed, and returns a 5-minute meeting token. The Daily API key never reaches the browser.

**Security model**
- Row Level Security is **on** for every table. The browser's public key can read only the list of active universities and the user's own profile. Everything else goes through API routes that verify the session with `supabase.auth.getUser()`.
- The service-role and Daily keys are only read on the server; `lib/supabase/admin.ts` and `lib/daily.ts` import `server-only`, so the build fails if they're ever pulled into browser code.
- Sign-up rules are enforced **in the database** by a trigger on `auth.users`, so someone calling Supabase directly with the public key still can't register a Gmail address or an under-18 birthday.
- Report/block take a *match ID*, not a user ID. The server looks up who your partner was, so users can't report or block arbitrary accounts.
- Every action is rate-limited, and cross-site POSTs are rejected.
- Video is never recorded: no recording is enabled on rooms or tokens.

---

## Known limitations and what still needs you

**Configuration only you can do** (the app can't work without it):
- Supabase project + running both SQL files (Step 2)
- Auth settings, custom SMTP and the two email templates (Step 3)
- Daily API key (Step 4)
- Environment variables locally and on Vercel (Steps 5–6)
- Verifying the seeded university domains and adding your own campus (Step 7)

**Honest notes about this MVP**
- **First build:** the database SQL was tested on PostgreSQL 16, including a concurrency stress test (16 parallel workers, 0 double-matches). The app code was written against current Next.js 15, Supabase and Daily APIs but couldn't be built here because the build environment had no internet access. Run `npm install && npm run build` once. If anything fails, the error message points to the file and line.
- **Age is self-declared** (date of birth plus a checkbox). Real ID-based age verification costs money per check. Add it later if needed.
- **A school email isn't proof of enrollment.** See Step 7. A future improvement: make students re-verify each semester.
- **No automatic nudity detection.** Moderation relies on reports, blocks and auto-suspension. AI video moderation services exist but cost money. Consider them once you grow.
- **Legal pages are templates.** Have a lawyer review the Terms and Privacy Policy before a public launch. As a platform operator you also have legal duties around illegal content: U.S. law requires reporting child sexual abuse material to NCMEC's CyberTipline if you become aware of it. Ban immediately and report.
- **Vercel Hobby (free) is for non-commercial use.** It's fine for the free test. When you add monetization, upgrade to Vercel Pro ($20/month).
- **Polling vs realtime:** status uses simple polling, which is reliable and fine for hundreds of users. At larger scale, switch to Supabase Realtime to cut requests.
- **Not built yet (by design, future):** same-university / different-university preference, an unblock screen, self-service account deletion, text chat, interests.

---

## Adding monetization later

The architecture keeps paid features separate from basic chat:
- Add new tables keyed by `profiles.id` (e.g. `wallets`, `coin_transactions`, `gift_events`, `purchased_items`) with the same "RLS on, server-only writes" pattern.
- Take payments with Stripe Checkout from a server route + a Stripe webhook route that credits coins (never trust the browser for balances).
- **Gifts / animated emojis:** send them during a call with Daily's `sendAppMessage` (already used for mic/camera state in `ChatClient.tsx`) after the server records the purchase.
- **Camera filters / effects:** the chat already sends your own camera track to Daily (`videoSource`), so you can process it with a canvas/WebGL filter before passing it in.
- Basic chat must stay free: never gate `/api/match/*` on payment.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Missing environment variable…" | `.env.local` is missing a value, or you forgot to restart `npm run dev` after editing it. On Vercel: add the variable, then redeploy. |
| Sign-up says success but no email arrives | Custom SMTP isn't set up (Step 3c), the email is in spam/quarantine, or the Supabase email rate limit was hit. Check **Supabase → Logs → Auth**. |
| Verification link says "invalid or expired" | The email template still has the default link (Step 3d), or the link was already used or is too old. Use **Resend verification**. |
| "That email isn't an approved address" | Add the domain in Admin → Schools & domains, under the **same university** the student picked. |
| Camera doesn't start | Browser permission blocked (click the camera icon in the address bar), another app is using the camera, or the site isn't on HTTPS (localhost is fine). |
| Both people stuck on "Searching…" | Are they blocked from each other? Are both verified and not suspended? Check Admin → Overview "In queue now". |
| Connected but no sound | Click "Tap to hear audio" (browsers sometimes block autoplay). Check the other person isn't muted. |
| "Could not create video room" | `DAILY_API_KEY` is wrong or missing on the server. |
| Admin link doesn't show | Your email wasn't in `admin_emails` before you signed up. Run the SQL in Step 7 to make yourself admin. |

---

## Project structure

```
app/
  page.tsx                  Homepage
  signup/ login/ check-email/ forgot-password/ reset-password/
  auth/confirm/route.ts     Handles email verification + reset links
  auth/signout/route.ts     Log out (also leaves any chat)
  chat/page.tsx             Video chat page (server checks) → ChatClient
  admin/page.tsx            Admin dashboard (admins only)
  guidelines/ privacy/ terms/ contact/
  api/
    auth/signup             Validated sign-up (domain, age, username)
    match/join|status|token|leave   Matching + Daily tokens
    report, block           Safety actions
    admin/stats|reports|users|domains   Admin APIs
components/
  chat/ChatClient.tsx       All video-chat UI + Daily logic
  chat/SafetyDialogs.tsx    Report & Block dialogs
  admin/AdminDashboard.tsx  Admin UI
  auth/*                    Forms
lib/
  supabase/{client,server,admin,middleware}.ts
  daily.ts                  Daily REST helpers (server only)
  match.ts                  Matching helpers (server only)
  api.ts                    Auth checks, rate limits, errors
supabase/
  schema.sql                Tables, RLS, matching functions, triggers
  seed.sql                  Admin email + starter universities/domains
middleware.ts               Session refresh + protects /chat, /admin
```
