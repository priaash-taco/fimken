import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.addInitScript(() => {
    const saved = JSON.parse(localStorage.getItem('fimken.v1.settings') || '{}');
    localStorage.setItem('fimken.v1.settings', JSON.stringify({ ...saved, 'scene-mode': '3d' }));
  });
  await page.goto('/?character=debug-goku&debug=1');
  await expect(page.locator('#battle')).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
  await expect(page.locator('#render-error')).toBeHidden();
}
async function settings(page) {
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  if(await page.locator('#advanced-settings').getAttribute('open')===null) await page.getByText('Advanced',{exact:true}).click();
}

test('solo 3D scene, modal, camera, demo choreography and controls', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await expect(page.locator('main')).toHaveText('fimken.');
  await page.screenshot({ path: 'test-results/first-light-scene.png' });
  await settings(page);
  await page.getByLabel('Sound sensitivity').fill('80');
  await expect(page.locator('#sensitivity-value')).toHaveText('80%');
  await page.getByLabel('Camera view').selectOption('portrait');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.screenshot({ path: 'test-results/character-study.png' });
  await settings(page);
  await page.getByLabel('Camera view').selectOption('training');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await settings(page);
  await page.getByRole('button', { name: 'Demo', exact: true }).click();
  await expect(page.locator('#source-label')).toHaveText('DEMO · SIMULATED');
  await expect(page.locator('#battle')).toHaveAttribute('data-phase', 'blast', { timeout: 25000 });
  await page.screenshot({ path: 'test-results/first-light-blast.png' });
  await settings(page);
  await page.getByRole('button', { name: 'Pause animation' }).click();
  await expect(page.getByRole('button', { name: 'Resume animation' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume animation' }).click();
  await page.getByRole('button', { name: 'Stop demo', exact: true }).click();
  await expect(page.locator('#source-label')).toHaveText('AMBIENT');
  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible();
  await page.getByRole('button', { name: 'Exit fullscreen' }).click();
  expect(errors).toEqual([]);
});

test('mobile viewport and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/goku-mobile.png' });
  await settings(page);
  await expect(page.getByRole('button', { name: 'Resume animation' })).toBeVisible();
  await expect(page.getByLabel('Reduced motion')).toBeChecked();
  await expect(page.getByLabel('Cinematic camera')).not.toBeChecked();
  await page.screenshot({ path: 'test-results/settings-mobile.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open settings' })).toBeFocused();
});

test('microphone denial and demo recovery', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
  });
  await ready(page);
  await settings(page);
  await page.getByRole('button', { name: 'Microphone', exact: true }).click();
  await expect(page.locator('#source-status')).toContainText('Microphone access was not granted');
  await expect(page.getByRole('button', { name: 'Microphone', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Demo', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#source-label')).toHaveText('DEMO · SIMULATED');
});

test('PC audio requests a monitor with system sound; stop releases stream', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async options => {
      window.testOptions = options;
      const context = new AudioContext();
      await context.resume();
      const oscillator = context.createOscillator();
      oscillator.frequency.value = 150;
      const destination = context.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();
      window.testStream = destination.stream;
      window.testContext = context;
      return destination.stream;
    };
  });
  await ready(page);
  await settings(page);
  await page.getByRole('button', { name: 'PC audio', exact: true }).click();
  await expect(page.locator('#source-label')).toHaveText('PC AUDIO LIVE');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await page.evaluate(() => window.testOptions.video.displaySurface)).toBe('monitor');
  expect(await page.evaluate(() => window.testOptions.systemAudio)).toBe('include');
  await expect(page.locator('#battle')).toHaveAttribute('data-section', /quiet|flow|build|peak/);
  await settings(page);
  await page.getByRole('button', { name: 'Stop audio', exact: true }).click();
  expect(await page.evaluate(() => window.testStream.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
  await page.evaluate(() => window.testContext.close());
});

test('sharing without sound releases video and explains system audio', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement('canvas');
      window.testStream = canvas.captureStream();
      return window.testStream;
    };
  });
  await ready(page);
  await settings(page);
  await page.getByRole('button', { name: 'PC audio', exact: true }).click();
  await expect(page.locator('#source-status')).toContainText('No audio was shared');
  expect(await page.evaluate(() => window.testStream.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
});

test('authored solo actor, saved preferences, manual energy practice and frozen action', async ({ page }) => {
  test.setTimeout(60000);
  const assets = [];
  page.on('request', request => { if (/\.(glb|vrm)$/.test(request.url())) assets.push(request.url()); });
  // Obsolete cast choices must not bring back the second character.
  await page.addInitScript(() => {
    if (!localStorage.getItem('fimken.v1.settings')) localStorage.setItem('fimken.v1.settings', JSON.stringify({ 'fighter-0': 'beerus', 'fighter-1': 'beerus', view: 'duel' }));
  });
  await ready(page);
  await expect(page.locator('#battle')).toHaveAttribute('data-characters', 'goku');
  await expect(page.locator('#battle')).toHaveAttribute('data-phase', 'powerup', { timeout: 8000 });
  expect(assets.length).toBeGreaterThan(0);
  expect(assets.every(url => url.endsWith('/goku-hero/goku-scene.glb'))).toBe(true);
  await settings(page);
  await expect(page.getByRole('button', { name: 'Swap sides' })).toHaveCount(0);
  await page.getByLabel('Environment', { exact: true }).selectOption('eclipse');
  await page.getByLabel('Render quality').selectOption('low');
  await page.getByLabel('Training routine').selectOption('melee');
  await page.reload();
  await expect(page.locator('#battle')).toHaveAttribute('data-ready', 'true');
  await settings(page);
  await expect(page.getByLabel('Environment', { exact: true })).toHaveValue('eclipse');
  await expect(page.getByLabel('Training routine')).toHaveValue('melee');
  await page.getByRole('button', { name: 'Energy blast', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#battle')).toHaveAttribute('data-phase', 'powerup');
  await expect(page.locator('#battle')).toHaveAttribute('data-phase', 'blast', { timeout: 12000 });
  await expect(page.locator('#battle')).toHaveAttribute('data-beam-visible', 'true');
  // Dialog closing restores focus to its opener; focus the scene before shortcuts.
  await page.locator('#battle').click({ position: { x: 30, y: 200 } });
  await page.keyboard.press('Space');
  const progress = await page.locator('#battle').getAttribute('data-progress');
  await page.screenshot({ path: 'test-results/first-light-paused.png' });
  await settings(page);
  await expect(page.getByRole('button', { name: 'Resume animation' })).toBeVisible();
  await expect(page.locator('#battle')).toHaveAttribute('data-progress', progress);
  await page.getByRole('button', { name: 'Practice strikes' }).click();
  await expect(page.locator('#battle')).toHaveAttribute('data-phase', 'punch', { timeout: 8000 });
  await expect(page.locator('#battle')).toHaveAttribute('data-impacts', /[1-9]/);
});

test('the original score starts a synchronized 20-second scene and can be stopped', async ({ page }) => {
  test.setTimeout(45000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await ready(page);
  await settings(page);
  await page.getByRole('button', { name: 'First Light', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#source-label')).toHaveText('LOCAL MUSIC');
  await expect(page.locator('#battle')).toHaveAttribute('data-phase', 'powerup', { timeout: 10000 });
  await page.screenshot({ path: 'test-results/first-light-powerup.png' });
  await expect(page.locator('#battle')).toHaveAttribute('data-phase', 'blast', { timeout: 8000 });
  await expect(page.locator('#battle')).toHaveAttribute('data-shot', 'impact');
  await expect(page.locator('#battle')).toHaveAttribute('data-phase', 'float', { timeout: 12000 });
  await expect.poll(async () => Number(await page.locator('#battle').getAttribute('data-progress'))).toBeGreaterThan(.25);
  await page.screenshot({ path: 'test-results/first-light-flight.png' });
  await expect(page.locator('#battle')).toHaveAttribute('data-phase', 'land', { timeout: 8000 });
  await expect.poll(async () => Number(await page.locator('#battle').getAttribute('data-progress'))).toBeGreaterThan(.25);
  await page.screenshot({ path: 'test-results/first-light-landing.png' });
  await settings(page);
  await page.getByRole('button', { name: 'Stop audio', exact: true }).click();
  await expect(page.locator('#source-label')).toHaveText('AMBIENT');
  expect(errors).toEqual([]);
});

test('high quality can allocate a native 4K frame without replacing character detail', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await settings(page);
  await page.getByLabel('Render quality').selectOption('high');
  const dimensions = await page.locator('#battle').evaluate(canvas => [canvas.width, canvas.height]);
  expect(dimensions).toEqual([3840, 2160]);
  await expect(page.locator('#battle')).toHaveAttribute('data-clips', '11');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.screenshot({ path: 'test-results/first-light-4k.png' });
});

test('local music plays without uploading and invalid files recover', async ({ page }) => {
  await ready(page);
  await settings(page);
  // An in-memory 3-second PCM tone exercises the real browser audio decoder.
  const rate = 8000, count = rate * 3, wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) wav.writeInt16LE(Math.round(Math.sin(i / rate * Math.PI * 300) * 5000), 44 + i * 2);
  const uploads = [];
  page.on('request', request => { if (request.method() === 'POST') uploads.push(request.url()); });
  await page.locator('#track-file').setInputFiles({ name: 'test.wav', mimeType: 'audio/wav', buffer: wav });
  await expect(page.locator('#source-label')).toHaveText('LOCAL MUSIC');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#source-label')).toHaveText('AMBIENT', { timeout: 10000 });
  await settings(page);
  await page.locator('#track-file').setInputFiles({ name: 'bad.wav', mimeType: 'audio/wav', buffer: Buffer.from('invalid') });
  await expect(page.locator('#source-status')).toContainText('could not be played');
  expect(uploads).toEqual([]);
});
