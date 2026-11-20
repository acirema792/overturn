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

## 3. What made the design easy (from the SDK API and source; to be confirmed on the live app)

- `inferenceSource` on every response makes an honest privacy ledger simple.
- One JSON Schema can drive both paths (`onDeviceParams.promptOptions.responseConstraint` and
  `generationConfig.responseJsonSchema`), so on-device and cloud return the same structure.
- `PREFER_IN_CLOUD` falls back to the on-device model on `FETCH_ERROR`, which gives an offline appeal
  draft with no extra code.

## 4. Smaller notes

- `OnDeviceParams.createOptions` types don't include `temperature`/`topK`; we pass them with a cast.
  It isn't clear whether web pages may set them, or whether Chrome ignores them there.
- App Check debug mode works with a placeholder provider, since the provider isn't asked for an
  attestation in debug mode. Documenting that would save local-dev confusion.
