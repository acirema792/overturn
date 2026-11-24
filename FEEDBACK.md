# Feedback on Firebase AI Logic hybrid inference (Web), from building Overturn

Firebase JS SDK 13.4.0, `firebase/ai`.

## 1. `ONLY_ON_DEVICE` can send the request to the cloud

When Chrome has no `LanguageModel` global (not Chrome, an older Chrome, or the Prompt API turned
off), `chromeAdapterFactory` returns `undefined`. `callCloudOrDevice` then starts with
`if (!chromeAdapter) return inCloudCall()`, so the request goes to the cloud **whatever the mode**.
`ONLY_ON_DEVICE` reads like a guarantee. For apps that pick it for privacy, as we do for a raw
medical letter, this is a silent leak.

- **What we do:** check `LanguageModel.availability()` ourselves before every on-device call, and
  reject any response whose `inferenceSource` isn't `on_device` (`src/ai/firebaseEngine.ts`).
- **Suggestion:** in `ONLY_ON_DEVICE` mode with no adapter, throw `API_NOT_ENABLED`, as `isAvailable()`
  already does when availability is `unavailable`.

## 2. `PREFER_ON_DEVICE` is the wrong default for sensitive input

It falls back to the cloud whenever the model isn't *already* downloaded, or the request isn't
supported on device. That's right for a notes summary and wrong for a medical letter. It would help
if the docs said in one line: "for data that must not leave the device, use `ONLY_ON_DEVICE`".

## 3. What made the design easy (confirmed on the live app, except the offline fallback)

- `inferenceSource` on every response makes an honest privacy ledger simple.
- One JSON Schema can drive both paths (`onDeviceParams.promptOptions.responseConstraint` and
  `generationConfig.responseJsonSchema`), so on-device and cloud return the same structure.
- `PREFER_IN_CLOUD` falls back to the on-device model on `FETCH_ERROR`, which gives an offline appeal
  draft with no extra code.

## 4. Smaller notes

- `OnDeviceParams.createOptions` types don't include `temperature`/`topK`; we pass them with a cast.
  It isn't clear whether web pages may set them, or whether Chrome ignores them there.
- From the App Check source: in debug mode the SDK exchanges the debug token and never asks the provider
  for a token, but `initializeAppCheck` still needs a provider (we pass a refusing `CustomProvider`).
  Confirmed against the live project (debug-token exchange returned 200). A documented "debug only" provider would save local-dev confusion.

## 5. From deploying it

- reCAPTCHA v3 ("Classic") is now deprecated in App Check, and a web app registered only for
  Enterprise answers v3 token exchanges with `400 App not registered`. A clearer error ("registered
  for reCAPTCHA Enterprise, not v3") would have saved us a debugging round.
- The free Gemini Developer API returned `500 "This model is currently experiencing high demand"`
  for most non-trivial requests during our tests (tiny prompts still succeeded). With default
  thinking an appeal took ~100 s; `thinkingConfig.thinkingLevel: LOW` brought it to ~4 s.
