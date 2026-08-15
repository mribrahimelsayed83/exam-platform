// One-off icon generator — run with `node scripts/generate-pwa-icons.cjs`.
// Builds all PWA/favicon assets from the single source photo (src/mr.png),
// cropped to a head-and-shoulders portrait so it stays recognizable at
// small sizes (a full-body street photo reads as noise at 32px).
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const SRC = path.join(__dirname, '../src/mr.png');
const OUT = path.join(__dirname, '../public/icons');
const BRAND = '#2563eb'; // tailwind blue-600, matches the dashboard/sidebar accent
const PORTRAIT_CROP = { left: 65, top: 5, width: 340, height: 340 };

fs.mkdirSync(OUT, { recursive: true });

function portrait() {
  return sharp(SRC).extract(PORTRAIT_CROP);
}

// Flat icon: portrait fills the square edge-to-edge (used where the OS
// doesn't apply its own mask, so no padding is needed or wanted).
async function flatIcon(size) {
  return portrait().resize(size, size).png();
}

// Maskable icon: portrait shrunk with brand-color padding so the face stays
// inside the ~80% safe-zone circle the OS may crop the icon to.
async function maskableIcon(size) {
  const subjectSize = Math.round(size * 0.72);
  const subject = await portrait().resize(subjectSize, subjectSize).toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  })
    .composite([{ input: subject, left: Math.round((size - subjectSize) / 2), top: Math.round((size - subjectSize) / 2) }])
    .png();
}

async function main() {
  await (await flatIcon(512)).toFile(path.join(OUT, 'icon-512.png'));
  await (await flatIcon(192)).toFile(path.join(OUT, 'icon-192.png'));
  await (await flatIcon(180)).toFile(path.join(OUT, 'apple-touch-icon.png'));
  await (await flatIcon(32)).toFile(path.join(OUT, 'favicon-32x32.png'));
  await (await flatIcon(16)).toFile(path.join(OUT, 'favicon-16x16.png'));
  await (await maskableIcon(512)).toFile(path.join(OUT, 'maskable-512.png'));

  console.log('✅ PWA icons generated in', OUT);
}

main().catch(err => { console.error(err); process.exit(1); });
