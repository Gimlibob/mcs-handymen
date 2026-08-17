import LegalPageShell from "@/components/LegalPageShell";
import {
  BACKUP_EMAIL,
  LEGAL_PARTY_IDENTIFICATION,
  MAILTO_HREF,
  SITE_NAME,
} from "@/lib/site-config";

export const metadata = {
  title: `Privacy Policy | ${SITE_NAME}`,
  description: `Privacy policy for ${SITE_NAME} website and quote requests.`,
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy">
      <p>
        This Privacy Policy explains how we collect, use, and protect information when you visit the{" "}
        {SITE_NAME} website or submit a project request.
      </p>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">1. Who We Are</h2>
        <p className="mt-3">{LEGAL_PARTY_IDENTIFICATION}</p>
      </section>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">2. Information We Collect</h2>
        <p className="mt-3">When you submit a quote request, we may collect:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Name, email address, and preferred contact method</li>
          <li>City, property type, and project details you provide</li>
          <li>Photos you upload to describe the work needed</li>
          <li>Preferred date and any optional notes included in your submission</li>
        </ul>
        <p className="mt-3">
          We may also collect basic technical information such as browser type, device type, and pages
          visited to help maintain and improve the website.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">3. How We Use Information</h2>
        <p className="mt-3">We use the information you provide to:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Review your project and respond to quote requests</li>
          <li>Communicate with you about scheduling, scope, or follow-up questions</li>
          <li>Operate, secure, and improve our website and customer experience</li>
          <li>Comply with legal obligations when required</li>
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">4. How We Share Information</h2>
        <p className="mt-3">
          We do not sell your personal information. We may share information only with service
          providers that help us operate the website or process form submissions (such as email or
          form hosting providers), or when required by law.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">5. Photo Uploads</h2>
        <p className="mt-3">
          Photos you submit are used to evaluate your project request. Please do not upload images
          containing sensitive personal information unrelated to the repair or maintenance work being
          requested.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">6. Data Retention &amp; Security</h2>
        <p className="mt-3">
          We retain project request information only as long as reasonably needed to respond, provide
          services, maintain business records, or meet legal requirements. We use reasonable
          administrative and technical measures to protect submitted information, but no method of
          transmission or storage is completely secure.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">7. Your Choices</h2>
        <p className="mt-3">
          You may contact us to ask questions about information you submitted or to request
          correction of inaccurate details associated with your project request.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">8. Contact</h2>
        <p className="mt-3">
          Privacy questions may be sent to{" "}
          <a href={MAILTO_HREF} className="font-medium text-gold-bright underline underline-offset-2">
            {BACKUP_EMAIL}
          </a>
          .
        </p>
        <p className="mt-3 text-xs text-muted/80">Effective date: August 17, 2026</p>
      </section>
    </LegalPageShell>
  );
}
