import Image from "next/image";

/**
 * Brand logo: crest mark + wordmark.
 * Crest file: /public/images/logo.png (transparent PNG)
 */
export default function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/images/logo.png?v=2"
        alt="MCS Handymen"
        width={64}
        height={62}
        className="h-14 w-14 object-contain"
        priority
        unoptimized
      />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-lg font-bold tracking-wide text-foreground">
          MCS<span className="text-gold-bright"> HANDYMEN</span>
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
          Manvel &middot; Iowa Colony &middot; Rosharon
        </span>
      </span>
    </span>
  );
}
