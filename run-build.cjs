'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const webpack = require('webpack')
const resolver = require('ts-loader/dist/resolver')
const originalMakeResolver = resolver.makeResolver
const mode = process.env.RESOLVER_MODE
let resolverCalls = 0

resolver.makeResolver = options => {
  const originalResolve = originalMakeResolver(options)
  return (...args) => {
    resolverCalls++
    if (mode === 'throw') return originalResolve(...args)
    if (mode === 'no-result') return false
    throw new Error(`Unknown RESOLVER_MODE: ${mode}`)
  }
}

const config = require('./webpack.config.cjs')
const started = process.hrtime.bigint()

webpack(config, (error, stats) => {
  const durationMs = Number(process.hrtime.bigint() - started) / 1e6
  if (error || !stats || stats.hasErrors()) {
    console.error(error || stats?.toString({ all: false, errors: true }))
    process.exitCode = 1
    return
  }

  const result = stats.toJson({ all: false, assets: true, errors: true, warnings: true })
  const assets = result.assets.map(asset => {
    const filePath = path.join(config.output.path, asset.name)
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    return { name: asset.name, size: asset.size, sha256 }
  })
  process.stdout.write(JSON.stringify({
    mode,
    durationMs,
    resolverCalls,
    assets,
    errors: result.errors.map(diagnostic => diagnostic.message),
    warnings: result.warnings.map(diagnostic => diagnostic.message),
  }) + '\n')
})
