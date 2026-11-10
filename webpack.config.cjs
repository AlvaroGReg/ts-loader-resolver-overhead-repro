'use strict'

const path = require('node:path')

const fixtureDir = process.env.FIXTURE_DIR || path.join(__dirname, '.generated/fixture')
const outputDir = process.env.OUTPUT_DIR || path.join(__dirname, '.generated/output')

module.exports = {
  mode: 'development',
  context: fixtureDir,
  entry: path.join(fixtureDir, 'src/index.ts'),
  output: { path: outputDir, filename: 'bundle.js' },
  cache: false,
  resolve: { extensions: ['.ts', '.js'] },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          configFile: path.join(fixtureDir, 'tsconfig.json'),
          appendTsSuffixTo: [/\.vue$/, /\.html$/],
          silent: true,
        },
      },
    ],
  },
  stats: 'errors-only',
  infrastructureLogging: { level: 'error' },
}
