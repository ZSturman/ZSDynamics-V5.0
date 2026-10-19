# Better Signals

A native recording app for iPhone, iPad, and Apple Watch. Answer a short question, keep optional context, and export your data.

![Better Signals: actual app screens with synthetic Signals](/projects/better_signals_33baec94-4d3c-805b-aa92-e0d16cc8a3f1/images/hero-optimized.webp)

## What it does

- Twelve metrics, in four categories, each with five labeled levels.
- Quick Signal widgets and a paired Apple Watch companion.
- Searchable History with answer, time, source, and optional context and location.
- Optional prompts when you return to familiar places.
- CSV, JSON, JSON Lines, and GeoJSON exports, read-only Shortcuts, and a current Files copy.
- No account, advertising, tracking SDK, or developer-operated backend.

[App overview](https://zacharysturman.com/better-signals) · [Support](https://zacharysturman.com/better-signals/support) · [Privacy](https://zacharysturman.com/better-signals/privacy)

## Availability

Being prepared for TestFlight and the App Store. Requires iOS or iPadOS 26 and watchOS 26 for the paired Watch app. There is no public download yet.

Watch Signals transfer to the paired iPhone. iPad history is separate; there is no iCloud history sync. Optional location uses system permissions and visit monitoring. The app records observations without diagnosis, scoring, or treatment recommendations.

## How it works

SwiftUI builds on a shared Swift archive layer compiled into the phone, Watch, and widget targets. Atomic locked writes and stable submission IDs coordinate recording. WatchConnectivity queues offline answers and exchanges receipts. App Groups share files within a device. The original Timing Coach archive is copied once without deleting the source; its raw SwiftData history stays in the legacy group. The earlier qualitative Better Signals database is preserved separately and is not converted into this different model.

## Validation boundary

The rename pass recorded 50 passing unit tests and a simulator recording/relaunch smoke test. The release pass adds signed archive/export verification and fresh iPhone/iPad screenshot acceptance. Screenshots use synthetic Signals in disposable simulators. Physical Watch pairing, visit delivery, notification actions, accessibility, and installed-device upgrade checks remain beta acceptance items. There is no claim that compilation proves those flows.

## Media

The gallery contains actual simulator captures. The hero and social card arrange those captures in a portfolio layout; app screen content is not generated. No personal history or private locations are included.
