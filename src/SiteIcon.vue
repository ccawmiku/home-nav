<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SiteIcon } from '../shared/dashboard'
import IconGlyph from './IconGlyph.vue'
const props = defineProps<{ icon: SiteIcon }>()
const failed = ref(false)
watch(() => props.icon.value, () => failed.value = false)
</script>
<template>
  <span class="site-icon" :class="{ 'logo-icon': icon.type === 'auto' && icon.value && !failed }" :style="{ color: icon.color || '#007aff' }">
    <img v-if="icon.type === 'auto' && icon.value && !failed" :src="icon.value" alt="" referrerpolicy="no-referrer" draggable="false" @error="failed = true" />
    <IconGlyph v-else :name="icon.type === 'lucide' ? icon.value : 'Globe'" :size="36" />
  </span>
</template>
