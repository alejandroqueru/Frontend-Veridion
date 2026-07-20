"use client";

import { Badge } from "@/shared/ui/badge";
import { ArrowRight, Trophy } from "lucide-react";
import type { NextBestActionItem } from "@/features/scoring/legacy";

interface NextBestActionProps {
  actions: NextBestActionItem[];
  isFullyCompleted: boolean;
}

const CATEGORY_LABELS: Record<NextBestActionItem["category"], string> = {
  social: "Social",
  physical: "Physical",
  blockchain: "Blockchain",
};

export function NextBestAction({ actions, isFullyCompleted }: NextBestActionProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-lighter-gray-text">Next best action</h4>

      {isFullyCompleted ? (
        <div className="rounded-2xl border border-green-500/30 bg-dark-green-bg p-4 flex items-center gap-3">
          <Trophy className="h-5 w-5 text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-200">
            You&apos;ve completed every verification. Your Human Score is fully maximized.
          </p>
        </div>
      ) : actions.length === 0 ? (
        <div className="rounded-2xl border border-custom-border bg-card-darker p-4">
          <p className="text-sm text-gray-text">
            Complete your first verification to start building your Human Score.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {actions.slice(0, 5).map((action, index) => (
            <li
              key={action.id}
              className="rounded-2xl border border-custom-border bg-card-darker p-3 sm:p-4 flex items-start gap-3"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#112541] border border-[#055BD0] flex items-center justify-center text-xs font-semibold text-white">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white">{action.title}</span>
                  <Badge
                    variant="outline"
                    className="rounded-full text-xs border-gray-600 text-gray-300 bg-button-verify"
                  >
                    {CATEGORY_LABELS[action.category]}
                  </Badge>
                </div>
                <p className="text-xs text-gray-text line-clamp-2">{action.description}</p>
              </div>
              <div className="flex-shrink-0 flex items-center gap-1 text-sm font-semibold text-[#7EDA76]">
                +{action.points.toLocaleString()}
                <ArrowRight className="h-3 w-3" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
