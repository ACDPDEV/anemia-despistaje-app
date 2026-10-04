# Print Report Specification

## Purpose

Paper/file reporting of the visible padrón: print view isolating the table with stats header, hiding interactive chrome.

## Requirements

### Requirement: Print Isolation

The system MUST render a print view showing only the visible-rows table plus stats header, hiding filters, checkboxes, action columns, tabs, and other chrome.

#### Scenario: Table-only print output

- GIVEN a non-empty filtered padrón
- WHEN the user prints
- THEN output contains the table and stats header only
- AND no filter, button, or action column appears

### Requirement: Print Action

The system MUST provide an "Imprimir" action operating on the visible rows, disabled when zero rows exist.

#### Scenario: Print reflects visible rows

- GIVEN a filtered, severity-sorted row set
- WHEN the user activates Imprimir
- THEN the print view shows exactly those visible rows

#### Scenario: Print disabled on empty

- GIVEN zero registered patients
- WHEN the view loads
- THEN Imprimir is disabled and no print output is produced
