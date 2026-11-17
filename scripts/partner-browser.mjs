// Run with the Vite server running. This is a real-browser acceptance test;
// it checks the missing-key path, and does not fabricate an AI response.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TEST_URL||'http://localhost:5173')+'/#/circuit');
 await page.locator('#ci-v').waitFor();
 await page.locator('#ci-v').fill('12');await page.locator('#ci-r').fill('4');
 assert.equal(await page.locator('#ci-i2').textContent(),'3.00 A');
 await page.locator('.partner-fab').click();await page.locator('#partner-question').fill('Why is the current 3 amperes?');
 const req=page.waitForRequest(r=>r.url().endsWith('/api/lab-partner'));
 await page.locator('.partner-chat [type=submit]').click();
 assert.equal((await req).postDataJSON().context.state.current,3);
 await page.locator('.partner-chat [data-close]').click();
 await page.locator('.partner-settings-trigger').click();await page.locator('[name=textSize]').selectOption('large');await page.locator('[name=colorMode]').selectOption('deuteranopia');
 await page.locator('.partner-settings button[value=close]').click();await page.reload();await page.locator('#ci-v').waitFor();
 assert.equal(await page.locator('html').getAttribute('data-text-size'),'large');
 assert.equal(await page.locator('html').getAttribute('data-color-mode'),'deuteranopia');
 await page.locator('#ci-v').focus();const before=await page.locator('#ci-v').inputValue();await page.keyboard.press('ArrowLeft');assert.notEqual(await page.locator('#ci-v').inputValue(),before);
 await page.setViewportSize({width:390,height:844});await page.locator('.partner-fab').click();
 const box=await page.locator('.partner-chat').boundingBox();assert.ok(box.width<=390&&box.x>=0);
 await page.locator('.partner-chat [data-close]').click();
 await page.evaluate(()=>globalThis.location.hash='#/pendulum');await page.locator('#pd-L').waitFor();assert.equal(await page.locator('.partner-fab').count(),1);
 assert.deepEqual(errors,[]);console.log('Browser acceptance passed: live values, request snapshot, persistence, keyboard, mobile dialog and navigation.');
} finally {await browser.close();}
