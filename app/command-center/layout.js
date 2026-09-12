import { SITE_NAME } from "@/lib/site-config";

export const metadata = {
  title: {
    default: `Command Center | ${SITE_NAME}`,
    template: `%s | ${SITE_NAME} Command Center`,
  },
  description: "Internal MCS Handymen operations dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CommandCenterLayout({ children }) {
  return children;
}
