import { NotebookPen, ImageUp, MailCheck } from "lucide-react";

const STEPS = [
  {
    icon: NotebookPen,
    title: "Tell Us About the Job",
    description: "Write a short description.",
  },
  {
    icon: ImageUp,
    title: "Upload Photos",
    description: "Add clear photos of the area or item needing work.",
  },
  {
    icon: MailCheck,
    title: "We Review Your Request",
    description: "We'll reply by email or Facebook Messenger.",
  },
];

export default function HowItWorks() {
  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Get a Quote in 3 Easy Steps
        </h2>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="flex flex-col items-center gap-3 rounded-xl border border-border-soft bg-surface p-6 text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold bg-surface-2 font-heading text-sm font-bold text-gold-bright">
                  {index + 1}
                </span>
                <Icon className="h-6 w-6 text-gold-bright" aria-hidden="true" />
                <h3 className="font-heading text-base font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm text-muted">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
