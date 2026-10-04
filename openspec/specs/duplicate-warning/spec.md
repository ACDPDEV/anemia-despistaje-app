# Duplicate-Warning Specification

## Purpose

Warning-only possible-duplicate signal that alerts field workers without ever blocking registration. Copy MUST say "posible", never "duplicado".

## Requirements

### Requirement: Possible-Duplicate Detection

The system MUST flag an exact normalized-name match (trim, lowercase, diacritic folding, whitespace collapse) as a possible duplicate.

#### Scenario: Exact normalized match warns

- GIVEN a registered "María López"
- WHEN the user enters " maria  lopez "
- THEN the form shows a "posible duplicado" hint

#### Scenario: Accent-insensitive match

- GIVEN a registered "José"
- WHEN the user enters "Jose"
- THEN the system flags a possible duplicate

#### Scenario: Different names stay silent

- GIVEN a registered "Ana Ruiz"
- WHEN the user enters "Ana Torres"
- THEN no duplicate hint appears

### Requirement: Warning Never Blocks Registration

The system MUST NOT block registration on a possible duplicate; the hint MUST be dismissible and submit MUST succeed.

#### Scenario: Registration succeeds despite warning

- GIVEN a visible "posible duplicado" hint
- WHEN the user confirms the submit
- THEN the patient is registered normally

#### Scenario: Same-name siblings show benign warning

- GIVEN a registered "Luis Pérez" (sibling already screened)
- WHEN the user registers another "Luis Pérez"
- THEN a "posible duplicado" badge appears on the row but both records persist

### Requirement: Row Duplicate Badge

The system MUST render a "Posible duplicado" badge on rows whose normalized name matches another record.

#### Scenario: Badge renders on duplicate row

- GIVEN two records with the same normalized name
- WHEN the table renders
- THEN each matching row shows the "Posible duplicado" badge
