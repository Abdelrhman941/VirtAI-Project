import { test, expect } from '@playwright/test';

test.describe('Explain Presentation Flow', () => {
  test('should run through presentation, handle interruption, and resume', async ({ page }) => {
    await page.goto('/');

    const explainBtn = page.locator('.explain-action-btn');
    await explainBtn.waitFor({ state: 'visible' });

    // Click Explain
    await explainBtn.click();

    // Verify ExplainSession mounts
    const explainPanel = page.locator('.explain-panel-active');
    await expect(explainPanel).toBeVisible();

    // Verify Slide 1
    const progress = page.locator('.explain-progress');
    await expect(progress).toContainText('Slide 1');

    // Wait for AWAITING state
    const questionInput = page.locator('.slide-question-input');
    await expect(questionInput).toBeVisible({ timeout: 15000 });

    // Click continue
    const continueBtn = page.locator('.slide-continue-btn');
    await continueBtn.click();

    // Verify Slide 2
    await expect(progress).toContainText('Slide 2');

    // Interrupt with Pause
    const pauseBtn = page.locator('.explain-pause-btn');
    await pauseBtn.click();

    // Verify AWAITING state
    await expect(questionInput).toBeVisible();

    // Ask a question
    await questionInput.fill('What does this mean?');
    const submitBtn = page.locator('.slide-question-submit');
    await submitBtn.click();

    // Verify ANSWERING state text shows up in content
    const markdownBody = page.locator('.markdown-body');
    await expect(markdownBody).toContainText('**You:** What does this mean?');

    // Wait for AWAITING state again
    await expect(questionInput).toBeVisible({ timeout: 15000 });

    // Click Stop
    const stopBtn = page.locator('.explain-stop-btn');
    await stopBtn.click();

    // Verify ExplainSession unmounts
    await expect(explainPanel).toBeHidden();
  });
});
