import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function LegalPageShell({ title, children }) {
  return (
    <>
      <Header />
      <main id="main-content" className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <article className="mx-auto max-w-3xl">
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
          <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-muted sm:text-base">
            {children}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
