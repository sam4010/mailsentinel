# 🛡️ MailSentinel

> **“Tell MailSentinel what matters. Never miss an important email again.”**

MailSentinel is a personal, privacy-focused email monitoring application with a responsive, installable Progressive Web App (PWA) client and an autonomous background synchronization daemon.

It continuously monitors incoming emails, deterministically evaluates your customizable rules, detects deadlines, calculates urgency, and delivers instant browser push alerts and in-app notifications.

---

## ⚡ Features

- **📱 Installable PWA (Android & Desktop):** Mobile-first dark interface with light mode toggle. Installable directly onto Android home screens via Chrome/Firefox/Edge with native-like push notifications and app badging.
- **🎯 Deterministic Matching Engine:**
  - Sender email matching (normalized, exact).
  - Sender domain matching with boundary enforcement (e.g., `@university.edu` matches `sub.university.edu`, but prevents substring spoofing like `fakeuniversity.edu`).
  - Sender display name & organization matching.
  - Keyword and phrase matching with word boundary protections.
  - Excluded keywords (instantly suppresses false-positive matches).
  - Subject-only vs full-message matching.
  - Match-Any vs Match-All rule semantics.
- **🚨 Intelligent Priority & Deadline Detection:**
  - Priority levels: `Critical`, `High`, `Normal`, `Low`.
  - Timezone-aware deadline detection: extracts explicit dates (e.g., *"due by November 15, 2026"*, *"within 48 hours"*, *"due tomorrow"*) and flags ambiguous dates without hallucinating.
  - Urgency escalation: flags critical markers like *"offer expires"*, *"immediate action required"*, *"payment past due"*.
- **🔒 Security & Minimum Privilege Scopes:**
  - Uses Google's official OAuth 2.0 flow with PKCE code challenges and state CSRF validation.
  - Requests only read-only scope (`https://www.googleapis.com/auth/gmail.readonly`).
  - Tokens are encrypted at rest with AES-256-GCM using derived keys.
  - Never stores your Google password or exposes refresh tokens to the frontend.
- **🔄 Background Incremental Synchronization:**
  - Tracks Gmail `historyId` checkpoints.
  - Automatic token refresh before expiration.
  - Reconciliation fallback if history cursors expire.
  - Background polling worker (configurable 30s–300s) + instant "Sync Now" trigger.
  - Strict idempotency: processed email deduplication prevents redundant notifications.
- **🔔 Real Web Push & In-App Alerts:**
  - Standards-compliant VAPID Web Push notifications delivered through Service Workers.
  - Configurable Quiet Hours (e.g., 22:00 to 07:00 in your local timezone) with Critical bypass.
  - Full audit trail of delivery attempts with retry capabilities.
  - Direct "Open in Gmail" action button launching the exact email thread.

---

## 🏗️ Architecture

```
MailSentinel/
├── public/                 # Static assets, Web App Manifest & Service Worker
│   ├── manifest.json       # PWA manifest for Android "Add to Home Screen"
│   ├── sw.js               # Service Worker: Web Push & offline shell cache
│   └── favicon.svg         # SVG shield icon
├── src/
│   ├── client/             # React 18 + TailwindCSS PWA Frontend
│   │   ├── components/     # Modals, Navbar, Toast, Rule Editor, Rule Tester
│   │   ├── views/          # 6 core views (Overview, Rules, Emails, History, Accounts, Settings)
│   │   ├── context/        # Global state provider & refresh coordinator
│   │   └── hooks/          # Web Push registration & permissions
│   ├── server/             # Express + TypeScript Backend
│   │   ├── crypto/         # AES-256-GCM token encryption/decryption
│   │   ├── db/             # Atomic persistent database store (WAL/atomic file swap)
│   │   ├── rules/          # Rule matcher & priority/deadline classifier
│   │   ├── gmail/          # Official Google OAuth 2.0 & Gmail API client
│   │   ├── sync/           # Background email synchronization worker
│   │   ├── notifications/  # Web Push & in-app dispatcher
│   │   ├── routes/         # REST API endpoints
│   │   └── index.ts        # Server entry point
│   └── tests/              # Vitest automated test suite (26 passing tests)
├── Dockerfile              # Multi-stage production container
├── docker-compose.yml      # Container orchestration
└── package.json
```

---

## 🚀 Quickstart

### Prerequisites

- Node.js 18+ (tested with Node 22 LTS)
- npm or pnpm

### 1. Installation

```bash
git clone <repo-url>
cd "notification app"
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Generate a secure 32+ character encryption secret and VAPID keys:

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys
```

Update your `.env` with the generated keys:
```env
PORT=3001
NODE_ENV=development
BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:3001

# Google Cloud OAuth (see detailed guide below)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# Security & Push
ENCRYPTION_SECRET=your_super_secret_32_character_hex_key_here!
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@example.com
```

### 3. Run Development Server

```bash
# Terminal 1: Run the backend server
npm run dev:server

# Terminal 2: Run the Vite frontend with hot module reload
npm run dev:client
```

Open `http://localhost:3000` in your browser.

### 4. Run Production Build

```bash
npm run build
npm start
```

The production server serves both the API and the compiled React PWA on `http://localhost:3001`.

---

## 🔑 Google Cloud OAuth 2.0 Setup Guide

To connect your Gmail account, follow this 5-minute setup:

1. **Go to Google Cloud Console:** [console.cloud.google.com](https://console.cloud.google.com/)
2. **Create a Project:** Click the project dropdown at the top and select **New Project** (e.g., `MailSentinel`).
3. **Enable Gmail API:**
   - In the search bar, search for **Gmail API**.
   - Click **Enable**.
4. **Configure OAuth Consent Screen:**
   - Go to **APIs & Services** &rarr; **OAuth consent screen**.
   - Choose **External** user type and click **Create**.
   - App Name: `MailSentinel`
   - User support email: Select your email.
   - Developer contact: Enter your email.
   - Click **Save and Continue**.
   - Under **Scopes**, click **Add or Remove Scopes**, and search for:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
   - Click **Save and Continue**.
   - Under **Test Users**, click **Add Users** and add your personal Gmail address.
5. **Create Credentials:**
   - Go to **APIs & Services** &rarr; **Credentials**.
   - Click **Create Credentials** &rarr; **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `MailSentinel Web Client`.
   - Under **Authorized redirect URIs**, click **Add URI** and enter:
     ```
     http://localhost:3001/api/auth/google/callback
     ```
     *(Or your production domain callback, e.g. `https://your-domain.com/api/auth/google/callback`)*
   - Click **Create**.
6. **Copy Credentials to `.env`:**
   - Copy the generated **Client ID** into `GOOGLE_CLIENT_ID`.
   - Copy the **Client Secret** into `GOOGLE_CLIENT_SECRET`.

---

## 📱 Android Installation (PWA)

1. Open MailSentinel in **Chrome for Android** (e.g. `http://<your-lan-ip>:3001` or your deployed HTTPS URL).
2. Tap the browser menu (three dots in the top right).
3. Tap **Add to Home screen** (or **Install app**).
4. Launch **MailSentinel** from your home screen or app drawer.
5. In **Settings**, tap **Subscribe Device to Push** and allow notifications when prompted.

---

## 🧪 Testing & Quality Assurance

### Automated Tests

MailSentinel comes with automated unit and integration tests covering:
- Sender, domain, and keyword matching semantics.
- Boundary protection preventing substring spoofing.
- Excluded keywords match suppression.
- Deterministic priority classification and deadline parsing.
- AES-256-GCM token encryption and tampering rejection.
- Database CRUD and message deduplication.

Run all tests:
```bash
npm test
```

Run end-to-end server verification:
```bash
npm run test:e2e
```

### Manual Verification Checklist

- [x] **Onboarding Flow:** Launching with a clean database opens the 5-step guided onboarding wizard.
- [x] **Rule Creation & CRUD:** Create rules with multiple domains, senders, keywords, and excluded keywords; toggle enable/disable; test with live simulator.
- [x] **Google OAuth Flow:** Initiate Google OAuth; state token and PKCE code challenge verify CSRF safety; callback stores encrypted tokens.
- [x] **Background Sync Worker:** Incremental history cursor poll runs automatically every 60s; manual "Sync Now" button triggers immediate sync.
- [x] **Priority Classification:** Emails with "deadline: Oct 25" or "immediate action required" escalate to Critical.
- [x] **Open in Gmail:** Clicking "Open in Gmail" opens the exact thread in Gmail.
- [x] **Web Push Alerts:** Triggering a test alert displays the system notification with action buttons.

---

## 🐳 Docker Deployment

Run with Docker Compose:

```bash
docker-compose up -d --build
```

View logs:
```bash
docker-compose logs -f
```

The container automatically persists your database in a named Docker volume (`sentinel-data`).

---

## 🔒 Security & Privacy Policy

- **Zero Content Retention:** MailSentinel only retains message metadata (sender, subject, snippet, and match rationale) necessary to display why an alert was triggered. Full email bodies are not persisted.
- **Encrypted at Rest:** Google OAuth refresh and access tokens are encrypted with AES-256-GCM using scrypt key derivation.
- **Read-Only Scope:** The application can never send, delete, or modify emails.
- **Account Disconnection:** Clicking "Disconnect" in Connected Accounts immediately purges stored OAuth credentials and can optionally delete all historic alert data.
