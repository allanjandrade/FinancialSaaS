import { ref } from 'vue'

const isDark = ref(false)

export function useTheme() {
  const applyTheme = (dark) => {
    isDark.value = dark
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.classList.toggle('light', !dark)
  }

  const toggleTheme = () => {
    applyTheme(!isDark.value)
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  }

  const setTheme = (theme) => {
    if (theme === 'light') {
      applyTheme(false)
      localStorage.setItem('theme', 'light')
      return
    }
    if (theme === 'dark') {
      applyTheme(true)
      localStorage.setItem('theme', 'dark')
      return
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(prefersDark)
    localStorage.setItem('theme', 'auto')
  }

  const initTheme = () => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') {
      applyTheme(true)
      return
    }
    if (saved === 'auto') {
      applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches)
      return
    }
    applyTheme(false)
    if (!saved) localStorage.setItem('theme', 'light')
  }

  return {
    isDark,
    toggleTheme,
    setTheme,
    initTheme,
  }
}
