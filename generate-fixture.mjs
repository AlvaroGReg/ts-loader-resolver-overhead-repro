import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function componentSource(index, nextIndex, resolutionFanout) {
  const stressImports = Array.from({ length: resolutionFanout }, (_value, importIndex) =>
    `import type { ResolutionType${importIndex} } from '@Core/types/resolution-type${importIndex}'`
  ).join('\n')
  const stressTypes = Array.from({ length: resolutionFanout }, (_value, importIndex) => `ResolutionType${importIndex}`).join(', ')

  return `import type { Component, Ref } from 'vue'
import type { PartialDeep, SetRequired } from 'type-fest'
import type { SwiperOptions } from 'swiper/types'
import type { CoreModel${index} } from '@Core/models/model${index}'
import type { Template${index} } from '@Templates/template${index}'
import type { SharedModel } from '../shared'
import type {} from 'portal-vue'
import type {} from 'vue3-carousel'
${stressImports}

type ViewModel = SetRequired<PartialDeep<CoreModel${index}>, 'id'>

export interface View${index} {
  component: Component
  state: Ref<ViewModel>
  options: SwiperOptions
  template: Template${index}
  shared: SharedModel
  resolutionTypes: [${stressTypes}]
  next: typeof import('./view${nextIndex}')
}
`
}

function parseArgs(argv) {
  const get = (flag, fallback) => {
    const index = argv.indexOf(flag)
    return index === -1 ? fallback : argv[index + 1]
  }
  const fixtureDir = path.resolve(get('--fixture-dir', '.generated/fixture'))
  const files = Number(get('--files', '300'))
  const resolutionFanout = Number(get('--resolution-fanout', '2100'))
  if (!Number.isInteger(files) || files < 2) throw new Error('--files must be an integer >= 2')
  if (!Number.isInteger(resolutionFanout) || resolutionFanout < 0) throw new Error('--resolution-fanout must be a non-negative integer')
  return { fixtureDir, files, resolutionFanout }
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

export function generateFixture({ fixtureDir, files, resolutionFanout }) {
  fs.rmSync(fixtureDir, { recursive: true, force: true })
  const srcDir = path.join(fixtureDir, 'src')
  const modelDir = path.join(srcDir, 'core/models')
  const resolutionTypeDir = path.join(srcDir, 'core/types')
  const templateDir = path.join(srcDir, 'templates')

  write(path.join(srcDir, 'shared.ts'), `export interface SharedModel {
  id: number
  label: string
  metadata: Record<string, unknown>
}
`)

  for (let index = 0; index < files; index++) {
    const nextIndex = (index + 1) % files
    write(path.join(modelDir, `model${index}.ts`), `export interface CoreModel${index} {
  id?: number
  value: string
  metadata: {
    source: 'generated'
    index: ${index}
  }
}
`)
    write(path.join(templateDir, `template${index}.ts`), `export interface Template${index} {
  name: 'template-${index}'
  values: string[]
}
`)
    write(path.join(srcDir, `views/view${index}.ts`), componentSource(index, nextIndex, resolutionFanout))
  }

  for (let index = 0; index < resolutionFanout; index++) {
    write(path.join(resolutionTypeDir, `resolution-type${index}.ts`), `export interface ResolutionType${index} {
  id: ${index}
  value: string
}
`)
  }

  const imports = Array.from({ length: files }, (_value, index) => `import type { View${index} } from './views/view${index}'`).join('\n')
  write(path.join(srcDir, 'index.ts'), `${imports}

export type ApplicationViews = [${Array.from({ length: files }, (_value, index) => `View${index}`).join(', ')}]
`)

  write(path.join(fixtureDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'es2020',
      module: 'commonjs',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: false,
      sourceMap: false,
      types: ['node'],
      paths: {
        '@Core/*': ['./src/core/*'],
        '@Templates/*': ['./src/templates/*'],
      },
    },
    include: ['src/**/*.ts'],
  }, null, 2))

  return { fixtureDir, files, resolutionFanout, entryFile: path.join(srcDir, 'index.ts') }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(generateFixture(parseArgs(process.argv.slice(2))), null, 2))
}
