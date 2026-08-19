import LegalPageShell from "@/components/LegalPageShell";
import ServiceAgreement from "@/components/ServiceAgreement";
import { SITE_NAME } from "@/lib/site-config";

export const metadata = {
  title: `Estimate Terms Template | ${SITE_NAME}`,
  description: `Template of service agreement and estimate terms for ${SITE_NAME} to attach to an individual job estimate.`,
  robots: {
    index: false,
    follow: true,
  },
};

export default function EstimateTermsPage() {
  return (
    <LegalPageShell
      title="Service Agreement / Estimate Terms"
      subtitle="This page is a template and reference. Visiting it does not create a contract."
      wide
    >
      <div className="space-y-3">
        <p>
          <strong className="font-medium text-foreground">Website Terms</strong> govern use of this
          website and submitting a Request a Quote form. See the{" "}
          <a href="/terms" className="font-medium text-gold-bright underline underline-offset-2">
            Website Terms &amp; Conditions
          </a>
          .
        </p>
        <p>
          <strong className="font-medium text-foreground">An individual estimate</strong> is the
          job-specific commercial document {SITE_NAME} may send after reviewing a project. It lists
          the scope, price, and other details for that job.
        </p>
        <p>
          <strong className="font-medium text-foreground">
            Service Agreement / Estimate Terms
          </strong>{" "}
          are the standard terms meant to be incorporated into an accepted estimate. They apply to a
          job only if {SITE_NAME} issues that estimate and the customer accepts it.
        </p>
        <p>
          The blank fields below are placeholders for a specific estimate. Filling them in on this
          public webpage, or simply opening this page, does not form an agreement.
        </p>
      </div>
      <ServiceAgreement />
    </LegalPageShell>
  );
}
