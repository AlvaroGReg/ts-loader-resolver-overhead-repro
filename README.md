# `ts-loader` disabled-resolver overhead reproduction

This standalone fixture compares the disabled resolver behavior in `ts-loader` 9.6.2 with a no-result return. Both modes keep TypeScript's module-resolution fallback active and perform the same type checking. The benchmark wraps the installed resolver in memory; it does not modify `ts-loader` source.

## Problem under investigation

The disabled resolver returned by `ts-loader` throws an exception. `servicesHost.resolveModule` catches that exception and continues with TypeScript's resolver. In a local profile of a large application, the resolver was invoked approximately 636,000 times during the initial build, so the cost of repeatedly throwing and catching exceptions was worth measuring. The private application and all proprietary source are excluded from this repository.

## What the fixture measures

The generated TypeScript graph includes project aliases, public type declaration packages, and configurable type-only resolution edges. Each benchmark iteration launches the two modes in independent Node.js processes concurrently:

- **`throw`** calls the original `makeResolver` result from the npm-installed `ts-loader` 9.6.2. The resolver throws as in the normal disabled-resolver path, then the existing TypeScript fallback runs.
- **`no-result`** returns `false` from the wrapper. TypeScript's existing fallback remains enabled and performs module resolution.

The runner counts resolver calls and compares emitted asset names, sizes, SHA-256 hashes, error messages, and warning messages. It reports the runtime and installed dependency versions, per-iteration durations, and medians. Generated fixture files, build outputs, and result JSON are kept under the ignored `.generated/` directory.

`--resolution-fanout` is calibrated to approximate the observed call volume. Its deliberately high fan-out is artificial and does **not** represent literal imports from real components. Results are specific to this synthetic fixture and environment; they do not guarantee the same performance improvement in every project.

## Requirements and dependencies

Node.js 24+ and npm are required. Direct development dependencies are pinned in `package.json` and `package-lock.json`:

| Package | Version |
| --- | ---: |
| `ts-loader` | 9.6.2 |
| `typescript` | 6.0.3 |
| `webpack` | 5.112.2 |
| `@types/node` | 24.1.0 |
| `portal-vue` | 3.0.0 |
| `swiper` | 14.2.0 |
| `type-fest` | 4.41.0 |
| `undici-types` | 7.8.0 |
| `vue` | 3.5.45 |
| `vue3-carousel` | 0.17.0 |

## Install and run

From the repository directory, install the exact lockfile dependencies and run the calibrated benchmark:

```sh
npm ci
npm run benchmark -- --files 300 --resolution-fanout 2100 --warmup 1 --iterations 3
```

These commands work in PowerShell, Command Prompt, and other shells supported by Node.js and npm. For example, to run a short smoke test on Windows PowerShell:

```powershell
npm ci
npm run benchmark -- --files 10 --resolution-fanout 10 --warmup 0 --iterations 1
```

Smaller values also work in other compatible shells:

```sh
npm run benchmark -- --files 50 --resolution-fanout 20 --warmup 0 --iterations 1
```

## Latest calibrated run

Run on 2026-11-10 with Node.js `v24.14.1`, TypeScript `6.0.3`, Webpack `5.112.2`, and `ts-loader` `9.6.2` using the command above (`300` files, fan-out `2100`, one warmup and three measured iterations):

| Resolver behavior | Median build time |
| --- | ---: |
| Throw and catch | 52.38 s |
| Return no result | 43.08 s |

Both modes counted **634,051 resolver calls per build**. Emitted assets and SHA-256 hashes matched; error and warning messages matched (zero errors and zero warnings). These are newly measured local results for this synthetic benchmark, not a promise of equivalent gains elsewhere. Full run observations are written to `.generated/benchmark-run/benchmark-results.json` and are not tracked by Git.

## License

MIT. See [LICENSE](LICENSE).
