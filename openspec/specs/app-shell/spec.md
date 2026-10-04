# App Shell Specification

## Purpose

Persistent sidebar navigation shell for the anemia screening app. Replaces top tabs with a collapsible sidebar hosting the three views (Registro, Padrón, Panel) and a widened content area.

## Requirements

### Requirement: Sidebar Navigation

The system MUST provide persistent sidebar navigation with one entry per view: Registro, Padrón, and Panel. UI labels SHALL be Spanish; identifiers SHALL be English.

#### Scenario: Navigate between views

- GIVEN the app shell is rendered
- WHEN the user selects "Padrón" in the sidebar
- THEN the padrón view is shown AND the Padrón entry is marked active

#### Scenario: All views reachable

- GIVEN the app shell is rendered
- WHEN the user selects each sidebar entry in turn
- THEN each corresponding view renders without reload

### Requirement: Single Navigation Source

The system MUST derive sidebar active state from the single existing view identifier. There MUST NOT be a second navigation control competing with the sidebar.

#### Scenario: Single source of truth

- GIVEN the app showing any view
- WHEN the active view changes
- THEN exactly one sidebar entry is marked active AND no other nav control exists

### Requirement: Collapsible Sidebar

The system MUST allow collapsing the sidebar to an icon-only mode on desktop and MUST present it as off-canvas on small screens.

#### Scenario: Collapse and expand

- GIVEN the expanded sidebar
- WHEN the user toggles collapse
- THEN only icons remain visible AND toggling again restores labels

#### Scenario: Small-screen navigation

- GIVEN a viewport below the desktop breakpoint
- WHEN the user opens navigation
- THEN the sidebar appears as an overlay AND selecting a view dismisses it

### Requirement: Content Layout

The system MUST constrain the content area to a readable maximum width wider than the previous cramped layout.

#### Scenario: Readable content width

- GIVEN any view rendered inside the shell
- WHEN measured on a wide viewport
- THEN content is centered within a maximum width of 5xl
