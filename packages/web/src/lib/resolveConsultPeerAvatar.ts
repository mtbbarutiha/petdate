import type { VetConsultation } from '@petdate/shared';
import { getTeamAgentByName, profileAvatarUrl } from '@petdate/shared';

/** Prefer API still-photo avatar; for team agents fall back to TEAM_AGENTS photo by name. */
export function resolveConsultPeerAvatarUrl(
  c: VetConsultation,
  mode: 'as_vet' | 'as_patient',
): string | undefined {
  if (mode === 'as_patient') {
    const fromApi = profileAvatarUrl(c.vetAvatarUrl);
    if (fromApi) return fromApi;
    const team = getTeamAgentByName(c.vetName);
    return team?.avatarUrl;
  }
  return profileAvatarUrl(c.patientAvatarUrl);
}
