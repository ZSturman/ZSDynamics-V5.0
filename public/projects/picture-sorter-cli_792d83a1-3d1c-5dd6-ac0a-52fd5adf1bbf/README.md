# Picture Sorter CLI

Python image/video sorting with object detection, OCR, local inference and regression tests for safe file operations.

## Implementation

A CLI routes images through OCR/object classification and samples video frames for captioning. File operations handle collisions and malformed media; dry-run previews planned moves.

## Source and testing

[Public source and setup](https://github.com/ZSturman/Picture-Sorter-CLI)

[Validation and next steps](https://github.com/ZSturman/Picture-Sorter-CLI/blob/main/docs/NEXT_STEPS.md)

## Current limitations

Classification quality is provisional. Audio sorting, undo/journaling and a distributable app are not implemented. Optional model downloads can be large; test first on copies of your files.
