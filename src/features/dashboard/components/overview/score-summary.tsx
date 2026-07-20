"use client";

import { Symbol } from "@/shared/components/icons/symbol";
import { Badge } from "@/shared/ui/badge";
import { CheckCircle2, Sparkles, Target } from "lucide-react";
import type { VerificationSummary } from "@/features/scoring/legacy";

interface ScoreSummaryProps {
  summary: VerificationSummary;
}

function ProgressRing({
  percentage,
  size = 72,
}: {
  percentage: number;
  size?: number;
}) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2A2A2A"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#7EDA76"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold text-white">{percentage}%</span>
      </div>
    </div>
  );
}

export function ScoreSummary({ summary }: ScoreSummaryProps) {
  const pointsProgress =
    summary.totalAvailablePoints > 0
      ? Math.round((summary.totalPoints / summary.totalAvailablePoints) * 100)
      : 0;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
      <ProgressRing percentage={summary.completionPercentage} />

      <div className="flex-1 space-y-3 w-full">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Symbol size="lg" />
            <span className="text-2xl sm:text-3xl font-bold text-white">
              {summary.totalPoints.toLocaleString()}
            </span>
            <span className="text-sm text-gray-text">
              / {summary.totalAvailablePoints.toLocaleString()} pts
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className="rounded-full border-gray-600 text-gray-300 bg-button-verify"
          >
            <Target className="h-3 w-3 mr-1" />
            {summary.completedCount} / {summary.totalCount} verifications
          </Badge>

          {summary.isFullyCompleted && (
            <Badge
              variant="outline"
              className="rounded-full border-green-500 text-green-400 bg-green-500/10"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              All complete
            </Badge>
          )}

          {summary.isEmpty && summary.isHydrated && (
            <Badge
              variant="outline"
              className="rounded-full border-gray-600 text-gray-300 bg-button-verify"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Get started
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-text">
            <span>Points progress</span>
            <span>{pointsProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#2A2A2A] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#7EDA76] transition-all duration-500"
              style={{ width: `${pointsProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
