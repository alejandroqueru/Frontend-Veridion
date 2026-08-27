import { describe, it, expect, beforeEach } from 'vitest';
import { useReviewStore } from '../store/review-store';

describe('Flagged Account Review Workflow', () => {
  beforeEach(() => {
    // Clear the store before each test
    useReviewStore.setState({
      isAdmin: false,
      riskScore: 0,
      riskThreshold: 80,
      flags: [],
    });
  });

  it('marks an account as "flagged for review" when crossing the threshold', () => {
    const { setRiskScore } = useReviewStore.getState();
    
    // Below threshold
    setRiskScore('user-1', 79, [{ source: 'test', score: 79, reason: 'test' }]);
    expect(useReviewStore.getState().getFlagStatusForAccount('user-1')).toBeNull();
    
    // Above threshold
    useReviewStore.getState().setRiskScore('user-1', 85, [{ source: 'test', score: 85, reason: 'test' }]);
    expect(useReviewStore.getState().getFlagStatusForAccount('user-1')).toBe('flagged');
  });

  it('allows an authorized reviewer to resolve a flagged account', () => {
    const { setRiskScore, resolveFlag } = useReviewStore.getState();
    
    setRiskScore('user-1', 90, [{ source: 'test', score: 90, reason: 'test' }]);
    const flag = useReviewStore.getState().flags[0];
    
    expect(flag).toBeDefined();
    expect(flag.status).toBe('flagged');
    
    resolveFlag(flag.id, 'confirmed-human', 'admin-123', 'Looks fine');
    
    const resolvedFlag = useReviewStore.getState().flags[0];
    expect(resolvedFlag.status).toBe('confirmed-human');
    expect(resolvedFlag.resolvedBy).toBe('admin-123');
    expect(resolvedFlag.resolutionNotes).toBe('Looks fine');
    expect(resolvedFlag.resolvedAt).toBeDefined();
  });

  it('ensures a dismissed flag does not immediately re-trigger from the same signals', () => {
    const { setRiskScore, resolveFlag } = useReviewStore.getState();
    const signals = [{ source: 'test', score: 90, reason: 'test' }];
    
    // 1. Trigger the flag
    setRiskScore('user-1', 90, signals);
    const flag1 = useReviewStore.getState().flags[0];
    expect(flag1.status).toBe('flagged');
    
    // 2. Dismiss the flag
    resolveFlag(flag1.id, 'dismissed', 'admin-123');
    
    // 3. Try to trigger again with the exact same score and signals length
    setRiskScore('user-1', 90, signals);
    
    // 4. Verify it was NOT flagged again
    const allFlags = useReviewStore.getState().flags;
    expect(allFlags.length).toBe(1); // Still only the dismissed one
    expect(useReviewStore.getState().getFlagStatusForAccount('user-1')).toBe('dismissed');
    
    // 5. Try to trigger with a DIFFERENT score/signals
    setRiskScore('user-1', 95, [...signals, { source: 'test2', score: 5, reason: 'new' }]);
    
    const flagsAfterNewSignal = useReviewStore.getState().flags;
    expect(flagsAfterNewSignal.length).toBe(2);
    expect(useReviewStore.getState().getFlagStatusForAccount('user-1')).toBe('flagged');
  });
});
