# Q5 search invalidation (v23h)

Normal and additional searches share a revision token. Requirement changes, hero switches in either tab, ignored-effect changes, save import start/commit, and new searches invalidate the previous revision. Demerit exclusions changed during a search also invalidate it without resetting the selected exclusions.

An invalidated search cannot publish results, candidates, completion status, or clear the cache/button state owned by a newer search. Both search buttons remain disabled during a live search, including after simulator rerenders. The additional-search cancel button remains supported.

Validation uses real search functions with deterministic async interruptions and synthetic relics: both searches stop after hero, requirement, save-replacement, and ignore changes. Two overlap tests keep a newer search pending while the older normal/additional search finishes and assert that its controls and rank cache remain owned by the newer search. Existing exact matching, Q2, B2, additional-benefit and demerit-exclusion regression tests pass. These are automated function tests with a simulated DOM, not a claim of manual browser verification.
