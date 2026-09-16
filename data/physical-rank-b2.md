# B2 physical attack rank correction (v23g)

Only effect-base-master.effectGroups[7001409].level changes from 0 to 2. The distinct ID and name are preserved. Existing effect 7001400 remains level 0 and 7001402 remains level 2.

Source: [AttachEffectParam.csv at pinned revision](https://github.com/alfizari/Elden-Ring-Nightreign-Save-Editor/blob/0d2ad1494c372098e689c23159656df70ff2d76d/src/Resources/Param/AttachEffectParam.csv).

7001409 and 7001402 both reference passiveSpEffectId_1=7001402 and attachTextId=7001402. The source records differ only in ID and compatibilityId (-1 versus 100). The Japanese text reference is physical attack +2. No compatibility metadata or identity is merged or rewritten.

Validation: the real rank measurement and additional-benefit measurement both return 3 points with zeroBasedRank. Exact matching accepts target +2 and rejects target +0. Existing Q2 and demerit regression cases pass. The provided save's 1,499 owned relics / 525 distinct effects pass the B2/Q2 audit without remaining detected inconsistencies. No save data is distributed.
