import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement media playback; components with <video autoPlay>
// (e.g. HumanityScoreCard, HeroSection) call video.play().catch(...), which
// throws on jsdom's unimplemented play() unless stubbed.
if (typeof window !== 'undefined' && window.HTMLMediaElement) {
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.HTMLMediaElement.prototype.pause = () => {};
}

