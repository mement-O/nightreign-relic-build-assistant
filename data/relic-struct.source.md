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
