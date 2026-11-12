# Public project source

Updated November 12, 2026. These curated source snapshots preserve private development history in the original repositories. Each new public repository has been scanned locally and verified accessible without authentication.

| Project | Public source | Portfolio |
| --- | --- | --- |
| Home Services | [Home-Services-Public](https://github.com/ZSturman/Home-Services-Public) | [Project](https://zacharysturman.com/projects/home-services) |
| Grounded Memory | [grounded-memory-public](https://github.com/ZSturman/grounded-memory-public) | [Project](https://zacharysturman.com/projects/grounded-memory) |
| Arduino Sensor Telemetry | [Arduino-Sensor-Telemetry](https://github.com/ZSturman/Arduino-Sensor-Telemetry) | [Project](https://zacharysturman.com/projects/arduino-sensor-telemetry) |
| Flow Review | [Flow-Review-Public](https://github.com/ZSturman/Flow-Review-Public) | [Project](https://zacharysturman.com/projects/flow-review) |
| Transactions Mobile | [Transactions-Mobile-Public](https://github.com/ZSturman/Transactions-Mobile-Public) | [Project](https://zacharysturman.com/projects/transactions) |
| Warehouse Wanderer | [Warehouse-Wanderer](https://github.com/ZSturman/Warehouse-Wanderer) | [Project](https://zacharysturman.com/projects/warehouse-wanderer) |
| iPhone Microscope | [iPhone-Microscope](https://github.com/ZSturman/iPhone-Microscope) | [Project](https://zacharysturman.com/projects/iphone-microscope) |
| Workspace Telemetry | [Workspace-Telemetry](https://github.com/ZSturman/Workspace-Telemetry) | [Project](https://zacharysturman.com/projects/workspace-telemetry) |
| Multi-Context Memory System | [Multi-Context-Memory-System](https://github.com/ZSturman/Multi-Context-Memory-System) | [Project](https://zacharysturman.com/projects/multi-context-memory-system) |
| Picture Sorter CLI | [Picture-Sorter-CLI](https://github.com/ZSturman/Picture-Sorter-CLI) | [Project](https://zacharysturman.com/projects/picture-sorter-cli) |
| Analyze Speech | [Analyze-Speech](https://github.com/ZSturman/Analyze-Speech) | [Project](https://zacharysturman.com/projects/analyze-speech) |
| Camera Monitor | [Camera-Monitor-Public](https://github.com/ZSturman/Camera-Monitor-Public) | [Project](https://zacharysturman.com/projects/camera-monitor) |
| Files & Backups | [Files-and-Backups-Public](https://github.com/ZSturman/Files-and-Backups-Public) | [Project](https://zacharysturman.com/projects/files-backups) |

## Maintenance

Source links are maintained in `content/projects/*/project.json` and `content/project-updates.json`. Run `npm run sync:local-projects`, the local-content and presentation tests, `npm run typecheck`, `npm run build`, and `npm run validate:portfolio` before publishing. Public snapshots have independent histories; source changes in the private repositories do not update them automatically. Repeat the explicit export and sensitive-data review before refreshing a snapshot.

New snapshot commits use the public GitHub noreply author address. Personal inputs, runtime databases, environment files, release signing assets and automated deployment workflows are excluded. Narrow Gitleaks exceptions cover reviewed synthetic fixture values, a deliberately invalid test token, a browser preference name and a published NIST test vector. Existing third-party notices are retained; publication introduces no new license.
