import {
  QUALITATIVE_FACTORS,
  type QualitativeFactor,
  type QualitativeScores,
  type QualitativeWeights,
} from "../persistence/db";

/**
 * Preference index (BR-015, critique W4): scores (0–10 per factor, "how much
 * would buying this home improve this for you?") weighted by personal
 * importance, normalized to 0–100. 50 is neutral. Deliberately dimensionless —
 * it is NEVER combined with the financial delta.
 */
export function preferenceIndex(
  scores: QualitativeScores,
  weights: QualitativeWeights,
): { index: number | null; scoredFactors: QualitativeFactor[] } {
  const scoredFactors = QUALITATIVE_FACTORS.filter(
    (factor) => scores[factor] !== undefined && weights[factor] > 0,
  );
  let weighted = 0;
  let maximum = 0;
  for (const factor of scoredFactors) {
    weighted += (scores[factor] ?? 0) * weights[factor];
    maximum += 10 * weights[factor];
  }
  return {
    index: maximum > 0 ? (weighted / maximum) * 100 : null,
    scoredFactors,
  };
}
