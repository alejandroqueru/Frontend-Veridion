"use client";

import React, { useEffect, useState } from "react";
import { useReviewStore } from "@/features/review/store/review-store";
import { ReviewQueue } from "@/features/review/components/review-queue";

export default function AdminReviewPage() {
  const isAdmin = useReviewStore((s) => s.isAdmin);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="bg-[#111111] border border-red-500/20 rounded-xl p-8 max-w-md w-full">
          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 text-sm">
            You do not have the required permissions to view the internal review surface. This area is restricted to authorized reviewers only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-12 xl:px-24">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Flagged Accounts Review</h1>
        <p className="text-gray-400 text-sm">
          Review accounts that have crossed the risk threshold and determine their resolution.
        </p>
      </div>
      <ReviewQueue />
    </div>
  );
}
