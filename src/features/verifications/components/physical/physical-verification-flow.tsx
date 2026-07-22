"use client";

import { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { WorkflowStepper, type WorkflowStep } from '../shared/workflow-stepper';
import { VerificationStatusAnnouncer } from '../shared/verification-status';
import { useSynchronousVerification } from '../../hooks/use-synchronous-verification';
import { useVerificationStore, type VerificationType } from '../../store/verification-store';
import { getPhysicalFlowConfig } from '../../constants/physical-verification-flows';
import { submitPhysicalVerification } from '../../services/physical-verification-mock';

type PhysicalStep = 'instructions' | 'capture' | 'processing' | 'done';

const STEPS: WorkflowStep<PhysicalStep>[] = [
  { id: 'instructions', label: 'Overview' },
  { id: 'capture', label: 'Details' },
  { id: 'processing', label: 'Review' },
  { id: 'done', label: 'Done' },
];

interface PhysicalVerificationFlowProps {
  methodId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Full multi-step workflow for the four Physical Verification methods
 * (government-id, binance, biometrics, proof-clean-hands), which previously
 * had only a static card and a "Start Verification" button that did
 * nothing but close the modal. One generic component, configured per
 * method via `PHYSICAL_FLOWS`, drives Instructions → Details → Processing →
 * Done through the same shared lifecycle machine every other provider uses.
 */
export function PhysicalVerificationFlow({ methodId, onSuccess, onError }: PhysicalVerificationFlowProps) {
  const config = getPhysicalFlowConfig(methodId);
  const [step, setStep] = useState<PhysicalStep>('instructions');
  const [fields, setFields] = useState<Record<string, string | boolean>>({});
  const { status, error, begin, succeed, fail, retry } = useSynchronousVerification(methodId as VerificationType);
  const recordVerificationEvent = useVerificationStore((state) => state.recordVerificationEvent);

  if (!config) {
    return <p className="text-sm text-red-400">Unknown verification method.</p>;
  }

  const canSubmit = config.fields.every((field) => {
    const value = fields[field.id];
    return field.type === 'checkbox' ? value === true : typeof value === 'string' && value.trim().length > 0;
  });

  async function handleSubmit() {
    setStep('processing');
    // `begin` (CONNECT) is only valid from idle; a resubmission after a
    // prior failure starts from `failed`, which only accepts RETRY/RESET.
    if (status === 'failed') {
      retry();
    } else {
      begin();
    }
    const result = await submitPhysicalVerification(fields);
    if (result.success) {
      recordVerificationEvent(methodId as VerificationType, 'physical', { ...fields, source: 'mock-adapter' });
      succeed();
      setStep('done');
      onSuccess?.();
    } else {
      fail(result.error);
      setStep('capture');
      onError?.(result.error);
    }
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle className="h-9 w-9 text-green-400" />
        </div>
        <p className="text-white font-semibold text-lg">Verification submitted!</p>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-5 py-2">
          <span className="text-green-400 font-bold text-lg">+{config.points}</span>
          <span className="text-green-400/70 text-sm ml-1">points awarded</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WorkflowStepper steps={STEPS} currentStepId={step} />

      {step === 'instructions' && (
        <>
          <p className="text-gray-300 text-sm leading-relaxed">{config.instructions}</p>
          <Button onClick={() => setStep('capture')} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            Continue
          </Button>
        </>
      )}

      {(step === 'capture' || step === 'processing') && (
        <>
          <div className="space-y-3">
            {config.fields.map((field) =>
              field.type === 'text' ? (
                <div key={field.id}>
                  <label htmlFor={field.id} className="block text-sm text-gray-300 mb-1">
                    {field.label}
                  </label>
                  <input
                    id={field.id}
                    type="text"
                    placeholder={field.placeholder}
                    value={(fields[field.id] as string) ?? ''}
                    disabled={step === 'processing'}
                    onChange={(e) => setFields((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              ) : (
                <div key={field.id} className="flex items-center gap-2">
                  <input
                    id={field.id}
                    type="checkbox"
                    checked={(fields[field.id] as boolean) ?? false}
                    disabled={step === 'processing'}
                    onChange={(e) => setFields((prev) => ({ ...prev, [field.id]: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <label htmlFor={field.id} className="text-sm text-gray-300">
                    {field.label}
                  </label>
                </div>
              ),
            )}
          </div>

          <VerificationStatusAnnouncer
            status={status === 'failed' ? 'failed' : step === 'processing' ? 'connecting' : 'idle'}
            connectingMessage={config.processingLabel}
            errorMessage={error}
            onRetry={handleSubmit}
          />

          {status !== 'failed' && (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || step === 'processing'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {step === 'processing' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {step === 'processing' ? 'Submitting…' : 'Submit'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
