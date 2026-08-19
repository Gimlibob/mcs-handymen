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
  description: `Privacy policy for the ${SITE_NAME} website and quote requests.`,
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      subtitle={`This Privacy Policy describes how ${SITE_NAME} handles information on this website, based on how the site is built today.`}
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
          number through that form.
        </p>
      </LegalSection>

      <LegalSection number={3} title="How Quote Submissions Are Delivered">
        <p>
          If a form-delivery address is configured for this website, your submission — including
          photos — is sent to that address so we can receive the request. If no form-delivery
          address is configured, the form cannot be submitted through the website.
        </p>
        <p>
          We do not name a specific form provider here unless one is confirmed in the live
          configuration. The host of this website may also keep standard server records of visits
          and form posts, as most website hosts do.
        </p>
      </LegalSection>

      <LegalSection number={4} title="Information Stored in Your Browser">
        <p>
          If you click a service card, the site may save the service name in your browser&apos;s
          session storage so the quote form can be pre-filled. That value stays on your device and
          is not submitted until you send the form.
        </p>
        <p>
          This website&apos;s own code does not set marketing cookies and does not include a
          third-party analytics script.
        </p>
      </LegalSection>

      <LegalSection number={5} title="Map">
        <p>
          The service-area map loads map imagery from a mapping provider in your browser. Depending
          on configuration, that may be OpenStreetMap / CARTO tiles, or Google Maps if a Google Maps
          key is configured. Those providers receive the technical information needed to display the
          map.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Links to Other Sites">
        <p>
          If you follow the Facebook link, you leave this website and Facebook&apos;s own terms and
          privacy policy apply. If you use the email link, your email application handles the
          message.
        </p>
      </LegalSection>

      <LegalSection number={7} title="How We Use Information">
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

      <LegalSection number={9} title="How We Share Information">
        <p>
          We do not sell your personal information. We share quote information with a form-delivery
          or hosting service only when that is how the website is set up to receive submissions, or
          when the law requires us to share information.
        </p>
      </LegalSection>

      <LegalSection number={10} title="Retention and Security">
        <p>
          We keep request information only as long as reasonably needed to respond, provide
          services, maintain ordinary business records, or meet legal requirements. No method of
          sending or storing information is completely secure.
        </p>
      </LegalSection>

      <LegalSection number={11} title="Your Choices">
        <p>
          You may contact us about information you submitted or to ask us not to use photos for
          marketing. You can also decline marketing photo use when we ask.
        </p>
      </LegalSection>

      <LegalSection number={12} title="Contact">
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
