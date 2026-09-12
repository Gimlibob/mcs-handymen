import { requireOwner } from "@/lib/cc/auth/dal";
import CommandCenterShell from "@/components/cc/CommandCenterShell";
import CustomersFilters, { CustomersTable } from "@/components/cc/CustomersTable";
import { listCustomers } from "@/lib/cc/db/customers";

export const metadata = {
  title: "Customers",
};

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }) {
  await requireOwner();

  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q : "";

  let customers = [];
  let dbError = null;

  try {
    customers = await listCustomers({ q, limit: 100 });
  } catch {
    console.error("[cc/customers] list failed");
    dbError = "Could not load customers.";
  }

  return (
    <CommandCenterShell pathname="/command-center/customers">
      <div className="flex flex-col gap-6 xl:gap-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
              Customers
            </h1>
            <p className="mt-2 text-base text-muted">
              Recognized by email across multiple leads. Matching never uses name alone.
            </p>
          </div>
          <p className="text-sm text-muted tabular-nums">
            <span className="font-semibold text-foreground">{customers.length}</span> shown
          </p>
        </div>

        <CustomersFilters q={q} />

        {dbError ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200"
          >
            {dbError}
          </p>
        ) : (
          <CustomersTable customers={customers} />
        )}
      </div>
    </CommandCenterShell>
  );
}
