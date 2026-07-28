// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PassportRenderer } from '../passport-renderer';
import { PassportEditorControls } from '../passport-editor-controls';
import { DEFAULT_PRESENTATION_OPTIONS } from '../../types';
import { PASSPORT_TEMPLATES } from '../../templates/template-registry';
import type { PassportSnapshot } from '../../types';

const SNAPSHOT: PassportSnapshot = {
  algorithmVersion: 'v2',
  computedAt: Date.now(),
  totalScore: 42,
  categories: [
    {
      category: 'social',
      label: 'Social',
      earnedPoints: 6,
      cap: 24,
      providers: [
        {
          providerId: 'github',
          category: 'social',
          label: 'GitHub',
          points: 6,
          occurredAt: Date.now(),
          isUnknownProvider: false,
        },
      ],
    },
  ],
};

describe('PassportRenderer — same schema instance across all 4 templates', () => {
  it.each(Object.keys(PASSPORT_TEMPLATES) as Array<keyof typeof PASSPORT_TEMPLATES>)(
    'renders the total score and every provider label for the %s template',
    (templateId) => {
      render(
        <PassportRenderer
          snapshot={SNAPSHOT}
          presentation={{ ...DEFAULT_PRESENTATION_OPTIONS, template: templateId }}
          context="public"
        />,
      );

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    },
  );

  it('falls back to the professional template for an unrecognized template id, never throws', () => {
    expect(() =>
      render(
        <PassportRenderer
          // @ts-expect-error deliberately passing an invalid id to exercise the fallback
          presentation={{ ...DEFAULT_PRESENTATION_OPTIONS, template: 'does-not-exist' }}
          snapshot={SNAPSHOT}
          context="public"
        />,
      ),
    ).not.toThrow();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});

describe('PassportEditorControls — keyboard accessibility', () => {
  it('tab order reaches every interactive control without getting trapped', async () => {
    const user = userEvent.setup();
    render(<PassportEditorControls presentation={DEFAULT_PRESENTATION_OPTIONS} onChange={() => {}} />);

    const visited = new Set<Element>();
    for (let i = 0; i < 12; i++) {
      await user.tab();
      if (document.activeElement && document.activeElement !== document.body) {
        visited.add(document.activeElement);
      }
    }

    // Template tabs, accent color input, layout buttons, and the QR checkbox
    // should all be independently reachable by keyboard alone.
    expect(visited.size).toBeGreaterThanOrEqual(6);
  });
});
