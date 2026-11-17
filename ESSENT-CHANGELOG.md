# Essent fork changelog

Changes that Essent made to `@sitecore-jss/sitecore-jss-angular`, on top of upstream [Sitecore/jss](https://github.com/Sitecore/jss). Upstream changes stay in `CHANGELOG.md`.

Rebuilt from git history on 2026-11-17. Dates are the **commit date** (`git log --format=%cd`), not the author date, of the version-bump commit. Each status was checked against upstream `dev` and `feat/angular-20` on that date.

## Where the fork lives

| What | Where |
| --- | --- |
| Active branch | `feat/angular-20` (PRs from feature branches) |
| Upstream base | Sitecore/jss `dev` at `8dbbed95db` (2025-11-05, `22.10.0-canary.8`); no upstream merge since |
| Package | `@essent/sitecore-jss-angular` in Artifactory `essent-frontend-custom-local`, installed through `essent-npm-essent` |
| Frontend use | `"@sitecore-jss/sitecore-jss-angular": "npm:@essent/sitecore-jss-angular@<version>"` |
| How to publish | Frontend `docs/architecture/migration/upgrade-angular-22-nx-23.md` |

Version numbers follow the upstream line (`22.10.0-canary.N`). Before `canary.9` the Essent builds used upstream version numbers, so the same number can mean two different packages.

## Current line (`feat/angular-20`)

### 22.10.0-canary.14 (2026-11-17)

- The two `DYNAMIC_COMPONENT` lazy-load errors now call `JssModule.forChild()` deprecated and point to `EnvironmentProviders` from `loadChildren` (ATL-4069, #14).

### 22.10.0-canary.13 (2026-11-16)

- Deprecate the NgModule API: `JssModule`, `forRoot()`, `forChild()`, `withComponents()` and `componentModuleRef`. Use `provideJss()` and `provideJssComponents()`. Not removed, because upstream still ships it (ATL-4069, #14).
- Unknown-component hints and the `loadChildren` docs name `provideJssComponents()` (ATL-4069).

### 22.10.0-canary.12 (2026-10-30)

- Handle rejected placeholder lazy loads inside the render `try` (ATL-4065, #13).
- First version installed from Artifactory as `@essent/sitecore-jss-angular` (2026-11-02); before this, Frontend used a tarball.

### 22.10.0-canary.11 (2026-10-29)

- Support Angular 21 and 22; build and tests on Angular 21.2.19 (TS 5.9.3) and 22.1.1 (TS 6.0.3) (ATL-4065, #12).
- Build non-strict on TypeScript 6, so the public `.d.ts` types match `canary.9` (ATL-4065).
- AOT consumer check resolves through the built package (ATL-4065).
- Test promise and thenable values in `wrapIntoObservable` (ATL-4065).
- CI: run the Angular package checks on Node 22.23.4 (ATL-4065).

### 22.10.0-canary.10 (2026-10-29)

- Keep lazy component injectors alive per render, like the NgModule path (ATL-3322, #11).
- Detect lazy load results with the public `reflectComponentType()`, not private Angular fields (ATL-3322).
- CI: run the standalone API specs and the AOT consumer check on PRs to every branch (ATL-3322).

### 22.10.0-canary.9 (2026-10-07)

- Standalone provider API: `provideJss()` and `provideJssComponents()`; lazy `loadChildren` may return a standalone component, a component map or `EnvironmentProviders` (ATL-3322).
- Clean up standalone injectors; make the directive tuple AOT-safe (ATL-3322).

### Tarball "22.10.0-canary.8" (2026-02-02 to 2026-10-09)

Built from the fork under the upstream version number and installed from Frontend `.yarn/patches/sitecore-jss-sitecore-jss-angular-22.10.0-canary.8.tgz` (Frontend `0abf6fe273`, ATL-2080).

- Angular 20.3: `inject()` migration, standalone components, signal inputs (Henk Bakker, 2025-10).
- Check that a component has an input before setting it; remove unused rendering data (2025-11).
- Field directives no longer render when the field is missing; matches upstream `shouldRender` (2025-12; reworded to `!!field && (...)` in canary.11).
- Inputs are passed to components in `sc-placeholder`: `setInput` in a `try`, so unknown inputs are ignored (ATL-3495, Frontend `99792d2132`, same day as the tarball; still in the fork).

### Yarn patch on upstream 21.8.0 (2025-02-20 to 2026-02-02)

Not a fork build: Frontend patched upstream `21.8.0` in `.yarn/patches` (Frontend `137abb3ce4` to `f8db235250`). On the fork, commits `f0e3ddeda0` ("use setinput to support signals") and `afce41e46e` ("use signals in unit test") are from the same day as ATL-2025.

- Set inputs with `setInput` so signal inputs work (ATL-2025).
- Do not set data on a component that has no data (ATL-2211).
- Remove the logging of the rendering (ATL-2469).
- Render all placeholders connected to the specified layouts (ATL-2531).

## Before the current line

These changes lived on old fork branches or as Frontend patches. Only `fix/jss-rendering-signals` (the 2025 start of the current line) is part of `feat/angular-20`; the other old branches were never merged.

### What Frontend installed (2018 to 2026)

From Frontend `package.json` and `patches/` / `.yarn/patches/` history. "Tarball" = a custom build checked into Frontend; "patch" = a patch on the upstream package.

| From | What | Frontend commit |
| --- | --- | --- |
| 2018-04 | Upstream `7.0.0`, then `8.0.1`, `9.0.5`, `11.0.1` (2018-12) | `6e6d058f38`, `c9d7116fdb`, `68f9690a56`, `20351478ec` |
| 2018-06 | patch-package patch on `sitecore-jss-dev-tools` `8.0.3` (removed 2018-09, `8e5650ad6b`) | `6753a12e2f` |
| 2019-02 | patch-package patch on `11.0.2` | `f1c3048fd5`, `a597765a8a` |
| 2019-07 | Tarball `11.0.2-3` (generic link, SC-2998) | `22d57d347a` |
| 2019-07 | patch-package patch on `12.0.0` (skeleton loading SC-4875; IBAN SC-127; lazy loading on Angular 8 SC-4843; multiple guards and resolvers SC-4869) | `254c7655a6`, `ae9a7ebf88`, `6e1ab0d7b4`, `00757f4101` |
| 2019-11 | Tarball `12.0.0` (SC-5445) | `8db65f80ee` |
| 2020-04 | Tarball `12.0.0-1` | `f0456af188` |
| 2020-09 | Tarball `14.0.2` (JSS 14) plus a patch on `sitecore-jss` `14.0.2` | `2dfab5ada0` |
| 2020-12 | Tarball `14.0.2-1` (`_blank` and `_top` links in rich text) | `beb7b74261` |
| 2021-06 | Tarball `14.0.2-2` | `312078bc79` |
| 2021-07 | Tarball `14.0.2-3` (Angular 11) | `94e9af89ec` |
| 2021-11 | Tarball `16.0.0-1` (Angular 12, SC-9897); a `20.0.0-canary.36` tarball was added but not referenced | `c713ecfa43` |
| 2023-01 | Tarball `19.0.2-3` (Angular 13, SC-10180) | `b7b3753f14` |
| 2023-06 | Tarball `19.0.2-4` replaced `19.0.2-3` (memory leak fix) | `948f590c35` |
| 2023-12 | Upstream `21.5.0` plus a patch-package patch (ATL-724) | `0dda24bd86` |
| 2024-01-10 | Yarn patch on `21.5.3`; the `19.0.2-4` tarball removed | `35f636f00a` |
| 2024-01-29 | Yarn patch on `21.7.0-canary.39` (Angular 16, ATL-955) | `b91a0a836e` |
| 2024-05 | Upstream `21.7.0`, patch removed; then `21.7.1` (2024-09) and `21.8.0` (2024-10, ATL-1618) | `b1759ade81`, `a416419f0e`, `e34ac3fa02` |
| 2025-02 | Yarn patch on `21.8.0` (see above) | `137abb3ce4` |
| 2026-02 | Tarball `22.10.0-canary.8` (see above) | `0abf6fe273` |
| 2026-10 | Tarball `22.10.0-canary.9` | `a18c044556` |
| 2026-11 | `@essent/sitecore-jss-angular@22.10.0-canary.12` from Artifactory | `1e5c48c9eb` |

### Old fork branches (2019 to 2024)

| Period | Branch | Change | Status today |
| --- | --- | --- | --- |
| 2019-07 to 2019-11 | `feature/multiple-guards`, `feature/inject-rendering-in-guard` | Guards and resolvers per component, observable guards, multiple guards, `clientOnly` placeholder input, `ComponentNameAndModule` export | In upstream: Essent's branch (Jeroen van der Last, 2020-05) was taken into upstream PR #1246 (2022-11) |
| 2019-07 | (same branches) | Generic text component; merge class names on link fields | Generic text component: dropped. Class-name merge: in upstream since PR #379 (2020-07) |
| 2019-08 | (same branches) | Angular 8, `import()` lazy loading | Superseded |
| 2020-04 | `fix-query-selector-all` | Rich text: skip nodes without `querySelectorAll` | In upstream since PR #1050 (2022-06) |
| 2020-09 | `essent-dev` | Angular 9 | Superseded |
| 2020-12 | `fix-link-target` | Rich text: no router navigation for `_blank` and `_top` links | In upstream since PR #1050 (2022-06) |
| 2021-04 | `feat/injectable-rendering-data` | `COMPONENT_RENDERING` and `COMPONENT_DATA` injection tokens | Dropped: not in upstream, the fork or Frontend |
| 2021-07 | `rebase-on-root-project` | Export `isAbsoluteUrl` | In upstream |
| 2023-12 | `fix/angular-guards` | `JssCanActivateError`, injectable guards, lazy-load helper | `JssCanActivateError` dropped: not in upstream, the fork or Frontend |
| 2024-08 | `feat/angular-18` | Angular 17 and 18 | Superseded by `feat/angular-20` |

## How to add an entry

Add an entry under a new version heading in the same PR as the change: what changed, why, and the ticket. The PR template has a checkbox for it.
