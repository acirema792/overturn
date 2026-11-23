# Claims and their evidence

**REPRODUCIBLE:** a command in this repo produces it. **VERIFIED-LIVE:** observable on the
deployed app now. **PENDING:** will be verified on the deployment or with Gemini Nano before
submission, and isn't claimed until then. **NOT-CLAIMED:** we say this so nobody reads it in.

| Claim | Tier | Evidence |
|---|---|---|
| On held-out letters, rules alone leave 7/34 identifiers (all names) in the outgoing text; pasting into a chatbot sends 34/34 | REPRODUCIBLE | `npm run eval` → `eval_results/rules-only.md` |
| No ID, date, address, phone, email or SSN leaked on any of the 24 letters (rules only) | REPRODUCIBLE | same; per-case table |
| All clinical facts needed for the appeal survive redaction (80/80) | REPRODUCIBLE | same |
| Appeal deadline correct on 24/24 letters, including "won't guess" when unknown | REPRODUCIBLE | same; `src/core/deadline.ts` |
| Raw-letter steps never reach the cloud, even when Chrome lacks the on-device API | REPRODUCIBLE | `src/ai/firebaseEngine.test.ts` (SDK mocked) |
| The egress gate blocks identifiers reformatted with common separators (spaces, dots, slashes, dashes, underscores, commas), and parts of names (in capitals only next to the rest of the name or after a label for short or common surnames), and doesn't false-alarm on Overturn's own prompt wording for the tested letters (all 24 cases, plus names that are also common words) | REPRODUCIBLE | `src/core/round3.test.ts`, `src/core/verify4.test.ts`, `src/core/verify5.test.ts`, `src/pipeline.test.ts` |
| Each step reports where it ran (`inferenceSource`) and the Gemini requests the browser saw | PENDING | Visible in the ledger on the live app |
| Gemini Nano recall on the benchmark | PENDING | Benchmark tab in Chrome; results added to BENCHMARK-RESULTS.md with Chrome version |
| Cloud appeal quality | PENDING | Example output to be added from the live app |
| Overturn wins appeals | NOT-CLAIMED | We have no outcome data. It helps patients file a complete, on-time appeal. |
| Redaction is perfect | NOT-CLAIMED | It isn't; that's why the patient reviews the outgoing text. |
| Medical content stays on the device | NOT-CLAIMED | The diagnosis and service go to the cloud model, because the appeal is about them. Identity doesn't. |
| Legal advice | NOT-CLAIMED | Deadlines use federal minimums when the letter is silent; state rules may differ. |
