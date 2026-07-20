"use client";
import { Card } from "@/shared/ui/card";
import { Logo } from "@/shared/components/icons/logotype";
import { Symbol } from "@/shared/components/icons/symbol";
import { ConnectWallet } from "@/features/wallet/components/ConnectWallet";
import { useEffect, useRef } from "react";
import { useScoreExplanation } from "@/features/scoring/hooks";

export function HeroSection() {
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

        video.play().catch(console.error);

        return () => {
            video.removeEventListener('ended', handleEnded);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return (
        <div className="h-screen relative overflow-hidden">
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

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Header */}
            <div className="relative z-10 p-6 flex justify-center">
                <Logo size="xxl" />
            </div>

            {/* Content */}
            <div className="relative z-10 h-screen flex items-start pt-[16rem]">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                        {/* Left Side - Score Card */}
                        <div className="flex justify-center">
                            {/* Main Score Card */}
                            <Card className="bg-white/10 backdrop-blur-md border-white/20 p-12 rounded-3xl w-full max-w-2xl">
                                <div className="text-center space-y-6">
                                    <div className="flex items-center justify-center gap-2 text-white/90">
                                        <h2 className="text-lg font-medium">Unique Humanity Score</h2>
                                    </div>
                                    
                                    <div className="flex items-center justify-center gap-6">
                                        <Symbol size="xxxl" className="text-white" />
                                        <div className="text-8xl font-bold text-white">{Math.round(totalScore)}</div>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Right Side - Content */}
                        <div className="space-y-6 text-white">
                            <div className="space-y-4">
                                <h1 className="text-2xl lg:text-5xl font-bold leading-tight">
                                    Verify Your Humanity,<br />
                                    Your Way.
                                </h1>
                                <p className="text-xl text-white/80 leading-relaxed">
                                    Collect Stamps, build your Unique Humanity Score, and access the internet built for humans.
                                </p>
                            </div>

                            <ConnectWallet />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}