import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const source = readFileSync(new URL('../apps/web/public/icons/icon.svg', import.meta.url))
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng()
  const path = new URL(`../apps/web/public/icons/${name}`, import.meta.url)
  writeFileSync(path, png)
}
