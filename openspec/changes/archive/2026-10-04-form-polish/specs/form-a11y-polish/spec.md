# form-a11y-polish Specification

## Purpose

Accessible, token-driven polish of RegisterForm: FieldGroup idiom, semantic error tokens, and preserved roles/text/behavior.

## Requirements

### Requirement: Field-group structure with semantic tokens

The system MUST render RegisterForm fields with FieldGroup + Field + FieldLabel, use semantic error tokens, and MUST NOT use hardcoded color or spacing utilities.

#### Scenario: Valid render uses Field idiom
- GIVEN a fresh RegisterForm
- WHEN it renders
- THEN each input has an associated FieldLabel and no `text-red-600`, `bg-blue-600`, or `space-*` classes appear

#### Scenario: Invalid submit associates errors accessibly
- GIVEN an empty required field with `aria-invalid` and `data-invalid`
- WHEN invalid submit occurs
- THEN the error shows with `role=alert`, semantic `text-destructive` token, and stays linked to its input

### Requirement: Button variants without hardcoded colors

The system MUST render submit/dismiss actions with Button variants and MUST NOT use hardcoded background utilities.

#### Scenario: Actions render as Button variants
- GIVEN RegisterForm actions
- WHEN rendered
- THEN submit/dismiss use Button variants with original names and no `bg-blue-600` class

### Requirement: Roles, copy, and behavior frozen

The system MUST preserve existing roles, Spanish copy, and validation/duplicate behavior unchanged.

#### Scenario: Existing tests pass unchanged
- GIVEN the existing RegisterForm test suite
- WHEN the suite runs
- THEN all tests pass with no updates to queries, text, or behavior

#### Scenario: Duplicate hint preserved
- GIVEN a duplicate document value
- WHEN the duplicate hint renders
- THEN its role, text, and dismiss behavior match prior behavior exactly
