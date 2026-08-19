import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function LegalPageShell({ title, subtitle, children, wide = false }) {
  return (
    <>
      <Header />
      <main id="main-content" className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <article className={`mx-auto ${wide ? "max-w-4xl" : "max-w-3xl"}`}>
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
          {subtitle ? <p className="mt-3 text-sm text-muted sm:text-base">{subtitle}</p> : null}
          <div className="prose-legal mt-8 space-y-8 text-sm leading-relaxed text-muted sm:text-base">
            {children}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
