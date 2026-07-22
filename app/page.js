import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import HowItWorks from "@/components/HowItWorks";
import Gallery from "@/components/Gallery";
import QuoteSection from "@/components/QuoteSection";
import FacebookSection from "@/components/FacebookSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
        <Hero />
        <Services />
        <HowItWorks />
        <Gallery />
        <QuoteSection />
        <FacebookSection />
      </main>
      <Footer />
    </>
  );
}
