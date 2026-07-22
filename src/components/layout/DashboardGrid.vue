<template>
  <section class="dashboard-grid" data-testid="dashboard-main">
    <div class="dashboard-grid__main">
      <slot name="main" />
    </div>
    <aside class="dashboard-grid__aside">
      <slot name="aside" />
    </aside>
  </section>
</template>

<style scoped>
.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(300px, 3fr);
  gap: 1rem;
  align-items: start;
}

.dashboard-grid__main,
.dashboard-grid__aside {
  min-width: 0;
  display: grid;
  gap: 1rem;
}

.dashboard-grid__main > *,
.dashboard-grid__aside > * {
  min-width: 0;
  box-sizing: border-box;
}

@media (max-width: 1023px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
