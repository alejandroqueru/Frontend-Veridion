"use client";

import type { OtpStep } from '../../types/otp.types';
import { WorkflowStepper, type WorkflowStep } from '../shared/workflow-stepper';

const STEPS: WorkflowStep<OtpStep>[] = [
  { id: 'input', label: 'Enter' },
  { id: 'code', label: 'Verify' },
  { id: 'done', label: 'Done' },
];

interface VerificationStepIndicatorProps {
  currentStep: OtpStep;
}

export function VerificationStepIndicator({ currentStep }: VerificationStepIndicatorProps) {
  return <WorkflowStepper steps={STEPS} currentStepId={currentStep} />;
}
