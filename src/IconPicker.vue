<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import type { Component } from 'vue'
import { Search, ChevronLeft, ChevronRight } from '@lucide/vue'
import { loadIcons } from './icons'
defineProps<{ selected: string }>()
const emit = defineEmits<{ select: [name: string] }>()
const catalog = shallowRef<Record<string, Component>>({})
const search = ref(''); const page = ref(0)
const aliases: Record<string, string> = { '服务器': 'server', '路由': 'router network', '网络': 'network globe wifi', '文件': 'folder file', '视频': 'tv video film', '音乐': 'music headphones', '图片': 'image camera', '下载': 'download', '工具': 'wrench settings', '设置': 'settings', '聊天': 'message bot', '安全': 'shield lock', '监控': 'activity chart', '游戏': 'gamepad', '书': 'book', '主页': 'house' }
const names = computed(() => {
  const value = search.value.trim().toLowerCase(); const words = (aliases[value] || value).split(/\s+/)
  return Object.keys(catalog.value).filter(name => !value || words.some(word => name.toLowerCase().includes(word)))
})
const pages = computed(() => Math.max(1, Math.ceil(names.value.length / 96)))
const visible = computed(() => names.value.slice(page.value * 96, (page.value + 1) * 96))
onMounted(async () => { catalog.value = await loadIcons() })
</script>
<template>
  <div class="icon-picker">
    <label class="icon-search"><Search :size="17" /><input v-model="search" placeholder="搜索 Lucide 图标" aria-label="搜索 Lucide 图标" @input="page = 0" /></label>
    <div class="icon-results">
      <button v-for="name in visible" :key="name" type="button" class="icon-choice" :class="{ selected: selected === name }" :title="name" :aria-label="name" :aria-pressed="selected === name" @click="emit('select', name)"><component :is="catalog[name]" :size="23" :stroke-width="1.7" /></button>
      <span v-if="!visible.length" class="picker-empty">{{ Object.keys(catalog).length ? '未找到图标' : '加载中…' }}</span>
    </div>
    <div class="icon-pagination"><button type="button" aria-label="上一页" :disabled="page === 0" @click="page--"><ChevronLeft :size="18" /></button><span>{{ page + 1 }} / {{ pages }} · {{ names.length }}</span><button type="button" aria-label="下一页" :disabled="page + 1 >= pages" @click="page++"><ChevronRight :size="18" /></button></div>
  </div>
</template>
