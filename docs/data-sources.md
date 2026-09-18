# 出典と変更記録

v24では以下の変更を通常のマスタ・アプリへ統合しています。各記録のruntime名などは変更当時の構成です。Q2記録にあるB2未対応の状態は、その後のB2修正で解消済みです。

# Relic color and normal/deep metadata

`relic-struct.json` contains every row of the source CSV as `{"r":{"ID":[relicColor,isDeepRelic]}}`. No ID ranges or name-based inference are used.

- Source repository: alfizari/Elden-Ring-Nightreign-Save-Editor
- Pinned revision: `0d2ad1494c372098e689c23159656df70ff2d76d`
- [Source CSV](https://github.com/alfizari/Elden-Ring-Nightreign-Save-Editor/blob/0d2ad1494c372098e689c23159656df70ff2d76d/src/Resources/Param/EquipParamAntique.csv)
- Columns: `ID`, `relicColor`, `isDeepRelic`
- Rows / unique IDs: 1,397 / 1,397
- Colors: 0 red, 1 blue, 2 yellow, 3 green; deep flag: 0 normal, 1 deep.

Source history records game resource additions on 2025-12-30 and an update on 2026-01-15. The checked history does not identify the precise game/regulation version or establish completeness for future game updates. This is a pinned third-party parameter table, not a claim of official or permanent exhaustive coverage.

## Comparison with v23d

- Previous generated table: 1,387,564 IDs.
- Shared IDs: 1,359. Color/deep mismatches among shared IDs: 0.
- CSV rows absent from the previous table: 38. All are now included.
- Previously generated IDs absent from the CSV: 1,386,205. These are no longer assigned inferred values. Their absence does not prove they can never exist.
- All 849 IDs in the existing relic-name master are present in the CSV.

## Unknown IDs and validation

IDs absent from the table have null color/deep metadata and are displayed as unclassified. They are excluded from optimizer comparisons, simulator slots (including any-color slots), effect catalogs and additional-skill searches. An import notice lists affected IDs. No red/normal fallback is used.

Validation covered all source rows, previously missing IDs, synthetic unknown IDs, normal/additional-search regression cases, and 1,499 owned relics in a provided save (all mapped). Save data and individual inventory details are not distributed.

To update the table, use a documented source revision, compare every ID and value, and rerun unknown-ID and search checks. Do not extend numerical ranges based on names or ownership in a single save.


---

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


---

# B2 physical attack rank correction (v23g)

Only effect-base-master.effectGroups[7001409].level changes from 0 to 2. The distinct ID and name are preserved. Existing effect 7001400 remains level 0 and 7001402 remains level 2.

Source: [AttachEffectParam.csv at pinned revision](https://github.com/alfizari/Elden-Ring-Nightreign-Save-Editor/blob/0d2ad1494c372098e689c23159656df70ff2d76d/src/Resources/Param/AttachEffectParam.csv).

7001409 and 7001402 both reference passiveSpEffectId_1=7001402 and attachTextId=7001402. The source records differ only in ID and compatibilityId (-1 versus 100). The Japanese text reference is physical attack +2. No compatibility metadata or identity is merged or rewritten.

Validation: the real rank measurement and additional-benefit measurement both return 3 points with zeroBasedRank. Exact matching accepts target +2 and rejects target +0. Existing Q2 and demerit regression cases pass. The provided save's 1,499 owned relics / 525 distinct effects pass the B2/Q2 audit without remaining detected inconsistencies. No save data is distributed.


---

# Q5 search invalidation (v23h)

Normal and additional searches share a revision token. Requirement changes, hero switches in either tab, ignored-effect changes, save import start/commit, and new searches invalidate the previous revision. Demerit exclusions changed during a search also invalidate it without resetting the selected exclusions.

An invalidated search cannot publish results, candidates, completion status, or clear the cache/button state owned by a newer search. Both search buttons remain disabled during a live search, including after simulator rerenders. The additional-search cancel button remains supported.

Validation uses real search functions with deterministic async interruptions and synthetic relics: both searches stop after hero, requirement, save-replacement, and ignore changes. Two overlap tests keep a newer search pending while the older normal/additional search finishes and assert that its controls and rank cache remain owned by the newer search. Existing exact matching, Q2, B2, additional-benefit and demerit-exclusion regression tests pass. These are automated function tests with a simulated DOM, not a claim of manual browser verification.


## ライセンス・流用元の表示

セーブ解析と効果データの流用元・参照元、および著作権表示・MITライセンス全文は [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) を参照してください。
