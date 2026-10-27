import { Globe, Server, Router, Network, Folder, Tv, Activity, Shield, Download, Bot, Wrench, ListOrdered } from '@lucide/vue'
import type { Component } from 'vue'
export const common: Record<string, Component> = { Globe, Server, Router, Network, Folder, Tv, Activity, Shield, Download, Bot, Wrench, ListOrdered }
let pending: Promise<Record<string, Component>> | undefined
export function loadIcons(): Promise<Record<string, Component>> {
  return pending ||= import('./icon-catalog').then(m => m.catalog)
}
