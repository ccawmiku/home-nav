<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { X } from '@lucide/vue'
defineProps<{ title: string; busy?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const box = ref<HTMLElement>(); const previous = document.activeElement as HTMLElement | null
function keys(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close') }
  if (event.key !== 'Tab' || !box.value) return
  const nodes = [...box.value.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select,a[href],[tabindex="0"]')].filter(node => node.offsetParent !== null)
  const first = nodes[0]; const last = nodes.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
onMounted(async () => { document.body.style.overflow = 'hidden'; document.addEventListener('keydown', keys); await nextTick(); box.value?.querySelector<HTMLElement>('input,button')?.focus() })
onUnmounted(() => { document.body.style.overflow = ''; document.removeEventListener('keydown', keys); previous?.focus() })
</script>
<template><Teleport to="body"><div class="dialog-backdrop" @click.self="!busy && emit('close')"><section ref="box" class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header class="dialog-header"><h2 id="dialog-title">{{ title }}</h2><button class="icon-button" type="button" aria-label="关闭" :disabled="busy" @click="emit('close')"><X :size="21" /></button></header><slot /></section></div></Teleport></template>
