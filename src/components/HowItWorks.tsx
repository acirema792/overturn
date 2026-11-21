export function HowItWorks() {
  return (
    <div className="flow">
      <section className="card">
        <h2>How Overturn splits the work between your device and the cloud</h2>
        <p className="lede">
          A denial letter is full of identity (your name, member ID, address, date of birth) and full of medicine (the diagnosis, the
          procedure, the reason). The appeal needs the medicine, not the identity. So Overturn reads the letter on your device, removes the
          identity there, and only then asks the cloud for help with the hard part: the argument.
        </p>
        <div className="how">
          <div className="how-step device">
            <div className="how-tag">On this device · ONLY_ON_DEVICE</div>
            <h3>1. Read</h3>
            <p>
              Gemini Nano, running in Chrome through Firebase AI Logic, lists every person, number and address in the letter and reads the
              denial reason. We use <code>ONLY_ON_DEVICE</code>, never <code>PREFER_ON_DEVICE</code>: if Nano isn't ready, the request
              fails instead of quietly uploading the raw letter.
            </p>
          </div>
          <div className="how-step code">
            <div className="how-tag">On this device · plain code</div>
            <h3>2. Hide and decide</h3>
            <p>
              Code replaces each identifier with a placeholder like <span className="ph">[PERSON_1]</span>, adds rule-based checks for 14 kinds of
              identifier, and computes the appeal deadline from the letter and federal rules. An <strong>egress gate</strong> blocks the
              request if any known identifier is still in the outgoing text. You see that text and approve it.
            </p>
          </div>
          <div className="how-step cloud">
            <div className="how-tag">Cloud · PREFER_IN_CLOUD</div>
            <h3>3. Argue</h3>
            <p>
              Gemini in the cloud writes the explanation, the strongest arguments and the appeal letter from the de-identified text only. If
              the network drops, the SDK falls back to Gemini Nano, so you still get a draft offline.
            </p>
          </div>
          <div className="how-step device">
            <div className="how-tag">On this device · plain code</div>
            <h3>4. Put it back</h3>
            <p>
              Your real name, IDs and dates are filled back into the letter on your device. The cloud never sees the finished letter.
            </p>
          </div>
        </div>
      </section>
      <section className="card">
        <h3>Firebase in Overturn</h3>
        <table>
          <tbody>
            <tr>
              <td>Firebase AI Logic (hybrid)</td>
              <td>Two inference modes, each where it fits: ONLY_ON_DEVICE for the raw letter, photos and "stay offline"; PREFER_IN_CLOUD for the redacted appeal. Every response's <code>inferenceSource</code> is logged in the privacy ledger.</td>
            </tr>
            <tr>
              <td>App Check</td>
              <td>Required by AI Logic: only this web app can call Gemini through the project (reCAPTCHA in production).</td>
            </tr>
            <tr>
              <td>Remote Config</td>
              <td>Switches the cloud model and the appeal letter's length without a new release.</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section className="card">
        <h3>Use Gemini Nano in Chrome</h3>
        <ol>
          <li>Use Chrome on desktop, version 139 or newer, with enough free disk space for the model (see Chrome's Prompt API requirements).</li>
          <li>
            Open <code>chrome://flags/#prompt-api-for-gemini-nano-multimodal-input</code>, set it to <em>Enabled</em>, and restart Chrome (needed
            for photos).
          </li>
          <li>The first time you click "Read it on this device", Chrome downloads the model. That can take a few minutes, once.</li>
        </ol>
        <p className="muted small">
          Without Gemini Nano, Overturn still works: rules hide what they can find, you review and hide the rest, and the cloud writes the
          appeal from the result.
        </p>
      </section>
      <section className="card small muted">
        <h3>Honest limits</h3>
        <ul>
          <li>No detector is perfect. Rules alone missed 7 of 34 identifiers on our held-out letters, all names in unusual places. That is why Gemini Nano reads first, and why you approve the outgoing text.</li>
          <li>The medical content (diagnosis, procedure) does go to the cloud model, because the appeal is about it. Identity does not.</li>
          <li>Deadlines use federal minimums when the letter doesn't state one. State rules and plan documents can differ. Always confirm with your plan.</li>
          <li>Overturn is not legal or medical advice.</li>
        </ul>
      </section>
    </div>
  );
}
