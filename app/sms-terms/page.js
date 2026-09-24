import Link from "next/link";
import LegalPageShell from "@/components/LegalPageShell";
import LegalSection from "@/components/LegalSection";
import {
  BACKUP_EMAIL,
  LEGAL_PARTY_IDENTIFICATION,
  MAILTO_HREF,
  SITE_NAME,
  TERMS_EFFECTIVE_DATE,
} from "@/lib/site-config";

export const metadata = {
  title: `SMS Terms | ${SITE_NAME}`,
  description: `SMS terms for ${SITE_NAME} customer-initiated text conversations about service requests, repairs, estimates, and appointments.`,
};

export default function SmsTermsPage() {
  return (
    <LegalPageShell
      title="SMS Terms"
      subtitle={`These SMS Terms explain how ${SITE_NAME} uses text messaging with customers. They apply to individual, manually sent business text conversations and are separate from the website quote form.`}
    >
      <p>
        Please also review our{" "}
        <Link href="/privacy" className="font-medium text-gold-bright underline underline-offset-2">
          Privacy Policy
        </Link>
        . Website use is covered by our{" "}
        <Link href="/terms" className="font-medium text-gold-bright underline underline-offset-2">
          Website Terms &amp; Conditions
        </Link>
        .
      </p>

      <LegalSection number={1} title="Who We Are">
        <p>{LEGAL_PARTY_IDENTIFICATION}</p>
      </LegalSection>

      <LegalSection number={2} title="Program Description">
        <p>
          {SITE_NAME}
          {" "}
          uses text messages for individual conversations with customers about their service
          requests, repairs, estimates, and appointments. Messages in this program are
          conversational replies sent manually in response to that customer&apos;s request or
          ongoing job discussion. They may cover project details, scheduling discussion, estimate
          discussion, and related service updates within that conversation.
        </p>
        <p>
          This SMS program is a RingCentral Conversations (external) / customer-initiated text
          program. It is not described here as a bulk marketing subscription or as an automated
          appointment-reminder or estimate-follow-up campaign.
        </p>
      </LegalSection>

      <LegalSection number={3} title="How Consent Works">
        <p>
          A customer may start a text conversation by sending the first SMS to the {SITE_NAME}
          {" "}
          business number shown on this website (see the Text Us section on the home page).{" "}
          {SITE_NAME}
          {" "}
          may then reply within that same conversation about the customer&apos;s request, repair,
          estimate, or appointment discussion.
        </p>
        <p>
          The website Request a Quote form does not collect a phone number and is not used as SMS
          consent.
        </p>
        <p>
          SMS consent and mobile opt-in / enrollment data are not shared with third parties or
          affiliates. Separately, message content and related delivery records are processed by our
          SMS provider (RingCentral) as needed to transmit and deliver the texts. See our{" "}
          <Link href="/privacy" className="font-medium text-gold-bright underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          for more detail.
        </p>
      </LegalSection>

      <LegalSection number={4} title="Message Frequency">
        <p>Message frequency may vary.</p>
      </LegalSection>

      <LegalSection number={5} title="Rates">
        <p>Message and data rates may apply.</p>
      </LegalSection>

      <LegalSection number={6} title="Opt Out">
        <p>Reply STOP to opt out.</p>
        <p>
          After you opt out, we will stop sending SMS messages to that number for this program,
          except that we may send a final confirmation of the opt-out if required.
        </p>
      </LegalSection>

      <LegalSection number={7} title="Help">
        <p>Reply HELP for assistance.</p>
        <p>
          You can also email{" "}
          <a href={MAILTO_HREF} className="font-medium text-gold-bright underline underline-offset-2">
            {BACKUP_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection number={8} title="Privacy">
        <p>
          Information related to SMS conversations is handled as described in our{" "}
          <Link href="/privacy" className="font-medium text-gold-bright underline underline-offset-2">
            Privacy Policy
          </Link>
          , including the Text Messaging (SMS) section.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Changes">
        <p>
          We may update these SMS Terms from time to time. The current version will be posted on
          this page with an updated effective date.
        </p>
      </LegalSection>

      <LegalSection number={10} title="Contact">
        <p>
          Questions about these SMS Terms may be sent to{" "}
          <a href={MAILTO_HREF} className="font-medium text-gold-bright underline underline-offset-2">
            {BACKUP_EMAIL}
          </a>
          .
        </p>
        <p className="text-xs text-muted/80">Effective date: {TERMS_EFFECTIVE_DATE}</p>
      </LegalSection>
    </LegalPageShell>
  );
}
