"use client";

import type { CategorySummary } from "@/features/scoring/legacy";

interface CategoryBreakdownProps {
  categories: CategorySummary[];
}

const CATEGORY_COLORS: Record<CategorySummary["category"], string> = {
  social: "#055BD0",
  physical: "#7EDA76",
  blockchain: "#FFD700",
};

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-lighter-gray-text">Category breakdown</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {categories.map((category) => {
          const pointsProgress =
            category.availablePoints > 0
              ? Math.round((category.earnedPoints / category.availablePoints) * 100)
              : 0;

          return (
            <div
              key={category.category}
              className="rounded-2xl border border-custom-border bg-card-darker p-3 sm:p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{category.label}</span>
                <span className="text-xs text-gray-text">
                  {category.completedCount}/{category.totalCount}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-text">Points</span>
                  <span className="text-white">
                    {category.earnedPoints.toLocaleString()} /{" "}
                    {category.availablePoints.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#2A2A2A] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pointsProgress}%`,
                      backgroundColor: CATEGORY_COLORS[category.category],
                    }}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-text">{category.completionPercentage}% complete</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
