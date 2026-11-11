# ChewSense: capture, review and evaluate

ChewSense is a research workflow for learning from synchronized AirPods motion and eating video. The public Collect app captures evidence; the experimental detector is still being evaluated.

## How the pieces fit

1. **Collect — iPhone and iPad.** Record paired camera video and AirPods motion. Guided takes save instruction-derived coarse spans that the wearer can adjust; natural meals need manual marking.
2. **Vision and Review — Mac.** Local computer vision proposes events. Human review records accepted or corrected labels; predictions alone are never verified truth.
3. **Motion — Python.** Compare chewing-bout models, inspect errors and report uncertainty with recordings from one sitting kept together.
4. **Live — iPhone.** Replay an exported experimental detector and compare its output with Mac replay. This remains a research check.

Recording works without the Mac. Transfer uses the paired Mac directly when available, or a temporary home-server mailbox that receives phone-encrypted deposits for later Mac collection.

## What the November 10 study found

The development set contains 23 recordings from **one wearer**, grouped into **12 sittings**, five with chewing. The detector distinguished chewing from pauses within held-out meals (AUC-ROC 0.965). A detector frozen on November 4 also found both chewing bouts in one November 9 recording: 50 of 50 labelled chewing windows and no false positives among 88 labelled non-chewing windows.

Those are pilot results. Overlapping windows are not independent trials, and one later recording cannot establish general accuracy. The study kept the locked test out of fitting and scoring.

The strongest signal is jaw vibration in the 5–25 Hz band. A resampling issue can damp that band and may change the operating point in Live. Training now offers a sample-aligned comparison, with export blocked until Live supports the same grid. The study did not replace the bundled detector.

## What remains

Record dedicated Soft Food, Crunchy Food, Talking, Drinking and Gum Chewing takes, then a complete Natural Meal on another day. Score those development recordings with the frozen detector before retraining. Other wearers, free-living use, individual chew counts, bites, swallows and health outcomes remain unvalidated.

The [validity study](https://github.com/ZSturman/Chew-Sense/blob/main/docs/VALIDITY_2026-11-10.md) explains the evidence, threshold-selection limits and resampling issue. The [current repository](https://github.com/ZSturman/Chew-Sense) contains installation, architecture and development instructions.
