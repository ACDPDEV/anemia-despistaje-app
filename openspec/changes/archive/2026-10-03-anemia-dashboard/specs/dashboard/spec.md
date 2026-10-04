# Dashboard Specification

## Purpose

Screening overview for the anemia padrón: KPI cards, hemoglobin distribution, and risk by age group. Data MUST derive from existing store selectors (`pacientes`, `countByDiagnosis`, `averageHb`) plus one pure presentation grouping; no new domain rules. UI copy in Spanish; identifiers in English.

## Requirements

### Requirement: KPI Cards

The system MUST display one card per metric: total screened, average Hb, and count per diagnosis band.

#### Scenario: KPIs render from store

- GIVEN a padrón with recorded patients
- WHEN the dashboard loads
- THEN each card shows the selector value (total, average Hb, per-diagnosis counts)

#### Scenario: Empty padrón

- GIVEN zero registered patients
- WHEN the dashboard loads
- THEN total shows 0, average shows the empty-state label, and diagnosis counts show 0

### Requirement: Hb Distribution Chart

The system MUST render a 4-band Hb bar chart covering all diagnosis bands, with a fixed-size test hook so tests assert without layout mocking.

#### Scenario: Four bands rendered

- GIVEN patients across diagnosis bands
- WHEN the chart renders
- THEN four bars appear, one per band, with counts matching `countByDiagnosis`

#### Scenario: Fixed-size test hook

- GIVEN the chart in a test environment without layout measurement
- WHEN rendered with the fixed-size hook
- THEN all bars and labels are assertable without responsive-container mocking

### Requirement: Risk by Age Group

The system MUST group patients into ages 6–23 months vs 24–59 months and show per-group counts.

#### Scenario: Age groups render

- GIVEN patients on both sides of 24 months
- WHEN the grouping renders
- THEN each group count equals the patients whose age falls in that band

#### Scenario: Boundary month

- GIVEN a patient aged exactly 24 months
- WHEN the grouping renders
- THEN the patient counts in the 24–59 group
