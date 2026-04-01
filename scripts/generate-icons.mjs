/**
 * PWAアイコン生成スクリプト
 * 実行: npx node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

/**
 * 指定サイズの SYNC. ロゴ PNG を SVG → sharp で生成
 */
function buildSvg(size) {
  const pad   = Math.round(size * 0.12)
  const inner = size - pad * 2
  const viewW = 560
  const viewH = 155
  // SVGをインラインで組み立て（フォントはシステムフォント）
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#7C6FE8"/>
      <stop offset="18%"  stop-color="#D455A8"/>
      <stop offset="36%"  stop-color="#E84040"/>
      <stop offset="52%"  stop-color="#E8A020"/>
      <stop offset="68%"  stop-color="#48C468"/>
      <stop offset="84%"  stop-color="#2890D8"/>
      <stop offset="100%" stop-color="#7C6FE8"/>
    </linearGradient>
    <linearGradient id="shine" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="38%"  stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <mask id="txt">
      <rect width="${size}" height="${size}" fill="black"/>
      <text
        x="${size / 2}"
        y="${size * 0.68}"
        text-anchor="middle"
        font-family="Arial Black,Impact,sans-serif"
        font-size="${Math.round(size * 0.52)}"
        font-weight="900"
        letter-spacing="-${Math.round(size * 0.008)}"
        fill="white"
      >SYNC.</text>
    </mask>
  </defs>
  <!-- 黒背景 -->
  <rect width="${size}" height="${size}" fill="#111111" rx="${Math.round(size * 0.18)}"/>
  <!-- グラデーション文字 -->
  <rect width="${size}" height="${size}" fill="url(#bg)"    mask="url(#txt)" rx="${Math.round(size * 0.18)}"/>
  <rect width="${size}" height="${size}" fill="url(#shine)" mask="url(#txt)" rx="${Math.round(size * 0.18)}"/>
</svg>`
}

async function generate(size, filename) {
  const svg = buildSvg(size)
  const buf = Buffer.from(svg)
  await sharp(buf)
    .png()
    .toFile(join(publicDir, filename))
  console.log(`✓ ${filename} (${size}×${size})`)
}

await generate(192, 'icon-192.png')
await generate(512, 'icon-512.png')
console.log('Done.')
