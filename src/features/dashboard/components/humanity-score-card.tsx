"use client";
import { Card } from "@/shared/ui/card";
import { Symbol } from "@/shared/components/icons/symbol";
import { useEffect, useRef } from "react";
import { useScoreExplanation } from "@/features/scoring/hooks";

export function HumanityScoreCard() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { totalScore } = useScoreExplanation();

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleEnded = () => {
            video.currentTime = 0;
            video.play().catch(console.error);
        };

        const handleVisibilityChange = () => {
            if (!document.hidden && video.paused) {
                video.play().catch(console.error);
            }
        };

        video.addEventListener('ended', handleEnded);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Asegurar que el video se reproduzca
        video.play().catch(console.error);

        return () => {
            video.removeEventListener('ended', handleEnded);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return (
        <Card className="relative overflow-hidden border-none p-3 sm:p-4 lg:p-6 h-40 sm:h-36 lg:h-64 w-full">
            {/* Video Background */}
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
            >
                <source src="/videos/points.mp4" type="video/mp4" />
            </video>

            <div className="absolute inset-0 bg-black/20" />

            <div className="relative z-10 flex flex-col items-center justify-center h-full">
                <div className="text-white flex items-center justify-center gap-2 mb-2">
                    <Symbol size="xxl" />
                    <div className="text-4xl sm:text-4xl lg:text-[44px] font-bold">{Math.round(totalScore)}</div>
                </div>
                <div className="text-sm sm:text-sm lg:text-lg text-white/80 text-center">Humanity points</div>
            </div>
        </Card>
    );
}