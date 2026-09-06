<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBackgroundStore } from '../stores/background'

const router = useRouter()
const bgStore = useBackgroundStore()

const heroBackgrounds = [
  { id: 'spring', label: '春', url: '/hero-spring.jpg' },
  { id: 'summer', label: '夏', url: '/hero-summer.jpg' },
  { id: 'autumn', label: '秋', url: '/hero-autumn.jpg' },
  { id: 'winter', label: '冬', url: '/hero-winter.jpg' }
]
const selectedHeroBg = ref(null)

function selectHeroBg(bg) {
  if (selectedHeroBg.value === bg.id) {
    selectedHeroBg.value = null
    bgStore.clearHeroBg()
    localStorage.removeItem('shiguang-hero-bg')
  } else {
    selectedHeroBg.value = bg.id
    bgStore.setHeroBg(bg.url, true)
    bgStore.setHeroOpacity(1)
    localStorage.setItem('shiguang-hero-bg', bg.id)
  }
}

const mottos = [
  '生活不是等待暴风雨过去，而是学会在雨中起舞。',
  '每一个不曾起舞的日子，都是对生命的辜负。',
  '愿你走出半生，归来仍是少年。',
  '人生没有白走的路，每一步都算数。',
  '把每一个平凡的日子，过成诗和远方。',
  '时光会给努力的人，留下最好的答案。',
  '心若向阳，无畏悲伤；心若向暖，四季如春。',
  '真正的成长，是温柔地与世界和解。',
  '岁月不居，时节如流，愿你我都被时光温柔以待。',
  '在喧嚣的世界里，守一份内心的宁静。',
  '读过的书，走过的路，见过的人，都是你的光。',
  '慢一点，没关系，花开有时，叶落有时。',
  '人生海海，山山而川，不过尔尔。',
  '愿你眼里有光，心中有爱，脚下有路。',
  '所有的遇见，都是久别重逢。',
  '以梦为马，不负韶华。'
]
const mottoChars = ref([])
const revealedCount = ref(0)
const typingDone = ref(false)
let typeTimer = null

function startTyping() {
  const motto = mottos[Math.floor(Math.random() * mottos.length)]
  mottoChars.value = motto.split('').map((char) => ({
    char,
    delay: 80 + Math.random() * 80,
    floatY: -8 + Math.random() * 16,
    glow: 0.3 + Math.random() * 0.5
  }))
  revealedCount.value = 0
  typingDone.value = false
  let i = 0
  if (typeTimer) clearTimeout(typeTimer)
  function tick() {
    if (i < mottoChars.value.length) {
      revealedCount.value = i + 1
      i++
      typeTimer = setTimeout(tick, mottoChars.value[i - 1]?.delay || 100)
    } else {
      typingDone.value = true
    }
  }
  tick()
}

const isLeaving = ref(false)

function goHome() {
  if (isLeaving.value) return
  isLeaving.value = true
  bgStore.setHeroOpacity(0)
  setTimeout(() => router.push('/home'), 1200)
}

let wheelHandler = null
function onWheel(e) {
  if (e.deltaY > 0) {
    goHome()
  }
}

onMounted(async () => {
  // 先确保基础背景是默认图（防止从上一页带过来的背景闪烁）
  await bgStore.setBackground('/bg-default.jpg', true)

  const savedHeroBg = localStorage.getItem('shiguang-hero-bg')
  if (savedHeroBg && !bgStore.heroBg) {
    const bg = heroBackgrounds.find(b => b.id === savedHeroBg)
    if (bg) {
      selectedHeroBg.value = bg.id
      bgStore.heroBg = bg.url
      bgStore.heroOpacity = 1
      bgStore.isLightBg = true
    }
  }
  startTyping()
  wheelHandler = onWheel
  window.addEventListener('wheel', wheelHandler, { passive: true, once: true })
})

onUnmounted(() => {
  if (typeTimer) clearTimeout(typeTimer)
  if (wheelHandler) window.removeEventListener('wheel', wheelHandler)
  bgStore.clearHeroBg()
})
</script>

<template>
  <div class="splash-page" :class="{ leaving: isLeaving }">
    <div class="splash-content">
      <h1 class="splash-title">拾光集</h1>
      <p class="splash-subtitle">记录每一束思想的光</p>
      <div class="splash-motto">
        <span
          v-for="(item, idx) in mottoChars"
          :key="idx"
          class="motto-char"
          :class="{ revealed: idx < revealedCount }"
          :style="{
            animationDelay: `${idx * 0.02}s`,
            '--float-y': `${item.floatY}px`,
            '--glow-opacity': item.glow
          }"
        >{{ item.char }}</span>
        <span class="typing-cursor" :class="{ blink: typingDone }">|</span>
      </div>
    </div>

    <div class="clover-selector">
      <div class="clover">
        <button
          v-for="(bg, i) in heroBackgrounds"
          :key="bg.id"
          class="clover-leaf"
          :class="[`leaf-${i + 1}`, { active: selectedHeroBg === bg.id }]"
          @click="selectHeroBg(bg)"
          :title="bg.label"
        >
          <span class="leaf-label">{{ bg.label }}</span>
        </button>
        <div class="clover-center"></div>
      </div>
    </div>

    <div class="scroll-hint" @click="goHome">
      <span>向下滚动</span>
      <div class="bounce-arrow">↓</div>
    </div>
  </div>
</template>

<style scoped>
.splash-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #fff;
  margin-top: calc(-1 * var(--nav-height));
  padding-top: var(--nav-height);
  position: relative;
  transition: opacity 1.2s ease-in-out, transform 1.2s ease-in-out;
}
.splash-page.leaving {
  opacity: 0;
  transform: scale(1.05);
}
.splash-page::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.2) 50%, transparent 100%);
  pointer-events: none;
}

.splash-content {
  position: relative;
  z-index: 1;
}

.splash-title {
  font-size: 4.5rem;
  font-weight: 800;
  letter-spacing: 12px;
  text-shadow: 0 0 30px rgba(255, 255, 255, 0.3), 0 4px 20px rgba(0, 0, 0, 0.3);
  margin-bottom: 12px;
}
.splash-subtitle {
  font-size: 1.1rem;
  letter-spacing: 8px;
  opacity: 0.7;
  margin-bottom: 40px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.splash-motto {
  min-height: 40px;
  font-size: 1.05rem;
  line-height: 2;
  max-width: 600px;
  margin: 0 auto;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.motto-char {
  display: inline-block;
  opacity: 0;
  transform: translateY(var(--float-y, 10px)) scale(0.5);
  filter: blur(8px);
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.motto-char.revealed {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, var(--glow-opacity, 0.4)));
}
.typing-cursor {
  display: inline-block;
  opacity: 0.5;
  font-weight: 100;
  animation: blink 1s step-end infinite;
}
.typing-cursor.blink {
  animation: blink 1.2s step-end infinite;
}
@keyframes blink {
  0%, 50% { opacity: 0.6; }
  51%, 100% { opacity: 0; }
}

/* Four-leaf clover - tails connected */
.clover-selector {
  position: absolute;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
}
.clover {
  position: relative;
  width: 88px;
  height: 88px;
}
.clover-leaf {
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50% 50% 50% 0;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: 0% 100%;
  left: 44px;
  top: 4px;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease, box-shadow 0.3s ease;
  background: linear-gradient(135deg, rgba(91, 206, 101, 0.35), rgba(34, 139, 34, 0.45));
  box-shadow: 0 2px 10px rgba(34, 139, 34, 0.15);
}
.clover-leaf .leaf-label {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.leaf-1 .leaf-label { transform: rotate(45deg); }
.leaf-2 .leaf-label { transform: rotate(-45deg); }
.leaf-3 .leaf-label { transform: rotate(-135deg); }
.leaf-4 .leaf-label { transform: rotate(135deg); }

/* All tails meet at center (44,44), each leaf rotated around its bottom-left corner */
.leaf-1 { transform: rotate(-45deg); }
.leaf-2 { transform: rotate(45deg); }
.leaf-3 { transform: rotate(135deg); }
.leaf-4 { transform: rotate(-135deg); }

.clover-leaf:hover {
  background: linear-gradient(135deg, rgba(91, 206, 101, 0.55), rgba(34, 139, 34, 0.65));
  box-shadow: 0 4px 18px rgba(34, 139, 34, 0.3);
}
.leaf-1:hover { transform: rotate(-45deg) scale(1.12); }
.leaf-2:hover { transform: rotate(45deg) scale(1.12); }
.leaf-3:hover { transform: rotate(135deg) scale(1.12); }
.leaf-4:hover { transform: rotate(-135deg) scale(1.12); }

.clover-leaf.active {
  background: linear-gradient(135deg, rgba(91, 206, 101, 0.8), rgba(34, 139, 34, 0.9));
  box-shadow: 0 0 16px rgba(91, 206, 101, 0.6), 0 2px 12px rgba(34, 139, 34, 0.3);
}
.leaf-1.active { transform: rotate(-45deg) scale(1.08); }
.leaf-2.active { transform: rotate(45deg) scale(1.08); }
.leaf-3.active { transform: rotate(135deg) scale(1.08); }
.leaf-4.active { transform: rotate(-135deg) scale(1.08); }

.clover-center {
  position: absolute;
  top: 40px;
  left: 40px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(34, 139, 34, 0.3);
  pointer-events: none;
}

.scroll-hint {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  cursor: pointer;
  letter-spacing: 4px;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  animation: hintFloat 2s ease-in-out infinite;
  z-index: 2;
}
@keyframes hintFloat {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(8px); }
}
.bounce-arrow {
  font-size: 20px;
  margin-top: 4px;
}
</style>
