// Run with Playwright available on NODE_PATH and a local backend serving the built panel.
// MANAGEMENT_URL, MANAGEMENT_KEY, and CHROME_PATH can override the preview fixture defaults.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(process.env.MANAGEMENT_URL || 'http://127.0.0.1:18317/management.html');
    await page.locator('input[type=password]').fill(process.env.MANAGEMENT_KEY || 'preview-only');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.getByRole('button', { name: '登录', exact: true }).waitFor({ state: 'hidden' });
    await page.getByRole('link', { name: '日志查看', exact: true }).click();
    await page.getByRole('button', { name: '日志内容', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.page-transition--animating'));
    const layer = await page
      .locator('.page-transition__layer[aria-hidden="false"]')
      .elementHandle();
    const check = async (name, query) => {
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForURL((u) => u.hash.endsWith(query));
      const button = page.getByRole('button', { name, exact: true });
      await page.waitForFunction(
        (n) =>
          [...document.querySelectorAll('button')].some(
            (b) => b.textContent.trim() === n && b.getAttribute('aria-pressed') === 'true'
          ),
        name,
        { timeout: 3000 }
      );
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(
        await layer.evaluate((el) => el.isConnected),
        true,
        'tab navigation must preserve the mounted page'
      );
    };
    await check('Claude 保活', 'tab=keepalive');
    await page.getByRole('table', { name: '事件日志', exact: true }).waitFor();
    await check('错误请求日志', 'tab=errors');
    await check('日志内容', 'tab=logs');
    await page.goBack();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('button')].some(
        (b) => b.textContent.trim() === '错误请求日志' && b.getAttribute('aria-pressed') === 'true'
      )
    );
    await page.goForward();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('button')].some(
        (b) => b.textContent.trim() === '日志内容' && b.getAttribute('aria-pressed') === 'true'
      )
    );
    await page.goto(
      `${(process.env.MANAGEMENT_URL || 'http://127.0.0.1:18317/management.html').split('#')[0]}#/logs?tab=keepalive`
    );
    await page.getByRole('table', { name: '事件日志', exact: true }).waitFor();
    await page.locator('a[href="#/config?field=claudeCacheKeepalive"]').click();
    await page.waitForURL((u) => u.hash === '#/config?field=claudeCacheKeepalive');
    await page.waitForFunction(() => !document.querySelector('.page-transition--animating'));
    await page.goBack();
    await page.getByRole('table', { name: '事件日志', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.page-transition--animating'));
    await page.setViewportSize({ width: 390, height: 844 });
    for (const name of ['错误请求日志', '日志内容', 'Claude 保活']) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForFunction(
        (n) =>
          [...document.querySelectorAll('button')].some(
            (b) => b.textContent.trim() === n && b.getAttribute('aria-pressed') === 'true'
          ),
        name
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS: desktop/mobile tabs, keepalive table, back/forward, deep link, page preservation, no page errors'
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
