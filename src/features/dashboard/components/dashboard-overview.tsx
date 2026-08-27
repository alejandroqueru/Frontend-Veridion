"use client";

import { SectionContainer } from "@/shared/components/section-container";
import { BarChart3, AlertTriangle } from "lucide-react";
import { useHumanScoreSummary, useScoreExplanation } from "@/features/scoring/hooks";
import { useReviewStore } from "@/features/review/store/review-store";
import { ContributionBreakdown, VerificationHistoryTimeline, ScoreSimulator } from "@/features/scoring/components";
import { ScoreSummary } from "./overview/score-summary";
import { CategoryBreakdown } from "./overview/category-breakdown";
import { NextBestAction } from "./overview/next-best-action";
import { RecentActivity } from "./overview/recent-activity";

export function DashboardOverview() {
  const summary = useHumanScoreSummary();
  const explanation = useScoreExplanation();

  const { getFlagStatusForAccount } = useReviewStore();
  const flagStatus = getFlagStatusForAccount('current-user');

  return (
    <div className="mb-6 sm:mb-8">
      {/* USER FACING NON-PUNITIVE FLAG BANNER */}
      {flagStatus === 'flagged' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-yellow-500 font-medium text-sm">Account Status: Under Routine Review</h4>
            <p className="text-yellow-500/80 text-sm mt-1">
              Your account has been selected for a routine security review. No action is needed from your side, and your current verifications remain valid while our team completes the process.
            </p>
          </div>
        </div>
      )}

      <SectionContainer className="p-3 sm:p-4 lg:p-6">
        <div className="flex items-start gap-2 mb-4 sm:mb-6">
          <div className="p-1.5 bg-[#112541] border-[1.5px] border-[#055BD0] rounded-full">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white">
              Verification analytics
            </h3>
            <p className="text-xs sm:text-[13px] text-gray-text mt-0.5">
              Your progress toward a complete Human Score
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <ScoreSummary summary={summary} />

          <CategoryBreakdown categories={summary.categories} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NextBestAction
              actions={summary.nextBestActions}
              isFullyCompleted={summary.isFullyCompleted}
            />
            <RecentActivity
              activity={summary.recentActivity}
              isEmpty={summary.isEmpty}
            />
          </div>
        </div>
      </SectionContainer>

      <SectionContainer className="p-3 sm:p-4 lg:p-6 mt-6">
        <div className="mb-4 sm:mb-6">
          <h3 className="text-sm sm:text-base font-semibold text-white">Score explainability</h3>
          <p className="text-xs sm:text-[13px] text-gray-text mt-0.5">
            How each verification contributes to your score, and its full history
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ContributionBreakdown explanation={explanation} />
          <VerificationHistoryTimeline explanation={explanation} />
        </div>

        <div className="mt-6">
          <ScoreSimulator />
        </div>
      </SectionContainer>
    </div>
  );
}
