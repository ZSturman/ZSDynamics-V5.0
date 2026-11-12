# Flow Review

Python tooling that turns small YAML UI flows into generated XCUITests and review artifacts.

## Implementation

The Python core discovers project configuration, validates linear flows and generates test sources. The Mac interface calls the CLI; Xcode project mutation is isolated in a Ruby helper.

## Source and testing

[Public source and setup](https://github.com/ZSturman/Flow-Review-Public)

[Validation and next steps](https://github.com/ZSturman/Flow-Review-Public/blob/main/docs/NEXT_STEPS.md)

## Current limitations

Prototype for Apple-platform testing. Running generated UI tests needs macOS and Xcode. Linear flows intentionally do not replace arbitrary handwritten UI automation.
