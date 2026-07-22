export const FAMILY_ROLES = {
  ADMINISTRATOR: 'administrator',
  MEMBER: 'member',
  VIEWER: 'viewer',
}

export const ROLE_LABELS = {
  administrator: 'Administrador',
  member: 'Membro',
  viewer: 'Visualizador',
}

export const INVITE_STATUS = ['Pendente', 'Aceito', 'Recusado']

export const SPLIT_MODES = {
  PERCENT: 'percent',
  FIXED: 'fixed',
  SHARES: 'shares',
}

export const SPLIT_MODE_LABELS = {
  percent: 'Por percentual',
  fixed: 'Por valor fixo',
  shares: 'Por cotas',
}

export const DEBT_TYPES = ['Financiamento', 'Empréstimo', 'Cartão', 'Parcelamento', 'Outro']

export const SETTLEMENT_METHODS = ['Pix', 'Transferência', 'Dinheiro']

export const AUDIT_ACTIONS = {
  CREATED: 'created',
  UPDATED: 'updated',
  PAID: 'paid',
  RECEIVED: 'received',
  SETTLED: 'settled',
  INVITED: 'invited',
  DELETED: 'deleted',
}
