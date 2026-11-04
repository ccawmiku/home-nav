<script setup lang="ts">
import { computed } from 'vue'
import { Cloud, ChevronRight, RefreshCw, Minus, Zap, Boxes, Database, Workflow } from '@lucide/vue'
import { productPeak, quotaNumber, quotaPercent } from '../shared/account-usage'
import type { AccountUsage, QuotaProduct } from '../shared/account-usage'

const props = defineProps<{ usage: AccountUsage | null; busy: boolean; error: string; editing: boolean }>()
defineEmits<{ refresh: []; open: []; hide: [] }>()
const products = [
  { name: 'Workers' as QuotaProduct, icon: Zap, color: '#ed8b24' },
  { name: 'Durable Objects' as QuotaProduct, icon: Boxes, color: '#5c79df' },
  { name: 'D1' as QuotaProduct, icon: Database, color: '#a65ed3' },
  { name: 'Workflows' as QuotaProduct, icon: Workflow, color: '#359f8a' },
]
const rows = computed(() => products.map(product => {
  const metric = productPeak(props.usage, product.name)
  const percent = metric ? quotaPercent(metric) : null
  return { ...product, metric, percent, fill: Math.min(100, Math.max(0, percent ?? 0)) }
}))
const status = computed(() => props.error || props.usage?.status === 'error' ? '暂时无法更新'
  : props.usage?.status === 'stale' ? '上次更新的数据'
    : props.usage?.status === 'unconfigured' ? '统计暂未配置'
      : props.usage?.status === 'partial' ? '部分统计暂不可用' : '全账号 · 今日用量')
</script>

<template>
  <section class="quota-tile" :class="{ 'quota-editing': editing }" aria-label="Cloudflare 额度" :aria-busy="busy">
    <button v-if="editing" class="remove-section" aria-label="移除 Cloudflare 额度拼贴" :disabled="busy" @click="$emit('hide')"><Minus :size="18" /></button>
    <header class="quota-header">
      <span class="quota-app-icon"><Cloud :size="27" :stroke-width="1.65" /></span>
      <div class="quota-heading"><h2>Cloudflare</h2><p>{{ status }}</p></div>
      <button class="icon-button quota-refresh" aria-label="刷新额度" title="刷新额度" :disabled="busy || editing" @click="$emit('refresh')"><RefreshCw :size="17" :class="{ spin: busy }" /></button>
    </header>
    <div v-if="!usage && busy" class="quota-skeleton" aria-label="正在读取额度"><div v-for="n in 4" :key="n"><span /><i /></div></div>
    <div v-else class="quota-rows" :class="{ 'quota-content-muted': editing }">
      <button v-for="row in rows" :key="row.name" class="quota-product" :style="{ '--quota-accent': row.percent !== null && row.percent >= 90 ? '#df5a45' : row.color }" :disabled="editing" @click="$emit('open')">
        <div class="quota-product-line"><span class="quota-product-name"><component :is="row.icon" :size="15" :stroke-width="1.8" />{{ row.name }}</span><strong :class="{ 'quota-warning': row.percent !== null && row.percent >= 90 }">{{ row.percent === null ? '—' : row.percent.toFixed(1) + '%' }}</strong></div>
        <div class="quota-product-detail"><span>{{ row.metric?.name || '日用量' }}</span><span>{{ row.metric ? quotaNumber(row.metric.value, row.metric.unit) + ' / ' + quotaNumber(row.metric.limit, row.metric.unit) : '暂无数据' }}</span></div>
        <div class="quota-track" role="progressbar" :aria-label="row.name + ' 今日最高用量'" :aria-valuenow="row.percent === null ? undefined : row.fill" :aria-valuetext="row.percent === null ? '暂无数据' : row.percent.toFixed(1) + '%'" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: row.fill + '%' }" /></div>
      </button>
    </div>
    <footer class="quota-footer"><span>{{ usage?.status === 'stale' ? '显示上次数据' : '每日 08:00 重置' }}</span><button :disabled="editing" aria-label="查看额度详情" @click="$emit('open')">详情<ChevronRight :size="14" /></button></footer>
  </section>
</template>
