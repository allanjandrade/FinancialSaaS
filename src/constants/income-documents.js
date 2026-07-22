export const INCOME_DOCUMENT_TYPES = {
  HOLERITE: 'holerite',
  INFORME_RENDIMENTOS: 'informe_rendimentos',
  COMPROVANTE: 'comprovante_entrada',
  OUTRO: 'outro',
}

export const INCOME_DOCUMENT_LABELS = {
  holerite: 'Holerite / contracheque',
  informe_rendimentos: 'Informe de rendimentos',
  comprovante_entrada: 'Comprovante de entrada (PIX, TED, etc.)',
  outro: 'Outro documento',
}

export const ACCEPTED_INCOME_DOCUMENT_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]

export const MAX_INCOME_DOCUMENT_BYTES = 12 * 1024 * 1024
