"use client";

import { Badge } from "@/shared/ui/badge";
import { Clock } from "lucide-react";
import type { RecentActivityItem } from "@/features/scoring/legacy";

interface RecentActivityProps {
  activity: RecentActivityItem[];
  isEmpty: boolean;
}

const CATEGORY_LABELS: Record<RecentActivityItem["category"], string> = {
  social: "Social",
  physical: "Physical",
  blockchain: "Blockchain",
};

function formatCompletedAt(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function RecentActivity({ activity, isEmpty }: RecentActivityProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-lighter-gray-text">Recent activity</h4>

      {isEmpty || activity.length === 0 ? (
        <div className="rounded-2xl border border-custom-border bg-card-darker p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-gray-text flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white mb-1">No verifications yet</p>
            <p className="text-xs text-gray-text">
              Complete a verification below to start earning Humanity points and see your
              activity here.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {activity.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-green-500/20 bg-dark-green-bg p-3 sm:p-4 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-green-200">{item.title}</span>
                  <Badge
                    variant="outline"
                    className="rounded-full text-xs border-green-500/50 text-green-400 bg-green-500/10"
                  >
                    {CATEGORY_LABELS[item.category]}
                  </Badge>
                </div>
                <p className="text-xs text-green-300/70">
                  {formatCompletedAt(item.completedAt)}
                </p>
              </div>
              <span className="flex-shrink-0 text-sm font-semibold text-green-400">
                +{item.points.toLocaleString()} pts
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
