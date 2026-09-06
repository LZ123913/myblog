import { defineStore } from 'pinia'

export const useBackgroundStore = defineStore('background', {
  state: () => ({
    currentBg: '/bg-default.jpg',
    previousBg: null,
    heroBg: null,
    heroOpacity: 1,
    isLightBg: true,
    _preloaded: new Set(),
    _heroFading: false
  }),
  actions: {
    async setBackground(bg, isLight = true) {
      if (this.currentBg === bg) {
        // 背景相同但明暗可能不同，立即更新
        this.isLightBg = isLight
        return
      }

      // 等待新图片加载完成
      if (!this._preloaded.has(bg)) {
        await this._preload(bg)
      }

      this.previousBg = this.currentBg
      this.currentBg = bg
      // 等背景开始淡入时再切换明暗，保持同步
      this.isLightBg = isLight
    },
    async setHeroBg(bg, isLight = true) {
      if (!this._preloaded.has(bg)) {
        await this._preload(bg)
      }
      this.heroBg = bg
      this.isLightBg = isLight
      this.heroOpacity = 1
      this._heroFading = false
    },
    // 淡出hero背景，淡出完成后再清除
    async fadeOutHeroBg() {
      if (!this.heroBg || this._heroFading) return
      this._heroFading = true
      this.heroOpacity = 0
      // 等1.2s过渡完成再清除
      await new Promise(r => setTimeout(r, 1200))
      this.heroBg = null
      this.heroOpacity = 1
      this._heroFading = false
    },
    clearHeroBg() {
      this.heroBg = null
      this._heroFading = false
    },
    setHeroOpacity(val) {
      this.heroOpacity = Math.max(0, Math.min(1, val))
    },
    _preload(url) {
      return new Promise((resolve) => {
        if (this._preloaded.has(url)) {
          resolve()
          return
        }
        const img = new Image()
        img.onload = () => {
          this._preloaded.add(url)
          resolve()
        }
        img.onerror = () => {
          // 加载失败也标记一下，避免重复尝试
          this._preloaded.add(url)
          resolve()
        }
        img.src = url
      })
    }
  }
})
