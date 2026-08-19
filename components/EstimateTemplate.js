import {
  LEGAL_ENTITY_FULL,
  MIN_SERVICE_CALL_USD,
  SERVICE_AREA,
  SITE_NAME,
} from "@/lib/site-config";
import { ApprovalMethodLine, DocumentArea, DocumentField } from "./DocumentFields";

export default function EstimateTemplate() {
  return (
    <div className="rounded-xl border border-border-soft bg-surface px-4 py-6 text-sm text-muted sm:px-6 sm:py-8 print:border print:bg-white">
      <header className="border-b border-border-soft pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-bright">
          {SITE_NAME}
        </p>
        <p className="mt-1 text-xs text-muted">{LEGAL_ENTITY_FULL}</p>
        <h2 className="mt-3 font-heading text-2xl font-bold text-foreground">Estimate</h2>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-gold-bright">
          Template — Example
        </p>
        <p className="mt-2 text-sm">
          This is a blank estimate template. Viewing it or printing it does not create a contract.
          An estimate becomes a job agreement only after {SITE_NAME} fills in a specific job and the
          customer approves that estimate.
        </p>
        <p className="mt-2 text-xs">Service area: {SERVICE_AREA}</p>
      </header>

      <section className="mt-5">
        <h3 className="font-heading text-base font-semibold text-foreground">Customer Information</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <DocumentField label="Customer Name" />
          <DocumentField label="Email" />
          <div className="sm:col-span-2">
            <DocumentField label="Property Address" />
          </div>
          <DocumentField label="Estimate Number" />
          <DocumentField label="Estimate Date" />
          <DocumentField label="Estimate Valid Until" />
        </div>
      </section>

      <section className="mt-6">
        <h3 className="font-heading text-base font-semibold text-foreground">Project</h3>
        <div className="mt-3">
          <DocumentArea label="Scope of Work" rows={4} />
        </div>
        <p className="mt-2 text-xs">
          Only the work listed in this estimate is included. Materials and parts are included only
          when specifically listed below.
        </p>
      </section>

      <section className="mt-6">
        <h3 className="font-heading text-base font-semibold text-foreground">Pricing</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <DocumentArea label="Labor" rows={2} />
          <DocumentArea label="Materials" rows={2} />
          <div className="sm:col-span-2">
            <DocumentArea label="Additional Work" rows={2} />
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <DocumentField label="Labor Total" />
          <DocumentField label="Materials Total" />
          <DocumentField label="Total Price" />
        </div>
        <p className="mt-2 text-xs">
          A ${MIN_SERVICE_CALL_USD} minimum service call applies and includes local travel, unless
          this estimate states a different amount.
        </p>
      </section>

      <section className="mt-6">
        <h3 className="font-heading text-base font-semibold text-foreground">Payment</h3>
        <div className="mt-3">
          <DocumentArea label="Payment Terms" rows={2} />
        </div>
        <p className="mt-2 text-xs">
          Payment is due upon completion unless different payment terms are stated in the accepted
          estimate.
        </p>
      </section>

      <section className="mt-6">
        <h3 className="font-heading text-base font-semibold text-foreground">Warranty</h3>
        <div className="mt-3">
          <DocumentArea label="Workmanship Warranty, if offered" rows={2} />
        </div>
        <p className="mt-2 text-xs">
          If a workmanship warranty is offered, write it here. If this field is left blank, this
          estimate does not create a warranty period. Manufacturer warranties remain with the
          manufacturer. This does not limit rights or remedies that cannot legally be limited or
          excluded.
        </p>
      </section>

      <section className="mt-6">
        <h3 className="font-heading text-base font-semibold text-foreground">
          Service Agreement / Estimate Terms
        </h3>
        <p className="mt-2">
          The standard Service Agreement / Estimate Terms are a public template at{" "}
          <a href="/estimate-terms" className="font-medium text-gold-bright underline underline-offset-2">
            /estimate-terms
          </a>
          . That public page is not itself a contract. Those terms apply to this job only after the
          customer accepts this individual estimate. The customer does not need to fill out the
          public template page.
        </p>
      </section>

      <section className="mt-6 border-t border-border-soft pt-5">
        <h3 className="font-heading text-base font-semibold text-foreground">Customer Approval</h3>
        <p className="mt-2">
          By approving this estimate, the customer agrees to the scope of work, pricing, payment
          terms, and applicable Service Agreement / Estimate Terms associated with this estimate.
        </p>
        <p className="mt-2 text-xs">
          Approval may be recorded by email, text, or signature. This template is not an online
          signature system.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <DocumentField label="Customer Approval" />
          <DocumentField label="Approval Date" />
          <div className="sm:col-span-2">
            <ApprovalMethodLine />
          </div>
        </div>
      </section>
    </div>
  );
}
