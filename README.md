# Are We Minecraft Yet: Still Waiting

Check if your server is vanilla Minecraft compliant or not.

For now, we require full vanilla compliance.

### Contributing

This repository is open to contributions.
If you find a bug or have a feature request, please open an issue.
Pull requests are welcome!

**Submitting a new server?**
Make sure to update `servers.json` with the following syntax
```json
{
  "name": "Your Server Name",
  "id": "your-server-id",
  "url": "https://your-url.com",
  "sourceLabel": "WhereIsYourSourceFrom",
  "language": "WhatLanguageIsItImplementedIn",
  "type": "SeeBelow",
  "mcVersion": "x.y.z",
  "status": "SeeBelow",
  "description": "Make an amazing description of your server.",
  "forkNote": null
}
```
**IMPORTANT:**
- If your server is a `reimplementation`, you must also add a `servers/[id].yaml` copied from `servers/template.yaml` with the features each moved to their respective status category. This is validated in CI: the file must exist and account for every feature listed in `servers/template.yaml` (no missing or unrecognized features).
- Forks do not need a `servers/[id].yaml` file and are always shown at 0% / `forked` compliance, since they intentionally diverge from vanilla behavior.
- Compliance is no longer set by hand. For reimplementations, it is computed from `servers/[id].yaml`: each `complete` feature is worth 1 point, each `inDev` feature is worth 0.5 points, and the total number of features listed in the file is the denominator. The resulting percentage decides the tier:
  - `full` (100%) — All mechanics, quirks, and known vanilla bugs are matched. No intentional behavioral deviations.
  - `mostly` (90-99%) — Core gameplay matches vanilla with only minor edge-case or timing differences.
  - `partial` (26-89%) — Some major systems are implemented, but significant gaps or inconsistencies remain.
  - `experimental` (0-25%) — Early-stage builds with limited feature coverage and frequent breaking bugs.
  - `forked` — Always applied to servers with `"type": "fork"`, regardless of feature coverage, since forks intentionally diverge from vanilla behavior to change gameplay or improve performance.
- If you include a new language, you must add it to line 1 of `script.js` and line 6 of `validate.js`
- `type` must be either `reimplementation` or `fork`
- `status` must be one of:
  - `active` — consistent activity within the last month.
  - `wip` — consistent activity in the last 2 months.
  - `inactive` — no consistent activity for >= 4 months.
- If you are adding a fork, you must set `forkNotice` to `true`, otherwise you must set it to `false`.

### Thanks
- [GoldenStack](https://github.com/GoldenStack) For the inspiration with [dayssincelastrustmcserver](https://github.com/GoldenStack/dayssincelastrustmcserver).
- [kermandev](https://github.com/kermandev) For the original [areweminecraftyet](https://github.com/kermandev/areweminecraftyet).
- [PumpkinMC](https://github.com/Pumpkin-MC/Pumpkin) for the feature list.
- Everyone attempting to reimplement vanilla.
- 