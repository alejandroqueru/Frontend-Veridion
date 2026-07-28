import type { PassportTemplateId } from '../types';
import type { PassportTemplateComponent } from './types';
import { ProfessionalTemplate } from './professional-template';
import { MinimalTemplate } from './minimal-template';
import { DaoTemplate } from './dao-template';
import { SocialTemplate } from './social-template';

export const PASSPORT_TEMPLATES: Record<PassportTemplateId, { label: string; component: PassportTemplateComponent }> = {
  professional: { label: 'Professional', component: ProfessionalTemplate },
  minimal: { label: 'Minimal', component: MinimalTemplate },
  dao: { label: 'DAO', component: DaoTemplate },
  social: { label: 'Social', component: SocialTemplate },
};

/** Falls back to 'professional' for an unrecognized template id — same never-throw idiom as `scoring/schema.ts`'s `getSchema`. */
export function getPassportTemplate(id: PassportTemplateId): PassportTemplateComponent {
  return (PASSPORT_TEMPLATES[id] ?? PASSPORT_TEMPLATES.professional).component;
}
