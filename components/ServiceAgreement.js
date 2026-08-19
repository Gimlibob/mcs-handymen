import {
  LEGAL_ENTITY_FULL,
  LEGAL_PARTY_IDENTIFICATION,
  MIN_SERVICE_CALL_USD,
  SERVICE_AREA,
  SITE_NAME,
  TERMS_EFFECTIVE_DATE,
} from "@/lib/site-config";

function Field({ label, className = "" }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-gold-bright">{label}</p>
      <div className="mt-1.5 min-h-[2.25rem] rounded-lg border border-border-soft bg-background px-3 py-2 text-sm text-foreground" />
    </div>
  );
}

function WideField({ label, rows = 3 }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gold-bright">{label}</p>
      <div
        className="mt-1.5 rounded-lg border border-border-soft bg-background px-3 py-2 text-sm text-foreground"
        style={{ minHeight: `${rows * 1.5}rem` }}
      />
    </div>
  );
}

export default function ServiceAgreement() {
  return (
    <div className="rounded-xl border border-border-soft bg-surface px-4 py-6 sm:px-6 sm:py-8 print:border print:bg-white">
      <header className="border-b border-border-soft pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-bright">
          {LEGAL_ENTITY_FULL}
        </p>
        <h2 className="mt-2 font-heading text-2xl font-bold text-foreground">
          Service Agreement / Estimate Terms
        </h2>
        <p className="mt-2 inline-flex rounded-full border border-gold/50 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-gold-bright">
          Template
        </p>
        <p className="mt-2 text-sm text-muted">
          This is a template of terms meant to be copied into, or attached to, an individual
          estimate. Visiting this page does not create a contract. These terms apply only if{" "}
          {SITE_NAME} issues a job-specific estimate and the customer accepts that estimate.
        </p>
        <p className="mt-2 text-sm text-muted">Service area: {SERVICE_AREA}</p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Customer Name" />
        <Field label="Estimate Number" />
        <Field label="Estimate Date" />
        <Field label="Estimate Valid Until" />
        <div className="sm:col-span-2">
          <Field label="Property Address" />
        </div>
      </section>

      <section className="mt-6 space-y-4">
        <WideField label="Scope of Work" rows={4} />
        <div className="grid gap-4 sm:grid-cols-2">
          <WideField label="Labor" rows={2} />
          <WideField label="Materials" rows={2} />
        </div>
        <WideField label="Additional Work" rows={2} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Total Price" />
          <Field label="Payment Terms" />
        </div>
        <WideField label="Warranty" rows={2} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer Approval" />
          <Field label="Approval Date" />
        </div>
      </section>

      <section className="mt-8 space-y-4 text-sm leading-relaxed text-muted">
        <h3 className="font-heading text-lg font-semibold text-foreground">Agreement Terms</h3>
        <p>{LEGAL_PARTY_IDENTIFICATION}</p>
        <p>
          {SITE_NAME} provides small repairs and property maintenance. A ${MIN_SERVICE_CALL_USD}{" "}
          minimum service call applies and includes local travel, unless this estimate states a
          different amount. Payment is due upon completion unless different payment terms are
          stated in the accepted estimate.
        </p>
        <ol className="list-decimal space-y-3 pl-5">
          <li>Only the listed scope of work is included.</li>
          <li>
            Additional work outside the original scope requires customer approval before it is
            performed, whenever reasonably possible. Approval may be given by email, text message,
            or another documented method.
          </li>
          <li>
            Hidden or pre-existing conditions may change the scope, price, and required work.
            Examples include hidden water damage, rot, mold, concealed wiring, concealed plumbing,
            structural problems, pest damage, and inaccessible areas.
          </li>
          <li>
            Materials and parts are included only when specifically listed. Routine consumable
            supplies used during the visit may be used unless this estimate says otherwise.
          </li>
          <li>
            Customer-supplied products are installed at the customer&apos;s request. {SITE_NAME}{" "}
            does not provide a manufacturer warranty for those products. Subject to applicable law,{" "}
            {SITE_NAME} is not responsible for manufacturer defects in customer-supplied products.
            This does not waive rights or liabilities that cannot legally be waived.
          </li>
          <li>
            {SITE_NAME} may stop work if conditions are unsafe, illegal, materially different from
            what was described, outside our lawful scope, or create an unreasonable risk.
          </li>
          <li>
            The customer is responsible for providing safe and reasonable access and for disclosing
            known hazards, restrictions, and access limits. The customer is also responsible for
            securing pets and obtaining any required landlord, property-owner, or HOA authorization
            where applicable.
          </li>
          <li>
            {SITE_NAME} may offer a specific workmanship warranty for this job. If offered, it must
            be stated in this estimate. Manufacturer warranties remain with the manufacturer.
          </li>
          <li>
            If this estimate does not state a workmanship warranty, these terms do not create a
            warranty period. Nothing here limits rights or remedies that cannot legally be limited
            or excluded under applicable law.
          </li>
          <li>
            This agreement is governed by the laws of the State of Texas, without regard to
            conflict-of-law rules, except where applicable consumer-protection laws provide
            otherwise. These terms are incorporated into an accepted estimate. Viewing a public
            template of these terms does not, by itself, form a contract.
          </li>
        </ol>
        <p className="text-xs text-muted/80">Effective date: {TERMS_EFFECTIVE_DATE}</p>
      </section>
    </div>
  );
}
