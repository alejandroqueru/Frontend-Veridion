import { describe, expect, it, vi } from 'vitest';

import { signMessageWithWallet } from './walletConfig';
import type { MessageSigningKit } from './walletConfig';

const MESSAGE = 'Veridion authentication request';

function kitThat(signMessage: MessageSigningKit['signMessage']): MessageSigningKit {
  return { setWallet: vi.fn(), signMessage };
}

describe('signMessageWithWallet', () => {
  it('re-selects the adapter before signing', async () => {
    // A kit instance is built fresh per call and does not remember which wallet
    // the user connected with, so skipping this would sign with nothing.
    const kit = kitThat(vi.fn().mockResolvedValue({ signedMessage: 'c2ln' }));

    await signMessageWithWallet(kit, 'freighter', MESSAGE);

    expect(kit.setWallet).toHaveBeenCalledWith('freighter');
    expect(kit.signMessage).toHaveBeenCalledWith(MESSAGE);
  });

  it('returns the signature the wallet produced', async () => {
    const kit = kitThat(vi.fn().mockResolvedValue({ signedMessage: 'c2lnbmF0dXJl' }));
    await expect(signMessageWithWallet(kit, 'freighter', MESSAGE)).resolves.toBe('c2lnbmF0dXJl');
  });

  it('reports a declined prompt as a typed signing error', async () => {
    const kit = kitThat(vi.fn().mockRejectedValue(new Error('User declined the request')));

    await expect(signMessageWithWallet(kit, 'freighter', MESSAGE)).rejects.toMatchObject({
      code: 'SIGNING_ERROR',
      message: 'User declined the request',
    });
  });

  it('reports an adapter failure as a typed signing error', async () => {
    const kit = kitThat(vi.fn().mockRejectedValue(new Error('Freighter is locked')));

    await expect(signMessageWithWallet(kit, 'freighter', MESSAGE)).rejects.toMatchObject({
      code: 'SIGNING_ERROR',
      message: 'Freighter is locked',
    });
  });

  it('treats an empty signature as a failure rather than passing it on', async () => {
    // A wallet that resolves with nothing would otherwise produce a request
    // that fails confusingly at /auth/verify instead of here.
    const kit = kitThat(vi.fn().mockResolvedValue({ signedMessage: '' }));

    await expect(signMessageWithWallet(kit, 'freighter', MESSAGE)).rejects.toMatchObject({
      code: 'SIGNING_ERROR',
    });
  });

  it('survives a non-Error rejection', async () => {
    const kit = kitThat(vi.fn().mockRejectedValue('nope'));

    await expect(signMessageWithWallet(kit, 'freighter', MESSAGE)).rejects.toMatchObject({
      code: 'SIGNING_ERROR',
      message: 'Failed to sign the message',
    });
  });
});
