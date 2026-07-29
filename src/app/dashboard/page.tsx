"use client";

import { useState } from "react";
import { DashboardLayout } from "@/features/dashboard/layout/dashboard-layout";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { HumanityScoreSection } from "@/features/dashboard/components/humanity-secore-section";
import { VerificationSection } from "@/features/dashboard/components/physical-verifications/verification-section";
import { SocialMediaSection } from "@/features/dashboard/components/social-media-verifications/social-media-section";
import { BlockchainSection } from "@/features/dashboard/components/blockchain-verifications/blockchain-section";
import { DataManagementPanel } from "@/features/data-privacy/components/data-management-panel";
import { PostDeletionState } from "@/features/data-privacy/components/post-deletion-state";
import { useDataSubjectStatus } from "@/features/data-privacy/use-data-subject-status";

export default function Dashboard() {
  const dataSubjectStatus = useDataSubjectStatus();
  // Track in-session deletion so we immediately show the banner without
  // requiring a page reload (the store will persist for future loads too).
  const [justDeleted, setJustDeleted] = useState(false);

  const isDeleted = dataSubjectStatus === "deleted" || justDeleted;

  return (
    <>
      <DashboardLayout>
        <div className="py-6 px-4 sm:py-8 sm:px-6 lg:py-12 lg:px-16 xl:px-24">
          {isDeleted ? (
            /* ── Post-deletion view ── */
            <div className="space-y-8">
              <PostDeletionState />
              <DataManagementPanel />
            </div>
          ) : (
            /* ── Normal dashboard ── */
            <>
              <HumanityScoreSection />
              <DashboardOverview />

              <div className="space-y-8">
                <SocialMediaSection />
                <BlockchainSection />
                <VerificationSection />
              </div>
            </>
          )}

          {/* Data management panel is always visible (below verifications when active) */}
          {!isDeleted && (
            <div className="mt-8">
              <DataManagementPanel onDeleted={() => setJustDeleted(true)} />
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}
