<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { common, loadIcons } from './icons'
const props = withDefaults(defineProps<{ name?: string; size?: number; color?: string }>(), { name: 'Globe', size: 32 })
const icon = shallowRef(common.Globe)
watch(() => props.name, async name => { icon.value = common[name] || common.Globe; if (!common[name]) { const all = await loadIcons(); if (props.name === name) icon.value = all[name] || common.Globe } }, { immediate: true })
</script>
<template><component :is="icon" :size="size" :color="color" :stroke-width="1.8" aria-hidden="true" /></template>
