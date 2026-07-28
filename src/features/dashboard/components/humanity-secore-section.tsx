"use client";

import { HumanityScoreCard } from "@/features/dashboard/components/humanity-score-card";
import { HumanityInfoPanel } from "@/features/dashboard/components/humanity-info-panel";
import { SectionContainer } from "@/shared/components/section-container";
import { Separator } from "@/shared/components/separator";
import { ShareToPassportButton } from "@/features/passport/components/share-passport-button";

export function HumanityScoreSection() {
    return (
        <div className="mb-6 sm:mb-8">
            <SectionContainer className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
                    <span className="text-lg sm:text-lg text-lighter-gray-text">Humanity score</span>
                    <ShareToPassportButton />
                </div>
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-stretch">
                    <div className="flex-1 w-full lg:max-w-md xl:max-w-lg">
                        <HumanityScoreCard />
                    </div>
                    <div className="hidden lg:flex items-stretch">
                        <Separator orientation="vertical" className="h-full w-[2px]" />
                    </div>
                    <div className="flex-1 w-full lg:max-w-xl">
                        <HumanityInfoPanel />
                    </div>
                </div>
            </SectionContainer>
        </div>
    );
}