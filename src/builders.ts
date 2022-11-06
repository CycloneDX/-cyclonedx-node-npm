/*!
This file is part of CycloneDX generator for NPM projects.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

SPDX-License-Identifier: Apache-2.0
Copyright (c) OWASP Foundation. All Rights Reserved.
*/

import { Builders, Enums, Factories, Models } from '@cyclonedx/cyclonedx-library'
import { PackageURL } from 'packageurl-js'

import { makeNpmRunner, runFunc } from './npmRunner'
import { PropertyNames, PropertyValueBool } from './properties'
import { makeThisTool } from './thisTool'
import { versionCompare } from './versionCompare'

type OmittableDependencyTypes = 'dev' | 'optional' | 'peer'

interface BomBuilderOptions {
  ignoreNpmErrors?: BomBuilder['ignoreNpmErrors']
  metaComponentType?: BomBuilder['metaComponentType']
  packageLockOnly?: BomBuilder['packageLockOnly']
  omitDependencyTypes?: Iterable<OmittableDependencyTypes>
  reproducible?: BomBuilder['reproducible']
  flattenComponents?: BomBuilder['flattenComponents']
  shortPURLs?: BomBuilder['shortPURLs']
}

type cPath = string
type AllComponents = Map<cPath, Models.Component>

export class BomBuilder {
  toolBuilder: Builders.FromNodePackageJson.ToolBuilder
  componentBuilder: Builders.FromNodePackageJson.ComponentBuilder
  treeBuilder: TreeBuilder
  purlFactory: Factories.FromNodePackageJson.PackageUrlFactory

  ignoreNpmErrors: boolean

  metaComponentType: Enums.ComponentType
  packageLockOnly: boolean
  omitDependencyTypes: Set<OmittableDependencyTypes>
  reproducible: boolean
  flattenComponents: boolean
  shortPURLs: boolean

  console: Console

  constructor (
    toolBuilder: BomBuilder['toolBuilder'],
    componentBuilder: BomBuilder['componentBuilder'],
    treeBuilder: BomBuilder['treeBuilder'],
    purlFactory: BomBuilder['purlFactory'],
    options: BomBuilderOptions,
    console_: BomBuilder['console']
  ) {
    this.toolBuilder = toolBuilder
    this.componentBuilder = componentBuilder
    this.treeBuilder = treeBuilder
    this.purlFactory = purlFactory

    this.ignoreNpmErrors = options.ignoreNpmErrors ?? false
    this.metaComponentType = options.metaComponentType ?? Enums.ComponentType.Library
    this.packageLockOnly = options.packageLockOnly ?? false
    this.omitDependencyTypes = new Set(options.omitDependencyTypes ?? [])
    this.reproducible = options.reproducible ?? false
    this.flattenComponents = options.flattenComponents ?? false
    this.shortPURLs = options.shortPURLs ?? false

    this.console = console_
  }

  buildFromProjectDir (projectDir: string, process: NodeJS.Process): Models.Bom {
    return this.buildFromNpmLs(
      this.fetchNpmLs(projectDir, process)
    )
  }

  private getNpmVersion (npmRunner: runFunc, process_: NodeJS.Process): number[] {
    let npmVersion: number[]
    this.console.info('INFO  | detect NPM version ...')
    try {
      npmVersion = npmRunner(['--version'], {
        env: process_.env,
        encoding: 'buffer',
        maxBuffer: Number.MAX_SAFE_INTEGER // DIRTY but effective
      }).toString().split('.').map(v => Number(v))
    } catch (runError: any) {
      this.console.group('DEBUG | npm-ls: STDOUT')
      this.console.debug('%s', runError.stdout)
      this.console.groupEnd()
      this.console.group('WARN  | npm-ls: MESSAGE')
      this.console.warn('%s', runError.message)
      this.console.groupEnd()
      this.console.group('ERROR | npm-ls: STDERR')
      this.console.error('%s', runError.stderr)
      this.console.groupEnd()
      throw runError
    }
    this.console.debug('DEBUG | detected NPM version %j', npmVersion)
    return npmVersion
  }

  private fetchNpmLs (projectDir: string, process_: NodeJS.Process): any {
    const npmRunner = makeNpmRunner(process_, this.console)

    const npmVersion = this.getNpmVersion(npmRunner, process_)

    const args: string[] = [
      'ls',
      // format as parsable json
      '--json',
      // get all the needed content
      '--long',
      // depth = infinity
      npmVersion[0] >= 7
        ? '--all'
        : '--depth=255'
    ]

    if (this.packageLockOnly) {
      if (npmVersion[0] >= 7) {
        args.push('--package-lock-only')
      } else {
        this.console.warn('WARN  | your NPM does not support "--package-lock-only", internally skipped this option')
      }
    }

    if (versionCompare(npmVersion, [8, 7]) >= 0) {
      // since NPM v8.7 -- https://github.com/npm/cli/pull/4744
      for (const odt of this.omitDependencyTypes) {
        args.push(`--omit=${odt}`)
      }
    } else {
      // see https://github.com/npm/cli/pull/4744
      for (const odt of this.omitDependencyTypes) {
        switch (odt) {
          case 'dev':
            this.console.warn('WARN  | your NPM does not support "--omit=%s", internally using "--production" to mitigate', odt)
            args.push('--production')
            break
          case 'peer':
          case 'optional':
            this.console.warn('WARN  | your NPM does not support "--omit=%s", internally skipped this option', odt)
            break
        }
      }
    }

    // TODO use instead ? : https://www.npmjs.com/package/debug ?
    this.console.info('INFO  | gather dependency tree ...')
    this.console.debug('DEBUG | npm-ls: run npm with %j in %j', args, projectDir)
    let npmLsReturns: Buffer
    try {
      npmLsReturns = npmRunner(args, {
        cwd: projectDir,
        env: process_.env,
        encoding: 'buffer',
        maxBuffer: Number.MAX_SAFE_INTEGER // DIRTY but effective
      })
    } catch (runError: any) {
      // this.console.group('DEBUG | npm-ls: STDOUT')
      // this.console.debug('%s', runError.stdout)
      // this.console.groupEnd()
      this.console.group('WARN  | npm-ls: MESSAGE')
      this.console.warn('%s', runError.message)
      this.console.groupEnd()
      this.console.group('ERROR | npm-ls: STDERR')
      this.console.error('%s', runError.stderr)
      this.console.groupEnd()
      if (!this.ignoreNpmErrors) {
        throw new Error(`npm-ls exited with errors: ${
          runError.status as string ?? 'noStatus'} ${
          runError.signal as string ?? 'noSignal'}`)
      }
      this.console.debug('DEBUG | npm-ls exited with errors that are to be ignored.')
      npmLsReturns = runError.stdout ?? Buffer.alloc(0)
    }
    // this.console.debug('stdout: %s', npmLsReturns)
    try {
      return JSON.parse(npmLsReturns.toString())
    } catch (jsonParseError) {
      // @ts-expect-error TS2554
      throw new Error('failed to parse npm-ls response', { cause: jsonParseError })
    }
  }

  buildFromNpmLs (data: any): Models.Bom {
    // TODO use instead ? : https://www.npmjs.com/package/debug ?
    this.console.info('INFO  | build BOM ...')

    // region all components & dependencies

    /* eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing --
     * as we need to enforce a proper root component to enable all features of SBOM */
    const rootComponent: Models.Component = this.makeComponent(data, this.metaComponentType) ||
      new DummyComponent(this.metaComponentType, 'RootComponent')
    const allComponents: AllComponents = new Map([[data.path, rootComponent]])
    this.gatherDependencies(allComponents, data, rootComponent.dependencies)

    // endregion all components & dependencies

    const bom = new Models.Bom()

    // region metadata

    bom.metadata.component = rootComponent

    const thisTool = makeThisTool(this.toolBuilder)
    if (thisTool !== undefined) {
      bom.metadata.tools.add(thisTool)
    }

    if (!this.reproducible) {
      bom.metadata.timestamp = new Date()
    }

    // endregion metadata

    // region components

    bom.components = this.nestComponents(
      // remove rootComponent - so the elements that are nested below it are just returned.
      new Map(Array.from(allComponents.entries()).filter(([, c]) => c !== rootComponent)),
      this.treeBuilder.fromPaths(
        new Set(allComponents.keys()),
        // do not depend on `path.sep` -- this would be runtime-dependent, not input-dependent
        data.path[0] === '/' ? '/' : '\\'
      )
    )
    bom.components.forEach(c => this.adjustNestedBomRefs(c, ''))
    rootComponent.components.clear()

    if (this.flattenComponents) {
      for (const component of allComponents.values()) {
        component.properties.forEach(p => {
          if (p.name === PropertyNames.PackageBundled) {
            // bundle-markers have no value when components are flattened, because it is impossible to identify where a component was bundled into.
            component.properties.delete(p)
          }
        })
        component.components.clear()
        if (component !== rootComponent) {
          bom.components.add(component)
        }
      }
    }

    // endregion components

    return bom
  }

  private adjustNestedBomRefs (component: Models.Component, pref: string): void {
    if (component.bomRef.value === undefined) {
      return
    }
    component.bomRef.value = pref + component.bomRef.value
    const fill = component.bomRef.value + '|'
    component.components.forEach(c => this.adjustNestedBomRefs(c, fill))
  }

  private nestComponents (allComponents: AllComponents, tree: PTree): Models.ComponentRepository {
    const children = new Models.ComponentRepository()
    for (const [p, pTree] of tree) {
      const component = allComponents.get(p)
      const components = this.nestComponents(allComponents, pTree)
      if (component === undefined) {
        components.forEach(c => children.add(c))
      } else {
        component.components = components
        children.add(component)
      }
    }
    return children
  }

  private gatherDependencies (allComponents: AllComponents, data: any, directDepRefs: Set<Models.BomRef>): void {
    /* One and the same component may appear multiple times in the tree,
     * but only one occurrence has all the direct dependencies.
     * So we work only on the one `data` that actually has dependencies.
     */
    /* One and the same component may appear multiple times in the tree,
     * but only the most top-level has a complete set with all `dependencies` *and* `resolved`.
     * This detail might cause implementation changes: run over the top level first, then go into nested dependencies.
     */
    for (const [depName, depData] of Object.entries(data.dependencies ?? {}) as any) {
      if (depData === null || typeof depData !== 'object') {
        // cannot build
        continue // for-loop
      }
      if (typeof depData.path !== 'string') {
        // might be an optional dependency that was not installed
        // skip, as it was not installed anyway
        continue // for-loop
      }

      let dep = allComponents.get(depData.path)
      if (dep === undefined) {
        const _dep = this.makeComponent(
          this.packageLockOnly
            ? depData
            : this.enhancedPackageData(depData)
        )
        if (_dep === false) {
          // shall be skipped
          continue // for-loop
        }
        dep = _dep ??
          new DummyComponent(Enums.ComponentType.Library, `InterferedDependency.${depName as string}`)
        if (dep instanceof DummyComponent) {
          this.console.warn('WARN  | InterferedDependency $j', dep.name)
        }

        allComponents.set(depData.path, dep)
      }
      directDepRefs.add(dep.bomRef)

      this.gatherDependencies(allComponents, depData, dep.dependencies)
    }
  }

  /**
   * Some combinations/versions of `npm-install`/`npm-ls` are insufficient,
   * they fail to load package details or miss details.
   * So here is a poly-fill that loads ALL the package's data.
   */
  private enhancedPackageData (data: { path: string }): any {
    try {
      return Object.assign(
        /* eslint-disable-next-line @typescript-eslint/no-var-requires */
        require(`${data.path}/package.json`),
        data
      )
    } catch {
      return data
    }
  }

  /**
   * base64 over 512 bit => 86 chars + 2 chars padding.
   * base64 alphabet: `A-Za-a+/` and `=` for padding
   * examples:
   * - sha512-EYuhVinaPQ2QMvF+SXUOxKpwmMp5rZxHQVHhuMfwhdSIjkwX+F8f+R/b0gyvZXc7eGu5qJJgOOmtR2likwgcFg==
   * - sha512-DXUS22Y57/LAFSg3x7Vi6RNAuLpTXwxB9S2nIA7msBb/Zt8p7XqMwdpdc1IU7CkOQUPgAqR5fWvxuKCbneKGmA==
   * - sha512-5BejraMXMC+2UjefDvrH0Fo/eLwZRV6859SXRg+FgbhA0R0l6lDqDGAQYhKbXhPN2ofk2kY5sgGyLNL907UXpA==
   */
  private readonly hashRE_sha512_base64 = /^sha512-([a-z0-9+/]{86}==)$/i

  /**
   * Ignore pattern for `resolved`.
   * - ignore: well, just ignore it ... i guess.
   * - file: local dist cannot be shipped and therefore should be ignored.
   */
  private readonly resolvedRE_ignore = /^(?:ignore|file):/i

  private makeComponent (data: any, type?: Enums.ComponentType | undefined): Models.Component | false | undefined {
    // older npm-ls versions (v6) hide properties behind a `_`
    const isDev = (data.dev ?? data._development) === true
    if (isDev && this.omitDependencyTypes.has('dev')) {
      this.console.debug('DEBUG | omit dev component: %j %j', data.name, data._id)
      return false
    }

    const component = this.componentBuilder.makeComponent(data, type)
    if (component === undefined) {
      this.console.debug('DEBUG | skip broken component: %j %j', data.name, data._id)
      return undefined
    }

    // region properties

    if (isDev) {
      component.properties.add(
        new Models.Property(PropertyNames.PackageDevelopment, PropertyValueBool.True)
      )
    }
    if (data.extraneous === true) {
      component.properties.add(
        new Models.Property(PropertyNames.PackageExtraneous, PropertyValueBool.True)
      )
    }
    if (data.private === true) {
      component.properties.add(
        new Models.Property(PropertyNames.PackagePrivate, PropertyValueBool.True)
      )
    }
    // older npm-ls versions (v6) hide properties behind a `_`
    if (!this.flattenComponents && (data.inBundle ?? data._inBundle) === true) {
      component.properties.add(
        new Models.Property(PropertyNames.PackageBundled, PropertyValueBool.True)
      )
    }

    // endregion properties

    // older npm-ls versions (v6) hide properties behind a `_`
    const resolved = data.resolved ?? data._resolved
    if (typeof resolved === 'string' && !this.resolvedRE_ignore.test(resolved)) {
      component.externalReferences.add(
        new Models.ExternalReference(
          resolved,
          Enums.ExternalReferenceType.Distribution,
          { comment: 'as detected from npm-ls property "resolved"' }
        )
      )
    }

    // older npm-ls versions (v6) hide properties behind a `_`
    const integrity = data.integrity ?? data._integrity
    if (typeof integrity === 'string') {
      const hashSha512Match = this.hashRE_sha512_base64.exec(integrity) ?? []
      if (hashSha512Match?.length === 2) {
        component.hashes.set(
          Enums.HashAlgorithm['SHA-512'],
          Buffer.from(hashSha512Match[1], 'base64').toString('hex')
        )
      }
    }

    // even private packages may have a PURL for identification
    component.purl = this.makePurl(component)

    /* eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- since empty-string handling is needed */
    component.bomRef.value = (typeof data._id === 'string' ? data._id : undefined) ||
      /* eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing -- since empty-string handling is needed */
      `${component.group || '-'}/${component.name}@${component.version || '-'}`

    return component
  }

  private makePurl (component: Models.Component): PackageURL | undefined {
    const purl = this.purlFactory.makeFromComponent(component, this.reproducible)
    if (purl === undefined) {
      return undefined
    }

    if (this.shortPURLs) {
      purl.qualifiers = undefined
      purl.subpath = undefined
    }

    return purl
  }
}

class DummyComponent extends Models.Component {
  constructor (type: Models.Component['type'], name: Models.Component['name']) {
    super(type, `DummyComponent.${name}`, {
      bomRef: `DummyComponent.${name}`,
      description: `This is a dummy component "${name}" that fills the gap where the actual built failed.`
    })
  }
}

type PTree = Map<string, PTree>

export class TreeBuilder {
  fromPaths (paths: Set<string>, dirSeparator: string): PTree {
    const tree: PTree = new Map(Array.from(paths, p => [p + dirSeparator, new Map()]))
    this.nestPT(tree)
    this.renderPR(tree, '')
    return tree
  }

  private renderPR (tree: PTree, pref: string): void {
    for (const [p, pTree] of [...tree.entries()]) {
      tree.delete(p)
      const pFull = pref + p
      this.renderPR(pTree, pFull)
      tree.set(pFull.slice(undefined, -1), pTree)
    }
  }

  private nestPT (tree: PTree): void {
    if (tree.size < 2) {
      // nothing to compare ...
      return
    }
    for (const a of tree.keys()) {
      for (const [b, bTree] of tree) {
        if (a === b) {
          continue
        }
        if (b.startsWith(a)) {
          (tree.get(a) as PTree).set(b.slice(a.length), bTree)
          tree.delete(b)
        }
      }
    }
    for (const c of tree.values()) {
      this.nestPT(c)
    }
  }
}
