import LegalPageShell from "@/components/LegalPageShell";
import LegalSection from "@/components/LegalSection";
import {
  BACKUP_EMAIL,
  LEGAL_PARTY_IDENTIFICATION,
  MAILTO_HREF,
  MIN_SERVICE_CALL_USD,
  SERVICE_AREA,
  SITE_NAME,
  TERMS_EFFECTIVE_DATE,
} from "@/lib/site-config";

export const metadata = {
  title: `Website Terms & Conditions | ${SITE_NAME}`,
  description: `Website terms and conditions for using the ${SITE_NAME} site and submitting a quote request.`,
};

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Website Terms & Conditions"
      subtitle="These Terms explain how you may use this website and how quote requests work. They are not a job contract. Visiting the Estimate Terms page also does not create a contract."
    >
      <p>
        By using the {SITE_NAME} website or submitting a Request a Quote form, you agree to these
        Website Terms &amp; Conditions (&ldquo;Terms&rdquo;). Please also review our{" "}
        <a href="/privacy" className="font-medium text-gold-bright underline underline-offset-2">
          Privacy Policy
        </a>
        .
      </p>

      <LegalSection number={1} title="Who We Are">
        <p>{LEGAL_PARTY_IDENTIFICATION}</p>
        <p>
          {SITE_NAME} provides small repairs and property maintenance for homeowners, landlords,
          property managers, and small businesses in {SERVICE_AREA}, and nearby areas we agree to
          serve.
        </p>
      </LegalSection>

      <LegalSection number={2} title="Services and Limitations">
        <p>{SITE_NAME} provides small repairs and property maintenance.</p>
        <p>A ${MIN_SERVICE_CALL_USD} minimum service call applies and includes local travel.</p>
        <p>{SITE_NAME} does not perform:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Roofing</li>
          <li>Major remodeling</li>
          <li>Structural work</li>
          <li>HVAC</li>
          <li>Gas work</li>
          <li>Hazardous-material removal</li>
          <li>Mold or asbestos remediation</li>
          <li>
            Specialty plumbing or electrical work that requires a license, unless the work is
            legally permitted and performed by an appropriately licensed or authorized professional
          </li>
        </ul>
        <p>
          Submitting a quote request does not mean we can or will accept every project. We may
          decline work that is outside our services, unsafe, or not a good fit.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Quotes and Estimates">
        <p>
          Online quote requests, photos, and descriptions are preliminary. They help us understand
          the project. They do not guarantee availability, a visit, a fixed price, or acceptance of
          the project.
        </p>
        <p>
          If we can help, we may send a written estimate for that job. Visiting this website, or
          visiting the Estimate Terms page, does not create a contract. A job agreement is formed
          only if {SITE_NAME} issues an individual estimate and you accept that estimate. The{" "}
          <a
            href="/estimate-terms"
            className="font-medium text-gold-bright underline underline-offset-2"
          >
            Service Agreement / Estimate Terms
          </a>{" "}
          are a template of terms meant to be incorporated into an accepted estimate, together with
          the job-specific details listed on that estimate.
        </p>
      </LegalSection>

      <LegalSection number={4} title="Scope of Work">
        <p>
          Only the work specifically described in the accepted estimate or service agreement is
          included. Anything not listed is outside the original scope.
        </p>
      </LegalSection>

      <LegalSection number={5} title="Materials and Customer-Supplied Products">
        <p>We distinguish between:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="font-medium text-foreground">Materials and parts</strong> used to
            complete the listed work, such as fixtures, hardware, or replacement pieces
          </li>
          <li>
            <strong className="font-medium text-foreground">Routine consumable supplies</strong> used
            during the visit, such as fasteners, adhesives, or similar shop supplies, unless the
            estimate says otherwise
          </li>
        </ul>
        <p>
          Materials and parts are not included unless specifically stated in the estimate. If you
          supply materials or products, {SITE_NAME} does not provide a manufacturer warranty for
          those items. Subject to applicable law, {SITE_NAME} is not responsible for manufacturer
          defects in customer-supplied products. This does not waive rights or liabilities that
          cannot legally be waived.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Existing and Hidden Conditions">
        <p>
          Photos and descriptions may not show everything. Concealed or pre-existing conditions can
          require additional work, materials, a revised price, a pause in work, or a referral to
          another professional.
        </p>
        <p>Examples include:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Hidden water damage</li>
          <li>Rot</li>
          <li>Mold</li>
          <li>Concealed wiring</li>
          <li>Concealed plumbing</li>
          <li>Structural problems</li>
          <li>Pest damage</li>
          <li>Inaccessible areas</li>
        </ul>
      </LegalSection>

      <LegalSection number={7} title="Change Orders and Additional Work">
        <p>
          Work outside the original scope should be approved by you before additional work is
          performed, whenever reasonably possible. Approval may be given electronically, including
          by email, text message, or another documented method.
        </p>
      </LegalSection>

      <LegalSection number={8} title="Scheduling, Access, and Delays">
        <p>
          Scheduling is by mutual agreement and may change because of weather, access issues, parts
          availability, or conditions discovered on site. You must provide safe and reasonable
          access to the work area at the scheduled time.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Customer Responsibilities">
        <p>You agree to:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Provide accurate information about the project</li>
          <li>Provide safe and reasonable access to the work area</li>
          <li>Disclose known hazards, restrictions, and access limits</li>
          <li>Secure pets</li>
          <li>
            Obtain any required landlord, property-owner, or HOA authorization before work begins,
            where applicable
          </li>
        </ul>
      </LegalSection>

      <LegalSection number={10} title="Payment Terms">
        <p>
          Payment is due upon completion unless different payment terms are stated in the accepted
          estimate.
        </p>
        <p>
          A ${MIN_SERVICE_CALL_USD} minimum service call applies and includes local travel, unless
          the accepted estimate states a different amount for that job.
        </p>
        <p>
          To the fullest extent permitted by applicable law, {SITE_NAME} may suspend work if an
          agreed balance remains unpaid.
        </p>
      </LegalSection>

      <LegalSection number={11} title="Cancellations and Rescheduling">
        <p>
          Please let us know as soon as you can if you need to cancel or reschedule. We do not
          charge a cancellation fee under these website Terms. If a job estimate includes a
          different cancellation or rescheduling note, that estimate controls for that job.
        </p>
      </LegalSection>

      <LegalSection number={12} title="Workmanship Warranty">
        <p>
          {SITE_NAME} may offer a specific workmanship warranty for a job. If a workmanship warranty
          is offered, it will be stated in the individual estimate or service agreement. These
          website Terms do not create a warranty period.
        </p>
        <p>
          Nothing in these Terms limits rights or remedies that cannot legally be limited or
          excluded under applicable law.
        </p>
      </LegalSection>

      <LegalSection number={13} title="Manufacturer and Third-Party Warranties">
        <p>
          Manufacturer and other third-party warranties remain with the manufacturer or original
          seller. {SITE_NAME} does not replace those warranties.
        </p>
      </LegalSection>

      <LegalSection number={14} title="Permits, Licensing, and Specialty Trades">
        <p>
          {SITE_NAME} provides small repairs and property maintenance. We do not claim to hold every
          specialty trade license. Work that legally requires a licensed specialist is not included
          unless it is legally permitted and performed by an appropriately licensed or authorized
          professional.
        </p>
      </LegalSection>

      <LegalSection number={15} title="Safety and Right to Stop Work">
        <p>
          {SITE_NAME} may refuse or stop work if conditions are unsafe, illegal, materially
          different from what was described, outside our lawful scope, or create an unreasonable
          risk.
        </p>
      </LegalSection>

      <LegalSection number={16} title="Photos and Project Documentation">
        <p>
          Photos you upload with a quote request are used to review the project, as described in our{" "}
          <a href="/privacy" className="font-medium text-gold-bright underline underline-offset-2">
            Privacy Policy
          </a>
          .
        </p>
        <p>
          We may take photos to document existing conditions, the work in progress, or completed
          work. Documentation photos are not used for marketing, the website gallery, Facebook, or
          advertising unless you give permission.
        </p>
      </LegalSection>

      <LegalSection number={17} title="Limitation of Liability">
        <p>
          To the fullest extent permitted by applicable law, {SITE_NAME} is not liable for
          indirect, incidental, special, or consequential damages arising from use of this website
          or our services.
        </p>
        <p>
          For any claim related to a specific service visit, our liability is limited to the amount
          paid for that visit, except where applicable law does not allow that limitation.
        </p>
        <p>
          This limitation does not apply to liability that cannot legally be limited, including
          liability for fraud, gross negligence, willful misconduct, or bodily injury or death, to
          the extent such liability cannot be limited under applicable law.
        </p>
      </LegalSection>

      <LegalSection number={18} title="Governing Law and Disputes">
        <p>
          These Terms are governed by the laws of the State of Texas, without regard to
          conflict-of-law rules, except where applicable consumer-protection laws provide otherwise.
        </p>
        <p>
          If a disagreement arises, please contact us first so we can try to resolve it. If we
          cannot, either party may pursue available remedies in a court of competent jurisdiction,
          subject to applicable law.
        </p>
      </LegalSection>

      <LegalSection number={19} title="Website Disclaimer">
        <p>
          Website photos, examples, descriptions, and pricing information are general information.
          They do not guarantee a particular result, schedule, or price for your project.
        </p>
      </LegalSection>

      <LegalSection number={20} title="Severability">
        <p>
          If any part of these Terms is found unenforceable, the remaining parts continue in
          effect. The unenforceable part will be limited to the minimum extent required by
          applicable law.
        </p>
      </LegalSection>

      <LegalSection number={21} title="Changes to These Terms">
        <p>
          We may update these Terms from time to time. The current version will be posted on this
          page with an updated effective date. Continued use of the website after changes are posted
          means you accept the updated Terms.
        </p>
      </LegalSection>

      <LegalSection number={22} title="Contact">
        <p>
          Questions about these Terms may be sent to{" "}
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
