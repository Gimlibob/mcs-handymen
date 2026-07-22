import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site-config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "MCS Handymen | Handyman Services in Manvel, Iowa Colony & Rosharon, TX",
  description:
    "Request handyman services in Manvel, Iowa Colony and Rosharon, TX. Send photos of your repair project to MCS Handymen for a quote.",
  keywords: [
    "handyman Manvel TX",
    "handyman Iowa Colony TX",
    "handyman Rosharon TX",
    "MCS Handymen",
    "home repair quote",
  ],
  openGraph: {
    title: "MCS Handymen | Handyman Services in Manvel, Iowa Colony & Rosharon, TX",
    description:
      "Send photos of your repair project for a fast quote. Serving Manvel, Iowa Colony & Rosharon, Texas.",
    url: SITE_URL,
    siteName: "MCS Handymen",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MCS Handymen | Handyman Services in Manvel, Iowa Colony & Rosharon, TX",
    description:
      "Send photos of your repair project for a fast quote. Serving Manvel, Iowa Colony & Rosharon, Texas.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-US" className={`${inter.variable} ${poppins.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-black focus:font-semibold"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
