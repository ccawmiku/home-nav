<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
type Turnstile = { render: (el: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void; reset: (id: string) => void }
declare global { interface Window { turnstile?: Turnstile } }
const props = defineProps<{ sitekey: string }>()
const emit = defineEmits<{ token: [value: string]; error: [] }>()
const container = ref<HTMLElement>(); let id: string | undefined; let disposed = false
function render() {
  if (disposed || !container.value || !window.turnstile || id) return
  id = window.turnstile.render(container.value, { sitekey: props.sitekey, theme: 'light', action: 'login', size: 'flexible', callback: (value: string) => emit('token', value), 'expired-callback': () => emit('token', ''), 'error-callback': () => { emit('token', ''); emit('error') } })
}
function reset() { emit('token', ''); if (id) window.turnstile?.reset(id) }
defineExpose({ reset })
onMounted(() => {
  if (window.turnstile) return render()
  let script = document.querySelector<HTMLScriptElement>('script[data-turnstile]')
  if (!script) { script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.dataset.turnstile = 'true'; script.async = true; document.head.appendChild(script) }
  script.addEventListener('load', render, { once: true }); script.addEventListener('error', () => emit('error'), { once: true })
})
onUnmounted(() => { disposed = true; if (id) window.turnstile?.remove(id) })
</script>
<template><div ref="container" class="turnstile-container" /></template>
