# Q2 effect coverage correction (v23f)

The correction combines observed normal/deep placement in an actual save with the existing formal rules. It changes ID membership and availability, not the established stacking semantics.

- 7002600 / 7002700 / 7002800 / 7002900: register under the existing magic/fire/lightning/holy damage-negation groups, level 0. These groups already specify that the unranked normal effect is equivalent to deep +0, using zero-based additive points.
- 7030600 / 7030200 / 7030800: also register in their existing normal NON_STACKING rules. Retain their separate deep UNIQUE_LEVEL rules.
- 6610500: also register in the existing deep FP ADDITIVE/COUNT rule. Retain the normal NON_STACKING rule. Align its base group metadata with the existing unranked FP ID 8010001; this level does not determine COUNT measurements.
- 6645000 / 6645100 / 6642100 / 6643000 / 6060300 / 6060500: enable normal availability in their existing rules, preserving deep availability and stacking behavior.
- 7006300: enable normal availability in its existing affinity-negation group, normal rank range 0..0. Preserve the deep 0..2 range.

The complete effective rule and base snapshots are packed under runtime-v23f and loaded by bootstrap.js. Existing maximum-value and game-category patches remain applied. Runtime rule version: 0.6.8-q2-game-filter.

Validation: all 525 distinct effect IDs across 1,499 owned relics resolve to applicable rules. The previously detected four unmapped IDs (44 effect occurrences) and eleven unavailable-for-type IDs (51 occurrences) are resolved. Tests cover normal/deep dispatch, zero-based rank totals, exact matching, normal/deep FP separation, additional-benefit aggregation, and existing demerit exclusion regression scenarios.

B2 (7001409, physical attack +2 with internal level 0) is intentionally unchanged and remains outstanding. Save data and personal inventory records are not distributed. This check covers the supplied save; it is not a guarantee of every possible effect in future versions.
