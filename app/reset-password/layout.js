import { SITE_NAME } from "@/lib/site-config";

export const metadata = {
  title: `Reset password | ${SITE_NAME} Command Center`,
  description: "Set a new Command Center owner password.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordLayout({ children }) {
  return children;
}
