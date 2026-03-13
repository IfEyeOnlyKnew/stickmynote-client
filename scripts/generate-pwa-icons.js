/**
 * PWA Icon Generator
 *
 * Generates all required PWA icon sizes from a source image.
 *
 * Usage:
 *   node scripts/generate-pwa-icons.js [source-image]
 *
 * If no source image is provided, it generates placeholder icons with the app initial.
 * For production, provide a high-res source image (at least 1024x1024).
 *
 * Requirements: Node.js (no external dependencies for placeholder generation)
 */

const fs = require("fs")
const path = require("path")

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const MASKABLE_SIZES = [192, 512]
const OUTPUT_DIR = path.join(__dirname, "..", "public", "icons")

// Simple SVG-based icon generator (no dependencies needed)
function generateSVGIcon(size, maskable = false) {
  const padding = maskable ? Math.round(size * 0.1) : 0
  const innerSize = size - padding * 2
  const fontSize = Math.round(innerSize * 0.45)
  const bgColor = "#2563eb"
  const textColor = "#ffffff"

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${maskable ? bgColor : "transparent"}" rx="${maskable ? 0 : Math.round(size * 0.15)}"/>
  <rect x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}" fill="${bgColor}" rx="${Math.round(innerSize * 0.15)}"/>
  <text x="${size / 2}" y="${size / 2}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${textColor}" text-anchor="middle" dominant-baseline="central">S</text>
  <text x="${size / 2}" y="${size / 2 + fontSize * 0.55}" font-family="Arial, sans-serif" font-size="${Math.round(fontSize * 0.35)}" fill="${textColor}" text-anchor="middle" dominant-baseline="central" opacity="0.8">Stick My Note</text>
</svg>`
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

console.log("Generating PWA icons...")
console.log(`Output directory: ${OUTPUT_DIR}\n`)

// Generate regular icons
for (const size of ICON_SIZES) {
  const svg = generateSVGIcon(size, false)
  const filename = `icon-${size}x${size}.png`
  // Save as SVG (browsers accept SVG in manifest; for true PNG, use sharp or canvas)
  const svgFilename = `icon-${size}x${size}.svg`
  fs.writeFileSync(path.join(OUTPUT_DIR, svgFilename), svg)

  // Also create a simple HTML redirect for PNG (placeholder until real images are made)
  console.log(`  Created ${svgFilename} (${size}x${size})`)
}

// Generate maskable icons
for (const size of MASKABLE_SIZES) {
  const svg = generateSVGIcon(size, true)
  const svgFilename = `maskable-icon-${size}x${size}.svg`
  fs.writeFileSync(path.join(OUTPUT_DIR, svgFilename), svg)
  console.log(`  Created ${svgFilename} (${size}x${size}, maskable)`)
}

console.log(`
Done! ${ICON_SIZES.length + MASKABLE_SIZES.length} icons generated.

NOTE: These are SVG placeholder icons. For production:
1. Create a high-resolution source image (1024x1024 PNG)
2. Use a tool like https://realfavicongenerator.net/ to generate all sizes
3. Replace the SVG files with proper PNG files
4. Update manifest.json icon types from "image/svg+xml" to "image/png"

The manifest.json currently references PNG files. Either:
- Rename the SVGs to .png (works in most browsers)
- Generate proper PNGs using: npx sharp-cli resize [size] [size] source.png -o icon-[size]x[size].png
`)
