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
    return undefined;
  }
  const patient = resolveProfileDisplayAvatarUrl(c.patientAvatarUrl, {
    gender: c.patientGender,
  });
  if (patient && !isGenderDefaultAvatarPath(patient)) return patient;
  return undefined;
}
