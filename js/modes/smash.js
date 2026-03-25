// ===== Smash Mode =====
import { createParticleSystem } from '../utils/particles.js'
import { synth, resumeAudio } from '../utils/sound.js'

let raf = null
let canvas = null
let ctx = null
let particles = null
let objects = []
let smashCount = 0
let counterEl = null
let flashEl = null
let container = null
let w = 0, h = 0, dpr = 1

const ITEMS = [
  { emoji: '💻', label: '筆電' },
  { emoji: '🖥️', label: '螢幕' },
  { emoji: '☕', label: '咖啡' },
  { emoji: '📄', label: '報表' },
  { emoji: '⌨️', label: '鍵盤' },
  { emoji: '📱', label: '手機' },
  { emoji: '🖨️', label: '印表機' },
  { emoji: '📊', label: '圖表' },
  { emoji: '📅', label: '行事曆' },
  { emoji: '🗂️', label: '文件' },
]

const SHARD_EMOJIS = ['💥', '✨', '⚡', '🔥']

let dragging = null
let dragOffsetX = 0
let dragOffsetY = 0
let lastX = 0, lastY = 0
let lastTime = 0
let velX = 0, velY = 0

function resize() {
  dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  w = rect.width
  h = rect.height
  canvas.width = w * dpr
  canvas.height = h * dpr
  ctx.scale(dpr, dpr)
}

function spawnObject(item) {
  const el = document.createElement('div')
  el.className = 'smash-object'
  el.textContent = item.emoji
  el.title = item.label

  const size = 48
  const x = size + Math.random() * (w - size * 2)
  const y = size + Math.random() * (h * 0.7)
  el.style.left = x + 'px'
  el.style.top = y + 'px'
  el.style.fontSize = (2.2 + Math.random() * 1.2) + 'rem'

  const obj = { el, x, y, vx: 0, vy: 0, alive: true, flying: false, rotation: 0, rotVel: 0 }

  el.addEventListener('mousedown', e => startDrag(e, obj))
  el.addEventListener('touchstart', e => startDrag(e, obj), { passive: false })

  container.querySelector('.smash-container').appendChild(el)
  objects.push(obj)
}

function spawnAll() {
  objects.forEach(o => o.el.remove())
  objects = []
  const picks = [...ITEMS].sort(() => Math.random() - 0.5).slice(0, 8)
  picks.forEach(item => spawnObject(item))
}

function getEventPos(e) {
  if (e.touches) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  return { x: e.clientX, y: e.clientY }
}

function startDrag(e, obj) {
  if (!obj.alive) return
  e.preventDefault()
  resumeAudio()
  dragging = obj
  const pos = getEventPos(e)
  const rect = obj.el.getBoundingClientRect()
  const contRect = obj.el.parentElement.getBoundingClientRect()
  dragOffsetX = pos.x - rect.left - rect.width / 2
  dragOffsetY = pos.y - rect.top - rect.height / 2
  lastX = pos.x - contRect.left
  lastY = pos.y - contRect.top
  lastTime = performance.now()
  velX = 0
  velY = 0
  obj.el.classList.add('dragging')
  obj.flying = false
}

function onMove(e) {
  if (!dragging) return
  const pos = getEventPos(e)
  const contRect = dragging.el.parentElement.getBoundingClientRect()
  const cx = pos.x - contRect.left
  const cy = pos.y - contRect.top

  const now = performance.now()
  const dt = Math.max(1, now - lastTime)
  velX = (cx - lastX) / dt * 16
  velY = (cy - lastY) / dt * 16
  lastX = cx; lastY = cy; lastTime = now

  dragging.x = cx - dragOffsetX
  dragging.y = cy - dragOffsetY
  dragging.el.style.left = dragging.x + 'px'
  dragging.el.style.top = dragging.y + 'px'
}

function endDrag() {
  if (!dragging) return
  dragging.el.classList.remove('dragging')
  const speed = Math.sqrt(velX * velX + velY * velY)
  if (speed > 3) {
    dragging.vx = velX
    dragging.vy = velY
    dragging.rotVel = (Math.random() - 0.5) * 15
    dragging.flying = true
    synth('whoosh')
  }
  dragging = null
}

function smashObject(obj) {
  if (!obj.alive) return
  obj.alive = false
  obj.flying = false
  smashCount++
  if (counterEl) counterEl.textContent = `💥 ${smashCount}`

  synth('smash')

  // Flash
  if (flashEl) {
    flashEl.classList.add('active')
    setTimeout(() => flashEl && flashEl.classList.remove('active'), 80)
  }

  // Particles
  particles.emit(obj.x, obj.y, 30, {
    colors: ['#ff2d55', '#ff6b35', '#ffaa00', '#fff', '#ff6b9d'],
    speed: 8 + Math.random() * 4,
    gravity: 0.4,
    lifetime: 55,
    size: 5,
    sizeVariance: 4,
  })

  // Shard emojis
  for (let i = 0; i < 5; i++) {
    const shard = document.createElement('div')
    shard.style.cssText = `
      position:absolute;
      font-size:1.5rem;
      pointer-events:none;
      left:${obj.x - 12}px;
      top:${obj.y - 12}px;
      z-index:5;
      animation: fallDown 0.7s ease forwards;
    `
    shard.textContent = SHARD_EMOJIS[Math.floor(Math.random() * SHARD_EMOJIS.length)]
    const tx = (Math.random() - 0.5) * 180
    const ty = (Math.random() - 0.5) * 120
    const rot = (Math.random() - 0.5) * 360 + 'deg'
    shard.style.setProperty('--fall-start', `translate(0,0)`)
    shard.style.setProperty('--fall-end', `translate(${tx}px, ${ty}px)`)
    shard.style.setProperty('--fall-rot', rot)
    container.querySelector('.smash-container').appendChild(shard)
    setTimeout(() => shard.remove(), 800)
  }

  // Shake screen
  const c = container.querySelector('.smash-container')
  c.style.animation = 'shake 0.3s ease'
  setTimeout(() => { if (c) c.style.animation = '' }, 300)

  obj.el.remove()

  // Check if all smashed
  const alive = objects.filter(o => o.alive)
  if (alive.length === 0) {
    setTimeout(() => {
      const respawn = container.querySelector('.respawn-btn')
      if (respawn) respawn.style.display = 'block'
    }, 500)
  }
}

function loop() {
  raf = requestAnimationFrame(loop)
  ctx.clearRect(0, 0, w, h)

  for (const obj of objects) {
    if (!obj.flying || !obj.alive) continue
    obj.x += obj.vx
    obj.y += obj.vy
    obj.vy += 0.5 // gravity
    obj.vx *= 0.99
    obj.rotation += obj.rotVel

    obj.el.style.left = obj.x + 'px'
    obj.el.style.top = obj.y + 'px'
    obj.el.style.transform = `rotate(${obj.rotation}deg)`

    const speed = Math.sqrt(obj.vx * obj.vx + obj.vy * obj.vy)

    // Hit walls
    const size = 24
    if (obj.x < -size || obj.x > w + size || obj.y > h + size) {
      if (speed > 5) {
        smashObject(obj)
      } else {
        obj.flying = false
        obj.x = Math.max(size, Math.min(w - size, obj.x))
        obj.y = Math.min(h - size, obj.y)
        obj.vx = 0; obj.vy = 0
        obj.el.style.left = obj.x + 'px'
        obj.el.style.top = obj.y + 'px'
      }
    }

    // Bounce off sides
    if (obj.x < size && obj.vx < 0) { obj.vx *= -0.6; obj.x = size }
    if (obj.x > w - size && obj.vx > 0) { obj.vx *= -0.6; obj.x = w - size }
    if (obj.y > h - size && obj.vy > 0) {
      if (speed > 8) {
        smashObject(obj)
      } else {
        obj.vy *= -0.3
        obj.vx *= 0.7
        obj.y = h - size
        obj.flying = Math.abs(obj.vy) > 1
      }
    }
  }

  particles.update()
  particles.draw()
}

export function init(cont) {
  container = cont
  smashCount = 0
  objects = []

  cont.innerHTML = `
    <div class="smash-container">
      <canvas class="smash-canvas"></canvas>
      <div class="smash-flash"></div>
      <div class="smash-counter">💥 0</div>
      <div class="smash-hint">拖動物品，用力甩出去！</div>
      <button class="respawn-btn" style="display:none">重新生成物品</button>
    </div>
  `

  canvas = cont.querySelector('.smash-canvas')
  ctx = canvas.getContext('2d')
  counterEl = cont.querySelector('.smash-counter')
  flashEl = cont.querySelector('.smash-flash')
  particles = createParticleSystem(canvas)

  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', endDrag)
  window.addEventListener('touchmove', onMove, { passive: false })
  window.addEventListener('touchend', endDrag)

  cont.querySelector('.respawn-btn').addEventListener('click', () => {
    cont.querySelector('.respawn-btn').style.display = 'none'
    spawnAll()
  })

  spawnAll()
  raf = requestAnimationFrame(loop)
}

export function destroy() {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('touchmove', onMove)
  window.removeEventListener('touchend', endDrag)
  objects = []
  dragging = null
  raf = null
  canvas = null
  ctx = null
  particles = null
  container = null
}
