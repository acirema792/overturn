# Set up Firebase for Overturn (about 10 minutes, free plan)

You need: a Google account, and an **empty** public GitHub repo `acirema792/overturn` (step 0).
Send Claude the three things marked **SEND** at the end. Never send a password or a secret key.

## 0. GitHub repo (30 seconds)

1. Open https://github.com/new
2. Repository name: `overturn` · Visibility: **Public**
3. Leave **all** "Initialize this repository with" boxes **unticked** (no README, no .gitignore, no license)
4. Click **Create repository**. Done. Claude pushes everything else.

## 1. Create the Firebase project

1. Open https://console.firebase.google.com and sign in.
2. Click **Create a project** (or **Add project**).
3. Name: `overturn-appeals` → Continue.
4. Google Analytics: **turn it off** (not needed) → **Create project** → wait → **Continue**.

## 2. Turn on Firebase AI Logic (Gemini)

1. In the left menu: **AI Services → AI Logic** (if you don't see it, click **All products** and search "AI Logic").
2. Click **Get started**.
3. When asked for a Gemini API provider, choose **Gemini Developer API** (free, no billing) → **Enable API** / Continue.
4. If the wizard offers to register an app, you can do step 3 here. If it says App Check will be enforced, that's expected.

## 3. Register the web app → **SEND #1**

1. Click the gear icon (top left) → **Project settings** → **General** tab.
2. Scroll to **Your apps** → click the **Web** icon `</>`.
3. App nickname: `overturn` · do **not** tick "Firebase Hosting" → **Register app**.
4. You'll see a code block with `const firebaseConfig = { apiKey: "...", authDomain: "...", projectId: "...", storageBucket: "...", messagingSenderId: "...", appId: "..." };`
5. **SEND #1:** copy that whole `firebaseConfig = { … }` block to Claude.
   It is **not** a secret: it only names the project. App Check (next step) stops other sites from using it.

## 4. Create a reCAPTCHA Enterprise key (Google Cloud Fraud Defense)

reCAPTCHA "Classic" (v3) is deprecated in Firebase App Check; use Enterprise.

1. In Firebase: **Security → App Check → Apps** → your web app → **reCAPTCHA Enterprise**.
2. If Firebase offers to create a key, accept it; otherwise create one in Google Cloud console →
   **Security → reCAPTCHA (Fraud Defense) → Create key**: type **Website**, domain **`acirema792.github.io`**,
   no checkbox challenge (score-based) → Create.
3. Paste the **site key** into the Firebase App Check panel → **Save**.
4. **SEND #2:** the site key to Claude (it's public: it goes into the web page). There is no secret key to paste for Enterprise.

## 5. App Check checks

1. **Apps** tab: the web app row shows **reCAPTCHA Enterprise** as registered.
2. ⋮ → **Manage debug tokens** → **Add debug token** (optional, only for Claude's scripted tests):
   - Name: `claude-live-test`, Value: the token Claude gives you **in chat** (never commit it). **Delete it after judging ends, Dec 16.**
3. **APIs** tab: **Firebase AI Logic** should say **Enforced**.

## 6. (Optional) Remote Config

Overturn works with built-in defaults. To change the cloud model or the letter length later:
**Run → Remote Config** → add parameters `cloud_model` (string, e.g. `gemini-3.5-flash-lite`) and `appeal_word_limit` (number, 150–800) → **Publish**.

## What to send Claude

| # | What | Secret? |
|---|---|---|
| 1 | The `firebaseConfig = { … }` block | No |
| 2 | The reCAPTCHA Enterprise **site key** | No |
| 3 | "Repo created" + "debug token added" | No |

Never send: your Google password, any secret key, or any service-account file.
