# CSV Export Specification

## Purpose

Portable file export of the visible padrón rows: RFC 4180 CSV with stats header and dated filename, openable in Excel with intact Spanish accents.

## Requirements

### Requirement: CSV Content Builder

The system MUST build CSV text from the visible (filtered + severity-sorted) rows with UTF-8 BOM, stats header lines, a `nombre,edad_meses,hemoglobina,diagnostico` column header, and one RFC 4180-quoted row per patient. Stats MUST derive from the same exported row set.

#### Scenario: Visible rows exported with matching stats

- GIVEN a filtered, severity-sorted visible row set
- WHEN the CSV text is built
- THEN body rows equal the visible rows in order
- AND header stats equal counts and average over that same set

#### Scenario: Hostile field quoting

- GIVEN a name containing `;`, `"`, comma, or newline
- WHEN the CSV text is built
- THEN the field is double-quote wrapped with inner quotes doubled
- AND the row still parses back to its original fields

#### Scenario: Accents preserved

- GIVEN patients named "José" with Spanish diagnosis labels
- WHEN the CSV text is built
- THEN output starts with a UTF-8 BOM and accents round-trip intact

### Requirement: Dated Filename

The system MUST name the download `padron-YYYY-MM-DD.csv` from the local date.

#### Scenario: Filename carries local date

- GIVEN any export day
- WHEN the export triggers
- THEN the filename matches `padron-<local-date>.csv`

### Requirement: Disabled on Empty

The system MUST NOT start a download when zero rows are visible.

#### Scenario: Empty padrón exports nothing

- GIVEN zero registered patients
- WHEN the padrón view loads
- THEN no CSV download can trigger and no empty file is produced
