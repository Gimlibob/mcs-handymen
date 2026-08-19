import Image from "next/image";

/**
 * Brand logo: crest mark + wordmark.
 * Crest file: /public/images/logo.png (transparent PNG)
 */
export default function Logo({ className = "" }) {
  return (
    <span className={`inline-flex max-w-full min-w-0 items-center gap-2 sm:gap-2.5 ${className}`}>
      <Image
        src="/images/logo.png?v=2"
        alt="MCS Handymen"
        width={64}
        height={62}
        className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
        priority
        unoptimized
      />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="font-heading text-base font-bold tracking-wide text-foreground sm:text-lg">
          MCS<span className="text-gold-bright"> HANDYMEN</span>
        </span>
        <span className="text-[10px] font-medium uppercase leading-tight tracking-wide text-muted sm:tracking-[0.2em]">
          Manvel &middot; Iowa Colony &middot; Rosharon
        </span>
      </span>
    </span>
  );
}
