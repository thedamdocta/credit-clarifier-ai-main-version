import profileData from "./strategyProfile.json";

/**
 * Dispute strategy profile — separates dispute STRATEGY from dispute
 * DETECTION. The engine detects every reason it can prove from the report;
 * the active profile only decides which reason classes arrive checked by
 * default. Demoted classes stay visible in the review UI with their
 * rationale, and a deliberate re-check restores the full letter/exhibit/
 * memorandum treatment for that case.
 *
 * The profile is pure data (strategyProfile.json). Per-firm strategies are
 * intended to be alternative profile files with this same shape, so shifts
 * in case law or firm preference are data edits, not engine changes.
 */
export interface StrategyDemotion {
  claimBasis: string;
  rationale: string;
}

export interface DisputeStrategyProfile {
  name: string;
  description: string;
  demotions: Record<string, StrategyDemotion>;
}

export const ACTIVE_STRATEGY_PROFILE = profileData as DisputeStrategyProfile;

export const getStrategyDemotion = (issueType: string): StrategyDemotion | undefined =>
  ACTIVE_STRATEGY_PROFILE.demotions[issueType];
