// ===== Bubble Pop Mode =====
import { createParticleSystem } from '../utils/particles.js'
import { synth, resumeAudio } from '../utils/sound.js'

let raf = null
let canvas = null
let ctx = null
let particles = null
let bubbles = []
let score = 0
let scoreEl = null
let w = 0, h = 0
let dpr = 1

const LABELS = [
  '加班', 'deadline', '老闆', '開會', '報表',
  '績效', '需求變更', '客訴', '週報', '加班費沒了',
  '又開會', '還有bug', '睡眠不足', '上班地獄', '拜託'
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

function spawnBubble() {
  const r = 28 + Math.random() * 38
  const x = r + Math.random() * (w - r * 2)
  bubbles.push({
    x,
    y: h + r,
    r,
    vx: (Math.random() - 0.5) * 0.6,
    vy: -(0.5 + Math.random() * 0.8),
    phase: Math.random() * Math.PI * 2,
    hue: 180 + Math.random() * 60,
    label: Math.random() > 0.4 ? LABELS[Math.floor(Math.random() * LABELS.length)] : null,
    opacity: 0,
    alive: true,
  })
}

function drawBubble(b) {
  ctx.save()
  ctx.globalAlpha = b.opacity * 0.9
  ctx.beginPath()
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)

  // Glass gradient
  const grad = ctx.createRadialGradient(
    b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1,
    b.x, b.y, b.r
  )
  grad.addColorStop(0, `hsla(${b.hue}, 80%, 90%, 0.5)`)
  grad.addColorStop(0.5, `hsla(${b.hue}, 70%, 60%, 0.15)`)
  grad.addColorStop(1, `hsla(${b.hue}, 80%, 50%, 0.3)`)
  ctx.fillStyle = grad
  ctx.fill()

  // Rim
  ctx.strokeStyle = `hsla(${b.hue}, 80%, 80%, 0.5)`
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Highlight
  ctx.beginPath()
  ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fill()

  // Label
  if (b.label) {
    ctx.globalAlpha = b.opacity * 0.85
    ctx.fillStyle = `hsl(${b.hue}, 60%, 85%)`
    ctx.font = `bold ${Math.max(10, b.r * 0.38)}px "Noto Sans TC", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(b.label, b.x, b.y)
  }
  ctx.restore()
}

function pop(b, x, y) {
  b.alive = false
  score++
  if (scoreEl) scoreEl.textContent = `💥 ${score}`
  synth('pop', { freq: 300 + b.hue })
  particles.emit(x ?? b.x, y ?? b.y, 18, {
    colors: [
      `hsl(${b.hue}, 80%, 70%)`,
      `hsl(${b.hue + 30}, 80%, 80%)`,
      'rgba(255,255,255,0.8)',
    ],
    speed: 4 + b.r * 0.08,
    gravity: 0.15,
    lifetime: 45,
    size: 3,
    sizeVariance: 3,
  })
}

function loop(t) {
  raf = requestAnimationFrame(loop)
  ctx.clearRect(0, 0, w, h)

  // Spawn
  if (Math.random() < 0.018 && bubbles.filter(b => b.alive).length < 25) {
    spawnBubble()
  }

  // Update & draw bubbles
  bubbles = bubbles.filter(b => b.alive || b.opacity > 0.01)
  for (const b of bubbles) {
    if (!b.alive) { b.opacity *= 0.7; continue }
    b.opacity = Math.min(1, b.opacity + 0.04)
    b.x += b.vx + Math.sin(t * 0.001 + b.phase) * 0.3
    b.y += b.vy
    if (b.y + b.r < 0) b.alive = false
    drawBubble(b)
  }

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
    for (const b of bubbles) {
      if (!b.alive) continue
      const dx = b.x - x, dy = b.y - y
      if (dx * dx + dy * dy < b.r * b.r) {
        pop(b, x, y)
      }
    }
  }
}

export function init(container) {
  score = 0
  bubbles = []

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

  resize()
  window.addEventListener('resize', resize)
  canvas.addEventListener('click', onPointer)
  canvas.addEventListener('touchstart', onPointer, { passive: true })

  // Spawn initial bubbles
  for (let i = 0; i < 8; i++) {
    spawnBubble()
    bubbles[bubbles.length - 1].y = Math.random() * h
    bubbles[bubbles.length - 1].opacity = 0.7
  }

  raf = requestAnimationFrame(loop)
}

export function destroy() {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  if (canvas) {
    canvas.removeEventListener('click', onPointer)
    canvas.removeEventListener('touchstart', onPointer)
  }
  bubbles = []
  raf = null
  canvas = null
  ctx = null
  particles = null
}
