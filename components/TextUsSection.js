import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import {
  BACKUP_EMAIL,
  BUSINESS_SMS_DISPLAY,
  BUSINESS_SMS_HREF,
  HAS_PUBLIC_BUSINESS_SMS,
  MAILTO_HREF,
  SITE_NAME,
} from "@/lib/site-config";

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
          Prefer to text? Send the first message to our business number about your service request,
          repair, estimate, or appointment discussion. We reply manually in that conversation.
        </p>
        <a
          href={BUSINESS_SMS_HREF}
          className="mt-6 inline-flex min-h-[52px] items-center justify-center rounded-xl bg-gold px-6 text-base font-semibold text-black transition-colors hover:bg-gold-bright sm:min-w-[240px]"
        >
          Text {BUSINESS_SMS_DISPLAY}
        </a>
        <div className="mt-6 space-y-2 text-sm text-muted">
          <p>
            Message types: individual replies about your request, repairs, estimates, scheduling
            discussion, and related job details.
          </p>
          <p>Message frequency may vary. Message and data rates may apply.</p>
          <p>Reply STOP to opt out. Reply HELP for assistance.</p>
          <p>
            Help also:{" "}
            <a href={MAILTO_HREF} className="font-medium text-gold-bright underline underline-offset-2">
              {BACKUP_EMAIL}
            </a>
          </p>
          <p>
            <Link href="/privacy" className="font-medium text-gold-bright underline underline-offset-2">
              Privacy Policy
            </Link>
            {" · "}
            <Link
              href="/sms-terms"
              className="font-medium text-gold-bright underline underline-offset-2"
            >
              SMS Terms
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
