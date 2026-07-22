"use client";

/**
 * Generic accessible step indicator, shared by the OTP flows (Phone/Email),
 * the Physical Verification wizard, and any provider that wants to show
 * multi-step progress. Replaces the old OTP-only `VerificationStepIndicator`,
 * which hardcoded the `input/code/done` steps.
 */
export interface WorkflowStep<T extends string = string> {
  id: T;
  label: string;
}

interface WorkflowStepperProps<T extends string> {
  steps: ReadonlyArray<WorkflowStep<T>>;
  currentStepId: T;
}

export function WorkflowStepper<T extends string>({ steps, currentStepId }: WorkflowStepperProps<T>) {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);

  return (
    <ol className="flex items-center gap-0 mb-4" aria-label="Verification progress">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isActive = index === currentIndex;
        const statusLabel = isCompleted ? 'completed' : isActive ? 'current step' : 'upcoming';

        return (
          <li key={step.id} className="flex items-center" aria-current={isActive ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <div
                aria-hidden="true"
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              <span
                className={`text-[10px] mt-1 font-medium ${
                  isActive ? 'text-blue-400' : isCompleted ? 'text-green-400' : 'text-gray-600'
                }`}
              >
                {step.label}
                <span className="sr-only"> ({statusLabel})</span>
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                aria-hidden="true"
                className={`h-px w-10 mx-1 mb-4 transition-colors ${
                  index < currentIndex ? 'bg-green-500' : 'bg-gray-700'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
