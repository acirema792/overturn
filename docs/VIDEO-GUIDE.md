# Overturn demo video: complete recording guide

Goal: a **2:45** video (hard limit **3:00**, only the first 3 minutes are judged), English voice or
English captions, **public on YouTube**, showing Overturn **working in Chrome on desktop**.

What judges must see, in this order of importance:
1. Gemini Nano reading the letter **on the device** (and the network panel staying quiet).
2. The side-by-side **"what leaves your device"** view and the green **egress check**.
3. The **cloud** writing the appeal from de-identified text, and the real details coming back **locally**.
4. The **privacy ledger** and the **benchmark** numbers.

---

## Part A. Prepare (once, ~20 minutes, the day before)

### A1. Chrome with Gemini Nano
1. Chrome on desktop, **version 139+** → `chrome://settings/help` → update → relaunch.
2. Address bar → `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → **Enabled** → **Relaunch**.
3. Open the live app: **https://acirema792.github.io/overturn/**
4. Click the sample chip **"Employer plan, MRI denied as not medically necessary"**.
5. Click **Download Gemini Nano (once), then read**. Wait (several minutes, once). When the header pill
   turns green and says **"Gemini Nano ready on this device"**, you're set. Click **Start over**.

### A2. Run the benchmark with Nano (send the result to Claude)
1. Click the **Benchmark** tab → **Run with Gemini Nano (on this device)**. Wait until both tables appear.
2. Click **Download results (JSON)** → send the file to Claude (it fills the Nano row in the docs).
3. Leave this tab open: you'll film it in scene 9.

### A3. Screen and tools
- Close other tabs and apps; turn off notifications (Do Not Disturb).
- Browser window **maximised**, screen **1920×1080** if possible. Chrome zoom **110%** (Ctrl/Cmd + `+` once).
- Hide the bookmarks bar: Ctrl/Cmd + Shift + B.
- **DevTools network panel** (proof that on-device steps send nothing):
  F12 → **Network** tab → filter box: `generateContent` → dock it **bottom**, about 20% of the height
  (⋮ menu in DevTools → Dock side → bottom). Tick **Preserve log**. Click the 🚫 (clear) icon before scene 3.
- Recorder: **OBS Studio** (free) or Loom or Win+G / Cmd+Shift+5. **1080p, 30 fps**, microphone on.
- Cursor highlighting helps judges follow: OBS → add a "cursor highlight" filter, or on macOS use
  Accessibility → Pointer size slightly larger.
- Have this script open on a second screen or printed.

### A4. Do one full dry run without recording
The cloud step can be slow when Google's free tier is busy (the app retries, then falls back
honestly). Do a dry run first; if the cloud answers within ~10 s, record right away.

---

## Plan B: your computer can't run Gemini Nano

Many computers can't (for example Intel Macs: Chrome reports the hardware as not eligible). **Never fake the
Nano steps** (no simulated engine, no edited footage). Two honest options:

1. **Best:** record scenes 4 and 8d on an eligible computer for 15 minutes (an Apple Silicon Mac, or a
   Windows/Linux PC with a GPU with more than 4 GB of video memory, or 16 GB of RAM), then edit them in.
2. **Otherwise:** record the whole video on your computer and turn the missing model into a strength.
   Replace these scenes:

**Scene 4B · 0:35–0:55 · No Nano here, and nothing leaks anyway**
- *Highlight* the header pill **"Gemini Nano not available in this browser"**.
- **Click** the MRI sample → **Hide my details on this device**. *Highlight* the network panel: **no
  `generateContent` row**.
- Say: *"This laptop can't run Gemini Nano. In Firebase AI Logic 13.4, even ONLY_ON_DEVICE requests go to
  the cloud when the on-device model is missing, so Overturn checks first and fails closed: the raw letter
  never leaves. Code hides the identity here instead. On a laptop with Nano, Gemini Nano reads the letter
  first."*
- Optional, 3 seconds: show `src/ai/firebaseEngine.ts` around the `deviceAvailability() === 'unavailable'`
  check (the guard), or FEEDBACK.md section 1.

**Scene 8d:** skip it ("Stay offline" needs Nano). Use **Scene 8e (PDF and Español)** instead.

**Scene 9:** on the Benchmark tab click **Run rules only** (the Nano button is disabled without Nano) and say
*"rules only, the floor for computers without Nano"*.

Everything else (the deadline, what leaves the device, the cloud appeal, the ledger) works the same.

## Part B. The script, scene by scene

Times are targets. **Bold** = what you click. *Highlight* = point the cursor at it and pause 1–2 s
(or add a box/zoom in editing).

### Scene 1 · 0:00–0:12 · The problem (title card)
- Screen: the title card (Claude sends `title.mp4`), or the app home page.
- Say: *"Health insurers on HealthCare.gov denied nearly one in five in-network claims in 2024.
  Fewer than one in a hundred of those denials were appealed."*

### Scene 2 · 0:12–0:25 · Why people don't appeal
- Screen: app home, top of the page.
- *Highlight* the tagline **"Appeal a health insurance denial. Your identity stays on your device."**
- Say: *"Appeals are hard to write, the deadline is buried in the letter, and the easy helper, a
  cloud chatbot, asks for your name, member ID and diagnosis. Overturn works differently."*

### Scene 3 · 0:25–0:35 · Hybrid in one sentence
- *Highlight* the green pill **"Gemini Nano ready on this device"**, then the blue pill **"Cloud: gemini-…"**.
- Say: *"It's built on Firebase AI Logic hybrid inference: Gemini Nano in Chrome for everything that
  sees your identity, and the cloud only for the argument."*

### Scene 4 · 0:35–0:55 · Nano reads the letter on the device
- **Click** the sample chip **"Employer plan, MRI denied…"**. The letter fills the box.
- *Highlight* in the letter: **Maria L. Gonzalez**, **Member ID: NWH448812901**, the address.
- **Click** **Read it on this device**.
- *Highlight* the DevTools network panel: **no new `generateContent` row**.
- Say: *"This synthetic letter is full of identity. Gemini Nano reads it here, on my laptop, in
  ONLY_ON_DEVICE mode. Watch the network panel: nothing goes out."*

### Scene 5 · 0:55–1:10 · The deadline, computed by code
- Top of the review screen, *highlight* the **Appeal deadline** card:
  **"Mon, April 26, 2027 · 157 days left"** (days left depends on the day you record), then
  **"Your letter says you have 180 days to appeal"**, then **Add to calendar (.ics)**.
- Say: *"The appeal deadline is computed by code from the letter and the federal rules, not guessed
  by a model. One click puts it in my calendar."*

### Scene 6 · 1:10–1:35 · What leaves the device
- Scroll to **"Check what leaves your device"**.
- *Highlight* the left pane, **"Your letter (stays here)"**: the coloured highlights (green = Gemini Nano, yellow = rules).
- Move to the right pane, **"What the cloud model will see"** (blue): *highlight* `[PERSON_1]`, `[MEMBER_ID_1]`, `[DATE_1]`.
- *Highlight* the green badge **"Egress check passed: no known or detectable identifiers…"**.
- Say: *"Every name, ID, address and date becomes a placeholder. On the right is exactly what the
  cloud will see. And a plain-code gate blocks the request if anything identifying is still in it."*

### Scene 7 · 1:35–1:45 · You stay in control
- Click in **"…or type text to hide"**, type `Northwind`, press **Enter**.
- *Highlight*: the right pane updates; a chip **"Northwind" ✕** appears under **Hidden by you**.
- Say: *"I can hide anything else with one click, or by typing it."*

### Scene 8a · 1:45–1:55 · The privacy ledger
- Scroll to **Privacy ledger**. *Highlight* the rows **Find personal details** and **Read the denial**:
  **On this device · ONLY_ON_DEVICE · 0 bytes · 0 requests**.
- Say: *"The privacy ledger shows where every step ran. So far, zero bytes have left this device."*

### Scene 8b · 1:55–2:15 · The cloud writes the appeal
- Scroll up, **click** **Send the hidden version to Gemini**.
- *Highlight* DevTools: **one** `generateContent` request appears.
- On the result page, *highlight* in **Your appeal letter**: the real name and **Member ID: NWH448812901**.
- Say: *"Only the de-identified text goes to Gemini in the cloud, which writes the appeal. My real
  name and member ID are filled back in here, on the device. The cloud never sees the finished letter."*

### Scene 8c · 2:15–2:25 · What else you get
- Scroll the right column: **Strongest arguments**, **Gather this evidence** (tick one box), **Ask your doctor**.
- Scroll to the ledger, *highlight* the row **Write the appeal · Cloud · PREFER_IN_CLOUD · N bytes**.
- Say: *"Arguments, an evidence checklist and questions for my doctor, and the ledger shows the one
  cloud step with exactly how many bytes it sent."*

### Scene 8d (optional, strong) · 2:25–2:35 · Offline
- Turn **Wi-Fi off**. **Start a new letter** → sample → **Read it on this device** → **Stay offline: draft on this device**.
- Say: *"Offline, the same SDK drafts the appeal with Gemini Nano. Nothing leaves."*
- Turn Wi-Fi back on.

### Scene 8e (optional, use instead of 8d if short on time) · 10 s · PDF and Español
- **Start a new letter** → **Open a PDF** → pick a PDF of a sample letter (print one of the samples to PDF
  beforehand). The text appears in the box: *"A PDF is read right here with pdf.js; nothing is uploaded."*
- Click **Español** in the top bar: the whole screen switches. Say: *"And it works in Spanish, for the many
  patients who read Spanish first. The appeal letter stays in English for the insurer."*
- Click **English** again before scene 9.

### Scene 9 · 2:35–2:50 · The proof
- Switch to the **Benchmark** tab (already run in A2). *Highlight* the stat tiles: identifiers that
  would reach the cloud, clinical facts kept, deadlines correct.
- Say: *"On 24 synthetic denial letters with 129 planted identifiers, a chatbot would receive all of
  them. Here's what reaches the cloud with Overturn, and every deadline is right. You can run this
  benchmark in your own Chrome."*

### Scene 10 · 2:50–2:58 · Close
- End card (Claude sends `end.mp4`) or the app home with the URL visible.
- Say: *"Overturn. Your appeal. Your identity stays on your device."*

---

## Part C. If something goes wrong while recording

| What happens | What to do |
|---|---|
| The cloud step takes long (Google's free tier is busy) | Keep talking over it. If it takes over ~20 s, stop, wait a minute, re-record only scene 8b. |
| "Here is a template letter instead" appears | That's the honest fallback. Re-record scene 8b later; don't publish a take that hides it. |
| Nano pill isn't green | Redo A1. If Nano won't download on your machine, record with **Hide my details now (rules only)** and say "this machine has no Gemini Nano, so on-device rules are used". |
| You mis-click | Keep going; cut it in editing. |

## Part D. Editing (10 minutes, CapCut / Clipchamp / iMovie)

1. Put `title.mp4` first and `end.mp4` last (Claude sends both, 1080p).
2. Add **zoom-ins** (1.3–1.5×) on scenes 5, 6 and 8b; add a **box highlight** on the egress badge and the ledger rows.
3. Add **English captions** (auto-captions are fine; fix "Gemini Nano", "ONLY_ON_DEVICE", "Overturn").
4. Trim pauses so the total is **under 3:00**. Export **1080p MP4**.
5. **Never** show: the Firebase console, any key or token, real personal data.

## Part E. Upload

- YouTube → Create → Upload → **Visibility: Public**.
- Title: `Overturn: appeal a health insurance denial, your identity stays on your device (#BuildHybridAI)`
- Description: the first two lines of the README, plus the live URL and `https://github.com/acirema792/overturn`.
- Send Claude the YouTube link.
