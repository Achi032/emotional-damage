// ===== DOM Utilities =====

/**
 * Wait until an element has non-zero dimensions, then call cb.
 * Uses ResizeObserver — reliable, no setTimeout race conditions.
 * Returns the ResizeObserver so callers can disconnect it in destroy().
 */
export function waitForSize(el, cb) {
  if (el.offsetWidth > 0 && el.offsetHeight > 0) {
    cb()
    return null
  }
  const ro = new ResizeObserver(entries => {
    for (const entry of entries) {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        ro.disconnect()
        cb()
        return
      }
    }
  })
  ro.observe(el)
  return ro
}
