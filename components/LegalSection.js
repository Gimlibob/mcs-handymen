export default function LegalSection({ number, title, children }) {
  return (
    <section>
      <h2 className="font-heading text-xl font-semibold text-foreground">
        {number}. {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
