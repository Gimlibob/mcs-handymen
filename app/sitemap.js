import { SITE_URL } from "@/lib/site-config";

const PUBLIC_PATHS = ["/", "/privacy", "/terms", "/sms-terms"];

export default function sitemap() {
  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
  }));
}
