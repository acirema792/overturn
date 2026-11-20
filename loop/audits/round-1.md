# Round 1 audit: Overturn (#BuildHybridAI 2026, Web/Chrome)

Auditor: independent, skeptical; had not seen the build. Date: 2026-11-20. No Firebase project and no Gemini Nano
in this container. Evidence: source reading (app + installed `firebase@13.4.0` / `@firebase/ai@3.1.0`),
`npm test` (22/22), `npm run build` (OK), `npm run eval` (reproduces the published numbers exactly; only `ms` differ),
`npx oxlint` (exit 1), adversarial scratch scripts, and Playwright against `vite preview` in `?engine=sim`
(desktop 1280, mobile 390, `device=unavailable`). Scratch files live in the session scratchpad, not the repo.
`npm run eval` rewrites the protected `eval_results/**`; I restored the original files byte-for-byte.

## Scores

| Criterion | Score | Evidence (file:line) |
|---|---|---|
| A. Technological Implementation | **6.5** | + Mode chosen per step with a stated reason: `ONLY_ON_DEVICE` for raw text/photo (src/ai/firebaseEngine.ts:124-138), `PREFER_IN_CLOUD` for the redacted appeal (:218); `responseConstraint` on device and `responseMimeType`+`responseJsonSchema` in the cloud match the SDK typings (ai-public.d.ts:1041, :1816); `inferenceSource` read per response (:173, :236); gate enforced inside the engine (:215-216); Remote Config + App Check wired (:114-150). − Fail-closed depends on the UI, not the engine: the SDK routes ANY mode to the cloud when `window.LanguageModel` is missing (node_modules/@firebase/ai/dist/esm/index.esm.js:2562-2567), and the `inferenceSource` check runs after the request (firebaseEngine.ts:172-177) (F8). App Check is silently skipped without a reCAPTCHA key (:115-120) (F9). `temperature/topK` forced through `as never` (:126, :230). Real bugs in the deterministic core (F1-F6). Never run against real Nano or cloud: no recorded run exists. Lint fails (F11). |
| B. Design | **7.0** | + Clean, coherent three-step flow; side-by-side "your letter / what the cloud sees" with colour-coded sources; deadline card with .ics; privacy ledger; template fallback; no horizontal scroll at 390px on any route or stage (Playwright: scrollWidth 390); no console errors. − Gate-blocked state is a dead end: count only, no list, no undo (F4). On the no-Nano path the template letter names the wrong member and addressee (F6). Photo ledger row disappears (F10). No hosted app, screenshots or video yet. |
| C. Potential Impact | **6.5** | + Specific audience and a sourced problem statement (README.md:17-19, KFF: 19% denied, <1% appealed); identity/medicine split is the real privacy barrier; works without Nano. − The two things a patient relies on are wrong on ordinary inputs: deadline (F1-F3, one case 5 days LATE) and rules-only redaction of all-caps EOB names, accented names and spaced IDs (F5). Held-out set is 8 letters. No user or advocate validation. |
| D. Quality of the Idea | **7.5** | + Non-obvious, well-argued use of hybrid inference: on-device reads identity, cloud writes from placeholders, local rehydration, deterministic egress gate, "don't guess" deadline; correct citations (deadline.ts:84-105: 29 CFR 2560.503-1(h)(3)(i), 45 CFR 147.136(b), 42 CFR 422.582(b) 65 days, 42 CFR 438.402(c)(2)(ii) 60 days). − Plan-type heuristic is naive and code overrides Nano (deadline.ts:265-269, pipeline.ts:79). "Safe Harbor" framing (detectors.ts:1-3) is partial: ages >89, many date formats and non-ASCII names are not covered. |
| **OVERALL (mean A-D)** | **6.9** | |

Reported separately (not in OVERALL):

| Extra | Score | Why |
|---|---|---|
| Security / Privacy | 6 | Good architecture (gate in engine, vault local, no secrets in repo, `.env*` ignored, CI does not pass the debug token). Weak rules-only coverage (F5), latent cloud path (F8), App Check optional (F9), ledger overclaims (F10). |
| Testing | 5 | 22 unit/pipeline tests and a reproducible eval harness with a held-out set. Nothing tests FirebaseEngine (mode, guard, gate-before-send) or the UI; no adversarial deadline/redaction tests (F14). |
| Honesty of claims | 5 | Badge numbers match `npm run eval` exactly (22 tests, 8/8 held-out deadlines, 23+57=80 facts). But the README links two files that don't exist and points to "the Gemini Nano runs" that were never recorded (F7). "Nothing has left this device" and "never from a model" overstate (F10). |
| Stage-1 readiness (10 = no risk) | 4 | LICENSE (Apache-2.0) and Firebase AI Logic calls at runtime are in place. Missing so far: public repo (no git remote), hosted URL, ≤3-min YouTube video (README.md:11). App Check can silently be off in a build (F9). All fixable before Nov 30. |

## Findings (ordered by severity, then expected score gain per changed line)

**F1 (S3) Plan-type rule makes Medicaid deadlines 5 days late and gives ERISA patients false Medicare instructions.**
Files: src/core/deadline.ts:265-269 (+ src/pipeline.ts:79, where code overrides Nano). Protected: no, but changes eval
inputs, so re-run eval; any change to published numbers goes to Escalations.
Evidence (`guessPlanType`): any `\bmedicare\b`, "reconsideration" or the substring "part c" returns
`medicare_advantage`, checked before Medicaid and ERISA. Reproduced: a Medicaid letter with "If you also have
Medicare…" gives a 65-day deadline (2026-05-07); the legal minimum is 60 days, so the patient is told 5 days too many.
ERISA letters that mention "peer-to-peer reconsideration" or "Medicare LCD criteria", and "part cannot be covered",
get 65 days and "the case is forwarded automatically to an Independent Review Entity" (deadline.ts:113). That is false
for ERISA, and a patient may wait for an escalation that never happens. Nano cannot correct it ("Code wins").
Minimal fix: check Medicaid and employer signals first; match MA only on `medicare advantage|\bpart c\b|medicare health plan|independent review entity`;
drop bare `reconsideration`/`medicare`. When signals conflict, use the shortest window. Add 4 regression tests.

**F8 (S2) Fail-closed rests on the UI. The SDK would upload the raw letter under ONLY_ON_DEVICE when Chrome's Prompt API is absent.**
Files: src/ai/firebaseEngine.ts:170-177 (and :218 for the `preferDevice` path). Protected: no.
Evidence: `chromeAdapterFactory` returns `undefined` when `window.LanguageModel` is missing (index.esm.js:1224-1231).
`callCloudOrDevice` then runs `inCloudCall()` whatever the mode (index.esm.js:2562-2567). `onDevice()` checks
`inferenceSource` only after the request returned, so the comment "ONLY_ON_DEVICE should make this impossible" is
wrong for this SDK version. Today only `deviceOk` in AppealFlow.tsx:74 and the disabled Benchmark button keep the raw
letter local. The README's "we read the SDK source … fail closed" (README.md:29) is therefore only true thanks to the UI.
Minimal fix (about 2 lines): at the top of `onDevice` and before the ONLY_ON_DEVICE draft, add
`if (typeof LanguageModel === 'undefined') throw new Error('Gemini Nano is not available; nothing was sent.')`.
Add a unit test with a stubbed `getGenerativeModel`.

**F7 (S2) README promises judge docs and Gemini Nano results that don't exist.**
Files: README.md:11-12, :78-79. Protected: no; it is a claim change, so list it under Escalations.
Evidence: `ls JUDGES.md BENCHMARK-RESULTS.md` gives "No such file". The README says "Full tables, the tuning set and the
Gemini Nano runs: BENCHMARK-RESULTS.md". No Nano result exists anywhere in the repo (eval_results/ is rules-only).
Live app and video are "_added at…_".
Minimal fix: add JUDGES.md (5-minute path: hosted URL, `?engine=sim`, what to click, what to look for in the ledger)
and BENCHMARK-RESULTS.md (copy of eval_results/rules-only.md plus the in-app Nano JSON once recorded on real Chrome,
with Chrome version and hardware). Until then, drop the Nano clause.

**F4 (S2) Egress-gate false positives cause an unrecoverable block, and the blocked UI says neither what nor how to undo.**
Files: src/core/egressGate.ts:17, :34-44; src/components/AppealFlow.tsx:111-117, :289-293. Protected: no.
Evidence: `squash()` removes spaces, so vault values match across word boundaries in the fixed prompt template.
Hiding the first name "Pat" (or Nano returning "Pat" from "Dear Pat,") gives
`gate allowed: false [{"reason":"vault-value","excerpt":"P•t"}]`, matched inside "patient". The same happens with
Sam, Tom, Don, Eli, Ana, Eva, Art, Val, Les, Cal, Ned, Ren, Sal, Lin, Ari and Ted on case C01. In the UI (Playwright),
hiding the word "appeal" gives "Egress check blocked: 1 identifier(s) still present", Send disabled, no list, and no
way to un-hide except Start over. Also, `hide()` always labels the selection PERSON, even for an ID.
Minimal fix: for values containing letters, match on word boundaries in whitespace-normalised text. Keep squash only
for digit-bearing IDs. Render `gate.findings` (already masked) and give user-added hides a remove chip.

**F2 (S2) Notice-date parser takes a date of birth or date of service, or matches inside words, giving a deadline decades in the past.**
Files: src/core/deadline.ts:248-250. Protected: no (re-run eval).
Evidence: "Date of birth 04/12/1961" (no colon) gives notice 1961-04-12 and deadline 1961-10-09, so the UI shows
"This date has passed: call your plan today". "Date of Service 02/10/2026" gives the service date. "Records
presented 01/15/2026" matches `sent` inside "presented" (no `\b`), so it becomes the notice date.
Minimal fix: wrap the labels in `\b`, add a negative lookahead for `of (birth|service)|DOB|DOS`, and only use
`^\s*date` when followed by `[:\-]`.

**F3 (S2) The window parser reads the insurer's decision time as the patient's appeal window and attributes it to the letter.**
Files: src/core/deadline.ts:194-196. Protected: no (re-run eval).
Evidence: "We will decide within 30 days of receiving your appeal. You have 180 days from the date of this notice to
file an appeal." gives window 30, basis `stated-in-letter`, and "Your letter says you have 30 days to appeal". This
sentence is standard in ERISA and Medicaid notices.
Minimal fix: skip matches preceded within ~40 chars by `we (will|must) (decide|respond|notify|make)`, or prefer
matches with `you (have|may|must)|file|submit`. Add the test sentence.

**F6 (S2) No-Nano template letter names the wrong member and addressee.**
Files: src/core/detectors.ts:43-49, :125 (PERSON label rule); src/core/template.ts:300; src/pipeline.ts:81. Protected: no.
Evidence (rules-only, which is what most judges get): C08 gives "Statement date: Oct 31, 2026 / … / Member: Account No /
… / Sincerely, Account No". C16 gives "Member: Benefits Trust", signed "Benefits Trust", because "Employee Benefits
Trust" and "Patient Account No." are captured as person names. The insurer fallback is the raw first line: C07 "From: …
Member Services", C14 truncated mid-word ("…Determ").
Minimal fix: add `account, no, number, benefits, trust, services` to `NOT_A_NAME`. In the template, use `____` for
member/insurer when no role or insurer came from Nano, rather than guessing.

**F9 (S2) App Check can be silently off, and the debug token is ignored without a site key.**
Files: src/ai/firebaseEngine.ts:114-120. Protected: no.
Evidence: `initializeAppCheck` runs only if a reCAPTCHA key is set. With only `VITE_APPCHECK_DEBUG=true` (the README's
local instructions), no App Check instance exists and no debug token is printed. A deployed build missing the variable
runs without App Check and nothing on screen says so. App Check is a Stage-1 requirement.
Minimal fix: if no provider, return `{engine:null, reason:'App Check is not configured'}` from `chooseEngine` (or show a
banner). When debug is set, initialise with the configured provider. Show "App Check: on" in the status pills.

**F5 (S2) Rules-only redaction (the floor for every judge without Nano) misses common real-world formats, and so do the gate and the "possible names" helper.**
Files: src/core/detectors.ts:90-99, :125-146; src/core/suspects.ts:287, :304. Protected: no, but it changes published
leak numbers, so Escalations.
Evidence (each leaked verbatim; `checkEgress` findings `[]`):
- `MEMBER NAME: JOHN Q PUBLIC` and `MEMBER ID: W1234 5678 90` (all-caps EOB style)
- `Patient: Gonzalez, Maria`
- `Dear José Ñúñez-García,` (ASCII-only `[A-Z][a-z]`)
- `Dear Ewan McGregor,` gives `[PERSON_1]Gregor`; `Dr. J. R. Okafor` gives `[PERSON_1]. R. Okafor`
- `Member ID: XJH 448 812 901`; `Member ID: 72148` (labelled ID rejected as a CPT look-alike)
- `12.04.1961`, `1961/04/12`; `SSN 123 45 6789`; `Dear Okonkwo,`; `age 93` (Safe Harbor requires >89 to be grouped)

`findSuspects` uses the same ASCII title-case pattern, so it flags none of these either.
Minimal fix: use the `u` flag with `\p{Lu}\p{Ll}` in the name rules and suspects; accept ALL-CAPS after explicit name
labels; allow spaces inside labelled IDs; skip `looksLikeCode` when the label is member/subscriber/ID; add dotted and
`yyyy/mm/dd` dates and spaced SSN. Add each line above as a test.

**F11 (S1) `npm run lint` fails.**
Files: src/components/AppealFlow.tsx:135, :142. Protected: no.
Evidence: `npx oxlint` exits 1 with "React Hook "useTemplate" is called in function "draft"" (it is not a hook).
Minimal fix: rename it to `applyTemplate` (3 occurrences).

**F12 (S1) "Days left" uses the UTC date, so US users see one fewer day in the evening and "date has passed" on the evening of the deadline day.**
Files: src/core/deadline.ts:126, :131. Protected: no.
Evidence: `toISO(new Date())` is `toISOString().slice(0,10)` (UTC). At 5 pm PT or later the UTC date is tomorrow.
Minimal fix: build today's ISO date from `getFullYear/getMonth/getDate` (local time).

**F10 (S1) The privacy ledger and the UI overstate in a few places.**
Files: src/components/Ledger.tsx:242-243; src/ai/engine.ts:316; src/components/AppealFlow.tsx:71, :101, :443; src/pipeline.ts:88-91; README.md:31. Protected: no.
Evidence:
- "Nothing has left this device" while Remote Config, Installations and App Check/reCAPTCHA requests go out on load
  (only Gemini hosts are counted). No letter text, but the claim is absolute.
- The on-device "Read the photo" ledger row is set at :101 and wiped by `read()` at :71, so the photo step never
  appears in the ledger.
- "Computed by code … not by a model" and "never from a model" are shown even when the notice date or window came from
  Nano (`noticeDateSource: 'Gemini Nano'`).
- After a `PREFER_IN_CLOUD` server error and fallback to Nano, `bytesOut` is 0 although the prompt reached the server.

Minimal fix: say "No letter text has left this device"; append to the ledger instead of resetting on read; show the
source in the deadline card when it was Nano; report gate bytes when `requests > 0`.

**F13 (S1) `npm run eval` rewrites the protected, published results on every run (CI included).**
Files: scripts/eval.ts:6, :15-18. **Protected path: yes, escalate.**
Evidence: two runs differ only in `ms` and `ranAt`, which dirties the tree and makes "recorded results" unstable.
Minimal fix: write to `eval_results/` only with `--record`; otherwise print, or compare against the committed file and
fail on metric drift.

**F14 (S1) Test gaps where the claims live.**
Files: src/core/core.test.ts, src/pipeline.test.ts (new tests only; never loosen existing ones). Protected: no.
Evidence: no test touches `FirebaseEngine` (mode per step, the `inferenceSource` guard, gate-before-send, the F8
guard), no UI test is committed, and none of F1-F6's inputs are tested. The held-out set is 8 letters.
Minimal fix: vitest with `vi.mock('firebase/ai')` asserting `mode` per call and that `generateContent` is never called
when the gate blocks or `LanguageModel` is absent. Commit the Playwright smoke test (sim mode, 390px).

## Escalations (for the person)
- F1, F2, F3, F5: fixing them may change `npm run eval` numbers that the README badges publish. They must be re-run and
  the badges updated deliberately. Expected values in protected `src/data/*` must not change.
- F7: removes or changes a published claim (Gemini Nano runs).
- F13: touches protected `scripts/eval.ts`.

## Only verifiable on a live deployment (real Gemini Nano, real Firebase project)
1. Chrome accepts `temperature`/`topK` in `LanguageModel.create()` for a web page. They are not in the SDK's
   `LanguageModelCreateOptions` type and are forced with `as never` (firebaseEngine.ts:126, :230).
2. Nano returns schema-valid JSON for ENTITY/FACTS/APPEAL under `responseConstraint`, and the people/role labels are
   good enough for `patientPlaceholder`.
3. `initializeDeviceModel` still has transient user activation after two awaited `availability()` calls
   (AppealFlow.tsx:77, firebaseEngine.ts:162-167); the download progress UI behaves over a multi-GB download.
4. Photo path: `prepareDevice` initialises only the text models, and availability is checked with text-only I/O
   (firebaseEngine.ts:154-156) while `imageModel` needs image input. Does the multimodal model load, or does create() fail?
5. App Check with reCAPTCHA Enterprise on the deployed domain, with enforcement on for AI Logic.
6. Remote Config fetch/activate on the deployed origin, and that `cloud_model` ("gemini-3.5-flash-lite", the SDK default) is served.
7. `PREFER_IN_CLOUD` to Nano fallback when offline, and that `inferenceSource` shows `on_device` in the ledger.
8. Resource Timing records the firebasevertexai requests, so "Gemini requests seen" is non-zero for the cloud step.
9. The cloud model uses only issued placeholders and rehydration leaves none.
10. Select-to-hide on touch devices (handlers are `onMouseUp`/`onKeyUp` only, AppealFlow.tsx:303-304).
11. GitHub Pages deploy with `base: './'` and repository variables set.

## Gaps versus strong public entries
Strong Devpost/Google AI entries usually ship:
- A hosted URL that works without Nano.
- A ≤3-minute video showing on-device inference with the DevTools Network panel open as proof.
- A JUDGES.md with a 5-minute path.
- Measured results on real hardware, with Chrome version and device, for both paths (Nano vs rules-only, latency, bytes).
- README screenshots or GIF and an architecture diagram.
- A Devpost write-up that maps each Firebase product to a job.

Overturn has the best raw material for this (ledger, benchmark page, held-out set), but today has none of the
deploy/video/judge-doc/Nano-measurement layer (F7). It also has no screenshots in the README, and no committed
e2e test to show the flow works.

## Appendix: working notes written during the audit

### Baseline checks (reproduced)
- `npm test`: 22/22 pass. `npm run build`: OK (419 kB JS, 132 kB gz). `npm run eval`: numbers identical to
  `eval_results/rules-only.md` (only `ms` differ). Note: `npm run eval` rewrites the protected `eval_results/**`
  (timestamps/ms); I restored the original files afterwards.
- `npx oxlint` exits 1: `src/components/AppealFlow.tsx:135` rules-of-hooks error (`useTemplate` is not a hook).

### Raw notes (verified with scratch scripts in the scratchpad, outside the repo)
- README links `JUDGES.md` and `BENCHMARK-RESULTS.md`: neither file exists. No Gemini Nano run recorded anywhere.
- SDK: `callCloudOrDevice` (node_modules/@firebase/ai/dist/esm/index.esm.js:2561-2567) sends the request to the
  CLOUD when there is no Chrome adapter (no `window.LanguageModel`), whatever the mode, ONLY_ON_DEVICE included.
  The app only avoids this because AppealFlow gates on `deviceOk`. firebaseEngine.ts:174 checks `inferenceSource`
  only AFTER the request was made.
- Rules-only leaks: ALL-CAPS names, `Last, First`, accented names (José Ñúñez-García), "McGregor" -> "[PERSON_1]Gregor",
  "Dr. J. R. Okafor" -> Okafor leaks, spaced IDs (`XJH 448 812 901`, `W1234 5678 90`), labelled member IDs that look
  like CPT/ICD (`Member ID: 72148`), dotted/slashed DOBs (12.04.1961, 1961/04/12), `SSN 123 45 6789`, bare "Dear Okonkwo,".
  The egress gate flagged none of them (it reuses the same detectors).
- Deadline: `Date of birth 04/12/1961` (no colon) is taken as the notice date -> deadline 1961-10-09 ("This date has
  passed"). "We will decide within 30 days of receiving your appeal" -> window 30 reported as "Your letter says you have
  30 days". guessPlanType: any "Medicare", "reconsideration" or "part c" -> Medicare Advantage, checked BEFORE Medicaid/ERISA:
  a Medicaid letter mentioning Medicare gets 65 days (legal minimum 60: deadline 5 days LATE) and wrong external-review text.
- Egress gate false positive: a vault value squashed to 3+ chars is matched across word boundaries in the fixed prompt.
  Hiding "Pat" (or Nano returning "Pat") -> blocked forever by "patient"; also Sam, Tom, Don, Eli, Ana, Eva, Art, Val, Les...

OVERALL_SCORE=6.9
