# Workspace Telemetry

A local-first Python telemetry and work-session service with explicit evidence, retention and mocked integration tests.

## Implementation

A Python package separates normalized event ingestion, work-session state, evidence exports and optional Notion writes. Tests use temporary directories and mocked remote calls.

## Source and testing

[Public source and setup](https://github.com/ZSturman/Workspace-Telemetry)

[Validation and next steps](https://github.com/ZSturman/Workspace-Telemetry/blob/main/docs/NEXT_STEPS.md)

## Current limitations

Development service. Configure private destinations locally; review optional integration and retention settings before use. No personal activity history is included.
