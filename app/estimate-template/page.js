import Header from "@/components/Header";
import Footer from "@/components/Footer";
import EstimateTemplate from "@/components/EstimateTemplate";
import ChangeOrderTemplate from "@/components/ChangeOrderTemplate";
import PrintButton from "@/components/PrintButton";
import { SITE_NAME } from "@/lib/site-config";

export const metadata = {
  title: `Estimate Template — Example | ${SITE_NAME}`,
  description: `Blank estimate and change-order templates for ${SITE_NAME}. Viewing this page does not create a contract.`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function EstimateTemplatePage() {
  return (
    <>
      <div className="print:hidden">
        <Header />
      </div>
      <main id="main-content" className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <article className="mx-auto max-w-4xl">
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Estimate Template — Example
          </h1>
          <p className="mt-3 text-sm text-muted sm:text-base">
            Blank templates for MCS to fill in, print, save as PDF, or attach to email. This page
            contains no customer information. Viewing it does not create a contract. Request a Quote
            on the website remains a request for information only.
          </p>
          <p className="mt-3 print:hidden">
            <PrintButton />
            <span className="ml-2 text-xs text-muted">Use your browser print dialog.</span>
          </p>
          <div className="mt-8 space-y-10">
            <EstimateTemplate />
            <div className="print:break-before-page">
              <ChangeOrderTemplate />
            </div>
          </div>
        </article>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </>
  );
}
