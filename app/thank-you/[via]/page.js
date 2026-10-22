import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  BACKUP_EMAIL,
  BUSINESS_SMS_DISPLAY,
  BUSINESS_SMS_HREF,
  MAILTO_HREF,
  SITE_NAME,
} from "@/lib/site-config";

const linkClass = "font-medium text-gold-bright underline underline-offset-2";

// Conversions are sent when the visitor acts, never from this page,
// so reloading or revisiting it does not count again.
const VARIANTS = {
  form: {
    lead: "Your project request has been received.",
    body: () => (
      <p>
        We&apos;ll review your details and photos, then contact you by your preferred method as
        soon as we can.
      </p>
    ),
  },
  email: {
    lead: "Your email app should open with our address.",
    body: () => (
      <>
        <p>
          If it didn&apos;t open, you can write to us at{" "}
          <a href={MAILTO_HREF} className={linkClass}>
            {BACKUP_EMAIL}
          </a>
          . We&apos;ll reply as soon as we receive your message.
        </p>
        <p>A short description and a few photos of the project help us quote faster.</p>
      </>
    ),
  },
  sms: {
    lead: "Your messaging app should open with our business number.",
    body: () => (
      <>
        <p>
          If it didn&apos;t open, you can text us at{" "}
          <a href={BUSINESS_SMS_HREF} className={linkClass}>
            {BUSINESS_SMS_DISPLAY}
          </a>
          . We&apos;ll reply as soon as we receive your message.
        </p>
        <p>
          Message frequency varies. Message and data rates may apply. Reply STOP to opt out or
          HELP for support.
        </p>
      </>
    ),
  },
};

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((via) => ({ via }));
}

export const dynamicParams = false;

export const metadata = {
  title: `Thank You | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function ThankYouPage({ params }) {
  const { via } = await params;
  const variant = VARIANTS[via];
  if (!variant) {
    notFound();
  }

  return (
    <>
      <Header />
      <main id="main-content" className="flex-1 scroll-mt-28 px-4 py-16 sm:px-6 sm:py-24">
        <div
          role="status"
          className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-xl border border-gold bg-surface p-8 text-center"
        >
          <CheckCircle2 className="h-12 w-12 text-gold-bright" aria-hidden="true" />
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
            Thank you for reaching out to {SITE_NAME}
          </h1>
          <p className="text-base font-medium text-foreground">{variant.lead}</p>
          <div className="space-y-3 text-sm leading-relaxed text-muted sm:text-base">
            {variant.body()}
          </div>
          <Link
            href="/"
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-gold px-6 text-base font-semibold text-black transition-colors hover:bg-gold-bright"
          >
            Back to Home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
