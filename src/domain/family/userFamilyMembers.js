export const FAMILY_RELATIONSHIPS = Object.freeze([
  'Cônjuge',
  'Filho(a)',
  'Pai/Mãe',
  'Outro familiar',
  'Outro',
])

export function normalizeFamilyMember(input = {}, userId = '') {
  const name = String(input.name || '').trim()
  const relationship = String(input.relationship || '').trim()
  if (!userId) throw new Error('Entre novamente para gerenciar sua família.')
  if (!name) throw new Error('Informe o nome do membro.')
  if (!FAMILY_RELATIONSHIPS.includes(relationship)) throw new Error('Informe uma relação válida.')

  return {
    user_id: userId,
    name,
    relationship,
    include_in_analysis: input.include_in_analysis !== false,
    notes: String(input.notes || '').trim() || null,
  }
}

export async function listUserFamilyMembers(supabase, user) {
  if (!supabase || !user?.id) return []
  const { data, error } = await supabase
    .from('user_family_members')
    .select('id,user_id,name,relationship,include_in_analysis,notes,created_at,updated_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createUserFamilyMember(supabase, user, input) {
  const payload = normalizeFamilyMember(input, user?.id)
  const { data, error } = await supabase
    .from('user_family_members')
    .insert(payload)
    .select('id,user_id,name,relationship,include_in_analysis,notes,created_at,updated_at')
    .single()
  if (error) throw error
  return data
}

export async function updateUserFamilyMember(supabase, user, id, input) {
  const payload = normalizeFamilyMember(input, user?.id)
  const { data, error } = await supabase
    .from('user_family_members')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id,user_id,name,relationship,include_in_analysis,notes,created_at,updated_at')
    .single()
  if (error) throw error
  return data
}

export async function deleteUserFamilyMember(supabase, user, id) {
  if (!supabase || !user?.id || !id) throw new Error('Membro inválido.')
  const { error } = await supabase
    .from('user_family_members')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error
}
