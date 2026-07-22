<template>
  <div class="auth-background" aria-hidden="true">
    <span class="glow glow-one"></span>
    <span class="glow glow-two"></span>
    <span class="grid"></span>
  </div>
</template>

<style scoped>
.auth-background {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--auth-background, var(--bg-shell, #f8fafc));
}

.glow {
  display: none;
}

.glow-one {
  width: 360px;
  height: 360px;
  left: -120px;
  bottom: -120px;
  background: transparent;
}

.glow-two {
  width: 260px;
  height: 260px;
  right: -90px;
  top: 18%;
  background: transparent;
}

.grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--auth-grid-line, rgba(15, 23, 42, .04)) 1px, transparent 1px),
    linear-gradient(90deg, var(--auth-grid-line, rgba(15, 23, 42, .04)) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: linear-gradient(to bottom, rgba(0,0,0,.85), transparent);
}
</style>
