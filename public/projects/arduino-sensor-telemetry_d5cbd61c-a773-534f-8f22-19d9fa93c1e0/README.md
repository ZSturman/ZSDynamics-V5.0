# Arduino Sensor Telemetry

Arduino Mega sensor firmware, a Python/FastAPI telemetry backend and a React dashboard with serial and simulated transports.

## Implementation

Firmware emits newline-delimited JSON envelopes. Backend transport adapters normalize serial and simulator data; shared schemas and a sensor catalog connect the backend to the TypeScript dashboard.

## Source and testing

[Public source and setup](https://github.com/ZSturman/Arduino-Sensor-Telemetry)

[Validation and next steps](https://github.com/ZSturman/Arduino-Sensor-Telemetry/blob/main/docs/NEXT_STEPS.md)

## Current limitations

Hardware/software prototype with simulator support. Firmware upload, real wiring, sensor accuracy and serial reliability require physical-board acceptance. Bluetooth is a planned extension.
