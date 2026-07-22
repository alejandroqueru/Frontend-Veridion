/**
 * Simulated external identity-verification partner. There is no real KYC/
 * biometrics/sanctions-screening vendor wired into this repo (no
 * credentials, no vendor SDK) — this stands in for that round-trip so the
 * Physical Verification workflow (steps, state, accessibility) is complete
 * and real, while the underlying "verification decision" is a mock. Swap
 * the body for a real vendor call without touching the calling component.
 */
export async function submitPhysicalVerification(
  fields: Record<string, string | boolean>,
): Promise<{ success: true } | { success: false; error: string }> {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const hasIncompleteField = Object.values(fields).some((value) => value === '' || value === false);
  if (hasIncompleteField) {
    return { success: false, error: 'Please complete all required fields.' };
  }

  return { success: true };
}
