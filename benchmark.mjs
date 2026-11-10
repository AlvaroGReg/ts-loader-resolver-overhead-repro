import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { generateFixture } from './generate-fixture.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const generatedDir = path.join(root, '.generated', 'benchmark-run')
const runBuildScript = path.join(root, 'run-build.cjs')

function parseArgs(argv) {
  const get = (flag, fallback) => {
    const index = argv.indexOf(flag)
    return index === -1 ? fallback : argv[index + 1]
  }
  const options = {
    files: Number(get('--files', '300')),
    resolutionFanout: Number(get('--resolution-fanout', '2100')),
    warmup: Number(get('--warmup', '1')),
    iterations: Number(get('--iterations', '3')),
  }
  if (!Number.isInteger(options.files) || options.files < 2) throw new Error('--files must be an integer >= 2')
  if (!Number.isInteger(options.resolutionFanout) || options.resolutionFanout < 0) throw new Error('--resolution-fanout must be a non-negative integer')
  if (!Number.isInteger(options.warmup) || options.warmup < 0) throw new Error('--warmup must be a non-negative integer')
  if (!Number.isInteger(options.iterations) || options.iterations < 1) throw new Error('--iterations must be a positive integer')
  return options
}

function runBuild(mode, iteration, fixtureDir) {
  return new Promise((resolve, reject) => {
    const outputDir = path.join(generatedDir, 'outputs', mode, String(iteration))
    const child = spawn(process.execPath, [runBuildScript], {
      env: { ...process.env, FIXTURE_DIR: fixtureDir, OUTPUT_DIR: outputDir, RESOLVER_MODE: mode },
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let stdout = ''
    child.stdout.on('data', chunk => { stdout += chunk.toString() })
    child.on('error', reject)
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`${mode} build exited with code ${code}`))
      try {
        resolve(JSON.parse(stdout.trim()))
      } catch (error) {
        reject(error)
      }
    })
  })
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const fixtureDir = path.join(generatedDir, 'fixture')
  const fixture = generateFixture({ fixtureDir, ...options })
  const samples = { throw: [], 'no-result': [] }
  const observations = []

  for (let iteration = 0; iteration < options.warmup + options.iterations; iteration++) {
    const [throwResult, noResult] = await Promise.all([
      runBuild('throw', iteration, fixtureDir),
      runBuild('no-result', iteration, fixtureDir),
    ])
    if (throwResult.resolverCalls !== noResult.resolverCalls) {
      throw new Error(`Resolver call counts differ: ${throwResult.resolverCalls} vs ${noResult.resolverCalls}`)
    }
    if (JSON.stringify(throwResult.assets) !== JSON.stringify(noResult.assets) ||
        JSON.stringify(throwResult.errors) !== JSON.stringify(noResult.errors) ||
        JSON.stringify(throwResult.warnings) !== JSON.stringify(noResult.warnings)) {
      throw new Error('Build outputs or diagnostics differ between resolver modes')
    }
    observations.push({ iteration, resolverCalls: throwResult.resolverCalls, throwResult, noResult })
    if (iteration >= options.warmup) {
      samples.throw.push(throwResult.durationMs)
      samples['no-result'].push(noResult.durationMs)
    }
    console.log(`iteration ${iteration + 1}/${options.warmup + options.iterations}: ${throwResult.resolverCalls} calls; throw=${throwResult.durationMs.toFixed(1)}ms; no-result=${noResult.durationMs.toFixed(1)}ms`)
  }

  const result = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    tsLoader: JSON.parse(fs.readFileSync(path.join(root, 'node_modules/ts-loader/package.json'), 'utf8')).version,
    typescript: JSON.parse(fs.readFileSync(path.join(root, 'node_modules/typescript/package.json'), 'utf8')).version,
    webpack: JSON.parse(fs.readFileSync(path.join(root, 'node_modules/webpack/package.json'), 'utf8')).version,
    fixture: { files: fixture.files, resolutionFanout: fixture.resolutionFanout },
    warmup: options.warmup,
    measuredIterations: options.iterations,
    resolverCallsPerBuild: observations.at(-1).resolverCalls,
    mediansMs: { throw: median(samples.throw), noResult: median(samples['no-result']) },
    observations,
  }
  fs.mkdirSync(generatedDir, { recursive: true })
  fs.writeFileSync(path.join(generatedDir, 'benchmark-results.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({
    fixture: result.fixture,
    versions: {
      node: result.node,
      typescript: result.typescript,
      webpack: result.webpack,
      tsLoader: result.tsLoader,
    },
    resolverCallsPerBuild: result.resolverCallsPerBuild,
    mediansMs: result.mediansMs,
    savedTo: path.join(generatedDir, 'benchmark-results.json'),
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
