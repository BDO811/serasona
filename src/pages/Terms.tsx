import { Link } from "react-router-dom";
import { LegalDoc, LEGAL_ENTITY, LEGAL_EMAIL } from "@/components/LegalDoc";

/**
 * Terms of Service.
 *
 * Written against what this product actually does, not a template: voice
 * capture, a wellness (not medical) classification, auto-renewing
 * subscriptions through Stripe, and outbound phone calls and SMS on the paid
 * tiers. The last of those is the one most often missed — placing automated
 * calls or texts without documented express written consent is a TCPA problem
 * with statutory damages per message.
 *
 * NOT reviewed by a lawyer. See the notice at the top of the page.
 */
const Terms = () => (
  <LegalDoc
    title="Terms of Service"
    summary={`These terms govern your use of Serasona, a voice-based wellness product operated by ${LEGAL_ENTITY}. Please read section 2 (not a medical service), section 6 (calls and messages), and sections 11 to 13 (disclaimers, liability and indemnity) closely. They affect your legal rights.`}
  >
    <div className="rounded-2xl border border-primary bg-card p-5">
      <p className="m-0 text-sm">
        <strong>Draft pending legal review.</strong> This document was prepared to be comprehensive and
        accurate to how the product works, but it has not been reviewed by a licensed attorney. Voice
        recordings are biometric data in several states, and automated calling is separately regulated.
        Have counsel review this before relying on it.
      </p>
    </div>

    <h2>1. Who we are, and accepting these terms</h2>
    <p>
      Serasona is operated by {LEGAL_ENTITY} ("Serasona", "we", "us"). By creating an account, checking
      in, or otherwise using the service, you agree to these terms and to our{" "}
      <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do not use the service.
    </p>
    <p>
      You must be <strong>18 or older</strong> and legally able to enter a contract. The service is not
      offered to children, and we do not knowingly collect anything from them.
    </p>

    <h2>2. Serasona is not a medical service</h2>
    <p>
      This is the most important section in this document.
    </p>
    <ul>
      <li>
        Serasona is a <strong>general wellness product</strong>. It is not a medical device, and it is
        not intended to diagnose, treat, cure, mitigate or prevent any disease or condition.
      </li>
      <li>
        It has not been cleared or approved by the U.S. Food and Drug Administration or by any other
        regulator.
      </li>
      <li>
        Nothing it produces is a medical opinion, a diagnosis, or a recommendation for treatment, and
        nothing in it creates a clinician-patient relationship.
      </li>
      <li>
        <strong>Never delay or disregard professional medical advice because of something Serasona
        showed you.</strong> If you think you may be having a medical emergency, call your local
        emergency number or go to an emergency department.
      </li>
      <li>
        Serasona is not a crisis service. It does not monitor your results for emergencies, and nobody
        is watching your readings in real time.
      </li>
    </ul>
    <p>
      The metrics are relative measures derived from acoustic properties of your voice and are compared
      against your own history. They are not clinical measurements and should not be treated as one.
    </p>

    <h2>3. Your account</h2>
    <p>
      You are responsible for your credentials and for everything done through your account. Give us
      accurate information and keep it current. Tell us promptly at{" "}
      <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a> if you believe your account has been used
      without your permission. One account per person; do not share it.
    </p>

    <h2>4. The service</h2>
    <p>
      A check-in records a short sample of your speech, analyses its acoustic properties, and returns a
      set of wellness readings positioned against your own prior results. Free accounts receive a
      limited number of check-ins; paid plans extend that and add features described on the{" "}
      <Link to="/pricing">pricing page</Link>.
    </p>
    <p>
      We may change, suspend or discontinue features. Where a change materially reduces what a paid
      plan provides, we will give reasonable notice and you may cancel under section 5.
    </p>

    <h3>Accuracy</h3>
    <p>
      Readings depend on recording conditions. Background noise, a poor microphone, illness, a short
      sample, or a telephone connection all affect results. Readings captured over a phone line carry
      less of your voice than readings captured in the app and are not directly comparable to them.
      Results may be unavailable or inconclusive, and we do not warrant that any reading is accurate,
      reliable or fit for any particular purpose.
    </p>

    <h2>5. Subscriptions, renewal, cancellation and refunds</h2>
    <ul>
      <li>
        Paid plans are <strong>subscriptions that renew automatically</strong> each month at the price
        shown when you subscribed, until you cancel.
      </li>
      <li>
        We charge the payment method you provide at checkout. Payments are processed by Stripe; we
        never receive or store your full card details.
      </li>
      <li>
        <strong>You may cancel at any time</strong> from your account page. Cancellation stops the next
        renewal. Access continues through the end of the period you have already paid for.
      </li>
      <li>
        Except where the law requires otherwise, payments are non-refundable and we do not pro-rate
        partial periods.
      </li>
      <li>
        We may change prices on notice. A price change applies from your next renewal, never
        retroactively, and you may cancel before it takes effect.
      </li>
      <li>
        Taxes may be added where required. If a payment fails we may retry it and may suspend paid
        features until it succeeds.
      </li>
    </ul>

    <h2>6. Phone calls, text messages, and recording</h2>
    <p>
      Some plans include check-ins delivered by phone call or by a link sent over SMS. By giving us your
      phone number and selecting one of those options, you are giving{" "}
      <strong>prior express written consent</strong> to the following.
    </p>
    <ul>
      <li>
        That we, or a provider acting for us, may <strong>call and send text messages to that number,
        including with an automatic telephone dialing system and with prerecorded or artificial
        voice messages</strong>, for the purpose of delivering your check-ins and service messages
        about them.
      </li>
      <li>
        That these messages are not marketing, and that{" "}
        <strong>consent is not a condition of purchasing anything</strong>. You can use Serasona in the
        app without ever receiving a call or a text.
      </li>
      <li>
        That message frequency depends on the plan and settings you choose.{" "}
        <strong>Message and data rates may apply</strong>, and your carrier is not liable for delayed or
        undelivered messages.
      </li>
      <li>
        That the number you give us is yours, or that you are authorised to give consent for it. Tell us
        immediately if the number stops being yours.
      </li>
    </ul>

    <h3>Withdrawing consent</h3>
    <p>
      You may withdraw consent at any time, by any reasonable means: reply <strong>STOP</strong> to a
      message, say so on a call, turn phone check-ins off in your account, or email{" "}
      <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>. Withdrawing consent stops calls and texts. It
      does not cancel your subscription, which you cancel separately under section 5.
    </p>

    <h3>Recording</h3>
    <p>
      A check-in works by recording your voice, so <strong>the call or session is recorded</strong>. We
      tell you before recording starts, and starting a check-in is your consent to that recording. Do
      not use the service where you cannot lawfully be recorded, and do not let anyone else be recorded
      without their knowledge. How recordings are handled and deleted is set out in the{" "}
      <Link to="/privacy">Privacy Policy</Link>.
    </p>

    <h2>7. Your content, and the licence you give us</h2>
    <p>
      Your recordings and results are yours. To run the service, you grant us a limited, non-exclusive,
      worldwide, royalty-free licence to host, process, transmit and analyse your voice recordings and
      derived results, solely to provide the service to you, to keep it secure, and to meet our legal
      obligations.
    </p>
    <p>
      <strong>We do not sell your voice recordings or your results.</strong> We do not use your voice to
      build a voice clone, and we do not use it to identify you to anyone else. Any use of
      de-identified or aggregated data to improve the models is described in the{" "}
      <Link to="/privacy">Privacy Policy</Link>, and that licence survives only in de-identified form.
    </p>

    <h2>8. Acceptable use</h2>
    <p>You agree not to:</p>
    <ul>
      <li>record anyone other than yourself, or record anyone without their knowledge and consent;</li>
      <li>submit audio you do not have the right to submit, including synthesised or impersonated speech;</li>
      <li>use the service to make decisions about another person's employment, insurance, credit,
        housing, or fitness for duty;</li>
      <li>present the output as a clinical assessment, or resell it as one;</li>
      <li>probe, scrape, reverse engineer, overload or interfere with the service or its security;</li>
      <li>share an account, or use the service through automated means we have not authorised;</li>
      <li>use the service unlawfully, or in a way that infringes anyone's rights.</li>
    </ul>
    <p>We may suspend or terminate accounts that breach this section.</p>

    <h2>9. Our intellectual property</h2>
    <p>
      The service, its software, models, interface, and the Serasona name and marks are owned by us or
      our licensors. We grant you a personal, non-transferable, revocable licence to use the service
      under these terms. You get no other rights, and nothing here transfers ownership.
    </p>

    <h2>10. Third parties</h2>
    <p>
      We rely on third parties to operate, including a cloud provider, a payments processor, and a
      telecommunications provider. They are listed in the <Link to="/privacy">Privacy Policy</Link>. We
      are not responsible for third-party services you choose to use alongside Serasona, and your use of
      them is governed by their terms.
    </p>

    <h2>11. Disclaimers</h2>
    <p>
      <strong>
        The service is provided "as is" and "as available", without warranties of any kind, whether
        express, implied or statutory, including any implied warranties of merchantability, fitness for
        a particular purpose, title, non-infringement, accuracy, or quiet enjoyment.
      </strong>
    </p>
    <p>
      We do not warrant that the service will be uninterrupted, timely, secure or error-free, that
      readings will be accurate or meaningful, or that defects will be corrected. Some jurisdictions do
      not allow the exclusion of certain warranties, so parts of this section may not apply to you.
    </p>

    <h2>12. Limitation of liability</h2>
    <p>
      <strong>
        To the fullest extent permitted by law, neither {LEGAL_ENTITY} nor its officers, directors,
        employees, agents, suppliers or licensors will be liable for any indirect, incidental, special,
        consequential, exemplary or punitive damages, or for any loss of profits, revenue, data,
        goodwill, or other intangible losses, arising out of or relating to the service, whether in
        contract, tort (including negligence), strict liability or otherwise, even if advised of the
        possibility.
      </strong>
    </p>
    <p>
      <strong>
        Our total aggregate liability arising out of or relating to the service will not exceed the
        greater of (a) the amount you paid us in the twelve months before the event giving rise to the
        claim, or (b) one hundred US dollars.
      </strong>
    </p>
    <p>
      Nothing in these terms excludes liability that cannot lawfully be excluded, including for fraud,
      or for death or personal injury caused by negligence. Some jurisdictions do not allow these
      limits, so they may not fully apply to you.
    </p>

    <h2>13. Indemnification</h2>
    <p>
      <strong>
        You agree to defend, indemnify and hold harmless {LEGAL_ENTITY} and its officers, directors,
        employees, agents, suppliers and licensors from and against any claims, demands, actions,
        liabilities, damages, losses, judgments, penalties, and costs (including reasonable legal fees)
        arising out of or relating to:
      </strong>
    </p>
    <ul>
      <li>your use of the service, or anyone's use of it through your account;</li>
      <li>your breach of these terms or of any law;</li>
      <li>
        <strong>
          any recording you submit of a person other than yourself, or any recording made without the
          knowledge and consent of everyone recorded;
        </strong>
      </li>
      <li>
        <strong>
          any claim that we called or messaged a number you gave us without proper consent, including
          where the number was not yours or stopped being yours;
        </strong>
      </li>
      <li>
        any use of readings to make decisions about another person, or any presentation of readings as
        clinical or diagnostic;
      </li>
      <li>your infringement of any third party's rights.</li>
    </ul>
    <p>
      We may assume exclusive defence and control of any matter subject to indemnification by you, at
      your expense, and you agree to cooperate with that defence. You will not settle any matter that
      imposes obligations on us without our prior written consent.
    </p>

    <h2>14. Disputes, arbitration and class action waiver</h2>
    <p>
      <strong>Please read this section carefully. It affects how disputes are resolved.</strong>
    </p>
    <p>
      First, contact us at <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a> and give us 30 days to
      resolve the matter informally. Most issues end here.
    </p>
    <p>
      If that fails, you and we agree that any dispute arising out of or relating to these terms or the
      service will be resolved by <strong>binding individual arbitration</strong>, administered by a
      recognised arbitration provider under its consumer rules, seated in Bexar County, Texas, or
      conducted remotely at the arbitrator's discretion. The arbitrator decides all issues except the
      enforceability of the class action waiver, which is for a court.
    </p>
    <p>
      <strong>
        You and we each waive the right to a jury trial and the right to participate in a class,
        collective, consolidated or representative action.
      </strong>{" "}
      Either party may bring an individual claim in small claims court instead. Nothing here prevents
      either party from seeking injunctive relief in court for infringement or misuse of intellectual
      property.
    </p>
    <p>
      <strong>You may opt out of arbitration</strong> by emailing{" "}
      <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a> within 30 days of first accepting these terms,
      saying so plainly. Opting out does not affect anything else in these terms.
    </p>

    <h2>15. Governing law</h2>
    <p>
      These terms are governed by the laws of the State of Texas, without regard to conflict-of-laws
      rules. Where arbitration does not apply, the state and federal courts located in Bexar County,
      Texas have exclusive jurisdiction, and you consent to that jurisdiction and venue. Mandatory
      consumer-protection rights in your place of residence are unaffected.
    </p>

    <h2>16. Termination</h2>
    <p>
      You may stop using the service and delete your account at any time. We may suspend or terminate
      your access if you breach these terms, if we are required to by law, or if we discontinue the
      service. Sections 2, 7, 9, and 11 through 17 survive termination.
    </p>

    <h2>17. Everything else</h2>
    <ul>
      <li>
        <strong>Changes.</strong> We may update these terms. If a change is material we will give notice
        in the app or by email before it takes effect. Continuing to use the service after that is
        acceptance. The effective date is at the top of this page.
      </li>
      <li>
        <strong>Entire agreement.</strong> These terms and the Privacy Policy are the whole agreement
        between us about the service.
      </li>
      <li>
        <strong>Severability.</strong> If any provision is unenforceable, the rest stays in force.
      </li>
      <li>
        <strong>No waiver.</strong> Not enforcing a provision is not a waiver of it.
      </li>
      <li>
        <strong>Assignment.</strong> You may not assign these terms. We may assign them in connection
        with a merger, acquisition or sale of assets.
      </li>
      <li>
        <strong>Force majeure.</strong> Neither party is liable for failures caused by events beyond its
        reasonable control.
      </li>
    </ul>

    <h2>18. Contact</h2>
    <p>
      {LEGAL_ENTITY} — <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
    </p>
  </LegalDoc>
);

export default Terms;
