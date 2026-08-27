"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuthSession } from "@/features/auth/use-auth-session";
import { ReviewQueue } from "@/features/review/components/review-queue";
import type { Role } from "@/features/auth/types";

// Internal review surface.
//
// Access used to hinge on `useReviewStore().isAdmin` — a client-side boolean
// anyone could flip from a console. It now asks the server who the caller is:
// `/api/v1/auth/sessions` runs `requireSession`, which verifies the token's
// signature and resolves roles from the server-held allowlist, so the answer
// cannot be forged by editing client state.
//
// This gate is still UX, not the security boundary. The flagged-account data
// itself comes from `api/internal/risk-review`, which independently requires a
// `reviewer` role — so rendering this page proves nothing on its own, and
// bypassing it gains nothing.

type Access = "checking" | "anonymous" | "denied" | "granted";

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="bg-[#111111] border border-red-500/20 rounded-xl p-8 max-w-md w-full">
        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">{title}</h1>
        <div className="text-gray-400 text-sm">{children}</div>
      </div>
    </div>
  );
}

export default function AdminReviewPage() {
  const { status, error, signIn, authorizedFetch } = useAuthSession();
  const [access, setAccess] = useState<Access>("checking");

  const checkAccess = useCallback(async () => {
    const res = await authorizedFetch("/api/v1/auth/sessions");
    if (!res.ok) {
      setAccess("anonymous");
      return;
    }

    const body = (await res.json()) as { roles: Role[] };
    // Reviewer is the floor; senior reviewers and admins reach it by
    // implication, resolved server-side.
    setAccess(body.roles.includes("reviewer") ? "granted" : "denied");
  }, [authorizedFetch]);

  useEffect(() => {
    if (status === "authenticating") return;
    void checkAccess();
  }, [status, checkAccess]);

  if (access === "checking") return null;

  if (access === "anonymous") {
    return (
      <Notice title="Sign in required">
        <p className="mb-4">
          This area is restricted to authorized reviewers. Prove control of your wallet to continue.
        </p>
        <button
          onClick={() => void signIn().then(checkAccess)}
          className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-semibold hover:bg-white/20"
        >
          Sign with wallet
        </button>
        {error && <p className="mt-3 text-red-400 text-xs">{error}</p>}
      </Notice>
    );
  }

  if (access === "denied") {
    return (
      <Notice title="Access Denied">
        You do not have the required permissions to view the internal review surface. This area is
        restricted to authorized reviewers only.
      </Notice>
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
