import { sendFamilyInvite } from '@/domain/family/familySharing.js'
import { getActiveSession } from '@/lib/supabase-auth.js'

function getClient() {
  const client = window.supabase
  if (!client) throw new Error('Supabase não inicializado')
  return client
}

function mapDbRoleToApp(role, accessRole) {
  if (accessRole === 'administrator' || role === 'admin') return 'administrator'
  if (accessRole === 'viewer' || role === 'viewer') return 'viewer'
  return 'member'
}

function mapAppRoleToDb(role) {
  if (role === 'administrator') return { role: 'admin', access_role: 'administrator' }
  if (role === 'viewer') return { role: 'viewer', access_role: 'viewer' }
  return { role: 'member', access_role: 'member' }
}

export async function getSessionUser() {
  const supabase = getClient()
  const { user, error } = await getActiveSession(supabase)
  if (error) throw error
  return user
}

export async function fetchMyMembership() {
  const supabase = getClient()
  const user = await getSessionUser()
  if (!user) return null

  const { data: member, error: memberError } = await supabase
    .from('family_members')
    .select('id, family_id, user_id, role, access_role, display_name, email, joined_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) throw memberError
  if (!member) return { user, member: null, family: null }

  const { data: family, error: familyError } = await supabase
    .from('families')
    .select('id, name, invite_code, created_at')
    .eq('id', member.family_id)
    .single()

  if (familyError) throw familyError

  return { user, member, family }
}

export async function fetchFamilyMembers(familyId) {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('family_members')
    .select('id, family_id, user_id, role, access_role, display_name, email, joined_at')
    .eq('family_id', familyId)
    .order('joined_at', { ascending: true })

  if (error) throw error
  return (data || []).map((row) => ({
    id: row.id,
    supabaseId: row.id,
    userId: row.user_id,
    name: row.display_name || row.email?.split('@')[0] || 'Membro',
    email: row.email || '',
    role: mapDbRoleToApp(row.role, row.access_role),
    joinedAt: row.joined_at,
  }))
}

export async function createFamilyOnRemote(name) {
  const supabase = getClient()
  const user = await getSessionUser()
  if (!user) throw new Error('Faça login para criar uma família')

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Administrador'

  const { data: rpcFamily, error: rpcError } = await supabase.rpc('create_family_with_admin', {
    p_name: name.trim(),
    p_display_name: displayName,
  })

  if (!rpcError && rpcFamily?.id) {
    await supabase.auth.updateUser({ data: { family_id: rpcFamily.id } })
    return rpcFamily
  }

  const missingRpc = rpcError?.code === 'PGRST202' || rpcError?.code === '42883'
  if (rpcError && !missingRpc) throw rpcError

  // Transitional fallback for projects where the hardening migration is not deployed yet.
  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert({ name: name.trim() })
    .select('id, name, invite_code, created_at')
    .single()

  if (familyError) throw familyError

  const { error: memberError } = await supabase.from('family_members').insert({
    family_id: family.id,
    user_id: user.id,
    role: 'admin',
    access_role: 'administrator',
    display_name: displayName,
    email: user.email,
  })

  if (memberError) throw memberError

  await supabase.auth.updateUser({ data: { family_id: family.id } })

  return family
}

export async function createInviteOnRemote({ familyId, email, method = 'link' }) {
  const result = await sendFamilyInvite({
    familyGroupId: familyId,
    email,
    role: 'member',
    message: method === 'email' ? 'Convite familiar' : '',
  })
  return {
    ...(result.invite || {}),
    token: result.token,
    invite_url: result.invite_url,
    method,
  }
}

export async function fetchFamilyInvites(familyId) {
  const supabase = getClient()
  const { data, error } = await supabase.rpc('list_family_invites', {
    p_family_id: familyId,
  })

  if (error) {
    if (error.code === '42501' || error.message?.toLowerCase().includes('permission denied')) {
      return []
    }
    throw error
  }
  return data || []
}

export async function acceptInviteToken(token, displayName) {
  const supabase = getClient()
  const { data, error } = await supabase.rpc('accept_family_invite', {
    p_token: token,
    p_display_name: displayName || null,
  })
  if (error) throw error
  return data
}

export async function joinFamilyByCode(code, displayName) {
  const supabase = getClient()
  const { data, error } = await supabase.rpc('join_family_by_invite_code', {
    p_code: code,
    p_display_name: displayName || null,
  })
  if (error) throw error
  return data
}

export async function pullFinanceState(familyId) {
  const supabase = getClient()
  const user = await getSessionUser()
  if (!user) throw new Error('Faça login para sincronizar dados financeiros')

  const { data, error } = await supabase
    .from('finance_states')
    .select('family_id, user_id, data, updated_at')
    .eq('family_id', familyId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function pushFinanceState(familyId, stateData) {
  const supabase = getClient()
  const user = await getSessionUser()
  if (!user) throw new Error('Faça login para sincronizar dados financeiros')

  const { data, error } = await supabase
    .from('finance_states')
    .upsert(
      {
        family_id: familyId,
        user_id: user.id,
        data: stateData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('updated_at')
    .single()

  if (error) throw error
  return data
}

export async function updateMemberRole(memberRowId, appRole) {
  const supabase = getClient()
  const mapped = mapAppRoleToDb(appRole)
  const { error } = await supabase
    .from('family_members')
    .update({ role: mapped.role, access_role: mapped.access_role })
    .eq('id', memberRowId)

  if (error) throw error
}

export async function removeMemberRemote(memberRowId) {
  const supabase = getClient()
  const { error } = await supabase.from('family_members').delete().eq('id', memberRowId)
  if (error) throw error
}

export function buildInviteUrl(token) {
  const configured = import.meta.env.VITE_APP_URL?.replace(/\/$/, '')
  const base =
    configured ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/family/invite/${token}`
}

export function mapRemoteMembersToLocal(members, currentUserId) {
  return members.map((m) => ({
    id: m.userId === currentUserId ? m.id : m.id,
    supabaseMemberId: m.id,
    userId: m.userId,
    name: m.name,
    email: m.email,
    role: m.role,
  }))
}
