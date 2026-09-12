import Link from "next/link";
import {
  Ban,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Inbox,
  MessageCircle,
  Send,
  ThumbsUp,
} from "lucide-react";
import { DASHBOARD_STATUS_TILES, statusLabel } from "@/lib/cc/domain/lead-status";
import {
  STATUS_SHORT_DESCRIPTIONS,
  getStatusCountTone,
} from "@/lib/cc/ui/status-tone";

const STATUS_ICONS = {
  new: Inbox,
  waiting_info: MessageCircle,
  ready_for_estimate: FileText,
  estimate_pending_review: ClipboardCheck,
  estimate_sent: Send,
  accepted: ThumbsUp,
  scheduled: CalendarCheck,
  completed: CheckCircle2,
  closed_lost: Ban,
};

export default function DashboardStatusTiles({ counts = {} }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-3">
      {DASHBOARD_STATUS_TILES.map((status) => {
        const count = counts[status] || 0;
        const tone = getStatusCountTone(status, count);
        const Icon = STATUS_ICONS[status];
        const description = STATUS_SHORT_DESCRIPTIONS[status] || "";

        return (
          <Link
            key={status}
            href={`/command-center/leads?status=${encodeURIComponent(status)}`}
            className={`group relative flex min-h-[148px] flex-col justify-between rounded-2xl border px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-colors hover:border-gold/50 xl:min-h-[128px] xl:py-3.5 ${tone.border} ${tone.card}`}
          >
            {Icon ? (
              <Icon
                aria-hidden="true"
                className={`absolute right-3.5 top-3.5 h-[18px] w-[18px] opacity-70 ${tone.icon}`}
                strokeWidth={1.5}
              />
            ) : null}

            <p
              className={`font-heading text-[2.6rem] font-bold leading-none tracking-tight tabular-nums xl:text-[2.85rem] ${tone.number}`}
            >
              {count}
            </p>

            <div className="pr-6">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${tone.label}`}>
                {statusLabel(status)}
              </p>
              <p className={`mt-1 text-sm leading-snug ${tone.desc}`}>{description}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
