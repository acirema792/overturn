# Demo video: what to show, second by second (target 2:45, hard limit 3:00)

The rules: ≤ 3 minutes (only the first 3 are judged), public on YouTube, English (or English
subtitles), showing the app **working on its platform** (Chrome on desktop).

## Before you press record (15 minutes, once)

1. **Chrome on desktop**, version 139 or newer (`chrome://settings/help`).
2. Open `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → **Enabled** → Relaunch.
3. Open the live app (Claude will send the URL). Click any sample → **Download Gemini Nano (once), then read**.
   Wait until the header pill says **"Gemini Nano ready on this device"**. (Do this before recording.)
4. Open the **Benchmark** tab → click **Run with Gemini Nano (on this device)** → wait until it finishes
   (a few minutes) → **Download results (JSON)** → send that file to Claude. Leave this tab open for scene 7.
5. Window: 1920×1080 if you can, browser zoom 110–125%, hide bookmarks bar (Ctrl/Cmd+Shift+B), close other tabs.
6. Open DevTools (F12) → **Network** tab → in the filter box type `googleapis` → dock it at the bottom,
   small. It proves on camera that on-device steps make **0** requests.
7. Recorder: OBS, Loom, or the OS recorder (Win+G / Cmd+Shift+5), 1080p, microphone on.
   No voice? Record silently; Claude adds English captions from this script.

## Shot list

| Time | On screen (exactly) | Say (or caption) |
|---|---|---|
| 0:00–0:12 | Title card (Claude sends it) or the app's home page | "Health insurers on HealthCare.gov denied nearly one in five in-network claims in 2024. Fewer than one in a hundred denials were appealed." |
| 0:12–0:25 | Home page. Point at the tagline. | "Appeals are hard to write, the deadline is buried in the letter, and the easy helper, a cloud chatbot, wants your name, member ID and diagnosis. Overturn is different." |
| 0:25–0:35 | Header pills: **Gemini Nano ready on this device**, **Cloud: …** | "It uses Firebase AI Logic hybrid inference: Gemini Nano in Chrome for everything that sees your identity, the cloud only for the argument." |
| 0:35–0:55 | Click sample **"Employer plan, MRI denied…"** → **Read it on this device**. Keep the Network panel visible: no new `googleapis` rows. | "Gemini Nano reads the letter here, on my laptop, in ONLY_ON_DEVICE mode. Watch the network panel: nothing goes out." |
| 0:55–1:10 | Review screen top: the **deadline card** (Mon, April 26, 2027 · 157 days left · Add to calendar) | "The appeal deadline is computed by code from the letter, with the federal rule behind it, not guessed by a model." |
| 1:10–1:35 | Scroll to **Check what leaves your device**. Left: highlighted letter. Right: blue pane with `[PERSON_1]`, `[MEMBER_ID_1]`. Hover a highlight. Point at the green **Egress check passed**. | "Every name, ID, address and date becomes a placeholder. On the right is exactly what the cloud will see. A code gate blocks the request if anything identifying is still in it." |
| 1:35–1:45 | Type `Northwind` in **…or type text to hide** → Enter. The right pane updates. | "I can hide anything else, with one click or by typing." |
| 1:45–1:55 | Scroll to the **Privacy ledger**: two rows **On this device · ONLY_ON_DEVICE · 0 bytes · 0 requests** | "The privacy ledger records where every step ran. So far: zero bytes left this device." |
| 1:55–2:15 | Click **Send the hidden version to Gemini**. Network panel shows **one** `googleapis` request. Result page: the letter with the real name and member ID. | "Only the de-identified text goes to Gemini in the cloud, which writes the appeal. My real name and member ID are filled back in here, on the device." |
| 2:15–2:25 | Scroll: arguments, evidence checklist, questions for the doctor; the ledger row **Cloud · PREFER_IN_CLOUD · N bytes** | "Arguments, an evidence checklist and questions for my doctor come with it, and the ledger shows the one cloud step." |
| 2:25–2:35 | (Optional, strong) Turn Wi-Fi off → **Start over** → sample → read → **Stay offline: draft on this device** | "Offline, the same SDK drafts the appeal with Gemini Nano. Nothing leaves." |
| 2:35–2:50 | **Benchmark** tab (already run): the stat tiles | "On 24 synthetic letters with 129 planted identifiers, a chatbot would receive all of them. Here's what reaches the cloud with Overturn, and every deadline is right. You can run this benchmark in your own Chrome." |
| 2:50–2:58 | End card / URL | "Overturn. Your appeal; your identity stays on your device." |

## Rules for a clean take

- Use only the **synthetic sample letters** (never a real letter or real personal data on screen).
- If the cloud step is slow, keep talking; if it fails, say "this run uses the template letter" and continue (the app never fakes it).
- Don't show the Firebase console, keys or tokens.
- Stop under **3:00**. Upload to YouTube as **Public** (the rules require the video to be publicly visible).
- Title: `Overturn: appeal a health insurance denial, your identity stays on your device (#BuildHybridAI)`.

## If you'd rather not record yourself

Claude's recorder (`npm run demo -- <url> <out-dir>`) makes a 1080p video with burned-in English
captions from the live site, but it runs in a browser **without** Gemini Nano, so it shows the
rules path, not Nano. Best result: your 0:25–1:55 Nano segment + Claude's captions and cards.
