# Laman Web Masjid Jamek Kampong Bharu

Static website (plain HTML, CSS and JavaScript on GitHub Pages) with a small admin panel so mosque staff can update content from their phones without touching code.

- **Public site:** `https://<github-account>.github.io/masjid-2/`
- **Admin panel:** `https://<github-account>.github.io/masjid-2/admin/`
- **Guide for mosque admins (Bahasa Malaysia):** [PANDUAN-ADMIN.md](PANDUAN-ADMIN.md)

## How it works

| Part | Where | Notes |
|---|---|---|
| Pages, styling | `*.html`, `styles.css`, `script.js` | No build step. Edit and push. |
| Dynamic content | `kandungan.js` | Reads announcements, activities, weekly kuliah, programmes and Friday-prayer info from Supabase. Read-only. |
| Admin panel | `admin/` | Bahasa Malaysia, mobile-first. Uses `vendor/supabase.js`. |
| Connection settings | `config.js` | Supabase URL, publishable key, JAKIM zone code. |
| Database setup | `supabase/` | SQL to recreate tables, security rules and storage. |
| Keep-alive | `.github/workflows/keepalive.yml` | Pings Supabase every 3 days. |

Prayer times come from the official JAKIM e-Solat API (zone `WLY01`, Kuala Lumpur and Putrajaya) and need no admin work. Bank details, the DuitNow QR, contact details and the organisation chart are deliberately **not** editable in the admin panel; they live in the HTML so a stolen admin password cannot redirect donations.

If Supabase is unreachable, visitors see the last copy saved in their browser, or else neutral fallback text that is written in the HTML. If JAKIM is unreachable, the site shows an estimate (clearly labelled), then the last saved day, then dashes. It never shows invented times.

## Who must own what

These accounts must belong to the **mosque**, not to a volunteer personally. Use a shared mosque mailbox (for example the mosque's Gmail) that at least two committee members can access, and turn on two-step verification.

| Account | Why it matters | Status today |
|---|---|---|
| **Supabase** organisation and project | Holds all content, photos and admin logins. Whoever owns it controls the site's data. | To be created. Create it under the mosque email from the start. |
| **GitHub** account that hosts the repository | Controls the website code and hosting. | Currently a personal account. Transfer the repository to a mosque-owned account or organisation (Settings > General > Transfer ownership), then re-check Pages and the Actions secrets. |
| **Domain name** (if one is bought later) | Controls where the address points. | None yet. Register it in the mosque's name with the mosque email. |

Keep the passwords for these in a place the committee controls, and record who has access. When a volunteer leaves, remove their access; nothing else needs to change.

## Setup, step by step

Menu names below are as Supabase and GitHub label them at the time of writing. If a label has moved, look for the nearest equivalent.

### 1. Create the Supabase project

1. Sign in at <https://supabase.com> with the **mosque email**.
2. New project. Choose the Free plan and region **Southeast Asia (Singapore)**.
3. Set a strong database password and store it with the committee. It is not needed for daily use.

### 2. Run the SQL

In the Supabase dashboard open **SQL Editor**. For each file, paste its whole contents and press **Run**, in this order:

1. `supabase/migrations/0001_jadual.sql`
2. `supabase/migrations/0002_keselamatan_rls.sql`
3. `supabase/migrations/0003_storan_gambar.sql`
4. Optional: `supabase/seed.sql`. Part A adds the four real annual programmes that are already on the site. Part B adds clearly marked sample items for testing; delete those in the admin panel before announcing the site.

Each should end with "Success". `0002` and `0003` are safe to run again; `0001` is not (it creates the tables).

### 3. Lock down sign-ups

In **Authentication > Sign In / Providers**:

1. Turn **off** "Allow new users to sign up".
2. Make sure "Allow anonymous sign-ins" is **off**.
3. Leave the Email provider enabled.

Even if sign-ups were left on by mistake, a new account could change nothing, because writes require a row in the `admins` table (step 4).

### 4. Create the admin accounts

Supabase's built-in email only delivers to members of the Supabase project, so invitation and password-reset emails will not reach mosque admins. Accounts are therefore created by hand:

1. **Authentication > Users > Add user > Create new user.** Enter the admin's email and a temporary password, and tick **Auto Confirm User**.
2. Open `supabase/tambah-admin.sql`, change the email and name, and run it in the SQL Editor.
3. Give the admin their email and temporary password privately. The panel forces them to choose their own password on first login.

Repeat for each admin. Give each person their own account; do not share one login.

### 5. Connect the website

1. In Supabase open **Project Settings > Data API** and copy the **Project URL**.
2. Open **Project Settings > API Keys** and copy the **Publishable key** (`sb_publishable_…`; older projects call it the `anon` key).
3. Put both into `config.js`:

   ```js
   window.MASJID_CONFIG = {
     supabaseUrl: 'https://abcdefgh.supabase.co',
     supabaseKey: 'sb_publishable_xxxxxxxx',
     zonSolat: 'WLY01'
   };
   ```

These two values are public by design and safe to commit. **Never** put the secret key (`sb_secret_…`) or the `service_role` key anywhere in this repository.

### 6. Add the GitHub secrets

In the GitHub repository open **Settings > Secrets and variables > Actions > New repository secret** and add:

| Name | Value |
|---|---|
| `SUPABASE_URL` | the Project URL from step 5 |
| `SUPABASE_PUBLISHABLE_KEY` | the publishable key from step 5 |

Then open the **Actions** tab, choose **Supabase keep-alive**, and press **Run workflow** once. It should finish green. Scheduled workflows only run from the default branch, so this works after step 7.

### 7. Publish

This work is on the `admin-panel` branch. After `config.js` is filled in:

```bash
git checkout main
git merge admin-panel
git push
```

GitHub Pages updates within a few minutes.

### 8. Check the security yourself

Replace the URL and key, then run these from any terminal. The first must return data; the second and third must be refused.

```bash
URL=https://abcdefgh.supabase.co
KEY=sb_publishable_xxxxxxxx

# 1. Public can read: expect HTTP 200 and a JSON list
curl -i "$URL/rest/v1/pengumuman?select=tajuk&limit=1" -H "apikey: $KEY"

# 2. Public cannot write: expect HTTP 401 or 403, "permission denied"
curl -i -X POST "$URL/rest/v1/pengumuman" -H "apikey: $KEY" \
  -H "Content-Type: application/json" -d '{"tajuk":"ujian"}'

# 3. Public cannot sign up: expect an error saying signups are not allowed
curl -i -X POST "$URL/auth/v1/signup" -H "apikey: $KEY" \
  -H "Content-Type: application/json" -d '{"email":"x@example.com","password":"password12345"}'
```

Also log in to the admin panel, add an announcement with a photo-free test title, check it appears on the public site, and delete it.

## Day-to-day operations

**An admin forgot their password.** Authentication > Users > open the user > reset the password to a new temporary one and pass it on privately. Ask them to change it via "Tukar Kata Laluan".

**An admin leaves.** Run the `delete from public.admins …` line at the bottom of `supabase/tambah-admin.sql`, then delete the user under Authentication > Users.

**The site shows only fallback text.** The Supabase project is probably paused. Open the Supabase dashboard and press Restore, then check the Actions tab to see why the keep-alive failed. GitHub emails the repository owner when a workflow fails, so that email should go to someone who will read it.

**Storage.** The free plan includes 1 GB. Photos are reduced in the browser to about 300 KB each (1 MB hard limit in the bucket), which is room for roughly 3,000 photos. Deleting an activity or programme in the panel also deletes its photos. Usage is shown under Project Settings > Usage.

**Backups.** The free plan has no automatic backups. Every few months, export each table from the Table Editor (Export to CSV) and keep the files with the committee.

**Changing the prayer zone.** Edit `zonSolat` in `config.js`. Zone codes are listed at <https://www.e-solat.gov.my>.

**Using a custom Supabase domain.** Update the `Content-Security-Policy` line in `admin/index.html`, which currently allows `https://*.supabase.co` only.

**Updating supabase-js.** `vendor/supabase.js` is version 2.117.3, copied unchanged from the npm package (`dist/umd/supabase.js`, SHA-256 `d6a5c4414a5d4ce646d9c1de223aa7067d3ff664c15394ffeb7fcffc763354a3`). To update, replace the file with the same path from a newer release and re-test the admin panel.

## Security model

- Row Level Security is enabled on every table. Anyone may read; insert, update and delete require the signed-in user to be listed in `public.admins`.
- `public.admins` cannot be changed through the API at all, only from the SQL Editor.
- The storage bucket `gambar` is public for viewing only. Upload, replace and delete require an admin, files are limited to 1 MB images, and uploads are restricted to the `aktiviti/` and `program/` folders.
- All admin-entered text is placed on pages with `textContent`, never `innerHTML`. Image paths are checked against a strict pattern in the database and again in the browser; full URLs are rejected.
- The admin page has a Content-Security-Policy that only allows scripts from this site and connections to Supabase.

## What has and has not been tested

Tested locally before handover:

- **SQL and security rules:** all migrations and the seed were run in an embedded PostgreSQL with stand-ins for Supabase's roles, `auth.uid()` and storage tables. 84 checks passed, covering every table for anonymous, signed-in non-admin and admin users, storage rules, and the input constraints.
- **Prayer times:** in a real browser against the live JAKIM API, plus simulated JAKIM outage, total outage, stale cache and malformed responses.
- **Public pages and admin panel:** in a real browser (desktop and 390 px phone width) against a local imitation of the Supabase API, including script-injection attempts in every text field, photo resizing (an 11 MB photo became 348 KB at 1600 px), failed saves and logout.

Not tested, because it needs the real project:

- The SQL has not been run on Supabase itself. Step 2 is the first real run.
- Login, saving and photo upload against real Supabase Auth, database and Storage. Step 8 is the check.
- The keep-alive workflow on GitHub. Only its request logic was dry-run locally. Whether it keeps a project awake, and whether its self re-enable step defeats GitHub's 60-day rule, can only be confirmed over time. Check the Actions tab after the first week and again after two months.
- iPhone Safari and older Android browsers. Testing used Microsoft Edge only.

## Known limits

- Programmes appear in the order they were added; there is no reorder button yet.
- The hero photo on the home page is still loaded from another website (`nry.com.my`). If that site removes it, the banner breaks. Replace it with a photo the mosque owns, saved in this repository.
- The Friday prayer time is typed by an admin and is not checked against that day's Zohor time.
