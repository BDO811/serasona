import { Link } from "react-router-dom";
import { LegalDoc, LEGAL_ENTITY, LEGAL_EMAIL } from "@/components/LegalDoc";

/**
 * Privacy Policy.
 *
 * Every factual claim here is true of the code as built, and was checked
 * against it rather than assumed:
 *
 *   - raw audio is deleted once a sample has been scored, on every terminal
 *     path including failures, with a one-day bucket lifecycle as a backstop
 *   - a stored check-in holds the derived readings, never the audio
 *   - the voice harness stores a SHA-256 of the phone number, not the number
 *   - the anonymous path keys on a SHA-256 of the email, not the address
 *   - card details go to Stripe and never reach our servers
 *
 * If any of those change, this page has to change with them. A privacy policy
 * that describes a system you no longer run is worse than none, because it is
 * a written misrepresentation.
 */
const Privacy = () => (
  <LegalDoc
    title="Privacy Policy"
    summary={`How ${LEGAL_ENTITY} handles your information when you use Serasona. Section 3 covers your voice, which is the most sensitive thing we touch and the part worth reading even if you skip the rest.`}
  >
    <h2>1. Scope</h2>
    <p>
      This policy covers the Serasona website and application operated by {LEGAL_ENTITY} ("we", "us").
      It does not cover third-party sites you reach from ours.
    </p>

    <h2>2. What we collect</h2>
    <ul>
      <li>
        <strong>Account information.</strong> Your name, email address, and a password that is stored
        only as a salted hash by our authentication provider. We never see your password.
      </li>
      <li>
        <strong>Voice recordings.</strong> Short audio samples of you speaking, captured in your browser
        or over a phone call. See section 3.
      </li>
      <li>
        <strong>Derived readings.</strong> The scores and wellness bands produced from a recording,
        together with the model used and the time of the check-in.
      </li>
      <li>
        <strong>Phone number</strong>, if you use the phone or SMS check-in. In the service that places
        those calls, the number is stored only as a <strong>SHA-256 hash</strong>, which is enough to
        match a later delivery receipt to a session but is not reversible back to the number.
      </li>
      <li>
        <strong>Payment information.</strong> Handled by Stripe. We receive a customer reference,
        subscription status and plan. <strong>Your full card number never reaches our servers.</strong>
      </li>
      <li>
        <strong>Technical data.</strong> Standard server logs, device and browser characteristics, and
        error reports, used to keep the service running and secure.
      </li>
    </ul>
    <p>
      We do not collect precise location, we do not track you across other companies' sites, and we do
      not run advertising.
    </p>

    <h2>3. Your voice, specifically</h2>
    <p>
      A voice recording can identify a person. In Illinois, Texas and elsewhere it is treated as a{" "}
      <strong>biometric identifier</strong>, and it is the most sensitive thing this product handles. So
      we are precise about it.
    </p>

    <h3>Why we collect it</h3>
    <p>
      For one purpose only: to compute your wellness readings. The analysis measures acoustic properties
      of speech. <strong>The content of what you say is not scored</strong>, and the prompts are
      designed only to keep you talking long enough to measure.
    </p>

    <h3>How long we keep it</h3>
    <ul>
      <li>
        A recording exists only as long as it takes to score it. Once a sample has been submitted for
        analysis and a result returned, <strong>the audio is deleted</strong> — on success, on failure,
        and on abandonment alike.
      </li>
      <li>
        The storage it passes through carries a <strong>one-day automatic deletion rule</strong> as a
        backstop, so nothing survives a crash.
      </li>
      <li>
        What remains afterwards is the <strong>derived readings only</strong>. A stored check-in record
        contains the scores, the model, and a timestamp. It does not contain your audio.
      </li>
    </ul>

    <h3>What we never do with it</h3>
    <ul>
      <li>We do not sell, lease, trade or otherwise profit from your voice recordings.</li>
      <li>We do not use your voice to create a voice clone or a synthetic copy of you.</li>
      <li>We do not use it for voice authentication or to identify you to any third party.</li>
      <li>We do not disclose it except as described in section 5.</li>
    </ul>

    <h3>Improving the models</h3>
    <p>
      We do not use your identifiable recordings to train models.{" "}
      <strong>If we ever wish to use recordings for model improvement, we will ask for your separate,
      specific, opt-in consent first</strong>, and you will be able to decline or withdraw without
      losing access to the service.
    </p>

    <h3>If other people can be heard</h3>
    <p>
      Record yourself, somewhere others are not being captured. You are responsible for not recording
      people without their knowledge and consent, as set out in the{" "}
      <Link to="/terms">Terms of Service</Link>.
    </p>

    <h2>4. How we use information</h2>
    <ul>
      <li>To provide check-ins and show your results and trend.</li>
      <li>To create and secure your account and authenticate you.</li>
      <li>To take payment and manage your subscription.</li>
      <li>To deliver check-ins by phone or SMS where you asked for that.</li>
      <li>To support you when you contact us.</li>
      <li>To detect, prevent and investigate abuse, fraud and security incidents.</li>
      <li>To meet legal obligations and enforce our terms.</li>
      <li>
        To improve the service using aggregated and de-identified data that cannot reasonably be linked
        back to you.
      </li>
    </ul>
    <p>
      <strong>We do not make automated decisions that produce legal or similarly significant effects
      about you.</strong> Your readings are informational.
    </p>

    <h3>Legal bases (if you are in the UK, EU or EEA)</h3>
    <ul>
      <li><strong>Contract</strong> — to provide the service you signed up for.</li>
      <li>
        <strong>Explicit consent</strong> — for processing voice recordings, which are special category
        biometric data. You may withdraw it at any time.
      </li>
      <li>
        <strong>Legitimate interests</strong> — security, abuse prevention, and improving the service,
        balanced against your rights.
      </li>
      <li><strong>Legal obligation</strong> — where the law requires it.</li>
    </ul>

    <h2>5. Who we share with</h2>
    <p>
      We do not sell your personal information and we do not share it for cross-context behavioural
      advertising. We use a small number of processors, each bound to act only on our instructions:
    </p>
    <ul>
      <li>
        <strong>Google Cloud and Firebase</strong> — hosting, authentication, databases and storage.
      </li>
      <li>
        <strong>Stripe</strong> — payments and subscription management.
      </li>
      <li>
        <strong>Telnyx</strong> — telephone calls and text messages, on the plans that include them.
      </li>
      <li>
        <strong>Amplifier Health</strong> — the acoustic model that produces your readings. Audio is sent
        for analysis and the result is returned.
      </li>
    </ul>
    <p>
      We may also disclose information where required by law or valid legal process, to protect rights,
      safety or property, or in connection with a merger, acquisition or sale of assets —{" "}
      <strong>in which case we will give notice before your information becomes subject to a different
      policy</strong>.
    </p>

    <h2>6. Retention</h2>
    <ul>
      <li><strong>Voice recordings</strong> — deleted once scored; one day maximum. See section 3.</li>
      <li><strong>Derived readings</strong> — kept while your account is open, so your trend is meaningful.</li>
      <li><strong>Account records</strong> — kept while your account is open.</li>
      <li>
        <strong>Billing records</strong> — kept as long as tax and accounting law requires, typically
        several years.
      </li>
      <li><strong>Security logs</strong> — kept for a limited period, then deleted.</li>
    </ul>
    <p>When you delete your account we delete or de-identify your data, except what we must keep by law.</p>

    <h2>7. Security</h2>
    <p>
      Data is encrypted in transit and at rest. Credentials are held in a managed secret store rather
      than in application configuration. Access is limited to those who need it. Stored check-ins are
      readable only by the account that owns them, enforced on the server and not merely in the
      interface.
    </p>
    <p>
      No system is perfectly secure, and we cannot guarantee absolute security. If a breach affects your
      information we will notify you and the regulators as the law requires.
    </p>

    <h2>8. Your rights</h2>
    <p>
      Wherever you live, you can ask us to access, correct, export or delete your information, and you
      can withdraw consent to voice processing. Email{" "}
      <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>. We will verify your identity before acting,
      and we will not treat you worse for exercising a right.
    </p>

    <h3>California</h3>
    <p>
      You have the right to know what we collect and why, to delete it, to correct it, to opt out of
      sale or sharing — <strong>we do not sell or share, so there is nothing to opt out of</strong> — and
      to limit the use of sensitive personal information. Voice recordings are sensitive personal
      information; we use them only to provide the service, which is a permitted purpose. You may use an
      authorised agent.
    </p>

    <h3>UK, EU and EEA</h3>
    <p>
      You have rights of access, rectification, erasure, restriction, portability and objection, and the
      right to withdraw consent. You may complain to your supervisory authority.
    </p>

    <h3>Washington, Nevada and other consumer-health laws</h3>
    <p>
      Where consumer health data laws apply, you may ask for a list of who we have shared data with, and
      you may withdraw consent to its collection and sharing.
    </p>

    <h3>Biometric identifiers</h3>
    <p>
      Where your state treats a voiceprint as a biometric identifier, this policy, together with the
      consent you give at signup, is our written notice of what we collect, why, how long we keep it and
      when we destroy it. Our retention schedule is in section 3:{" "}
      <strong>recordings are destroyed as soon as they have been scored, and within one day at the
      latest.</strong> We do not sell, lease or trade biometric identifiers.
    </p>

    <h2>9. International transfers</h2>
    <p>
      We operate in the United States, and your information is processed there. If you use the service
      from elsewhere, you are transferring information to a country whose laws may differ from your
      own. Where required we rely on appropriate safeguards such as standard contractual clauses.
    </p>

    <h2>10. Children</h2>
    <p>
      Serasona is for adults. We do not knowingly collect information from anyone under 18. If you
      believe a child has given us information, email{" "}
      <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a> and we will delete it.
    </p>

    <h2>11. Cookies</h2>
    <p>
      We use the minimum needed to keep you signed in and to keep the service secure. We do not use
      advertising or cross-site tracking cookies.
    </p>

    <h2>12. Changes</h2>
    <p>
      We may update this policy. If a change is material we will give notice in the app or by email
      before it takes effect. The effective date is at the top of this page.
    </p>

    <h2>13. Contact</h2>
    <p>
      {LEGAL_ENTITY} — <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
    </p>
  </LegalDoc>
);

export default Privacy;
