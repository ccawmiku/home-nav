<script setup lang="ts">
import { computed } from 'vue'
import { RefreshCw } from '@lucide/vue'
import { quotaNumber, quotaPercent, quotaProducts } from '../shared/account-usage'
import type { AccountUsage } from '../shared/account-usage'
const props = defineProps<{ usage: AccountUsage | null; busy: boolean; error: string }>()
defineEmits<{ refresh: [] }>()
const groups = computed(() => quotaProducts.map(product => ({ product, metrics: props.usage?.metrics.filter(metric => metric.product === product) || [] })))
const updated = computed(() => props.usage?.fetchedAt ? new Date(props.usage.fetchedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '尚未更新')
</script>

<template>
  <div class="quota-details">
    <div class="quota-detail-intro"><div><p>全账号 · 免费套餐参考额度</p><span>{{ updated }}{{ usage?.status === 'stale' ? ' · 上次数据' : '' }}</span></div><button class="quota-detail-refresh" :disabled="busy" @click="$emit('refresh')"><RefreshCw :size="15" :class="{ spin: busy }" />{{ busy ? '更新中' : '刷新' }}</button></div>
    <p v-if="error || usage?.message" class="quota-notice" role="status">{{ error || usage?.message }}</p>
    <section v-for="group in groups" :key="group.product" class="quota-detail-group"><h3>{{ group.product }}</h3><div class="quota-detail-list"><div v-for="metric in group.metrics" :key="metric.id" class="quota-detail-metric">
      <div class="quota-detail-line"><span>{{ metric.name }}</span><strong :class="{ 'quota-warning': (quotaPercent(metric) ?? 0) >= 90 }">{{ quotaNumber(metric.value, metric.unit) }}</strong></div>
      <div v-if="metric.limit !== null" class="quota-detail-limit"><span>{{ metric.period === 'day' ? '每日额度' : '存储容量' }} {{ quotaNumber(metric.limit, metric.unit) }}</span><span v-if="quotaPercent(metric) !== null">{{ quotaPercent(metric)!.toFixed(1) }}%</span></div>
      <div v-if="quotaPercent(metric) !== null" class="quota-track" :class="{ 'quota-high': quotaPercent(metric)! >= 90 }" role="progressbar" :aria-label="metric.name" :aria-valuenow="Math.min(100, quotaPercent(metric)!)" :aria-valuetext="quotaPercent(metric)!.toFixed(1) + '%'" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: Math.min(100, quotaPercent(metric)!) + '%' }" /></div>
      <p v-if="metric.note" class="quota-metric-note">{{ metric.note }}</p>
    </div><p v-if="!group.metrics.length" class="quota-metric-note">{{ busy ? '正在读取统计…' : '暂无数据' }}</p></div></section>
    <p class="quota-explanation">首页百分比为各产品已知日额度中的最高用量比例。每日额度在北京时间 08:00 重置，存储容量不随每日重置。Analytics 统计存在延迟，不是实时账单。</p>
  </div>
</template>
