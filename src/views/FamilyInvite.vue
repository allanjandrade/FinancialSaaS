<template>
  <PageShell
    eyebrow="Convite familiar"
    title="Entrar em uma família"
    description="Revise o convite antes de aceitar. A entrada não compartilha seus dados privados automaticamente."
    testid="family-invite-page"
  >
    <section class="invite-panel">
      <div v-if="loading" class="empty-state">Carregando convite...</div>
      <template v-else-if="preview.family">
        <p class="panel-kicker">Família</p>
        <h2>{{ preview.family.name }}</h2>
        <p class="muted">Você foi convidado como {{ roleLabel(preview.invite.role) }}.</p>
        <p class="muted">Ao aceitar, você verá apenas lançamentos compartilhados desta família. Seus dados privados continuam fora da visão familiar.</p>
        <div class="actions">
          <button type="button" class="primary-button" :disabled="submitting" @click="accept">Aceitar convite</button>
          <button type="button" class="secondary-button" :disabled="submitting" @click="decline">Recusar</button>
        </div>
      </template>
      <template v-else>
        <h2>Convite indisponível</h2>
        <p class="muted">{{ error || 'Este convite pode ter expirado ou ja ter sido usado.' }}</p>
        <router-link class="secondary-link" to="/family">Ir para Família</router-link>
      </template>
    </section>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageShell from '@/components/layout/PageShell.vue'
import { acceptFamilyInvite, declineFamilyInvite, familyRoleLabel, previewFamilyInvite } from '@/domain/family/familySharing.js'

const route = useRoute()
const router = useRouter()
const token = String(route.params.token || '')
const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const preview = ref({ family: null, invite: null })

function roleLabel(role) {
  return familyRoleLabel(role)
}

async function loadPreview() {
  loading.value = true
  error.value = ''
  try {
    preview.value = await previewFamilyInvite(token)
  } catch (err) {
    error.value = err?.message || 'Não foi possível carregar o convite.'
  } finally {
    loading.value = false
  }
}

async function accept() {
  submitting.value = true
  error.value = ''
  try {
    await acceptFamilyInvite(token)
    router.replace('/family')
  } catch (err) {
    error.value = err?.message || 'Não foi possível aceitar o convite.'
  } finally {
    submitting.value = false
  }
}

async function decline() {
  submitting.value = true
  error.value = ''
  try {
    await declineFamilyInvite(token)
    router.replace('/family')
  } catch (err) {
    error.value = err?.message || 'Não foi possível recusar o convite.'
  } finally {
    submitting.value = false
  }
}

onMounted(loadPreview)
</script>

<style scoped>
.invite-panel {
  display: grid;
  gap: 1rem;
  max-width: 680px;
  padding: 1rem;
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}

.panel-kicker {
  margin: 0;
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--eyebrow-letter-spacing);
}

h2,
p {
  margin: 0;
}

.muted,
.empty-state {
  color: var(--text-secondary);
  line-height: 1.55;
}

.actions {
  display: flex;
  gap: .75rem;
  flex-wrap: wrap;
}

.primary-button,
.secondary-button,
.secondary-link {
  width: fit-content;
  border-radius: 8px;
  padding: .75rem .95rem;
  font-weight: 900;
}

.primary-button {
  border: 0;
  background: var(--accent);
  color: #fff;
}

.secondary-button,
.secondary-link {
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-primary);
  text-decoration: none;
}
</style>
