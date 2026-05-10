import { test, expect, Page } from '@playwright/test';

test.describe('gfarena0-web smoke tests', () => {

  async function playFastGameToCompletion(page: Page) {
    await page.goto('/?fast');
    await page.waitForSelector('#hand-cards .card-display', { timeout: 15_000 });
    for (let move = 0; move < 5000; move++) {
      const targetIdx = (move % 3) + 1;
      const cardIdx   = Math.floor(move / 3) % 7;
      const action = await page.evaluate(([tIdx, cIdx]: number[]) => {
        if ((document.getElementById('game-over') as HTMLElement | null)?.style.display === 'flex') return 'over';
        const draw = document.getElementById('draw-btn') as HTMLButtonElement | null;
        if (draw?.style.display === 'block') { draw.click(); return 'draw'; }
        const askSection = document.getElementById('ask-section') as HTMLElement | null;
        const cards = document.querySelectorAll('#hand-cards .card-display');
        const card = cards[cIdx % Math.max(cards.length, 1)] as HTMLElement | null;
        if (askSection?.style.display === 'flex' && card) {
          card.click();
          const t = document.getElementById('target-' + tIdx) as HTMLButtonElement | null;
          if (t && !t.disabled) t.click();
          return 'ask';
        }
        return 'wait';
      }, [targetIdx, cardIdx]);
      if (action === 'over') break;
      if (action === 'wait') {
        await page.waitForFunction(
          () => {
            const a = (document.getElementById('ask-section') as HTMLElement | null)?.style.display === 'flex';
            const d = (document.getElementById('draw-btn') as HTMLElement | null)?.style.display === 'block';
            const o = (document.getElementById('game-over') as HTMLElement | null)?.style.display === 'flex';
            return a || d || o;
          },
          { polling: 100, timeout: 10_000 }
        );
      }
    }
  }

  test('page loads and version is shown', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => {
        const el = document.getElementById('sc-version');
        return el != null && el.textContent != null && el.textContent.includes('v');
      },
      { timeout: 10_000 }
    );
    const version = await page.textContent('#sc-version');
    expect(version).toMatch(/gfarena0 v\d+\.\d+/);
  });

  test('game initialises with bot names visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#bot-0 .bot-name');
        return el != null && el.textContent !== '--';
      },
      { timeout: 10_000 }
    );
    const bot0 = await page.textContent('#bot-0 .bot-name');
    expect(bot0).toBe('Harriet');
  });

  test('human hand shows card-display elements on their turn', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#hand-cards .card-display', { timeout: 15_000 });
    const count = await page.locator('#hand-cards .card-display').count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking card enables target buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#hand-cards .card-display', { timeout: 15_000 });

    await expect(page.locator('#target-1')).toBeDisabled();
    await page.locator('#hand-cards .card-display').first().click();
    await expect(page.locator('#target-1')).toBeEnabled();
  });

  test('submitting ask updates status line', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#hand-cards .card-display', { timeout: 15_000 });

    await page.locator('#hand-cards .card-display').first().click();
    await page.locator('#target-1').click();

    await page.waitForFunction(
      () => {
        const el = document.getElementById('status-msg');
        const txt = (el != null && el.textContent != null) ? el.textContent : '';
        return txt.length > 5 && txt !== 'Game started - your turn!';
      },
      { timeout: 5_000 }
    );
    const status = await page.textContent('#status-msg');
    expect(status!.length).toBeGreaterThan(5);
  });

  test('game reaches GameOver and shows overlay', async ({ page }) => {
    test.setTimeout(60_000);

    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await playFastGameToCompletion(page);

    // Diagnostic snapshot if game didn't finish.
    const snap = await page.evaluate(() => {
      const st = (window as any).state;
      return {
        over:       (document.getElementById('game-over') as HTMLElement | null)?.style.display,
        askSection: (document.getElementById('ask-section') as HTMLElement | null)?.style.display,
        draw:       (document.getElementById('draw-btn') as HTMLElement | null)?.style.display,
        drawPile:   document.getElementById('sc-draw-pile')?.textContent,
        phase:      st?.phase,
        curPlayer:  st?.current_player,
        status:     (document.getElementById('status-msg') as HTMLElement | null)?.textContent,
      };
    });
    console.log('diagnostic snap', snap);

    if (jsErrors.length) console.warn('Browser JS errors during game:', jsErrors);

    await expect(page.locator('#game-over')).toBeVisible();
    const title = await page.textContent('#game-over-title');
    expect(title!.length).toBeGreaterThan(3);
  });

  test('download-btn is disabled on load', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#sc-version', { timeout: 10_000 });
    await expect(page.locator('#download-btn')).toBeDisabled();
  });

  test('download-btn enabled and audit result shown after game over', async ({ page }) => {
    test.setTimeout(60_000);
    await playFastGameToCompletion(page);
    await expect(page.locator('#game-over')).toBeVisible();
    await expect(page.locator('#download-btn')).toBeEnabled();
    const auditText = await page.locator('#audit-result').textContent();
    expect(auditText).toMatch(/[✓⚠]/);
  });

  test('clicking download-btn triggers a yaml file download', async ({ page }) => {
    test.setTimeout(60_000);
    await playFastGameToCompletion(page);
    await expect(page.locator('#game-over')).toBeVisible();
    await expect(page.locator('#download-btn')).toBeEnabled();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^gf-history-\d+\.yaml$/);
  });

});
