function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Opens the system print dialog with a one-off HTML document.
 * Uses a hidden iframe so Electron / strict popup rules do not leave an empty `about:blank` tab.
 */
export function printHtmlDocument(title: string, bodyHtml: string) {
  const safeTitle = escapeHtml(title)
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="color-scheme" content="light"/><title>${safeTitle}</title></head><body>${bodyHtml}</body></html>`

  const iframe = document.createElement('iframe')
  iframe.setAttribute(
    'style',
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;pointer-events:none',
  )
  iframe.setAttribute('title', 'Print preview')
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  const doc = iframe.contentDocument ?? win?.document
  if (!win || !doc) {
    iframe.remove()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 500)
  }

  const runPrint = () => {
    try {
      win.focus()
      win.print()
    } finally {
      if ('onafterprint' in win) {
        win.onafterprint = cleanup
      } else {
        cleanup()
      }
    }
  }

  // `load` on a document.write() popup is unreliable; a short delay after close is enough.
  window.setTimeout(runPrint, 300)
}
