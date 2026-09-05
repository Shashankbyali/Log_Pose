import type { Metadata } from "next";
import { AdminDashboard } from "@/components/AdminDashboard";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "LOG POSE Admin — Safe Haven verification",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <div className="lp-ambient min-h-[100dvh]">
      <Header compact />

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-white">
            Safe Haven verification
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Review applications, assign physical verification visits and approve
            the LOG POSE Safe Haven designation.
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            This dashboard shows real application records only. No individual
            user activity is tracked or displayed anywhere in LOG POSE.
          </p>
        </div>

        <AdminDashboard />
      </main>
    </div>
  );
}
