# Recallable

Spaced-repetition flashcards that fit into your day, on iPhone, iPad, Mac, and Apple Watch.

![Recallable on iPad, iPhone, and Apple Watch](/projects/recallable_5031ef4c-2724-54a4-92ca-42d270a59716/images/hero.jpg)

## What it does

Open Recallable and a card is waiting. Show the answer, rate it Hard, Good, or Easy, and the next one is ready. Every rating spaces that card: ones you know drift further apart, and hard ones come back sooner. Unlike most spaced-repetition apps, nothing is ever "due". The queue only decides what to show first, so a few days away never leaves you with a backlog.

- **Quick study** on Home, the Home Screen widget, and Apple Watch, plus focused rounds of 10.
- **Discover:** built-in starter decks that work offline, and community decks with reporting, blocking, and moderation.
- **Your own cards** with pictures, hints, explanations, links, and LaTeX math typeset on every device.
- **CSV import and export.**
- **AI drafts** from a topic, text, a web page, a PDF, or a photo of notes, using on-device Apple Intelligence, LM Studio, or your own Gemini key. Every draft is reviewed before it's saved.
- **Widgets, a Control Center control, Shortcuts and Siri,** and reminders that never show card text.
- **iCloud sync** across devices, where reviews from every device are kept.

## Screenshots

These are unedited captures of the real app, using its built-in starter decks with study history from the app's own scheduler.

| Home | Answer | Progress | Discover |
|---|---|---|---|
| ![Home](/projects/recallable_5031ef4c-2724-54a4-92ca-42d270a59716/images/iphone-01-home-optimized.webp) | ![Answer](/projects/recallable_5031ef4c-2724-54a4-92ca-42d270a59716/images/iphone-02-answer-optimized.webp) | ![Progress](/projects/recallable_5031ef4c-2724-54a4-92ca-42d270a59716/images/iphone-03-progress-optimized.webp) | ![Discover](/projects/recallable_5031ef4c-2724-54a4-92ca-42d270a59716/images/iphone-04-discover-optimized.webp) |

![Apple Watch: a question](/projects/recallable_5031ef4c-2724-54a4-92ca-42d270a59716/images/watch-01-question-optimized.webp) ![Apple Watch: the answer](/projects/recallable_5031ef4c-2724-54a4-92ca-42d270a59716/images/watch-02-answer-optimized.webp)

## How it's built

- **RecallableDomain:** a pure Swift package with the scheduler, models, CSV, rich text and math, and the SwiftData store, covered by 94 unit tests.
- **Apps:** SwiftUI for iPhone and iPad, the Mac through Mac Catalyst, a WidgetKit extension, and a watchOS app.
- **Sync:** SwiftData with CloudKit mirroring. Review events are immutable and insert-only, so merges from several devices are unions.
- **Watch:** gets a bounded set of upcoming cards and replays offline ratings over WatchConnectivity.
- **Technologies:** Swift 6, SwiftUI, SwiftData, CloudKit, WidgetKit, App Intents, WatchConnectivity, Foundation Models, TipKit, and XCTest and Swift Testing.

## Availability

Recallable is released for iPhone and iPad on the App Store. The separate Mac version is still in Apple review. It needs iOS, iPadOS, or watchOS 26, or macOS 26.

## Help and privacy

[Support](/recallable/support) · [Privacy policy](/recallable/privacy)

Copyright © 2026 Zachary Sturman.

## Install or try

[Install for iPhone and iPad](https://apps.apple.com/us/app/recallable-flashcards/id6822919785) · [Try the browser demo](/recallable/demo). Public release 1.0.0 (8) is separate from newer TestFlight builds.
