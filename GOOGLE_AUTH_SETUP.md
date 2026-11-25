# B-CONNECT — Google Authentication Setup Guide (Supabase)

This guide walks you through configuring **Google OAuth 2.0** for B-CONNECT using native **Supabase Auth** and the updated **Google Auth Platform** UI in Google Cloud Console.

---

## Architecture Overview

```text
[ Citizen Browser ]
        │
        │ 1. Click "Sign in with Google"
        ▼
[ Supabase Auth ] ─── 2. Redirect to accounts.google.com ───► [ Google OAuth ]
        ▲                                                            │
        │ 3. Callback with auth code                                 │
        └────────────────────────────────────────────────────────────┘
        │
        │ 4. Issues Supabase JWT & redirects back to B-CONNECT
        ▼
[ B-CONNECT App ]
   └── AuthContext captures session
   └── Auto-provisions resident profile in PostgreSQL `public.users`
   └── Logs into citizen portal
```

---

## Prerequisites

- Access to the [Supabase Dashboard](https://supabase.com/dashboard)
- A Google account with access to the [Google Cloud Console](https://console.cloud.google.com/)

---

## Step 1: Copy Your Supabase Callback URL First

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. In the left sidebar, go to **Authentication** > **Sign In / Providers** (or **Providers**).
3. Click **Google** to expand its settings.
4. Copy the **Callback URL (for OAuth)** shown there:
   ```text
   https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback
   ```
   *(Replace `<YOUR-PROJECT-REF>` with your actual Supabase project reference ID. Keep this tab open for Step 5.)*

---

## Step 2: Initialize Google Auth Platform (Google Cloud Console)

Google replaced the old **APIs & Services > OAuth consent screen** flow with **Google Auth Platform** (**Overview**, **Branding**, **Audience**, **Clients**, and **Data Access**).

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project selector in the top bar and create or select your project (e.g., `B-CONNECT Roxas`).
3. Search for **`Google Auth Platform`** in the top search bar and open **Google Auth Platform > Overview**.
4. If this project has not configured OAuth yet, click **Get started** and complete the setup wizard:
   - **App Information:**
     - **App name:** `B-CONNECT Municipal Portal`
     - **User support email:** Your email or municipal IT desk email.
   - **Audience:** Select **External** (so any resident with a Google account can sign in), then click **Next**.
   - **Contact Information:** Enter your developer contact email, then click **Next**.
   - **Finish:** Agree to the policy and click **Create**.

---

## Step 3: Create the OAuth Client

1. In the left navigation under **Google Auth Platform**, go to **Clients** and click **+ Create client** *(or click **Create OAuth client** from **Overview**)*.
2. Set **Application type** to **`Web application`**.
3. Set **Name** to `B-CONNECT Web Client`.
4. Under **Authorized JavaScript origins**, click **+ Add URI** and add:
   - Local development: `http://localhost:3000`
   - Production (once deployed): `https://your-domain.vercel.app`
5. Under **Authorized redirect URIs**, click **+ Add URI** and paste the exact Supabase Callback URL from Step 1:
   ```text
   https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback
   ```
   *(Must match exactly with no trailing slash.)*
6. Click **Create**.
7. Copy both the **Client ID** (e.g. `123456789-abc.apps.googleusercontent.com`) and **Client Secret** (e.g. `GOCSPX-...`) from the dialog.

---

## Step 4: Scopes, Testing Mode, and Publishing (**Data Access**, **Audience**, & **Branding**)

- **Data Access (formerly Scopes):**
  Supabase's Google OAuth flow only requests basic `openid`, `email`, and `profile` info by default, so you do not need to add sensitive or restricted scopes under **Google Auth Platform > Data Access**.

Choose **Option A** for local testing or **Option B** when you have a public `https://` deployment and want any resident to log in:

### Option A: Local Development / Private Testing (**Testing** mode)
Google blocks **Publish app** until you provide real public `https://` URLs on the **Branding** page (it rejects `localhost`). While developing locally, keep the app in **Testing** mode:
1. Go to **Google Auth Platform > Audience**.
2. Leave **Publishing status** as **Testing**.
3. Scroll to **Test users**, click **+ Add users**, and add the Gmail addresses you will test with (up to 100 users).
4. Click **Save**.

### Option B: Public Rollout (**In production** mode)
Once B-CONNECT is deployed to a public `https://` domain (B-CONNECT includes standalone public pages at `public/privacy.html` and `public/terms.html` for this step):
1. Go to **Google Auth Platform > Branding**.
2. Under **App domain**, fill in your live public URLs:
   - **Application home page:** `https://<your-deployed-domain>`
   - **Application privacy policy link:** `https://<your-deployed-domain>/privacy.html`
   - **Application terms of service link:** `https://<your-deployed-domain>/terms.html`
3. Under **Authorized domains**, click **+ Add domain** and add:
   - `<your-deployed-domain>` *(domain only—no `https://` or paths, e.g. `bconnect-roxas.vercel.app`)*
   - `supabase.co` *(if prompted for your Supabase callback domain)*
4. Click **Save** at the bottom of the **Branding** page.
5. Go to **Google Auth Platform > Audience**, click **Publish app**, and confirm.
   > **Note:** Because B-CONNECT only uses basic non-sensitive email/profile scopes, full Google verification review is not required.

---

## Step 5: Configure Supabase Dashboard

1. Return to your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Authentication** > **Sign In / Providers** > **Google**.
3. Enable and save the provider:
   - Toggle **Enable Sign in with Google** to **ON**.
   - Paste your **Client ID** from Step 3.
   - Paste your **Client Secret** from Step 3.
   - Click **Save**.
4. Go to **Authentication** > **URL Configuration**:
   - **Site URL:** Set to your primary application URL:
     - Local dev: `http://localhost:3000`
     - Production: `https://<your-deployed-domain>`
   - **Redirect URLs:** Add all environments where OAuth redirects should be allowed:
     ```text
     http://localhost:3000/**
     http://127.0.0.1:3000/**
     https://<your-deployed-domain>/**
     https://*.vercel.app/**
     ```
   - Click **Save**.

---

## Step 6: Verification & Local Testing

1. Ensure your `.env` contains valid Supabase public keys:
   ```env
   VITE_SUPABASE_URL=https://<YOUR-PROJECT-REF>.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000`.
4. On the sign-in page, click **"Sign in with Google"** (or select a barangay under **"Sign up with Google"**).
5. Choose your Google account and grant consent.
6. Google redirects through Supabase back to B-CONNECT (`window.location.origin` in `src/components/auth/AuthPage.tsx`), and `src/context/AuthContext.tsx` automatically provisions your resident citizen profile in `public.users` and signs you into the Citizen Portal.

---

## Common Troubleshooting

| Issue / Error | Root Cause | Fix |
| :--- | :--- | :--- |
| `redirect_uri_mismatch` (Google 400 error) | The callback URI in Google Auth Platform does not match Supabase exactly. | Under **Google Auth Platform > Clients** > your Web client > **Authorized redirect URIs**, verify it matches `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback` exactly (no trailing slash). |
| `403: access_denied` | App is in **Testing** status and the Gmail account is not listed in **Test users**. | Either add the Gmail under **Google Auth Platform > Audience > Test users**, or complete **Branding** and click **Publish app** on **Audience**. |
| `To publish your app, you must complete your configuration on the Branding page` | Required **App domain** URLs on **Branding** are missing or use `localhost`. | Keep the app in **Testing** with **Test users** during local dev, or deploy first and add your public `https://` homepage, `/privacy.html`, `/terms.html`, and **Authorized domains** on **Branding**. |
| Supabase redirects to `localhost:3000` instead of production domain | Site URL or Redirect URLs are not updated in Supabase. | Update **Authentication > URL Configuration** in Supabase with your production **Site URL** and **Redirect URLs**. |
| User created without barangay assignment | Stored barangay state cleared during redirect. | B-CONNECT safely defaults missing barangay assignments to `Bagumbayan` in `src/context/AuthContext.tsx`. |
