# Changelog

All notable changes to this project will be documented in this file.

## unreleased

* Added
  * When CLI option `--flatten-components=true` 
    then [`cdx:npm:package:bundled`](https://github.com/CycloneDX/cyclonedx-property-taxonomy/blob/main/cdx/npm.md)
    might be added ([#311] via [#310])
* Misc
  * Added demos for flattened results (via [#310]) 

[#310]: https://github.com/CycloneDX/cyclonedx-node-npm/pull/310
[#311]: https://github.com/CycloneDX/cyclonedx-node-npm/issues/311

## 1.5.0 - 2022-11-11

* Added
  * Components' install path/location will be visible in the SBOM result ([#305] via [#308])

[#305]: https://github.com/CycloneDX/cyclonedx-node-npm/issues/305
[#308]: https://github.com/CycloneDX/cyclonedx-node-npm/pull/308

## 1.4.1 - 2022-11-06

* Fixed
  * Components' "sha512" hash is properly detected and populated in the SBOM result ([#302] via [#303]) 

[#302]: https://github.com/CycloneDX/cyclonedx-node-npm/issues/302
[#303]: https://github.com/CycloneDX/cyclonedx-node-npm/pull/303

## 1.4.0 - 2022-11-05

* Added
  * Enabled support for NPM v9 ([#245] via [#246])

[#245]: https://github.com/CycloneDX/cyclonedx-node-npm/issues/245
[#246]: https://github.com/CycloneDX/cyclonedx-node-npm/pull/246

## 1.3.0 - 2022-10-30

* Fixed
  * Improved the NPM compatibility with `--omit` options ([#254] via [#259])
  * In case of an error, the exit code is guaranteed to be non-zero (via [#260])
* Misc
  * Added more debug output regarding NPM version detection (via [#259])

[#254]: https://github.com/CycloneDX/cyclonedx-node-npm/issues/254
[#259]: https://github.com/CycloneDX/cyclonedx-node-npm/pull/259
[#260]: https://github.com/CycloneDX/cyclonedx-node-npm/pull/260

## 1.2.0 - 2022-10-23

* Changed
  * The existence of a lock file is no longer enforced, as long as there are other evidence ([#247] via [#248])

[#247]: https://github.com/CycloneDX/cyclonedx-node-npm/issues/247
[#248]: https://github.com/CycloneDX/cyclonedx-node-npm/pull/248

## 1.1.0 - 2022-10-22

* Added
  * CLI got a new switch `--short-PURLs` ([#225] via [#226])
* Fixed
  * Improved usability on Windows ([#161] via [#234])
* Misc
  * Improved the error message when a lock files was missing ([#196] via [#231])
* Build
  * Use _TypeScript_ `v4.8.4` now, was `v4.8.3` (via [#164])

[#161]: https://github.com/CycloneDX/cyclonedx-node-npm/issues/161
[#164]: https://github.com/CycloneDX/cyclonedx-node-npm/pull/164
[#196]: https://github.com/CycloneDX/cyclonedx-node-npm/issues/196
[#225]: https://github.com/CycloneDX/cyclonedx-node-npm/issues/225
[#226]: https://github.com/CycloneDX/cyclonedx-node-npm/pull/226
[#231]: https://github.com/CycloneDX/cyclonedx-node-npm/pull/231
[#234]: https://github.com/CycloneDX/cyclonedx-node-npm/pull/234

## 1.0.0 - 2022-09-24

First major version (via [#1])

Thanks to all the beta testers. Your efforts, feedback and contributions are appreciated.

[#1]: https://github.com/CycloneDX/cyclonedx-node-npm/pull/1

## 1.0.0-beta.8 - 2022-09-10

* Fixed
  * Run on Windows systems was improved for `npm`/`npx` sub-processes.
* Misc
  * Style: imports are sorted, now.
* Build
  * Use _TypeScript_ `v4.8.3` now, was `v4.8.2`.

## 1.0.0-beta.7 - 2022-09-07

* Changed
  * PackageUrl(PURL) in JSON and XML results are as short as possible, but still precise.

## 1.0.0-beta.6 - 2022-09-06

* Added
  * CLI switch `--ignore-npm-errors` to ignore/suppress NPM errors.

## 1.0.0-beta.5 - 2022-09-06

* Added
  * Support for node 14 was enabled.
  * Support for handling when run via `npx`.
* Docs
  * Improve installation instructions and usage instructions.
* Misc
  * Improved test coverage.
* Build
  * Use _TypeScript_ `v4.8.2` now, was `v4.7.4`.

## 1.0.0-beta.4 - 2022-08-25

* Fixed
  * Run on Windows systems was fixed.
  * Improved error reporting.
  * Debug output was made clearer to understand.

## 1.0.0-beta.3 - 2022-08-23

* Change
  * The package no longer pins dependencies via shrinkwrap.

## 1.0.0-beta.2 - 2022-08-21

* Fixed
  * Debug output was made clearer to understand and less annoying.
* Style
  * Improved internal typing for OmittableDependencyTypes.

## 1.0.0-beta.1 - 2022-08-20

* First feature complete implementation.
