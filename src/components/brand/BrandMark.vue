<template>
  <span class="brand-mark" aria-label="Controle Financeiro">
    <span class="shield">
      <span class="line"></span>
    </span>
  </span>
</template>

<style scoped>
.brand-mark {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--gradient-accent);
  box-shadow: 0 12px 28px -18px var(--accent);
}

.shield {
  position: relative;
  width: 24px;
  height: 28px;
  border: 2px solid rgba(255,255,255,.95);
  border-radius: 10px 10px 12px 12px;
}

.shield::after {
  content: "";
  position: absolute;
  left: 7px;
  bottom: -5px;
  width: 10px;
  height: 10px;
  background: rgba(255,255,255,.95);
  transform: rotate(45deg);
  border-radius: 2px;
}

.line {
  position: absolute;
  left: 5px;
  top: 13px;
  width: 15px;
  height: 8px;
  border-left: 2px solid white;
  border-bottom: 2px solid white;
  transform: skewY(-24deg) rotate(-8deg);
}
</style>
