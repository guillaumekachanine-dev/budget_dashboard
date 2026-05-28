/**
 * optimize-icons.mjs
 * Converts all category/block/account/app/fallback PNG icons to WebP.
 * - Resize to 128×128 max (covers 56px × 2× retina = 112px comfortably)
 * - Quality 85 (visually lossless for this type of illustration icon)
 * - Keeps originals untouched; WebP replaces in-place.
 *
 * Run:  node scripts/optimize-icons.mjs
 */

import sharp from 'sharp'
import { readdir, stat, rename, unlink } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'

const ICON_DIRS = [
  'src/assets/icons/categories',
  'src/assets/icons/blocks',
  'src/assets/icons/accounts',
  'src/assets/icons/app',
  'src/assets/icons/fallback',
]

const MAX_DIM = 128
const WEBP_QUALITY = 85

async function processDir(dir) {
  let files
  try {
    files = await readdir(dir)
  } catch {
    console.warn(`⚠  Directory not found: ${dir}`)
    return { processed: 0, savedKB: 0 }
  }

  const pngs = files.filter(f => /\.(png|PNG)$/.test(f))
  let processed = 0
  let savedKB = 0

  for (const file of pngs) {
    const srcPath = join(dir, file)
    const destPath = join(dir, file.replace(/\.png$/i, '.webp'))

    const srcStat = await stat(srcPath)
    const srcKB = srcStat.size / 1024

    try {
      await sharp(srcPath)
        .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: 6 })
        .toFile(destPath)

      const destStat = await stat(destPath)
      const destKB = destStat.size / 1024
      const saved = srcKB - destKB
      savedKB += saved

      // Remove original PNG
      await unlink(srcPath)

      console.log(`  ✓ ${file.padEnd(50)} ${srcKB.toFixed(0).padStart(6)} KB → ${destKB.toFixed(0).padStart(5)} KB  (−${saved.toFixed(0)} KB)`)
      processed++
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`)
    }
  }

  return { processed, savedKB }
}

async function main() {
  console.log('🖼  Optimizing icons (PNG → WebP 128px max, q85)…\n')
  let total = 0
  let totalSaved = 0

  for (const dir of ICON_DIRS) {
    console.log(`📁 ${dir}`)
    const { processed, savedKB } = await processDir(dir)
    total += processed
    totalSaved += savedKB
    if (processed > 0) console.log()
  }

  console.log(`\n✅ Done! Converted ${total} icons, saved ${(totalSaved / 1024).toFixed(1)} MB\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
