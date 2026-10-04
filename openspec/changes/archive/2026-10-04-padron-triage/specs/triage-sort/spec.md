# Triage-Sort Specification

## Purpose

Opt-in severity-priority ordering for the padrón so field workers can see the most severe cases first. Default view MUST preserve registration order.

## Requirements

### Requirement: Severity Priority Ordering

The system MUST order patients Severa → Moderada → Leve → Normal when severity mode is active, breaking ties by registration order, without mutating the stored list.

#### Scenario: Toggle on sorts by severity

- GIVEN patients in arrival order (Normal, Severa, Leve)
- WHEN the user activates "Ver graves primero"
- THEN rows list Severa first, then Leve, then Normal

#### Scenario: Stable order within same band

- GIVEN two Severa patients registered A then B
- WHEN severity mode is active
- THEN A appears before B

#### Scenario: Toggle off restores insertion order

- GIVEN severity mode was active
- WHEN the user deactivates the toggle
- THEN rows return to registration order

### Requirement: Severity Toggle Control

The system MUST provide an opt-in "Ver graves primero" toggle that defaults to off and persists only for the current view session.

#### Scenario: Default off

- GIVEN the padrón view loads
- WHEN no toggle interaction occurred
- THEN rows appear in registration order

#### Scenario: Alert line reuses severe count

- GIVEN patients including Severa and Moderada cases
- WHEN the padrón view renders
- THEN the alert line shows the Moderada + Severa count
