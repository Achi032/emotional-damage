// ===== Smash Mode =====
import { createParticleSystem } from '../utils/particles.js'
import { synth, resumeAudio } from '../utils/sound.js'
import { waitForSize } from '../utils/dom.js'

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
  '💻','🖥️','☕','📄','⌨️','📱','🖨️','📊','📅','🗂️',
  '📋','🖊️','📌','🗑️','💾','📡','🔋','📎','✂️','🗄️',
]

const CRASH_TEXTS = ['💥','✨','⚡','🔥','💢','🌋','☄️','🤯']

let dragging = null
let dragOffsetX = 0
let dragOffsetY = 0
let lastX = 0, lastY = 0
let lastTime = 0
let velX = 0, velY = 0

function resize() {
  dpr = window.devicePixelRatio || 1
  const parent = canvas.parentElement
  const rect = parent.getBoundingClientRect()
  w = rect.width || window.innerWidth
  h = rect.height || window.innerHeight
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  canvas.width = w * dpr
  canvas.height = h * dpr
  ctx.scale(dpr, dpr)
}

function randBetween(a, b) { return a + Math.random() * (b - a) }

function spawnObject(emoji) {
  const el = document.createElement('div')
  el.className = 'smash-object'
  el.textContent = emoji

  const size = 32
  const x = size + Math.random() * (w - size * 2)
  const y = size + Math.random() * (h * 0.75)
  el.style.left = x + 'px'
  el.style.top = y + 'px'
  el.style.fontSize = randBetween(1.8, 3.5) + 'rem'
  el.style.transform = `rotate(${randBetween(-20, 20)}deg)`

  const obj = {
    el, x, y,
    vx: (Math.random() - 0.5) * 1.2,  // slight random drift
    vy: (Math.random() - 0.5) * 0.8,
    alive: true, flying: false,
    rotation: randBetween(-20, 20),
    rotVel: 0,
  }

  el.addEventListener('mousedown', e => startDrag(e, obj))
  el.addEventListener('touchstart', e => startDrag(e, obj), { passive: false })

  container.querySelector('.smash-container').appendChild(el)
  objects.push(obj)
}

function spawnAll() {
  objects.forEach(o => o.el?.remove())
  objects = []
  const count = 7 + Math.floor(Math.random() * 4)
  const pool = [...ITEMS].sort(() => Math.random() - 0.5).slice(0, count)
  pool.forEach(emoji => spawnObject(emoji))
}

function getEventPos(e) {
  if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
  return { x: e.clientX, y: e.clientY }
}

function startDrag(e, obj) {
  if (!obj.alive) return
  e.preventDefault()
  resumeAudio()
  dragging = obj
  const pos = getEventPos(e)
  const rect = obj.el.getBoundingClientRect()
  dragOffsetX = pos.x - rect.left - rect.width / 2
  dragOffsetY = pos.y - rect.top - rect.height / 2
  const contRect = obj.el.parentElement.getBoundingClientRect()
  lastX = pos.x - contRect.left
  lastY = pos.y - contRect.top
  lastTime = performance.now()
  velX = 0; velY = 0
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
  if (speed > 2) {
    dragging.vx = velX
    dragging.vy = velY
    dragging.rotVel = (Math.random() - 0.5) * 20
    dragging.flying = true
    synth('whoosh')
  }
  dragging = null
}

function chainReaction(originObj) {
  // Knock nearby alive objects
  for (const obj of objects) {
    if (!obj.alive || obj === originObj) continue
    const dx = obj.x - originObj.x
    const dy = obj.y - originObj.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 200) {
      const push = (200 - dist) / 200 * 15
      obj.vx += (dx / dist) * push * randBetween(0.5, 1.5)
      obj.vy += (dy / dist) * push * randBetween(0.3, 1.0) - 2
      obj.rotVel = (Math.random() - 0.5) * 25
      obj.flying = true
    }
  }
}

function smashObject(obj) {
  if (!obj.alive) return
  obj.alive = false
  obj.flying = false
  smashCount++
  if (counterEl) counterEl.textContent = `💥 ${smashCount}`

  synth('smash')

  if (flashEl) {
    flashEl.classList.add('active')
    setTimeout(() => flashEl && flashEl.classList.remove('active'), 80)
  }

  // Lots of particles with trail
  particles.emit(obj.x, obj.y, 50, {
    colors: ['#ff2d55','#ff6b35','#ffaa00','#fff','#ff6b9d','#ffdd00'],
    speed: randBetween(8, 14),
    gravity: 0.45,
    lifetime: 65,
    size: 7,
    sizeVariance: 5,
    trail: true,
  })

  // Crash text shards
  for (let i = 0; i < 6; i++) {
    const shard = document.createElement('div')
    const tx = (Math.random() - 0.5) * 220
    const ty = (Math.random() - 0.5) * 150
    shard.style.cssText = `
      position:absolute; font-size:${randBetween(1.2, 2.5)}rem;
      pointer-events:none; left:${obj.x - 16}px; top:${obj.y - 16}px;
      z-index:5; animation:fallDown 0.8s ease forwards;`
    shard.textContent = CRASH_TEXTS[Math.floor(Math.random() * CRASH_TEXTS.length)]
    shard.style.setProperty('--fall-start', 'translate(0,0)')
    shard.style.setProperty('--fall-end', `translate(${tx}px,${ty}px)`)
    shard.style.setProperty('--fall-rot', `${(Math.random()-0.5)*400}deg`)
    container.querySelector('.smash-container').appendChild(shard)
    setTimeout(() => shard.remove(), 900)
  }

  // Shake
  const c = container.querySelector('.smash-container')
  const intensity = randBetween(5, 12)
  c.style.animation = 'none'
  requestAnimationFrame(() => {
    c.style.animation = `shake 0.35s ease`
    c.style.setProperty('--shake-amount', intensity + 'px')
  })
  setTimeout(() => { if (c) c.style.animation = '' }, 350)

  // Chain reaction (random chance)
  if (Math.random() < 0.4) chainReaction(obj)

  obj.el.remove()

  const alive = objects.filter(o => o.alive)
  if (alive.length === 0) {
    setTimeout(() => {
      const respawn = container.querySelector('.respawn-btn')
      if (respawn) respawn.style.display = 'block'
    }, 600)
  }
}

function loop() {
  raf = requestAnimationFrame(loop)
  ctx.clearRect(0, 0, w, h)

  for (const obj of objects) {
    if (!obj.flying || !obj.alive) continue
    obj.x += obj.vx
    obj.y += obj.vy
    obj.vy += 0.55
    obj.vx *= 0.99
    obj.rotation += obj.rotVel
    obj.el.style.left = obj.x + 'px'
    obj.el.style.top = obj.y + 'px'
    obj.el.style.transform = `rotate(${obj.rotation}deg)`

    const speed = Math.sqrt(obj.vx * obj.vx + obj.vy * obj.vy)
    const size = 28

    if (obj.x < -60 || obj.x > w + 60 || obj.y > h + 60) {
      if (speed > 3) { smashObject(obj); continue }
      else {
        obj.flying = false
        obj.vx = 0; obj.vy = 0
      }
    }
    if (obj.x < size && obj.vx < 0) { obj.vx *= -0.55; obj.x = size; if (speed > 3) smashObject(obj) }
    else if (obj.x > w - size && obj.vx > 0) { obj.vx *= -0.55; obj.x = w - size; if (speed > 3) smashObject(obj) }
    if (obj.y > h - size && obj.vy > 0) {
      if (speed > 6) { smashObject(obj) }
      else { obj.vy *= -0.35; obj.vx *= 0.65; obj.y = h - size; obj.flying = Math.abs(obj.vy) > 0.8 }
    }
  }

  particles.update()
  particles.draw()
}

export function init(cont) {
  container = cont
  smashCount = 0
  objects = []
  dragging = null

  cont.innerHTML = `
    <div class="smash-container">
      <canvas class="smash-canvas"></canvas>
      <div class="smash-flash"></div>
      <div class="smash-counter">💥 0</div>
      <div class="smash-hint">拖住物品，用力甩出去！</div>
      <button class="respawn-btn" style="display:none">再來一次</button>
    </div>
  `

  canvas = cont.querySelector('.smash-canvas')
  ctx = canvas.getContext('2d')
  counterEl = cont.querySelector('.smash-counter')
  flashEl = cont.querySelector('.smash-flash')
  particles = createParticleSystem(canvas)

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', endDrag)
  window.addEventListener('touchmove', onMove, { passive: false })
  window.addEventListener('touchend', endDrag)

  cont.querySelector('.respawn-btn').addEventListener('click', () => {
    cont.querySelector('.respawn-btn').style.display = 'none'
    spawnAll()
  })

  waitForSize(canvas.parentElement, () => {
    resize()
    window.addEventListener('resize', resize)
    spawnAll()
    raf = requestAnimationFrame(loop)
  })
}

export function destroy() {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('touchmove', onMove)
  window.removeEventListener('touchend', endDrag)
  objects.forEach(o => o.el?.remove())
  objects = []
  dragging = null
  raf = null; canvas = null; ctx = null; particles = null; container = null
}
