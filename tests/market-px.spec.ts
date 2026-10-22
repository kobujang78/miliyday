import { expect, test } from '@playwright/test'

test('슬병PX 메뉴에서 PX 가이드를 가운데 화면에 표시한다', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('mili_guest', 'true')
    window.localStorage.setItem(
      'mili_profile',
      JSON.stringify({
        name: '테스터',
        branch: 'army',
        rank: 1,
        enlistDate: '2026-01-01',
      }),
    )
  })

  page.on('dialog', (dialog) => dialog.dismiss())

  await page.goto('http://127.0.0.1:3000/')
  await page.getByRole('link', { name: /슬병PX/ }).click()

  await expect(page).toHaveURL(/\/market$/)
  await expect(page.getByTitle('슬병 PX 가이드')).toHaveAttribute(
    'src',
    'https://pxguide.zeromorow.chatgpt.site',
  )
  await expect(page.getByRole('link', { name: '새 창에서 열기' })).toHaveCount(0)
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    const frame = await page.getByTitle('슬병 PX 가이드').boundingBox()
    const header = await page.locator('header').boundingBox()
    const nav = await page.getByRole('navigation', { name: '메인 내비게이션' }).boundingBox()
    expect(frame!.x).toBe(0)
    expect(frame!.width).toBe(viewport.width)
    expect(frame!.y).toBeCloseTo(header!.y + header!.height, 0)
    expect(frame!.y + frame!.height).toBeCloseTo(nav!.y, 0)
  }
  await expect
    .poll(() =>
      page.frames().some((frame) =>
        frame.url().startsWith('https://pxguide.zeromorow.chatgpt.site'),
      ),
    )
    .toBe(true)
})
