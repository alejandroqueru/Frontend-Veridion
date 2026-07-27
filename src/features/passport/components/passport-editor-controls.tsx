'use client';

import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Button } from '@/shared/ui/button';
import { PASSPORT_TEMPLATES } from '../templates/template-registry';
import type { PassportPresentationOptions, PassportTemplateId, QrPresentationOptions } from '../types';

export interface PassportEditorControlsProps {
  presentation: PassportPresentationOptions;
  onChange: (next: PassportPresentationOptions) => void;
}

const ERROR_CORRECTION_LEVELS: readonly QrPresentationOptions['errorCorrectionLevel'][] = ['L', 'M', 'Q', 'H'];

/**
 * All native/Radix controls (native color/range/checkbox inputs, Radix
 * Tabs) — keyboard accessibility comes from the underlying elements rather
 * than anything bespoke here.
 */
export function PassportEditorControls({ presentation, onChange }: PassportEditorControlsProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-xs uppercase tracking-wide opacity-60 block mb-2">Template</label>
        <Tabs
          value={presentation.template}
          onValueChange={(value) => onChange({ ...presentation, template: value as PassportTemplateId })}
        >
          <TabsList>
            {Object.entries(PASSPORT_TEMPLATES).map(([id, { label }]) => (
              <TabsTrigger key={id} value={id}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center justify-between">
        <label htmlFor="passport-accent-color" className="text-xs uppercase tracking-wide opacity-60">
          Accent color
        </label>
        <input
          id="passport-accent-color"
          type="color"
          value={presentation.accentColor}
          onChange={(event) => onChange({ ...presentation, accentColor: event.target.value })}
          className="h-8 w-12 rounded border border-custom-border bg-transparent"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-wide opacity-60 block mb-2">Layout</label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={presentation.layout === 'detailed' ? 'default' : 'outline'}
            onClick={() => onChange({ ...presentation, layout: 'detailed' })}
          >
            Detailed
          </Button>
          <Button
            type="button"
            size="sm"
            variant={presentation.layout === 'compact' ? 'default' : 'outline'}
            onClick={() => onChange({ ...presentation, layout: 'compact' })}
          >
            Compact
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="passport-qr-enabled" className="text-xs uppercase tracking-wide opacity-60">
            QR code
          </label>
          <input
            id="passport-qr-enabled"
            type="checkbox"
            checked={presentation.qr.enabled}
            onChange={(event) => onChange({ ...presentation, qr: { ...presentation.qr, enabled: event.target.checked } })}
          />
        </div>

        {presentation.qr.enabled && (
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="passport-qr-size" className="text-xs opacity-60 block mb-1">
                Size: {presentation.qr.size}px
              </label>
              <input
                id="passport-qr-size"
                type="range"
                min={96}
                max={320}
                step={8}
                value={presentation.qr.size}
                onChange={(event) => onChange({ ...presentation, qr: { ...presentation.qr, size: Number(event.target.value) } })}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs opacity-60 block mb-1">Error correction</label>
              <Tabs
                value={presentation.qr.errorCorrectionLevel}
                onValueChange={(value) =>
                  onChange({
                    ...presentation,
                    qr: { ...presentation.qr, errorCorrectionLevel: value as QrPresentationOptions['errorCorrectionLevel'] },
                  })
                }
              >
                <TabsList>
                  {ERROR_CORRECTION_LEVELS.map((level) => (
                    <TabsTrigger key={level} value={level}>
                      {level}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
