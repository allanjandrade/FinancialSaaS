async function detectText(bitmap) {
  if (typeof window.TextDetector !== 'function') return []
  const detector = new window.TextDetector()
  const blocks = await detector.detect(bitmap)
  return blocks.map((block) => block.rawValue || '').filter(Boolean)
}

async function detectBarcodes(bitmap) {
  if (typeof window.BarcodeDetector !== 'function') return []
  const detector = new window.BarcodeDetector({
    formats: ['qr_code', 'ean_13', 'ean_8', 'code_128'],
  })
  const barcodes = await detector.detect(bitmap)
  return barcodes.map((barcode) => barcode.rawValue || '').filter(Boolean)
}

export async function extractNativeDocumentText(file) {
  if (!file?.type?.startsWith('image/') || typeof createImageBitmap !== 'function') return ''

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
    const [textBlocks, barcodes] = await Promise.all([
      detectText(bitmap).catch(() => []),
      detectBarcodes(bitmap).catch(() => []),
    ])
    return [...textBlocks, ...barcodes].join('\n').trim()
  } catch {
    return ''
  } finally {
    bitmap?.close?.()
  }
}
