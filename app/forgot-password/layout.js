import { SITE_NAME } from "@/lib/site-config";

export const metadata = {
  title: `Forgot password | ${SITE_NAME} Command Center`,
  description: "Request a Command Center password reset.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordLayout({ children }) {
  return children;
}
