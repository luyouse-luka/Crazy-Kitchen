// Pulls the Kenney (CC0) art this game uses into game/assets/art/. Zero deps: `node tools/fetch-art.mjs`.
// Re-running is safe; files are rewritten byte-identical. Pick lists are the single source of truth.
import { inflateRawSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'game', 'assets', 'art')

const KITS = [
  {
    url: 'https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip',
    dir: 'kitchen',
    pick: {
      'Models/GLTF format/kitchenFridge.glb': 'kitchenFridge.glb',
      'Models/GLTF format/kitchenStove.glb': 'kitchenStove.glb',
      'Models/GLTF format/kitchenCabinet.glb': 'kitchenCabinet.glb',
      'Models/GLTF format/kitchenBar.glb': 'kitchenBar.glb',
      'Models/GLTF format/kitchenSink.glb': 'kitchenSink.glb',
      'Models/GLTF format/kitchenCabinetDrawer.glb': 'kitchenCabinetDrawer.glb',
      'Models/GLTF format/kitchenStoveElectric.glb': 'kitchenStoveElectric.glb',
      'Models/GLTF format/trashcan.glb': 'trashcan.glb',
      'Models/GLTF format/bookcaseOpen.glb': 'bookcaseOpen.glb',
      'Models/GLTF format/cardboardBoxClosed.glb': 'cardboardBoxClosed.glb',
      'Models/GLTF format/cardboardBoxOpen.glb': 'cardboardBoxOpen.glb',
      'Models/GLTF format/benchCushion.glb': 'benchCushion.glb',
      'Models/GLTF format/computerScreen.glb': 'computerScreen.glb',
      'Models/GLTF format/computerKeyboard.glb': 'computerKeyboard.glb',
      'Models/GLTF format/pottedPlant.glb': 'pottedPlant.glb',
      'Models/GLTF format/plantSmall1.glb': 'plantSmall1.glb',
      'Models/GLTF format/doorwayOpen.glb': 'doorwayOpen.glb',
      'License.txt': 'License.txt',
    },
  },
  {
    url: 'https://kenney.nl/media/pages/assets/mini-characters/bfc7e272b4-1774770718/kenney_mini-characters.zip',
    dir: 'characters',
    pick: {
      'Models/GLB format/character-female-e.glb': 'character-female-e.glb',
      'Models/GLB format/character-male-a.glb': 'character-male-a.glb',
      'Models/GLB format/character-female-b.glb': 'character-female-b.glb',
      'Models/GLB format/character-male-c.glb': 'character-male-c.glb',
      'Models/GLB format/character-female-d.glb': 'character-female-d.glb',
      'Models/GLB format/Textures/colormap.png': 'Textures/colormap.png',
      'License.txt': 'License.txt',
    },
  },
  {
    url: 'https://kenney.nl/media/pages/assets/food-kit/83086fa91c-1719418518/kenney_food-kit.zip',
    dir: 'food',
    pick: {
      'Previews/bread.png': 'icons/bun.png',
      'Previews/meat-raw.png': 'icons/patty.png',
      'Previews/cheese-cut.png': 'icons/cheese.png',
      'Previews/cabbage.png': 'icons/lettuce.png',
      'Previews/tomato-slice.png': 'icons/tomato.png',
      'Previews/onion.png': 'icons/onion.png',
      'Previews/celery-stick.png': 'icons/pickle.png',
      'Previews/bacon-raw.png': 'icons/bacon.png',
      'Previews/plate.png': 'icons/plate.png',
      'Previews/burger.png': 'icons/burger.png',
      'Models/GLB format/meat-patty.glb': 'meat-patty.glb',
      'Models/GLB format/plate.glb': 'plate.glb',
      'Models/GLB format/burger.glb': 'burger.glb',
      'Models/GLB format/bag.glb': 'bag.glb',
      'Models/GLB format/styrofoam.glb': 'styrofoam.glb',
      'Models/GLB format/fries.glb': 'fries.glb',
      'Models/GLB format/cutting-board.glb': 'cutting-board.glb',
      'Models/GLB format/pot.glb': 'pot.glb',
      'Models/GLB format/meat-raw.glb': 'meat-raw.glb',
      'Models/GLB format/cheese.glb': 'cheese.glb',
      'Models/GLB format/cabbage.glb': 'cabbage.glb',
      'Models/GLB format/tomato.glb': 'tomato.glb',
      'Models/GLB format/bread.glb': 'bread.glb',
      'Models/GLB format/Textures/colormap.png': 'Textures/colormap.png',
      'License.txt': 'License.txt',
    },
  },
]

/** Minimal zip reader: central directory -> stored/deflated entries. Enough for Kenney zips. */
function unzip(buf) {
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error('not a zip')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const files = new Map()
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    files.set(name, () => {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
      const raw = buf.subarray(start, start + size)
      if (method === 0) return raw
      if (method === 8) return inflateRawSync(raw)
      throw new Error(`${name}: unsupported zip method ${method}`)
    })
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}

for (const kit of KITS) {
  const res = await fetch(kit.url)
  if (!res.ok) throw new Error(`${kit.url}: HTTP ${res.status}`)
  const files = unzip(Buffer.from(await res.arrayBuffer()))
  for (const [src, dst] of Object.entries(kit.pick)) {
    const read = files.get(src)
    if (!read) throw new Error(`${kit.dir}: ${src} not in zip`)
    const out = join(OUT, kit.dir, dst)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, read())
    console.log(`${kit.dir}/${dst}`)
  }
}
