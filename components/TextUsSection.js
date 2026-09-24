import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import {
  BUSINESS_SMS_DISPLAY,
  BUSINESS_SMS_HREF,
  HAS_PUBLIC_BUSINESS_SMS,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site-config";

const PRIVACY_URL = `${SITE_URL.replace(/\/$/, "")}/privacy`;
const SMS_TERMS_URL = `${SITE_URL.replace(/\/$/, "")}/sms-terms`;

/**
 * Public SMS invitation for RingCentral "They message us first".
 * Renders only when BUSINESS_SMS_NUMBER / BUSINESS_SMS_DISPLAY are set to a confirmed
 * professional business number (not the schema placeholder).
 */
export default function TextUsSection() {
  if (!HAS_PUBLIC_BUSINESS_SMS) return null;

  return (
    <section id="text-us" className="border-t border-border-soft px-4 py-14 sm:px-6">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold bg-surface-2">
          <MessageSquareText className="h-6 w-6 text-gold-bright" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Text {SITE_NAME}
        </h2>
        <p className="mt-3 text-base text-muted">
          Prefer to text? Send the first message to our business number. We reply manually about
          your service request, repair, estimate, or appointment discussion.
        </p>
        <a
          href={BUSINESS_SMS_HREF}
          className="mt-6 inline-flex min-h-[52px] items-center justify-center rounded-xl bg-gold px-6 text-base font-semibold text-black transition-colors hover:bg-gold-bright sm:min-w-[240px]"
        >
          Text{" "}
          {BUSINESS_SMS_DISPLAY}
        </a>
        <p className="mt-6 text-sm leading-relaxed text-muted">
          You can text {SITE_NAME} at {BUSINESS_SMS_DISPLAY} for information about our services. Tap
          &ldquo;Text {BUSINESS_SMS_DISPLAY}&rdquo; or send your first SMS to this number with your
          question. By texting {SITE_NAME}, you agree to receive conversational messages from{" "}
          {SITE_NAME} about your request. Reply STOP to opt out; reply HELP for support; message and
          data rates may apply; messaging frequency may vary. Visit{" "}
          <Link
            href="/privacy"
            className="font-medium text-gold-bright underline underline-offset-2 break-all"
          >
            {PRIVACY_URL}
          </Link>{" "}
          for our Privacy Policy and{" "}
          <Link
            href="/sms-terms"
            className="font-medium text-gold-bright underline underline-offset-2 break-all"
          >
            {SMS_TERMS_URL}
          </Link>{" "}
          for our SMS Terms.
        </p>
      </div>
    </section>
  );
}
