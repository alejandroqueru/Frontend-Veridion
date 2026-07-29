"use client";

import { Header } from "@/features/dashboard/components/header";
import { useRetentionEnforcement } from "@/features/data-privacy/use-retention-enforcement";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  // Run retention policy purge check on every dashboard load
  useRetentionEnforcement();

  return (
    <div className="min-h-screen bg-[#0B0A0A] text-white">
      <Header />
      <main className="pt-[70px]">{children}</main>
    </div>
  );
}