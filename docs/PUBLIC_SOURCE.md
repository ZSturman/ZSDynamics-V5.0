# Public project source

Updated November 12, 2026. These curated source snapshots preserve private development history in the original repositories. Each new public repository has been scanned locally and verified accessible without authentication.

| Project | Public source | Portfolio |
| --- | --- | --- |
| Home Services | [Home-Services-Public](https://github.com/ZSturman/Home-Services-Public) | [Project](/projects/home-services) |
| Grounded Memory | [grounded-memory-public](https://github.com/ZSturman/grounded-memory-public) | [Project](/projects/grounded-memory) |
| Arduino Sensor Telemetry | [Arduino-Sensor-Telemetry](https://github.com/ZSturman/Arduino-Sensor-Telemetry) | [Project](/projects/arduino-sensor-telemetry) |
| Flow Review | [Flow-Review-Public](https://github.com/ZSturman/Flow-Review-Public) | [Project](/projects/flow-review) |
| Transactions Mobile | [Transactions-Mobile-Public](https://github.com/ZSturman/Transactions-Mobile-Public) | [Project](/projects/transactions) |
| Warehouse Wanderer | [Warehouse-Wanderer](https://github.com/ZSturman/Warehouse-Wanderer) | [Project](/projects/warehouse-wanderer) |

## Maintenance

Source links are maintained in `content/projects/*/project.json` and `content/project-updates.json`. Run `npm run sync:local-projects`, the local-content and presentation tests, `npm run typecheck`, `npm run build`, and `npm run validate:portfolio` before publishing. Public snapshots have independent histories; source changes in the private repositories do not update them automatically. Repeat the explicit export and sensitive-data review before refreshing a snapshot.

New snapshot commits use the public GitHub noreply author address. Personal inputs, runtime databases, environment files, release signing assets and automated deployment workflows are excluded. Narrow Gitleaks exceptions cover reviewed synthetic fixture values, a deliberately invalid test token, a browser preference name and a published NIST test vector. Existing third-party notices are retained; publication introduces no new license.
