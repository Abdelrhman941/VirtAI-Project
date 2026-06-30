import { test, expect } from '@playwright/test';

test.describe('Diagram Flow', () => {
  test('should open document picker, select document, and render diagram', async ({ page }) => {
    await page.goto('/');

    const diagramBtn = page.locator('.diagram-action-btn');
    await diagramBtn.waitFor({ state: 'visible' });

    // Click Diagram button
    await diagramBtn.click();

    // Document Picker should open
    const documentPicker = page.locator('.document-picker-overlay');
    await expect(documentPicker).toBeVisible();

    // Select the first document
    const docOption = page.locator('.document-option').first();
    await docOption.click();

    // Click Generate
    const generateBtn = page.locator('.generate-diagram-btn');
    await generateBtn.click();

    // Verify loading state
    const loader = page.locator('.diagram-loader');
    await expect(loader).toBeVisible();

    // Verify Mermaid diagram renders successfully
    const mermaidContainer = page.locator('.mermaid-render-container svg');
    await expect(mermaidContainer).toBeVisible({ timeout: 20000 }); // LLM generation can take time

    // Verify Export buttons
    const exportBtn = page.locator('.diagram-export-btn').first();
    await expect(exportBtn).toBeVisible();
  });
});
