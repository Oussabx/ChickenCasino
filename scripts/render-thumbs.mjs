/**
 * Renders the game card thumbnails from the live 3D scenes.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/render-thumbs.mjs            # needs `playwright` + python3 with Pillow
 *
 * Writes public/img/games/<id>-sq.webp (1:1) and <id>-wide.webp (4:3).
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const GAMES = (process.env.GAMES ?? 'chicken-cross,crash,plinko,egg-hunt,cluck-dice,golden-wheel,blackjack,roulette,baccarat,punto-banco,poker,video-poker').split(',');
const SHAPES = { sq: { width: 900, height: 900 }, wide: { width: 1200, height: 900 } };
const tmp = '.thumbs-tmp';
mkdirSync(tmp, { recursive: true });
mkdirSync('public/img/games', { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const id of GAMES) {
  for (const [shape, viewport] of Object.entries(SHAPES)) {
    const page = await (await browser.newContext({ viewport, deviceScaleFactor: 1 })).newPage();
    await page.goto(`${BASE}/#/showcase/${id}`);
    await page.waitForSelector('#showcase[data-ready="1"]', { timeout: 30000 });
    await page.waitForTimeout(150);
    const png = `${tmp}/${id}-${shape}.png`;
    await page.locator('#showcase').screenshot({ path: png });
    execFileSync('python3', ['-c', `from PIL import Image; im=Image.open('${png}').convert('RGB'); im=im.resize((im.width*2//3, im.height*2//3), Image.LANCZOS); im.save('public/img/games/${id}-${shape}.webp', 'WEBP', quality=84, method=6)`]);
    console.log('rendered', id, shape);
    await page.context().close();
  }
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
