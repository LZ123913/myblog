import { defineStore } from 'pinia'
import api from '../utils/api'

export const useSiteStore = defineStore('site', {
  state: () => ({
    settings: {},
    loaded: false,
    loading: false
  }),
  getters: {
    blogName: (state) => state.settings.blog_name || '拾光集',
    blogSubtitle: (state) => state.settings.blog_subtitle || '记录每一束思想的光',
    authorName: (state) => state.settings.author_name || '拾光者',
    authorAvatar: (state) => state.settings.author_avatar || '/avatar.jpg',
    mottos: (state) => {
      if (Array.isArray(state.settings.mottos)) return state.settings.mottos
      return ['记录每一束思想的光']
    },
    randomMotto: (state) => {
      const list = Array.isArray(state.settings.mottos) && state.settings.mottos.length > 0
        ? state.settings.mottos
        : ['记录每一束思想的光']
      return list[Math.floor(Math.random() * list.length)]
    }
  },
  actions: {
    async loadSettings(force = false) {
      if (this.loaded && !force) return
      if (this.loading) return
      this.loading = true
      try {
        const data = await api.get('/site-settings')
        this.settings = data
        this.loaded = true
      } catch (err) {
        console.error('Failed to load site settings:', err)
      } finally {
        this.loading = false
      }
    },
    async saveSettings(updates) {
      try {
        const data = await api.put('/site-settings', updates)
        this.settings = data
        return data
      } catch (err) {
        throw err
      }
    }
  }
})
