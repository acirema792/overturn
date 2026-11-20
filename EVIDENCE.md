# Judging criteria → evidence

| Criterion (equal weight) | What Overturn does | Where to look |
|---|---|---|
| **Technological Implementation**: how well built; how effectively it uses Firebase AI Logic hybrid inference | Three inference modes, each chosen for a stated reason (`ONLY_ON_DEVICE` for raw text and photos, `PREFER_IN_CLOUD` for the redacted appeal, `ONLY_ON_DEVICE` for "stay offline"). One JSON Schema drives both paths. `inferenceSource` is logged on every response. An availability guard closes an SDK gap where `ONLY_ON_DEVICE` reaches the cloud. App Check and Remote Config. A deterministic core: 13 identifier detectors, a redaction vault, an egress gate, deadline rules. 61 tests, including an SDK-mocked engine. | `src/ai/firebaseEngine.ts`, `src/core/*`, `FEEDBACK.md`, `npm test` |
| **Design**: a complete, coherent product | Three steps: paste/photo → "check what leaves" (side-by-side, select-to-hide, undo, possible-name hints, a live egress check) → appeal (editable letter, copy/print/download, evidence checklist, questions for the doctor, calendar file for the deadline). A privacy ledger on every screen. Works without Nano (rules + review) and without a network (Nano draft, or a template letter). Mobile layout. Dark mode. | Live app; `src/components/*`; `JUDGES.md` |
| **Potential Impact**: a credible, specific case for a real problem and audience | US patients with a denied claim. 19% of in-network HealthCare.gov claims were denied in 2024, and under 1% of denials were appealed (KFF, Mar 2026). Overturn removes the three blockers we could address: not knowing the deadline (computed, cited, with a calendar file), not knowing what to argue (category playbooks plus a cloud-written argument), and not wanting to hand identity to a chatbot (on-device de-identification). | `README.md` "Why"; `src/core/categories.ts`; `src/core/deadline.ts` |
| **Quality of the Idea**: creative, non-obvious use of AI Logic; understanding of the problem | The hybrid split follows the data, not the device: identity stays local, medicine goes to the cloud. Placeholders keep who-is-who for the cloud model (name fragments share the full name's placeholder). Deadlines follow ERISA, ACA, Medicare Advantage and Medicaid rules with CFR citations, never model output. "Inconclusive" beats a guess. | `README.md` "How it works"; `src/core/redact.ts`; `src/core/deadline.ts` |

| Required deliverable | Status |
|---|---|
| Firebase AI Logic imported and called at runtime | `src/ai/firebaseEngine.ts` (`getAI`, `getGenerativeModel`, `generateContent`, `initializeDeviceModel`) |
| App Check | `src/ai/firebaseEngine.ts` (reCAPTCHA Enterprise / v3 / debug token; mode shown in the app footer) |
| Public repo with an OSS license | Apache-2.0 `LICENSE` (repo goes public before submission) |
| Hosted URL | GitHub Pages via `.github/workflows/deploy.yml` (pending Firebase project) |
| Demo video ≤3 min | pending |
