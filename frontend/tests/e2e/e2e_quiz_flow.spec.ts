import { test, expect } from '@playwright/test';

test.describe('Quiz Flow', () => {
  test('should open quiz drawer, load question, and allow answering', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Ensure documents are loaded (mocked or pre-loaded in DB for E2E)
    // Wait for the Quiz button to appear
    const quizBtn = page.locator('.quiz-action-btn');
    await quizBtn.waitFor({ state: 'visible' });

    // Click Quiz button
    await quizBtn.click();

    // Verify drawer is open
    const drawer = page.locator('.quiz-drawer.open');
    await expect(drawer).toBeVisible();

    // Verify loading skeleton or actual question
    const questionCard = page.locator('.quiz-question-card');
    await expect(questionCard).toBeVisible({ timeout: 15000 }); // Wait for LLM

    // Click an option
    const firstOption = page.locator('.quiz-option').first();
    await firstOption.click();

    // Click Submit
    const submitBtn = page.locator('.quiz-submit-btn');
    await submitBtn.click();

    // Verify feedback is shown
    const feedback = page.locator('.quiz-feedback');
    await expect(feedback).toBeVisible();

    // Verify citations are shown
    const citation = page.locator('.quiz-citation').first();
    if (await citation.count() > 0) {
      await citation.click();
      // Verify PDF Viewer opens (mocked)
      const pdfViewer = page.locator('.pdf-viewer-container');
      await expect(pdfViewer).toBeVisible();
    }
  });
});
