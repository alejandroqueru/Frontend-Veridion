"use client";

import { SectionContainer } from "@/shared/components/section-container";
import { BarChart3, AlertTriangle, ShieldCheck } from "lucide-react";
import { useHumanScoreSummary, useScoreExplanation } from "@/features/scoring/hooks";
import { useReviewStore } from "@/features/review/store/review-store";
import { ContributionBreakdown, VerificationHistoryTimeline, ScoreSimulator } from "@/features/scoring/components";
import { ScoreSummary } from "./overview/score-summary";
import { CategoryBreakdown } from "./overview/category-breakdown";
import { NextBestAction } from "./overview/next-best-action";
import { RecentActivity } from "./overview/recent-activity";
import Link from "next/link";

export function DashboardOverview() {
  const summary = useHumanScoreSummary();
  const explanation = useScoreExplanation();

  const { isAdmin, riskScore, setAdminMode, setRiskScore, getFlagStatusForAccount } = useReviewStore();
  const flagStatus = getFlagStatusForAccount('current-user');

  return (
    <div className="mb-6 sm:mb-8">
      {/* DEVELOPER SIMULATION TOOLS */}
      <div className="bg-[#111111] border border-blue-500/30 rounded-xl p-4 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">DEV MODE</div>
        <h4 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          Review Workflow Simulation
        </h4>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Risk Score:</span>
            <input 
              type="range" 
              min="0" max="100" 
              value={riskScore}
              onChange={(e) => setRiskScore('current-user', parseInt(e.target.value), [{ source: 'manual-test', score: parseInt(e.target.value), reason: 'Testing flagged account' }])}
              className="w-32 accent-blue-500"
            />
            <span className="text-sm font-mono text-white bg-[#222] px-2 py-1 rounded">{riskScore}</span>
          </div>
          <div className="h-6 w-px bg-[#333]"></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isAdmin}
              onChange={(e) => setAdminMode(e.target.checked)}
              className="rounded border-[#333] bg-[#222] accent-blue-500"
            />
            <span className="text-sm text-gray-400">Admin Mode</span>
          </label>
          {isAdmin && (
            <Link href="/admin/review" className="text-sm font-medium text-blue-400 hover:text-blue-300 ml-auto border border-blue-500/50 px-3 py-1 rounded-md transition-colors">
              Go to Admin Panel →
            </Link>
          )}
        </div>
      </div>

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
