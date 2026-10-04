# Delta for Dashboard

## MODIFIED Requirements

### Requirement: KPI Cards

The system MUST display one section-card per metric — total screened, average Hb, and count per diagnosis band — each with a label, the selector value, and a Spanish trend caption. Values MUST derive from existing selectors; presentation follows the kpi-cards spec.

(Previously: plain cards with values only, no trend captions.)

#### Scenario: KPIs render from store

- GIVEN a padrón with recorded patients
- WHEN the dashboard loads
- THEN each card shows the selector value (total, average Hb, per-diagnosis counts)
- AND each card shows its Spanish trend caption

#### Scenario: Empty padrón

- GIVEN zero registered patients
- WHEN the dashboard loads
- THEN total shows 0, average shows the empty-state label, and diagnosis counts show 0
- AND captions describe the empty state instead of a trend

#### Scenario: Dashboard inside app shell

- GIVEN the dashboard viewed via the sidebar shell
- WHEN the Panel entry is active
- THEN KPI cards, distribution chart, and age grouping all render within the shell content area
