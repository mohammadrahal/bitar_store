function cell(value: string | number) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Builds a CSV in the browser and hands it to the user as a download. */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const body = [header, ...rows].map((row) => row.map(cell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
