# Native application availability — October 31, 2026

The current app portfolio includes public Store releases and private internal TestFlight betas. Beta access is limited to the existing personal tester; there are no public join links.

| Product | Current beta | Platforms |
| --- | --- | --- |
| Home Page | 1.0 (4) | MAC_OS |
| Trackables Mac | 1.0.1 (9) | MAC_OS |
| Content Manager | 1.0 (7) | IOS |
| Casino Exit | 1.0 (5) | IOS |
| Camera Monitor | 0.1.0 (4) | IOS |
| Camera Monitor | 0.1.0 (4) | MAC_OS |
| Files & Backups | 0.1 (4) | IOS |
| Files & Backups | 0.1 (4) | MAC_OS |
| ChewSense Collect | 1.2 (7) | IOS |
| Microscope Camera | 1.0 (2) | IOS |
| Recallable | 1.0.2 (18) | IOS |
| Recallable | 1.0.2 (18) | MAC_OS |
| Trackables | 1.0.1 (9) | IOS |
| Better Signals | 1.5.1 (13) | IOS |
| Better Workspace | 1.0.3 (37) | IOS |

All rows were read back from Apple as VALID / IN_BETA_TESTING. Home Page 1.0 (4), Recallable iOS/Mac 1.0.2 (18), Trackables iOS 1.0.1 (9), Better Signals 1.5.1 (13), and Better Workspace mobile 1.0.3 (37) are WAITING_FOR_REVIEW with automatic release after approval. These are submissions, not approval/publication claims.

ChewSense Collect remains a research beta until new paired recording and independent review acceptance. The Microscope iPhone companion is named Bench Lens: Microscope Camera; it requires the separately distributed local Mac viewer and has known frame-rate limitations. Older ChewSense shells/debuggers were not added. Camera Monitor, Files & Backups, Content Manager, Casino Exit and Trackables Mac keep their public listing drafts until their own release checks are ready. Transactions iOS 1.0.0 (1) is already public and needed no new binary.

Curated entries live in `content/projects/`; small updates to imported projects live in `content/project-updates.json`. Run `npm run build && npm run validate:portfolio`; expect 51 projects and 94 canonical routes. Device acceptance and Apple review results remain external follow-up.

## Portfolio thumbnails

Home Page, Trackables, Microscope, Camera Monitor, Files & Backups and Casino Exit use their actual app icons in authored landscape thumbnails. Originals live in each curated entry's `images/app-icon.png`. Run `node scripts/generate-native-app-thumbnails.mjs` after replacing an icon; the normal build synchronizes thumbnail/icon fields and files to the public manifest and API. The centered layout also fits square list crops. ChewSense retains its existing thumbnail.
