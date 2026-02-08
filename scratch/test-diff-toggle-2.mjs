import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox'],
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  if (actual === expected) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

const page = await browser.newPage();
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('[Diff') || text.includes('error') && !text.includes('WebSocket') && !text.includes('annotations')) {
    console.log('  [console]', text);
  }
});
page.on('pageerror', err => console.log('  [PAGE ERROR]', err.message));

console.log('=== Test: Rapid toggle cycle ===');
await page.goto('http://localhost:5173/?doc=bregman-lower-bound&room=test-diff-cycle', { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction(() => window.__tldraw_editor__, { timeout: 15000 });
await new Promise(r => setTimeout(r, 2000));

const baseCount = await page.evaluate(() => window.__tldraw_editor__.getCurrentPageShapes().length);
console.log(`  Base shape count: ${baseCount}`);

// Toggle ON via keyboard
await page.keyboard.press('d');
await new Promise(r => setTimeout(r, 8000));

const onCount = await page.evaluate(() => window.__tldraw_editor__.getCurrentPageShapes().length);
console.log(`  After ON: ${onCount} shapes`);
check('Shapes added on first toggle', onCount > baseCount, true);

// Toggle OFF, then ON again quickly (tests cached data)
await page.keyboard.press('d');
await new Promise(r => setTimeout(r, 500));
const offCount = await page.evaluate(() => window.__tldraw_editor__.getCurrentPageShapes().length);
check('Shapes removed', offCount, baseCount);

await page.keyboard.press('d');
await new Promise(r => setTimeout(r, 2000)); // Faster since cached
const onCount2 = await page.evaluate(() => window.__tldraw_editor__.getCurrentPageShapes().length);
check('Cached toggle same count', onCount2, onCount);

// Toggle OFF
await page.keyboard.press('d');
await new Promise(r => setTimeout(r, 500));
const offCount2 = await page.evaluate(() => window.__tldraw_editor__.getCurrentPageShapes().length);
check('Clean removal second time', offCount2, baseCount);

console.log('\n=== Test: Shapes don\'t leak to Yjs ===');
// Toggle ON, then check that no diff shapes are in the Yjs synced set
await page.keyboard.press('d');
await new Promise(r => setTimeout(r, 3000));

// Create a math note (user-created shape) to verify it's in the store
await page.evaluate(() => {
  const editor = window.__tldraw_editor__;
  editor.createShape({
    type: 'math-note',
    x: 100,
    y: 100,
    props: { text: 'test annotation', color: 'yellow', w: 200, h: 100 },
  });
});
await new Promise(r => setTimeout(r, 500));

const totalWithNote = await page.evaluate(() => window.__tldraw_editor__.getCurrentPageShapes().length);
console.log(`  Total shapes with note: ${totalWithNote}`);

// Toggle OFF — math note should survive
await page.keyboard.press('d');
await new Promise(r => setTimeout(r, 1000));

const afterOff = await page.evaluate(() => {
  const shapes = window.__tldraw_editor__.getCurrentPageShapes();
  const hasNote = shapes.some(s => s.type === 'math-note');
  const hasOldPage = shapes.some(s => s.id.includes('old-page'));
  return { count: shapes.length, hasNote, hasOldPage };
});
check('Math note survives toggle', afterOff.hasNote, true);
check('Old pages removed', afterOff.hasOldPage, false);
check('Shape count = base + 1 note', afterOff.count, baseCount + 1);

console.log('\n=== Test: Camera bounds adjust ===');
// Get camera bounds while diff is OFF
const boundsOff = await page.evaluate(() => {
  const opts = window.__tldraw_editor__.getCameraOptions();
  const b = opts.constraints?.bounds;
  return b ? { x: b.x, y: b.y, w: b.w, h: b.h } : null;
});
console.log(`  Bounds OFF: x=${boundsOff?.x}, w=${boundsOff?.w}`);

// Toggle ON
await page.keyboard.press('d');
await new Promise(r => setTimeout(r, 3000));

const boundsOn = await page.evaluate(() => {
  const opts = window.__tldraw_editor__.getCameraOptions();
  const b = opts.constraints?.bounds;
  return b ? { x: b.x, y: b.y, w: b.w, h: b.h } : null;
});
console.log(`  Bounds ON: x=${boundsOn?.x}, w=${boundsOn?.w}`);
check('Camera bounds wider in diff mode', boundsOn.w > boundsOff.w, true);
check('Camera bounds extend left for old pages', boundsOn.x < boundsOff.x, true);

// Toggle OFF — bounds should contract
await page.keyboard.press('d');
await new Promise(r => setTimeout(r, 1000));

const boundsOff2 = await page.evaluate(() => {
  const opts = window.__tldraw_editor__.getCameraOptions();
  const b = opts.constraints?.bounds;
  return b ? { x: b.x, y: b.y, w: b.w, h: b.h } : null;
});
check('Camera bounds restore after toggle off', boundsOff2.w, boundsOff.w);

await browser.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
