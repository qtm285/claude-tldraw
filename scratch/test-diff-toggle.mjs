import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox'],
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const page = await browser.newPage();

const logs = [];
page.on('console', msg => {
  const text = msg.text();
  logs.push(text);
  // Print diff-related logs in real-time
  if (text.includes('[Diff') || text.includes('diff') || text.includes('Error') || text.includes('error')) {
    console.log('  [console]', text);
  }
});

page.on('pageerror', err => {
  console.log('  [PAGE ERROR]', err.message);
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

console.log('=== Test 1: Normal doc detects diff availability ===');
await page.goto('http://localhost:5173/?doc=bregman-lower-bound&room=test-diff-toggle-2', { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction(() => window.__tldraw_editor__, { timeout: 15000 });
await new Promise(r => setTimeout(r, 2000));

const diffHintExists = await page.evaluate(() => {
  return document.querySelector('.toc-diff-hint') !== null;
});
check('Diff hint visible in TOC', diffHintExists, true);

const diffTabHidden = await page.evaluate(() => {
  const tabs = document.querySelectorAll('.doc-panel-tab');
  return !Array.from(tabs).some(t => t.textContent.trim() === 'Diff');
});
check('Diff tab hidden before toggle', diffTabHidden, true);

const shapeCountBefore = await page.evaluate(() => {
  return window.__tldraw_editor__.getCurrentPageShapes().length;
});
console.log(`  Shapes before: ${shapeCountBefore}`);

console.log('\n=== Test 2: Toggle diff ON ===');
console.log('  Pressing d to toggle...');

// Press 'd' to toggle diff on, then check results
await page.keyboard.press('d');
const toggleResult = await page.evaluate(async () => {
  try {
    // Wait for async load
    await new Promise(r => setTimeout(r, 10000));
    const shapes = window.__tldraw_editor__.getCurrentPageShapes();
    return {
      shapeCount: shapes.length,
      hasOldPages: shapes.some(s => s.id.includes('old-page')),
      hasHighlights: shapes.some(s => s.id.includes('diff-hl')),
      hasArrows: shapes.some(s => s.id.includes('diff-arrow')),
      hasChangesHeader: document.querySelector('.changes-header') !== null,
    };
  } catch (e) {
    return { error: e.message };
  }
});

console.log('  Toggle result:', JSON.stringify(toggleResult, null, 2));

if (toggleResult.error) {
  console.log(`  FAIL: Toggle errored: ${toggleResult.error}`);
  failed++;
} else {
  check('New shapes were added', toggleResult.shapeCount > shapeCountBefore, true);
  check('Old page shapes exist', toggleResult.hasOldPages, true);
  check('Highlight shapes exist', toggleResult.hasHighlights, true);
  check('Arrow shapes exist', toggleResult.hasArrows, true);
  check('Changes header visible', toggleResult.hasChangesHeader, true);
}

console.log('\n=== Test 3: Toggle OFF with keyboard ===');
await page.keyboard.press('d');
await new Promise(r => setTimeout(r, 1500));

const shapeCountOff = await page.evaluate(() => {
  return window.__tldraw_editor__.getCurrentPageShapes().length;
});
check('Shapes back to original count', shapeCountOff, shapeCountBefore);

console.log('\n=== Test 4: Standalone diff doc ===');
const page2 = await browser.newPage();
page2.on('console', msg => {
  const text = msg.text();
  if (text.includes('Diff') || text.includes('error')) {
    console.log('  [standalone console]', text);
  }
});

await page2.goto('http://localhost:5173/?doc=bregman-lower-bound-diff&room=test-standalone-2', { waitUntil: 'networkidle0', timeout: 30000 });
await page2.waitForFunction(() => window.__tldraw_editor__, { timeout: 15000 });
await new Promise(r => setTimeout(r, 4000));

const standaloneResult = await page2.evaluate(() => {
  const shapes = window.__tldraw_editor__.getCurrentPageShapes();
  const tabs = document.querySelectorAll('.doc-panel-tab');
  return {
    shapeCount: shapes.length,
    hasOldPages: shapes.some(s => s.id.includes('old-page')),
    hasDiffTab: Array.from(tabs).some(t => t.textContent.trim() === 'Diff'),
    hasToggleBtn: document.querySelector('.diff-toggle-btn') !== null,
  };
});
console.log('  Standalone result:', JSON.stringify(standaloneResult, null, 2));
check('Standalone has shapes', standaloneResult.shapeCount > 0, true);
check('Standalone has old pages', standaloneResult.hasOldPages, true);
check('Standalone has Diff tab', standaloneResult.hasDiffTab, true);
check('Standalone has NO toggle', standaloneResult.hasToggleBtn, false);

// Print all diff/error console logs
const diffLogs = logs.filter(l => l.includes('[Diff'));
if (diffLogs.length > 0) {
  console.log('\n=== Diff-related console logs ===');
  for (const l of diffLogs) console.log(`  ${l}`);
}

await browser.close();
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
