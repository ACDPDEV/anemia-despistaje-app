# Delta for Padron-Table

## MODIFIED Requirements

### Requirement: Filterable Table

The system MUST render patients in a table with a single text filter matching name or document, folding diacritics via the shared `normalizeNombre` helper so accented and unaccented queries match identically.
(Previously: plain substring filter with no diacritic folding.)

#### Scenario: Filter narrows rows

- GIVEN several registered patients
- WHEN the user types a matching fragment
- THEN only matching rows remain visible

#### Scenario: Filter no-match

- GIVEN a non-empty padrón
- WHEN the filter matches no patient
- THEN the table shows the no-results empty state ("Sin resultados")

#### Scenario: Accent-insensitive filter match

- GIVEN a registered patient "José"
- WHEN the user types "Jose"
- THEN the "José" row remains visible

#### Scenario: Filter consistency with duplicates

- GIVEN the shared `normalizeNombre` helper
- WHEN filter matching and duplicate detection run
- THEN both fold diacritics identically ("José" matches "Jose" in both)
