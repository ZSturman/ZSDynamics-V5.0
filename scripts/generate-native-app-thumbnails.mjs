import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Frame real app icons in a landscape card; keep the artwork and title inside
// the center square so the portfolio's list crop remains readable too.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const palettes = {
  'home-page': ['#16313c', '#294e59'],
  trackables: ['#0d4037', '#17745d'],
  'iphone-microscope': ['#081f2c', '#154550'],
  'camera-monitor': ['#123a51', '#197c89'],
  'files-backups': ['#12365b', '#14758b'],
  'casino-exit': ['#103b33', '#176a56'],
};
const xml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
for (const [slug, colors] of Object.entries(palettes)) {
  const folder = path.join(root, 'content', 'projects', slug);
  const project = JSON.parse(await fs.readFile(path.join(folder, 'project.json'), 'utf8'));
  const images = path.join(folder, 'images');
  const icon = await sharp(path.join(images, 'app-icon.png')).resize(512, 512).webp({ quality: 88 }).toBuffer();
  await fs.writeFile(path.join(images, 'app-icon-optimized.webp'), icon);
  const embeddedIcon = await sharp(path.join(images, 'app-icon.png')).resize(512, 512).png().toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="${xml(project.title)} app icon">
  <defs><linearGradient id="background" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient><clipPath id="icon"><rect x="408" y="92" width="384" height="384" rx="76"/></clipPath></defs>
  <path fill="url(#background)" d="M0 0h1200v675H0z"/>
  <image xlink:href="data:image/png;base64,${embeddedIcon.toString('base64')}" x="408" y="92" width="384" height="384" clip-path="url(#icon)"/>
  <text x="600" y="554" fill="#f5f8f7" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Arial,sans-serif" font-size="46" font-weight="600">${xml(project.title)}</text>
</svg>\n`;
  await Promise.all(['thumbnail.svg', 'thumbnail-optimized.svg'].map((name) => fs.writeFile(path.join(images, name), svg)));
  console.log(`${slug}: thumbnail and optimized icon generated`);
}
