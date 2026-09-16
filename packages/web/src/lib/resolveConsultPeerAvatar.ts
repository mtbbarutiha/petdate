import type { VetConsultation } from '@petdate/shared';
import {
  getTeamAgentByName,
  isGenderDefaultAvatarPath,
  resolveProfileDisplayAvatarUrl,
} from '@petdate/shared';

/** Prefer API still-photo avatar; for team agents fall back to TEAM_AGENTS photo by name. */
export function resolveConsultPeerAvatarUrl(
  c: VetConsultation,
  mode: 'as_vet' | 'as_patient',
): string | undefined {
  if (mode === 'as_patient') {
    const fromApi = resolveProfileDisplayAvatarUrl(c.vetAvatarUrl, { gender: c.vetGender });
    if (fromApi && !isGenderDefaultAvatarPath(fromApi)) return fromApi;
    const team = getTeamAgentByName(c.vetName);
    if (team?.avatarUrl) return team.avatarUrl;
    return fromApi || resolveProfileDisplayAvatarUrl(undefined, { gender: c.vetGender });
  }
  return resolveProfileDisplayAvatarUrl(c.patientAvatarUrl, { gender: c.patientGender });
}
