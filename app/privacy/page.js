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
  title: `Privacy Policy | ${SITE_NAME}`,
  description: `Privacy policy for the ${SITE_NAME} website, quote requests, and SMS conversations.`,
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      subtitle={`This Privacy Policy describes how ${SITE_NAME} handles information on this website and in related business communications, based on how the site and services work today.`}
    >
      <LegalSection number={1} title="Who We Are">
        <p>{LEGAL_PARTY_IDENTIFICATION}</p>
      </LegalSection>

      <LegalSection number={2} title="Information You Submit Through the Quote Form">
        <p>
          If you use Request a Quote, the form collects the fields you enter and any photos you
          attach:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Full name</li>
          <li>Email address</li>
          <li>City (and a custom city name if you select Other)</li>
          <li>Property type</li>
          <li>Project type (or a custom service name if you select Other)</li>
          <li>Project description</li>
          <li>Preferred contact method (Email or Facebook Messenger)</li>
          <li>Preferred date, if you provide one</li>
          <li>Photos you upload</li>
        </ul>
        <p>
          The website quote form does not include a phone-number field. We do not collect a phone
          number through that form. Submitting the quote form is not SMS consent and is not treated
          as permission to send marketing text messages.
        </p>
      </LegalSection>

      <LegalSection number={3} title="How Quote Submissions Are Handled">
        <p>
          When a quote request is submitted successfully, the website uses the following services
          as configured in the live application:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="font-medium text-foreground">Vercel Blob</strong> stores uploaded
            project photos as private files (not public gallery images).
          </li>
          <li>
            <strong className="font-medium text-foreground">Resend</strong> sends a notification
            email to {SITE_NAME} with the form details and temporary private photo links so we can
            review the request. The email is typically addressed to{" "}
            <a href={MAILTO_HREF} className="font-medium text-gold-bright underline underline-offset-2">
              {BACKUP_EMAIL}
            </a>
            , unless a different business notification address is configured.
          </li>
          <li>
            Temporary photo access links are signed and expire after a limited period (currently 14
            days).
          </li>
        </ul>
        <p>
          If those services are not configured, the form cannot be submitted through the website.
          The website host may also keep ordinary server records of visits and form posts, as most
          website hosts do.
        </p>
      </LegalSection>

      <LegalSection number={4} title="Information Stored in Your Browser and Site Analytics">
        <p>
          If you click a service card, the site may save the service name in your browser&apos;s
          session storage so the quote form can be pre-filled. That value stays on your device and
          is not submitted until you send the form.
        </p>
        <p>
          This website includes{" "}
          <strong className="font-medium text-foreground">Vercel Analytics</strong>, which collects
          aggregated, privacy-oriented usage information about page visits. The site&apos;s own
          code does not set marketing cookies and does not include a separate advertising analytics
          script.
        </p>
      </LegalSection>

      <LegalSection number={5} title="Map">
        <p>
          The service-area map is displayed with Leaflet using OpenStreetMap map tiles in your
          browser. OpenStreetMap receives the technical information needed to display those tiles.
          A separate &ldquo;View in Google Maps&rdquo; link may open Google Maps in another tab;
          Google&apos;s own terms and privacy policy apply there.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Links to Other Sites">
        <p>
          If you follow the Facebook link, you leave this website and Facebook&apos;s own terms and
          privacy policy apply. If you use the email link, your email application handles the
          message.
        </p>
      </LegalSection>

      <LegalSection number={7} title="How We Use Website Quote Information">
        <p>We use quote-form information to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Review the project and photos</li>
          <li>Respond by the contact method you selected, when we can</li>
          <li>Keep ordinary business records of requests we receive</li>
          <li>Comply with legal obligations when required</li>
        </ul>
      </LegalSection>

      <LegalSection number={8} title="Photos">
        <p>
          <strong className="font-medium text-foreground">A. Documentation and quote review.</strong>{" "}
          Photos you upload with a quote request are used to understand the work. Photos taken
          during a job may be used to document existing conditions, the work, or completed work.
        </p>
        <p>
          <strong className="font-medium text-foreground">B. Marketing.</strong> We do not treat
          documentation or quote photos as permission to use them on the website gallery, Facebook,
          other social media, or advertising. Marketing use requires your permission.
        </p>
        <p>
          Please do not upload images that contain sensitive personal information unrelated to the
          work.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Text Messaging (SMS)">
        <p>
          {SITE_NAME} may exchange text messages with customers about their individual service
          requests, repairs, estimates, and appointments. Under our current RingCentral setup,
          customers may start by texting the {SITE_NAME} business number shown on this website;{" "}
          {SITE_NAME} then replies manually within that conversation. SMS messaging is separate
          from the website quote form, which does not collect a phone number and is not SMS
          consent.
        </p>
        <p>
          <strong className="font-medium text-foreground">Information related to SMS.</strong> When
          we communicate by text, the information involved may include:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Mobile phone number</li>
          <li>Message content and related timestamps or delivery records</li>
          <li>
            Name and service details needed to continue the conversation about your request,
            estimate, repair, or appointment discussion
          </li>
        </ul>
        <p>
          <strong className="font-medium text-foreground">How SMS information is used.</strong> We
          use this information to reply to you, coordinate service, discuss estimates or
          scheduling, and keep ordinary business records of customer communications.
        </p>
        <p>
          <strong className="font-medium text-foreground">
            SMS consent and mobile enrollment data.
          </strong>{" "}
          SMS consent and mobile opt-in / enrollment data are not shared with third parties or
          affiliates.
        </p>
        <p>
          <strong className="font-medium text-foreground">
            Message processing needed to deliver texts.
          </strong>{" "}
          Separately, message content and related delivery records are processed by our SMS
          provider (RingCentral) as needed to transmit and deliver the conversation. The website
          host for this site does not receive or process those SMS messages through the quote form
          or other website code.
        </p>
        <p>
          Message frequency may vary. Message and data rates may apply. Reply STOP to opt out.
          Reply HELP for assistance. For SMS help by email, contact{" "}
          <a href={MAILTO_HREF} className="font-medium text-gold-bright underline underline-offset-2">
            {BACKUP_EMAIL}
          </a>
          . Additional SMS program details are in our{" "}
          <Link href="/sms-terms" className="font-medium text-gold-bright underline underline-offset-2">
            SMS Terms
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection number={10} title="How We Share Information">
        <p>
          We do not sell your personal information. Depending on how you interact with us, we may
          share information with:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Vercel (website hosting, private photo storage, and site analytics)</li>
          <li>Resend (quote-request notification email delivery)</li>
          <li>
            RingCentral (business SMS messaging and related delivery processing when we exchange
            texts)
          </li>
          <li>Other providers only when required by law or needed to operate the services above</li>
        </ul>
      </LegalSection>

      <LegalSection number={11} title="Retention and Security">
        <p>
          We keep request and messaging information only as long as reasonably needed to respond,
          provide services, maintain ordinary business records, or meet legal requirements. Private
          quote-photo access links expire after a limited time. No method of sending or storing
          information is completely secure.
        </p>
      </LegalSection>

      <LegalSection number={12} title="Your Choices">
        <p>
          You may contact us about information you submitted or to ask us not to use photos for
          marketing. You can also decline marketing photo use when we ask. For SMS, reply STOP to
          opt out or HELP for assistance, or email us at the address below.
        </p>
      </LegalSection>

      <LegalSection number={13} title="Contact">
        <p>
          Privacy questions may be sent to{" "}
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
