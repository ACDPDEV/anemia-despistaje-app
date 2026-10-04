# KPI Cards Specification

## Purpose

Scannable screening-metric cards using the section-cards pattern: each card pairs a metric value with a Spanish trend caption, fed exclusively by existing store selectors. No new domain rules.

## Requirements

### Requirement: Section-Cards Pattern

The system MUST render one card per screening metric: total screened, average Hb, and count per diagnosis band. Each card MUST show a label, the metric value, and a trend caption.

#### Scenario: Cards render from store

- GIVEN a padrón with recorded patients
- WHEN the dashboard loads
- THEN each card shows its selector value with label and caption

#### Scenario: Empty padrón

- GIVEN zero registered patients
- WHEN the dashboard loads
- THEN total shows 0, average shows the empty-state label, and diagnosis counts show 0

### Requirement: Trend Captions

The system MUST display a short Spanish trend caption on every card describing the metric's direction or context (e.g. rising, stable, empty-state hint).

#### Scenario: Caption present per card

- GIVEN any padrón state
- WHEN the cards render
- THEN every card shows exactly one Spanish caption line below its value

#### Scenario: Empty-state caption

- GIVEN zero registered patients
- WHEN the cards render
- THEN captions describe the empty state instead of a trend

### Requirement: Selector-Only Data

The system MUST derive all card values from existing store selectors (`pacientes`, `countByDiagnosis`, `averageHb`). It MUST NOT introduce new domain rules or data fetching for cards.

#### Scenario: No new domain logic

- GIVEN the card data layer under review
- WHEN its data sources are listed
- THEN every value traces to an existing selector AND no new rule exists
