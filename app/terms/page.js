import LegalPageShell from "@/components/LegalPageShell";
import {
  BACKUP_EMAIL,
  LEGAL_PARTY_IDENTIFICATION,
  MAILTO_HREF,
  SERVICE_AREA,
  SITE_NAME,
} from "@/lib/site-config";

export const metadata = {
  title: `Terms & Conditions | ${SITE_NAME}`,
  description: `Terms and conditions for ${SITE_NAME} handyman services.`,
};

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms & Conditions">
      <p>
        These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your use of the {SITE_NAME} website
        and your request for handyman services. By using this website or submitting a project request,
        you agree to these Terms.
      </p>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">1. Who We Are</h2>
        <p className="mt-3">{LEGAL_PARTY_IDENTIFICATION}</p>
        <p className="mt-3">
          {SITE_NAME} provides small repairs and property maintenance for homes, rental properties,
          and light commercial customers in {SERVICE_AREA}.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">2. Services Offered</h2>
        <p className="mt-3">
          We provide small repairs and maintenance only. We do not perform roofing, major remodeling,
          structural work, or major plumbing or electrical work. Materials are not included unless
          specifically agreed in writing.
        </p>
        <p className="mt-3">
          A $125 minimum service call applies and includes local travel within our service area.
          Final pricing may vary based on scope, access, and conditions discovered on site.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">3. Quotes &amp; Scheduling</h2>
        <p className="mt-3">
          Information submitted through our quote form — including photos, descriptions, and contact
          details — helps us review your project. A form submission does not guarantee availability,
          scheduling, or a fixed price until we confirm scope and acceptance.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">4. Customer Responsibilities</h2>
        <p className="mt-3">
          You agree to provide safe access to the work area, accurate project details, and timely
          communication. You are responsible for securing pets, clearing work areas where reasonably
          possible, and disclosing known hazards or property restrictions.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">5. Limitation of Liability</h2>
        <p className="mt-3">
          To the fullest extent permitted by law, {SITE_NAME} is not liable for indirect,
          incidental, special, or consequential damages arising from use of this website or our
          services. Our liability for any claim related to a service visit is limited to the amount
          paid for that specific service, except where prohibited by law.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">6. Changes to These Terms</h2>
        <p className="mt-3">
          We may update these Terms from time to time. The revised version will be posted on this
          page with an updated effective date. Continued use of the website after changes are posted
          constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section>
        <h2 className="font-heading text-xl font-semibold text-foreground">7. Contact</h2>
        <p className="mt-3">
          Questions about these Terms may be sent to{" "}
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
