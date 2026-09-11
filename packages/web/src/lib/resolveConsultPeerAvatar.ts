import type { VetConsultation } from '@petdate/shared';
import { getTeamAgentByName } from '@petdate/shared';

/** Prefer API avatar; for team agents fall back to TEAM_AGENTS photo by name. */
export function resolveConsultPeerAvatarUrl(
  c: VetConsultation,
  mode: 'as_vet' | 'as_patient',
): string | undefined {
  if (mode === 'as_patient') {
    const fromApi = String(c.vetAvatarUrl || '').trim();
    if (fromApi) return fromApi;
    const team = getTeamAgentByName(c.vetName);
    return team?.avatarUrl;
  }
  const fromPatient = String(c.patientAvatarUrl || '').trim();
  return fromPatient || undefined;
}
