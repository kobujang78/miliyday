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
  await expect(page.getByRole('link', { name: '새 창에서 열기' })).toHaveAttribute(
    'href',
    'https://pxguide.zeromorow.chatgpt.site',
  )
  await expect
    .poll(() =>
      page.frames().some((frame) =>
        frame.url().startsWith('https://pxguide.zeromorow.chatgpt.site'),
      ),
    )
    .toBe(true)
})
