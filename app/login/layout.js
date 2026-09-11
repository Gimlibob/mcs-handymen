import { SITE_NAME } from "@/lib/site-config";

export const metadata = {
  title: `Sign in | ${SITE_NAME} Command Center`,
  description: "Owner sign-in for MCS Command Center.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({ children }) {
  return children;
}
