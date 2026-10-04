# Padron-Table Specification

## Purpose

Filterable register of screened patients: searchable table with diagnosis badges and preserved row edit/delete. UI copy in Spanish; identifiers in English.

## Requirements

### Requirement: Filterable Table

The system MUST render patients in a table with a single text filter matching name or document.

#### Scenario: Filter narrows rows

- GIVEN several registered patients
- WHEN the user types a matching fragment
- THEN only matching rows remain visible

#### Scenario: Filter no-match

- GIVEN a non-empty padrón
- WHEN the filter matches no patient
- THEN the table shows the no-results empty state ("Sin resultados")

### Requirement: Diagnosis Badges

The system MUST label each row's diagnosis with a badge variant per band.

#### Scenario: Badges render per row

- GIVEN patients with distinct diagnoses
- WHEN the table renders
- THEN each row shows a badge whose label matches its diagnosis

### Requirement: Row Actions

The system MUST preserve per-row edit and delete actions.

#### Scenario: Edit row

- GIVEN an existing patient row
- WHEN the user edits and saves valid data
- THEN the row reflects the updated values

#### Scenario: Delete row

- GIVEN an existing patient row
- WHEN the user confirms deletion
- THEN the row is removed and counts update

### Requirement: Empty Padrón

The system MUST show an empty-state call-to-action when no patients exist.

#### Scenario: No patients registered

- GIVEN zero registered patients
- WHEN the padrón view loads
- THEN the empty state appears instead of table rows
