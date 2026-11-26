# Review Overturn in five minutes

No account, key or install needed. Desktop Chrome gives the full on-device path. Any other browser
still shows the whole flow, with the rules as the on-device layer.

| Minute | Do this | Watch for |
|---|---|---|
| 0:00 | Open the live app (link in README). | Header pills: **Gemini Nano ready / downloadable / not available**, the cloud model, and App Check mode (footer). |
| 0:30 | Click the sample **"Employer plan, MRI denied…"**, then **Read it on this device** (if Chrome hasn't downloaded Gemini Nano yet, choose **Download Gemini Nano (once), then read**, or **rules only**). | The download takes a few minutes, once, with progress shown. The privacy ledger shows **Find personal details** and **Read the denial**: *On this device*, `ONLY_ON_DEVICE`, **0 bytes, 0 Gemini requests seen**. |
| 1:30 | Look at **Check what leaves your device**. | Left: your letter, highlighted by who found each detail (Gemini Nano / rules / you). Right: exactly what the cloud would get, with `[PERSON_1]`, `[MEMBER_ID_1]`… The **egress check** is green. The **deadline card** reads Mon, April 26, 2027, from the letter's 180 days, computed by code. |
| 2:15 | Select any word in the left pane, then click **Hide**. Then click its ✕ to undo. | The outgoing text and the gate update instantly. |
| 2:45 | Click **Send the hidden version to Gemini**. | The ledger adds **Write the appeal**: *Cloud*, `PREFER_IN_CLOUD`, N bytes. Your letter has the real name and member ID again, put back on the device. |
| 3:30 | Optional: turn Wi-Fi off and click **Stay offline: draft on this device**. | The same SDK drafts with Gemini Nano (`ONLY_ON_DEVICE`). |
| 4:00 | Open **Benchmark** and click **Run rules only** (or **Run with Gemini Nano**). | 24 synthetic letters scored in your browser: identifiers leaked, facts kept, deadlines right. |

## Where each claim lives in the code

| Claim | Code |
|---|---|
| Raw letter and photo only ever go to the on-device model | `src/ai/firebaseEngine.ts`: `onDevice()` uses `InferenceMode.ONLY_ON_DEVICE`, checks availability **before** calling the SDK (see FEEDBACK.md for why), and refuses any response whose `inferenceSource` isn't `on_device`. |
| Cloud gets de-identified text only | `src/ai/firebaseEngine.ts` `draftAppeal()` runs `checkEgress()` before the request; `src/core/egressGate.ts`. |
| Identifiers are replaced everywhere, consistently | `src/core/redact.ts` (vault, placeholders, name fragments share the full name's placeholder), `src/core/detectors.ts` (14 kinds). |
| Deadlines are computed, not generated | `src/core/deadline.ts` (`computeDeadline`, CFR citations, "unknown" when unsure); `src/pipeline.ts` `mergeFacts()`: code wins, the model fills gaps. |
| Real details are restored only on the device | `src/core/redact.ts` `rehydrate()`, called in `src/components/AppealFlow.tsx`. |
| The ledger tells the truth | `src/ai/engine.ts` `watchGeminiRequests()` (Resource Timing); `inferenceSource` per response. |
| UI tested | `npm run e2e`: 9 Playwright checks on the simulated engine (flow, hide/undo, no-Nano path, cancel, PDF read with no off-origin request, Español with an English letter, 390px). |
| PDF read on the device | `src/pdf/readPdf.ts`: pdf.js and its worker are bundled and loaded only when a PDF is opened; the file is read from memory. The e2e check fails if any request leaves the origin while a PDF is read. |
| Spanish UI | `src/i18n.ts`: the type requires a Spanish text for every key. The cloud prompt asks for the explanation in Spanish and the letter in English; `src/i18n.test.ts` checks the gate still passes for all 24 letters with the Spanish prompt. |
| Tested | `npm test`: 272 tests, including SDK-mocked engine tests (`src/ai/firebaseEngine.test.ts`) and adversarial inputs (`src/core/adversarial.test.ts`). |

More: [CLAIMS.md](CLAIMS.md) (every claim with its evidence tier),
[BENCHMARK-RESULTS.md](BENCHMARK-RESULTS.md), [EVIDENCE.md](EVIDENCE.md) (judging criteria → evidence),
[FEEDBACK.md](FEEDBACK.md) (what we learned about the SDK).
