# Delta for Padron-Table

## ADDED Requirements

### Requirement: Export Actions

The system MUST show "Exportar CSV" and "Imprimir" actions beside the padrón table, operating on the visible (filtered + severity-sorted) rows (WYSIWYG scope). Both actions MUST be disabled when zero rows exist.

#### Scenario: Export buttons placed by table

- GIVEN a non-empty padrón
- WHEN the table renders
- THEN both actions appear beside the table and act on visible rows

#### Scenario: Actions disabled on empty padrón

- GIVEN zero registered patients
- WHEN the view loads
- THEN both actions are disabled and the empty state remains
