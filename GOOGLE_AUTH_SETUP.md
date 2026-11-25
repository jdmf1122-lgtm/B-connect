# B-CONNECT — Google Authentication Setup Guide (Supabase)

This guide walks you through configuring **Google OAuth 2.0** for B-CONNECT using native **Supabase Auth**.

---

## Architecture Overview

```
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

## Step 1: Google Cloud Console Setup

### 1.1 Create or Select a Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and select **New Project** (or pick an existing one).
3. Name it `B-CONNECT Roxas` and click **Create**.

---

### 1.2 Configure the OAuth Consent Screen
1. In the left navigation, go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** user type and click **Create**.
3. Fill in the required app information:
   - **App name:** `B-CONNECT Municipal Portal`
   - **User support email:** Your email or municipal IT desk email.
   - **Developer contact information:** Your email address.
4. Click **Save and Continue**.
5. **Scopes**:
   - Click **Add or Remove Scopes**.
   - Check the standard non-sensitive scopes:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - Click **Update**, then **Save and Continue**.
6. **Publishing Status (Exit Testing Mode)**:
   - By default, apps start in *Testing* status (requiring manually added test users).
   - Go back to the **OAuth consent screen** tab.
   - Under **Publishing status**, click **PUBLISH APP** and confirm.
   > **Note:** Because B-CONNECT only requests basic email/profile scopes, **Google verification is NOT required**. The app publishes instantly, allowing any resident with a Google account to log in.

---

### 1.3 Create OAuth 2.0 Web Credentials
1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** at the top > select **OAuth client ID**.
3. In the dropdown, choose **Application type:** `Web application`.
4. Name it `B-CONNECT Web Client`.
5. Under **Authorized redirect URIs**, click **Add URI** and enter your Supabase callback URL:
   ```text
   https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback
   ```
   *(Replace `<YOUR-PROJECT-REF>` with your actual Supabase project reference ID)*.
6. Click **Create**.
7. A dialog will display:
   - **Client ID** (e.g. `123456789-abc.apps.googleusercontent.com`)
   - **Client Secret** (e.g. `GOCSPX-xyz123...`)
   - Copy both values for Step 2.

---

## Step 2: Configure Supabase Dashboard

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Authentication** > **Providers** in the sidebar.
3. Find **Google** in the provider list and click it to expand settings.
4. Enable the provider:
   - Toggle **Enable Google provider** to `ON`.
   - Paste your **Client ID** from Step 1.3.
   - Paste your **Client Secret** from Step 1.3.
5. Click **Save**.

---

## Step 3: Configure Redirect Allowlist & Site URL

1. In Supabase Dashboard, go to **Authentication** > **URL Configuration**.
2. **Site URL**:
   - Set to your primary application URL:
     - Local dev: `http://localhost:3000`
     - Production: `https://your-domain.vercel.app` (or custom municipal domain)
3. **Redirect URLs**:
   - Add all environments where OAuth redirects should be allowed:
     ```text
     http://localhost:3000/**
     http://127.0.0.1:3000/**
     https://your-production-domain.com/**
     https://*.vercel.app/**
     ```
4. Click **Save**.

---

## Step 4: Verification & Local Testing

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
5. You will be redirected to Google to select your account and grant consent.
6. Upon approval, Google redirects through Supabase back to B-CONNECT.
7. [AuthContext.tsx](src/context/AuthContext.tsx) automatically provisions your resident citizen profile in the `public.users` PostgreSQL table and logs you into the Citizen Portal.

---

## Common Troubleshooting

| Issue / Error | Root Cause | Fix |
| :--- | :--- | :--- |
| `redirect_uri_mismatch` (Google 400 error) | The callback URI in Google Cloud Console does not match Supabase exactly. | Double check Google Cloud **Authorized redirect URIs** matches `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback` exactly (no trailing slash). |
| `403: access_denied` | Google OAuth app is in "Testing" mode and the current Gmail is not in the test users list. | Click **Publish App** on Google Cloud *OAuth consent screen* to exit testing mode. |
| Supabase redirects to `localhost:3000` instead of production domain | Site URL or Redirect URLs are not set in Supabase. | Update **Authentication** > **URL Configuration** in Supabase with your production URL. |
| User created without barangay assignment | Stored barangay state cleared during redirect. | B-CONNECT safely defaults missing barangay assignments to `Bagumbayan` in `AuthContext.tsx`. |
