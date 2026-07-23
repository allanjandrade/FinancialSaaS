<template>
  <section class="onboarding-step">
    <p class="step-kicker">Etapa {{ index }} de {{ total }}</p>
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
    <slot />
  </section>
</template>

<script setup>
defineProps({
  index: { type: Number, required: true },
  total: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
})
</script>

<style scoped>
.onboarding-step {
  display: grid;
  gap: 1rem;
}
.step-kicker {
  margin: 0;
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}
h1 {
  margin: 0;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
  letter-spacing: 0;
}
p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}
</style>
