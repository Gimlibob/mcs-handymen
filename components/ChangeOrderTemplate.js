import { SITE_NAME } from "@/lib/site-config";
import { ApprovalMethodLine, DocumentArea, DocumentField } from "./DocumentFields";

export default function ChangeOrderTemplate() {
  return (
    <div className="rounded-xl border border-border-soft bg-surface px-4 py-6 text-sm text-muted sm:px-6 sm:py-8 print:border print:bg-white">
      <header className="border-b border-border-soft pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-bright">
          {SITE_NAME}
        </p>
        <h2 className="mt-3 font-heading text-2xl font-bold text-foreground">Change Order</h2>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-gold-bright">
          Template — Example
        </p>
        <p className="mt-2 text-sm">
          Use this form to document additional work after an estimate is accepted. Additional work
          should be approved before it is performed, whenever reasonably possible. Viewing this
          template does not create a contract.
        </p>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        <DocumentField label="Related Estimate Number" />
        <DocumentField label="Change Order Number" />
        <DocumentField label="Date" />
        <DocumentField label="Customer Name" />
      </section>

      <section className="mt-5 space-y-3">
        <DocumentArea label="Reason for Additional Work" rows={2} />
        <DocumentArea label="Additional Scope" rows={3} />
      </section>

      <section className="mt-5">
        <h3 className="font-heading text-base font-semibold text-foreground">Additional Pricing</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <DocumentArea label="Additional Labor" rows={2} />
          <DocumentArea label="Additional Materials" rows={2} />
        </div>
      </section>

      <section className="mt-5">
        <h3 className="font-heading text-base font-semibold text-foreground">Totals</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <DocumentField label="Original Estimate" />
          <DocumentField label="Additional Approved Work" />
          <DocumentField label="Revised Total" />
        </div>
        <div className="mt-3">
          <DocumentField label="Additional Price" />
        </div>
      </section>

      <section className="mt-6 border-t border-border-soft pt-5">
        <h3 className="font-heading text-base font-semibold text-foreground">Customer Approval</h3>
        <p className="mt-2">
          By approving this change order, the customer agrees to the additional scope and pricing
          listed above. This does not waive rights that cannot legally be waived.
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
