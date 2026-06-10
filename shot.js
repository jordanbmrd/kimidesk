const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  await p.goto('file://' + path.resolve('docs/index.html').replace(/\\/g, '/'));
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'docs/_preview.png', fullPage: true });
  await b.close();
  console.log('OK');
})();
