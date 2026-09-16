# Verified relic metadata

This file documents `relic-verified-meta.json`, an explicit ID-to-[color, deep] mapping applied after the legacy generator.

Source: https://github.com/alfizari/Elden-Ring-Nightreign-Save-Editor/blob/0d2ad1494c372098e689c23159656df70ff2d76d/src/Resources/Param/EquipParamAntique.csv

Columns: `ID`, `relicColor`, `isDeepRelic`. Colors: 0 red, 1 blue, 2 yellow, 3 green. Deep: 0 normal, 1 deep.

The 70 IDs were selected from the B1 missing-metadata list after confirming actual inventory ownership in a user-provided save. Every value was copied from the matching source row, not inferred from names or ID digits. The other 38 B1 IDs were not added. No save file, player information, or individual inventory records are included.

Validation: all 70 IDs have exactly one source row; all 391 affected owned relics resolve to that row's color/deep values; existing generated entries remain unchanged.
