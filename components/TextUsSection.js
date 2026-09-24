"use client";

import { useId, useState } from "react";
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

const buttonClassName =
  "mt-4 inline-flex min-h-[52px] w-full max-w-sm items-center justify-center rounded-xl bg-gold px-6 text-base font-semibold text-black transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-gold sm:min-w-[240px]";

/**
 * Public SMS invitation for RingCentral "They message us first".
 * Renders only when BUSINESS_SMS_NUMBER / BUSINESS_SMS_DISPLAY are set to a confirmed
 * professional business number (not the schema placeholder).
 */
export default function TextUsSection() {
  const consentId = useId();
  const [consented, setConsented] = useState(false);

  if (!HAS_PUBLIC_BUSINESS_SMS) return null;

  return (
    <section id="text-us" className="border-t border-border-soft px-4 py-14 sm:px-6">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold bg-surface-2">
          <MessageSquareText className="h-6 w-6 text-gold-bright" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Text MCS <span className="text-gold">Handymen</span>
        </h2>
        <p className="mt-3 text-base text-muted">
          Prefer to text? Send the first message to our business number. We reply manually about
          your service request, repair, estimate, or appointment discussion.
        </p>

        <div className="mt-6 w-full max-w-lg text-left">
          <label
            htmlFor={consentId}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-soft bg-surface/40 p-4 text-sm leading-relaxed text-muted"
          >
            <input
              id={consentId}
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-gold"
            />
            <span>
              I agree to receive conversational text messages from {SITE_NAME} in response to my
              service request, including questions about the work, estimates, appointment
              scheduling, and related job details.
            </span>
          </label>
        </div>

        {consented ? (
          <a href={BUSINESS_SMS_HREF} className={buttonClassName}>
            Text {BUSINESS_SMS_DISPLAY}
          </a>
        ) : (
          <button type="button" disabled aria-disabled="true" className={buttonClassName}>
            Text {BUSINESS_SMS_DISPLAY}
          </button>
        )}

        <p className="mt-6 text-sm leading-relaxed text-muted">
          By sending your first text to {SITE_NAME} at {BUSINESS_SMS_DISPLAY}, you agree to receive
          conversational messages about your request. Message frequency varies. Message and data
          rates may apply. Reply STOP to opt out or HELP for support. See our Privacy Policy at{" "}
          <Link
            href="/privacy"
            className="font-medium text-gold-bright underline underline-offset-2 break-all"
          >
            {PRIVACY_URL}
          </Link>{" "}
          and SMS Terms at{" "}
          <Link
            href="/sms-terms"
            className="font-medium text-gold-bright underline underline-offset-2 break-all"
          >
            {SMS_TERMS_URL}
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
