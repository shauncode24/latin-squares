export const TIERS = ['low', 'medium', 'high'];
export const TIER_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };
export const TIER_DESC = {
  low: 'Direct read — the answer sits in a row or column with a single blank.',
  medium: 'One pivot — solve a neighbouring cell first, then read the target.',
  high: 'Two or more pivots — a chain of deductions before the target opens up.',
};
export const TIER_TARGET_LABEL = { low: '10-20s', medium: '40-50s', high: '65-75s' };
export const TIER_TARGET_MS    = { low: 20000, medium: 50000, high: 75000 };