// Prints the live fps/renderScale reading after load, for comparing the shell's quality choice.
import { chromium } from '@playwright/test';
const port = process.argv[2] || process.env.FIMKEN_PORT || 5311;
const browser = await chromium.launch({ channel: 'msedge', args: ['--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/?controls=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('#battle[data-ready="true"]', { timeout: 120000 });
for (let i = 0; i < 4; i++) { await page.waitForTimeout(2500); console.log(await page.evaluate(() => { const d = document.querySelector('#battle').dataset; return `fps ${d.fps} scale ${d.renderScale} res ${d.resolution} quality ${document.querySelector('#quality').value}`; })); }
await browser.close();
