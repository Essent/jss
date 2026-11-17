# Essent fork changelog

Changes that Essent made to `@sitecore-jss/sitecore-jss-angular`, on top of upstream [Sitecore/jss](https://github.com/Sitecore/jss). Upstream changes stay in `CHANGELOG.md`.

Rebuilt from git history on 2026-11-17. Dates are the version-bump commit. Entries that could not be traced are marked _not checked_.

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

### 22.10.0-canary.13 (2026-11-17)

- Deprecate the `JssModule` NgModule API: `JssModule`, `forRoot`, `forChild`, `withComponents`, the NgModule `loadChildren` result and `ComponentFactoryResult.componentModuleRef`. Kept for upstream alignment (ATL-4069, #14).
- "Unknown component" hints name `provideJssComponents` instead of `JssModule.withComponents`.

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

### Essent build "22.10.0-canary.8" (2025-02 to 2026-02, Frontend tarball)

Shipped from Frontend `.yarn/patches`, under the upstream version number.

- Angular 20.3: `inject()` migration, standalone components, signal inputs (Henk Bakker, 2025-10).
- Set inputs with `setInput` so signal inputs work; check that a component has an input before setting it (ATL-2025, 2025-02 and 2025-11).
- Remove unused rendering data (2025-11).
- Rendering with an empty value (2025-12; the commit says "maybe fix", effect _not checked_).
- Inputs are passed to components in `sc-placeholder` (ATL-3495, 2026-02).

## Before the current line

These changes lived on old fork branches or as Frontend patches. None of the old branches was merged into `feat/angular-20`.

### Frontend `.yarn/patches` (2020 to 2026)

Patches and tarballs in the Frontend repo, per its git history:

- 2020-09 upgrade to JSS 14; 2020-12 allow `_blank` and `_top` links in rich text.
- 2023-06 memory leak fix, then the patch was removed after an upstream update.
- 2024-01 patch on upstream 21.5.3; 2024-05 patch removed.
- 2025-02 to 2026-02: the Essent build of "canary.8" above (ATL-2025, ATL-2211, ATL-2469, ATL-2531, ATL-2080, ATL-3495).

### Old fork branches (2019 to 2024)

| Period | Branch | Change | Status today |
| --- | --- | --- | --- |
| 2019-07 to 2019-11 | `feature/multiple-guards`, `feature/inject-rendering-in-guard` | Guards and resolvers per component, observable guards, multiple guards, `clientOnly` placeholder input, `ComponentNameAndModule` export | In upstream (`canActivate`, `resolve`, `clientOnly`); how they got there _not checked_ |
| 2019-07 | (same branches) | Generic text component; merge class names on link fields | No `GenericTextComponent` in upstream or the fork; class-name merge _not checked_ |
| 2019-08 | (same branches) | Angular 8, `import()` lazy loading | Superseded |
| 2020-04 | `fix-query-selector-all` | Fix `querySelectorAll` | _not checked_ |
| 2020-09 | `essent-dev` | Angular 9 | Superseded |
| 2020-12 | `fix-link-target` | Link target fix | Shipped as a Frontend patch; current state _not checked_ |
| 2021-04 | `feat/injectable-rendering-data` | Rendering and data injectable in child components | _not checked_ |
| 2021-07 | `rebase-on-root-project` | Export `isAbsoluteUrl` | In upstream |
| 2023-12 | `fix/angular-guards` | `JssCanActivateError`, injectable guards, lazy-load helper | `JssCanActivateError` is not in upstream or the fork |
| 2024-08 | `feat/angular-18` | Angular 17 and 18 | Superseded by `feat/angular-20` |

## How to add an entry

Add an entry under a new version heading in the same PR as the change: what changed, why, and the ticket.
