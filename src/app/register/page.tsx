import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { SafeHavenRegistrationForm } from "@/components/SafeHavenRegistrationForm";

export const metadata: Metadata = {
  title: "Become a LOG POSE Safe Haven",
  description:
    "Register your establishment to be considered for the physically verified LOG POSE Safe Haven network in Bengaluru.",
};

const WORKFLOW = [
  "You submit this application",
  "Our team reviews the submitted details",
  "A LOG POSE verification employee is assigned",
  "They visit your establishment in person",
  "A verification report is recorded",
  "An admin approves or rejects the application",
  "Approved establishments receive the LOG POSE SAFE HAVEN designation",
];

export default function RegisterPage() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950">
      <Header compact />

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <h1 className="text-2xl font-semibold text-white">
          Become a LOG POSE Safe Haven
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Safe Havens are establishments that agree to let someone step inside
          and wait when they feel unsafe. Registering does not grant the
          designation on its own.
        </p>

        <div className="mt-5 rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
          <h2 className="text-sm font-semibold text-white">
            How verification works
          </h2>
          <ol className="mt-3 space-y-2">
            {WORKFLOW.map((step, index) => (
              <li key={step} className="flex gap-2.5 text-sm text-zinc-300">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] text-zinc-400">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            Your Trust Score is calculated by LOG POSE from the facilities
            confirmed during verification. It cannot be chosen or purchased.
          </p>
        </div>

        <div className="mt-5">
          <SafeHavenRegistrationForm />
        </div>
      </main>
    </div>
  );
}
