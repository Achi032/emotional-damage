// ===== Bubble Pop Mode =====
import { createParticleSystem } from '../utils/particles.js'
import { synth, resumeAudio } from '../utils/sound.js'
import { waitForSize } from '../utils/dom.js'

let raf = null
let canvas = null
let ctx = null
let particles = null
let bubbles = []
let shockwaves = []
let score = 0
let scoreEl = null
let w = 0, h = 0
let dpr = 1

const LABELS = [
  '加班','deadline','老闆','開會','報表','績效','需求變更','客訴',
  '週報','加班費呢','又開會','還有bug','睡眠不足','上班地獄',
  '下週一前交','KPI','OKR','方案A','方案B','重做','再改一版',
  '為什麼','不合理','沒有原因','緊急','ASAP','最後一次了',
]

function resize() {
  dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  w = rect.width
  h = rect.height
  canvas.width = w * dpr
  canvas.height = h * dpr
  ctx.scale(dpr, dpr)
}

function randBetween(a, b) { return a + Math.random() * (b - a) }

function spawnBubble(yOverride) {
  const giant = Math.random() < 0.05
  const r = giant ? randBetween(70, 100) : randBetween(22, 52)
  const x = r + Math.random() * (w - r * 2)
  const y = yOverride !== undefined ? yOverride : h + r
  bubbles.push({
    x, y, r,
    vx: (Math.random() - 0.5) * 0.7,
    vy: -(randBetween(0.4, 1.0)),
    phase: Math.random() * Math.PI * 2,
    phaseSpeed: randBetween(0.003, 0.008),
    hue: randBetween(160, 280),
    label: Math.random() > 0.35 ? LABELS[Math.floor(Math.random() * LABELS.length)] : null,
    opacity: 0,
    alive: true,
    giant,
  })
}

function spawnInitialBubbles() {
  for (let i = 0; i < 10; i++) {
    spawnBubble(randBetween(h * 0.05, h * 0.9))
    bubbles[bubbles.length - 1].opacity = randBetween(0.5, 0.9)
  }
}

function drawBubble(b) {
  ctx.save()
  ctx.globalAlpha = b.opacity * 0.88

  ctx.beginPath()
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)

  const grad = ctx.createRadialGradient(
    b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.05,
    b.x, b.y, b.r
  )
  grad.addColorStop(0,   `hsla(${b.hue}, 80%, 92%, 0.55)`)
  grad.addColorStop(0.45, `hsla(${b.hue}, 70%, 60%, 0.12)`)
  grad.addColorStop(1,   `hsla(${b.hue}, 85%, 50%, 0.35)`)
  ctx.fillStyle = grad
  ctx.fill()

  ctx.strokeStyle = `hsla(${b.hue}, 80%, 82%, 0.55)`
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Highlight
  ctx.beginPath()
  ctx.arc(b.x - b.r * 0.28, b.y - b.r * 0.32, b.r * 0.16, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fill()

  // Small secondary highlight
  ctx.beginPath()
  ctx.arc(b.x + b.r * 0.3, b.y - b.r * 0.1, b.r * 0.07, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fill()

  if (b.label) {
    ctx.globalAlpha = b.opacity * 0.9
    ctx.fillStyle = `hsl(${b.hue}, 50%, 88%)`
    const fontSize = Math.max(9, b.r * (b.giant ? 0.22 : 0.36))
    ctx.font = `bold ${fontSize}px "Noto Sans TC", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(b.label, b.x, b.y)
  }
  ctx.restore()
}

function drawShockwaves() {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i]
    s.r += 5
    s.opacity -= 0.06
    if (s.opacity <= 0) { shockwaves.splice(i, 1); continue }
    ctx.save()
    ctx.globalAlpha = s.opacity
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.strokeStyle = `hsl(${s.hue}, 80%, 70%)`
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.restore()
  }
}

function pop(b, x, y) {
  b.alive = false
  score++
  if (scoreEl) scoreEl.textContent = `💥 ${score}`
  synth('pop', { freq: randBetween(250, 550) })

  shockwaves.push({ x: x ?? b.x, y: y ?? b.y, r: b.r * 0.5, opacity: 0.7, hue: b.hue })

  const pCount = b.giant ? 55 : 28
  particles.emit(x ?? b.x, y ?? b.y, pCount, {
    colors: [
      `hsl(${b.hue}, 80%, 70%)`,
      `hsl(${b.hue + 40}, 80%, 80%)`,
      `hsl(${b.hue - 30}, 90%, 75%)`,
      'rgba(255,255,255,0.9)',
    ],
    speed: b.giant ? randBetween(8, 14) : randBetween(3, 7),
    gravity: 0.18,
    lifetime: b.giant ? 75 : 50,
    size: b.giant ? 8 : 4,
    sizeVariance: 4,
    trail: true,
  })

  // Chain reaction: pop nearby bubbles
  const chainRadius = b.giant ? b.r * 3 : b.r * 1.4 + 45
  for (const other of bubbles) {
    if (!other.alive) continue
    const dx = other.x - b.x, dy = other.y - b.y
    if (Math.sqrt(dx*dx+dy*dy) < chainRadius) {
      // Delayed chain
      setTimeout(() => { if (other.alive) pop(other, other.x, other.y) }, randBetween(60, 200))
    }
  }
}

function loop(t) {
  raf = requestAnimationFrame(loop)
  ctx.clearRect(0, 0, w, h)

  if (Math.random() < 0.02 && bubbles.filter(b => b.alive).length < 22) {
    spawnBubble()
  }

  bubbles = bubbles.filter(b => b.alive || b.opacity > 0.01)
  for (const b of bubbles) {
    if (!b.alive) { b.opacity *= 0.65; continue }
    b.opacity = Math.min(1, b.opacity + 0.035)
    b.x += b.vx + Math.sin(t * b.phaseSpeed + b.phase) * 0.35
    b.y += b.vy
    if (b.y + b.r < 0) b.alive = false
    drawBubble(b)
  }

  drawShockwaves()
  particles.update()
  particles.draw()
}

function onPointer(e) {
  resumeAudio()
  const rect = canvas.getBoundingClientRect()
  const points = e.touches
    ? Array.from(e.touches).map(t => ({ x: t.clientX - rect.left, y: t.clientY - rect.top }))
    : [{ x: e.clientX - rect.left, y: e.clientY - rect.top }]

  for (const { x, y } of points) {
    for (const b of [...bubbles]) {
      if (!b.alive) continue
      const dx = b.x - x, dy = b.y - y
      if (dx*dx + dy*dy < b.r*b.r) pop(b, x, y)
    }
  }
}

export function init(container) {
  score = 0
  bubbles = []
  shockwaves = []

  container.innerHTML = `
    <div class="bubbles-container">
      <canvas class="bubbles-canvas"></canvas>
      <div class="bubbles-score">💥 0</div>
      <div class="bubbles-hint">點擊氣泡來釋放壓力</div>
    </div>
  `
  canvas = container.querySelector('.bubbles-canvas')
  ctx = canvas.getContext('2d')
  scoreEl = container.querySelector('.bubbles-score')
  particles = createParticleSystem(canvas)

  canvas.addEventListener('click', onPointer)
  canvas.addEventListener('touchstart', onPointer, { passive: true })

  waitForSize(canvas, () => {
    resize()
    window.addEventListener('resize', resize)
    spawnInitialBubbles()
    raf = requestAnimationFrame(loop)
  })
}

export function destroy() {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  if (canvas) {
    canvas.removeEventListener('click', onPointer)
    canvas.removeEventListener('touchstart', onPointer)
  }
  bubbles = []
  shockwaves = []
  raf = null; canvas = null; ctx = null; particles = null
}
