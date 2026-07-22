import { getSupabaseClient } from '@/lib/supabase-client.js'
import {
  deleteLocalDocumentBlob,
  getLocalDocumentBlob,
  saveLocalDocumentBlob,
} from '@/lib/document-blob-store.js'

const BUCKET = 'income-documents'

function sanitizeFileName(name) {
  return String(name || 'documento')
    .replace(/[^\w.\-()áàâãéêíóôõúçÁÀ·áÉÊÍÓÔÕÚÇ\s]/gi, '_')
    .slice(0, 120)
}

export function buildStoragePath(userId, documentId, fileName) {
  return `${userId}/${documentId}/${sanitizeFileName(fileName)}`
}

export async function uploadIncomeDocumentFile(file, documentId) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    await saveLocalDocumentBlob(documentId, file)
    return { storage: 'local', storagePath: null }
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const user = authData?.user
  if (!user) {
    await saveLocalDocumentBlob(documentId, file)
    return { storage: 'local', storagePath: null }
  }

  const storagePath = buildStoragePath(user.id, documentId, file.name)
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  })

  if (error) {
    if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
      await saveLocalDocumentBlob(documentId, file)
      return { storage: 'local', storagePath: null, bucketMissing: true }
    }
    throw error
  }

  return { storage: 'cloud', storagePath }
}

export async function downloadIncomeDocumentFile(meta) {
  if (meta.storage === 'cloud' && meta.storagePath) {
    const supabase = getSupabaseClient()
    if (!supabase) throw new Error('Supabase não inicializado')
    const { data, error } = await supabase.storage.from(BUCKET).download(meta.storagePath)
    if (error) throw error
    return data
  }
  const blob = await getLocalDocumentBlob(meta.id)
  if (!blob) throw new Error('Arquivo não encontrado neste dispositivo')
  return blob
}

export async function removeIncomeDocumentFile(meta) {
  if (meta.storage === 'cloud' && meta.storagePath) {
    const supabase = getSupabaseClient()
    if (supabase) {
      await supabase.storage.from(BUCKET).remove([meta.storagePath])
    }
  }
  await deleteLocalDocumentBlob(meta.id).catch(() => {})
}

export async function createObjectUrlForDocument(meta) {
  const blob = await downloadIncomeDocumentFile(meta)
  return URL.createObjectURL(blob)
}
