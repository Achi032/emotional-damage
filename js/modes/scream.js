// ===== Scream Detection Mode =====
import { createParticleSystem } from '../utils/particles.js'
import { resumeAudio } from '../utils/sound.js'

let raf = null
let meterCanvas = null
let meterCtx = null
let pCanvas = null   // full-screen particle canvas
let pCtx = null
let particles = null
let audioCtx = null
let analyser = null
let stream = null
let dataArray = null
let listening = false
let level = 0
let peakLevel = 0
let tapLevel = 0
let container = null
let damageEl = null
let flashEl = null
let bgEl = null
let statusEl = null
let levelTextEl = null
let peakEl = null
let recordEl = null
let damageFired = false
let dpr = 1
let meterSize = 220
let pW = 0, pH = 0

function resizeMeter() {
  dpr = window.devicePixelRatio || 1
  meterSize = Math.min(220, window.innerWidth * 0.5)
  meterCanvas.style.width = meterSize + 'px'
  meterCanvas.style.height = meterSize + 'px'
  meterCanvas.width = meterSize * dpr
  meterCanvas.height = meterSize * dpr
  meterCtx.scale(dpr, dpr)
}

function resizeParticle() {
  if (!pCanvas) return
  const rect = pCanvas.parentElement.getBoundingClientRect()
  pW = rect.width; pH = rect.height
  pCanvas.style.width = pW + 'px'
  pCanvas.style.height = pH + 'px'
  pCanvas.width = pW * dpr
  pCanvas.height = pH * dpr
  pCtx.scale(dpr, dpr)
}

function onResize() { resizeMeter(); resizeParticle() }

function getRMS(data) {
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128
    sum += v * v
  }
  return Math.sqrt(sum / data.length)
}

function drawMeter(lvl) {
  const m = meterSize
  const cx = m / 2, cy = m / 2
  const r = m * 0.42

  meterCtx.clearRect(0, 0, m, m)

  // Background ring
  meterCtx.beginPath()
  meterCtx.arc(cx, cy, r, 0, Math.PI * 2)
  meterCtx.strokeStyle = 'rgba(255,255,255,0.05)'
  meterCtx.lineWidth = 16
  meterCtx.stroke()

  // Colored arc
  const startAngle = -Math.PI * 0.75
  const endAngle = startAngle + Math.max(0.01, lvl) * Math.PI * 1.5
  const hue = 120 - lvl * 120
  meterCtx.beginPath()
  meterCtx.arc(cx, cy, r, startAngle, endAngle)
  meterCtx.strokeStyle = `hsl(${hue}, 90%, 55%)`
  meterCtx.lineWidth = 16
  meterCtx.lineCap = 'round'
  meterCtx.shadowColor = `hsl(${hue}, 90%, 55%)`
  meterCtx.shadowBlur = 20
  meterCtx.stroke()
  meterCtx.shadowBlur = 0

  // Tick marks
  meterCtx.lineWidth = 2
  meterCtx.strokeStyle = 'rgba(255,255,255,0.1)'
  for (let i = 0; i <= 10; i++) {
    const angle = startAngle + (i / 10) * Math.PI * 1.5
    const inner = r - 20
    meterCtx.beginPath()
    meterCtx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner)
    meterCtx.lineTo(cx + Math.cos(angle) * (r + 2), cy + Math.sin(angle) * (r + 2))
    meterCtx.stroke()
  }

  // Needle
  const needleAngle = startAngle + lvl * Math.PI * 1.5
  meterCtx.beginPath()
  meterCtx.moveTo(cx, cy)
  meterCtx.lineTo(cx + Math.cos(needleAngle) * (r - 28), cy + Math.sin(needleAngle) * (r - 28))
  meterCtx.strokeStyle = '#fff'
  meterCtx.lineWidth = 3
  meterCtx.lineCap = 'round'
  meterCtx.stroke()

  // Center dot
  meterCtx.beginPath()
  meterCtx.arc(cx, cy, 6, 0, Math.PI * 2)
  meterCtx.fillStyle = '#fff'
  meterCtx.fill()
}

function triggerDamage() {
  if (damageFired) return
  damageFired = true

  if (damageEl) {
    damageEl.classList.add('show')
    setTimeout(() => { if (damageEl) { damageEl.classList.remove('show'); damageFired = false } }, 1600)
  }
  if (flashEl) {
    flashEl.style.opacity = '0.5'
    setTimeout(() => { if (flashEl) flashEl.style.opacity = '0' }, 150)
    setTimeout(() => { if (flashEl) flashEl.style.opacity = '0.3' }, 250)
    setTimeout(() => { if (flashEl) flashEl.style.opacity = '0' }, 350)
  }

  if (particles) {
    for (let i = 0; i < 6; i++) {
      particles.emit(
        Math.random() * pW,
        Math.random() * pH * 0.6,
        25,
        { colors: ['#ff2d55', '#ff6b35', '#ffaa00', '#fff'], speed: 12, gravity: 0.35, lifetime: 70, size: 6, sizeVariance: 4 }
      )
    }
  }
}

function loop() {
  raf = requestAnimationFrame(loop)

  if (listening && analyser && dataArray) {
    analyser.getByteTimeDomainData(dataArray)
    const rms = getRMS(dataArray)
    const target = Math.min(1, rms * 6)
    level = level * 0.7 + target * 0.3
  } else {
    level = Math.max(0, level - 0.015)
    if (tapLevel > 0) {
      level = Math.max(level, tapLevel)
      tapLevel = Math.max(0, tapLevel - 0.04)
    }
  }

  if (level > peakLevel) {
    peakLevel = level
    if (peakEl) peakEl.innerHTML = `最高紀錄：<span>${Math.round(peakLevel * 100)}%</span>`
  }

  drawMeter(level)

  if (levelTextEl) levelTextEl.textContent = Math.round(level * 100) + '%'

  if (bgEl) {
    const a = level * 0.22
    bgEl.style.background = `radial-gradient(ellipse at 50% 50%, rgba(255,45,85,${a}) 0%, transparent 60%)`
  }

  if (level > 0.7 && container) {
    const c = container.querySelector('.scream-container')
    if (c) c.style.transform = `translateX(${(Math.random()-0.5) * level * 8}px)`
  } else if (container) {
    const c = container.querySelector('.scream-container')
    if (c) c.style.transform = ''
  }

  if (level > 0.92 && !damageFired) triggerDamage()

  // Draw particles on full-screen canvas
  if (pCtx && particles) {
    pCtx.clearRect(0, 0, pW, pH)
    particles.update()
    particles.draw()
  }
}

async function startListening(startBtn, tapBtn) {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    resumeAudio()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    dataArray = new Uint8Array(analyser.frequencyBinCount)
    audioCtx.createMediaStreamSource(stream).connect(analyser)
    listening = true
    if (statusEl) { statusEl.textContent = '偵測中……用力叫！🎤'; statusEl.className = 'scream-status listening' }
    if (recordEl) recordEl.classList.add('visible')
    startBtn.textContent = '⏹'
  } catch {
    listening = false
    if (statusEl) statusEl.textContent = '無法存取麥克風。點擊下方按鈕代替！'
    if (tapBtn) tapBtn.style.display = 'block'
  }
}

function stopListening(startBtn) {
  listening = false
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
  if (audioCtx) { audioCtx.close(); audioCtx = null }
  analyser = null
  if (statusEl) { statusEl.textContent = '按按鈕開始偵測'; statusEl.className = 'scream-status' }
  if (recordEl) recordEl.classList.remove('visible')
  startBtn.textContent = '🎤'
}

export function init(cont) {
  container = cont
  level = 0; peakLevel = 0; tapLevel = 0; damageFired = false

  cont.innerHTML = `
    <div class="scream-container">
      <div class="scream-bg-pulse"></div>
      <div class="scream-flash-overlay"></div>
      <canvas class="scream-particle-canvas" style="position:absolute;inset:0;pointer-events:none;z-index:5;"></canvas>

      <div class="scream-title">壓力計</div>
      <div class="scream-meter-wrap">
        <canvas class="scream-canvas"></canvas>
      </div>
      <div class="scream-level-text">0%</div>

      <div class="scream-controls">
        <div class="scream-record">● REC</div>
        <button class="scream-start-btn" title="開始偵測">🎤</button>
        <button class="scream-tap-btn" title="用力拍！" style="display:none">👊</button>
        <div class="scream-status">按按鈕開始偵測麥克風</div>
      </div>

      <div class="scream-peak">最高紀錄：<span>0%</span></div>
      <div class="scream-damage-text">EMOTIONAL DAMAGE!</div>
    </div>
  `

  meterCanvas = cont.querySelector('.scream-canvas')
  meterCtx = meterCanvas.getContext('2d')
  pCanvas = cont.querySelector('.scream-particle-canvas')
  pCtx = pCanvas.getContext('2d')
  particles = createParticleSystem(pCanvas)
  damageEl = cont.querySelector('.scream-damage-text')
  flashEl = cont.querySelector('.scream-flash-overlay')
  bgEl = cont.querySelector('.scream-bg-pulse')
  statusEl = cont.querySelector('.scream-status')
  levelTextEl = cont.querySelector('.scream-level-text')
  peakEl = cont.querySelector('.scream-peak')
  recordEl = cont.querySelector('.scream-record')

  setTimeout(() => { resizeMeter(); resizeParticle() }, 30)
  window.addEventListener('resize', onResize)

  const startBtn = cont.querySelector('.scream-start-btn')
  const tapBtn = cont.querySelector('.scream-tap-btn')

  startBtn.addEventListener('click', () => {
    if (listening) stopListening(startBtn)
    else startListening(startBtn, tapBtn)
  })

  tapBtn.addEventListener('pointerdown', () => {
    tapLevel = Math.min(1, tapLevel + 0.35)
    if (tapLevel > 0.92) triggerDamage()
  })

  raf = requestAnimationFrame(loop)
}

export function destroy() {
  cancelAnimationFrame(raf)
  if (stream) stream.getTracks().forEach(t => t.stop())
  if (audioCtx) audioCtx.close()
  window.removeEventListener('resize', onResize)
  listening = false; stream = null; audioCtx = null; analyser = null
  raf = null; meterCanvas = null; meterCtx = null; pCanvas = null; pCtx = null
  particles = null; container = null; damageEl = null; flashEl = null
  bgEl = null; statusEl = null; levelTextEl = null; peakEl = null; recordEl = null
}
