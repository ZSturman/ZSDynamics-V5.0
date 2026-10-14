# Better Workspace

A native Mac workspace browser with an iPhone and iPad capture and planning companion.

![Mac Overview with sample workspace data](/projects/better_workspace_210b2324-2bdf-5751-a101-9c334db91f8c/images/mac-store-overview.jpg)

## What it does

- Browse real workspace folders while keeping project plans and work records portable as Markdown.
- Rank projects and ideas, bring important work forward, and choose a Next Action.
- Capture text, links, images and files through the app or the iOS Share extension.
- Browse a private iCloud index on iPhone and iPad, including cached content when offline.
- Queue mobile planning changes for the Mac to validate, apply and acknowledge.
- Review optional Notion changes and launch explicitly selected agent tasks on Mac.

## Platforms and architecture

Mac: macOS 14.4 or later. Phone/tablet: iOS/iPadOS 17 or later. Cloud features need iCloud Drive and the same Apple account on both devices. The Mac publishes the workspace index; the phone does not access Mac files directly. Tags, indexes, drafts and receipts stay in private storage. The Mac background service currently requires Python 3.11 or later.

## Release status

In testing. The planned distribution is an iPhone/iPad App Store companion and a separate Mac download. App Store review, production CloudKit acceptance, final device acceptance and Mac notarization remain release gates. A locally exported App Store signed 1.0/build 3 candidate is prepared. There is no public download or App Store listing yet. Open Overview → More workspace views → Explore sample workspace to browse without connecting a Mac or iCloud.

## Screenshots

These are actual app captures using sample workspace data, captured in isolated sample workspaces. The mobile images use the public read-only sample mode included in the release candidate.

![iPhone idea priority and scoring](/projects/better_workspace_210b2324-2bdf-5751-a101-9c334db91f8c/images/iphone-idea-scoring.png)

![iPad project details and work plan](/projects/better_workspace_210b2324-2bdf-5751-a101-9c334db91f8c/images/ipad-project.png)

## Help and privacy

[Setup and support](/better-workspace/support) · [Privacy policy](/better-workspace/privacy)

Copyright © 2026 Zachary Sturman. No open-source license or public source download is currently offered on this page.
