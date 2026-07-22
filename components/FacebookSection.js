import FacebookIcon from "./icons/FacebookIcon";
import { PrimaryLink } from "./Buttons";
import { FACEBOOK_URL } from "@/lib/site-config";

export default function FacebookSection() {
  return (
    <section id="facebook" className="border-t border-border-soft bg-surface/40 px-4 py-14 sm:px-6">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold bg-surface-2">
          <FacebookIcon className="h-6 w-6 text-gold-bright" />
        </span>
        <h2 className="mt-4 font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Follow MCS Handymen
        </h2>
        <p className="mt-3 text-base text-muted">
          See recent work, updates, and message us directly on Facebook.
        </p>
        <PrimaryLink href={FACEBOOK_URL} external className="mt-6 sm:min-w-[240px]">
          <FacebookIcon className="h-5 w-5" />
          Open Facebook Page
        </PrimaryLink>
      </div>
    </section>
  );
}
