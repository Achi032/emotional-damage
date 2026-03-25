// ===== Text Burn Mode =====
import { createParticleSystem } from '../utils/particles.js'
import { synth, resumeAudio } from '../utils/sound.js'
import { waitForSize } from '../utils/dom.js'

let raf = null
let canvas = null
let ctx = null
let particles = null
let selectedMethod = 'burn'
let textarea = null
let submitBtn = null
let statEl = null
let animating = false
let resizeRO = null

const QUOTES = [
  '說出來真的有用的。',
  '你已經做得很好了。',
  '那些話不配繼續佔據你的腦袋。',
  '燒掉它，繼續走。',
  '不需要留著它。',
  '壓力清除完成。',
  '你比你想的更強。',
  '煩惱已成灰燼。',
]

const FLAME_COLORS_POOL = [
  ['#ff2d00', '#ff6b35', '#ffaa00', '#ffdd00', '#fff'],
  ['#ff0055', '#ff6b35', '#ff00aa', '#ffdd00', '#fff'],
  ['#00ddff', '#0055ff', '#7b2fff', '#fff'],
]

function getTotalChars() { return parseInt(localStorage.getItem('ed_total_chars') || '0') }
function addChars(n) { localStorage.setItem('ed_total_chars', getTotalChars() + n) }

function updateStat(afterRelease) {
  const n = getTotalChars()
  if (afterRelease) {
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)]
    if (statEl) statEl.innerHTML = `<span style="color:var(--accent-orange)">${quote}</span> 累計 ${n.toLocaleString()} 字`
  } else {
    if (statEl) statEl.innerHTML = n > 0
      ? `你已經釋放了 <span>${n.toLocaleString()}</span> 字的壓力`
      : '寫下任何你想說的，然後毀掉它。'
  }
}

function setupCanvas() {
  if (!canvas) return
  const wrap = canvas.parentElement
  const rect = wrap.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const cw = rect.width || wrap.offsetWidth || 600
  const ch = rect.height || wrap.offsetHeight || 300
  canvas.style.width = cw + 'px'
  canvas.style.height = ch + 'px'
  canvas.width = cw * dpr
  canvas.height = ch * dpr
  ctx.scale(dpr, dpr)
}

function startFlameLoop(wrap) {
  const palette = FLAME_COLORS_POOL[Math.floor(Math.random() * FLAME_COLORS_POOL.length)]
  let t = 0
  function flameLoop() {
    if (!canvas || !animating) return
    raf = requestAnimationFrame(flameLoop)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    t++
    if (t < 70) {
      const wrapRect = wrap.getBoundingClientRect()
      const canvRect = canvas.getBoundingClientRect()
      const offX = wrapRect.left - canvRect.left
      const offY = wrapRect.top - canvRect.top
      const count = 5 + Math.floor(Math.random() * 5)
      const px = offX + Math.random() * wrapRect.width
      const py = offY + wrapRect.height
      particles.emit(px, py, count, {
        colors: palette,
        speed: 3 + Math.random() * 4,
        gravity: -0.18,
        lifetime: 55,
        size: 6,
        sizeVariance: 5,
        angle: -Math.PI / 2,
        spread: Math.PI * 0.65,
        trail: true,
      })
    }
    particles.update()
    particles.draw()
  }
  flameLoop()
}

function scatterWords(text, wrap) {
  const words = text.replace(/\n/g, ' ').split(/\s+/).filter(Boolean)
  const overlay = wrap.querySelector('.text-scatter-overlay')
  const textareaRect = textarea.getBoundingClientRect()
  const wrapRect = wrap.getBoundingClientRect()
  textarea.style.opacity = '0'

  words.forEach((word, i) => {
    const span = document.createElement('span')
    span.className = 'scatter-word'
    span.textContent = word
    const x = Math.random() * (textareaRect.width - 60)
    const y = Math.random() * (textareaRect.height - 20)
    span.style.left = (textareaRect.left - wrapRect.left + x) + 'px'
    span.style.top  = (textareaRect.top  - wrapRect.top  + y) + 'px'
    const tx = (Math.random() - 0.5) * (600 + Math.random() * 400)
    const ty = (Math.random() - 0.5) * (400 + Math.random() * 400)
    const rot = (Math.random() - 0.5) * 360
    span.style.setProperty('--scatter-to', `translate(${tx}px,${ty}px) rotate(${rot}deg) scale(0)`)
    span.style.setProperty('--delay', `${i * 0.015}s`)
    overlay.appendChild(span)
  })
}

function doDestroy(wrap) {
  if (animating) return
  const text = textarea.value.trim()
  if (!text) {
    textarea.style.animation = 'shake 0.4s ease'
    setTimeout(() => { if (textarea) textarea.style.animation = '' }, 400)
    return
  }

  animating = true
  submitBtn.disabled = true
  addChars(text.length)
  resumeAudio()

  if (selectedMethod === 'burn') {
    textarea.classList.add('burning')
    synth('burn')
    startFlameLoop(wrap)
    setTimeout(reset, 1400)
  } else if (selectedMethod === 'scatter') {
    scatterWords(text, wrap)
    setTimeout(reset, 1300)
  } else if (selectedMethod === 'space') {
    textarea.classList.add('launching')
    synth('whoosh')
    setTimeout(reset, 1200)
  }
}

function reset() {
  animating = false
  cancelAnimationFrame(raf)
  if (!textarea) return
  textarea.classList.remove('burning', 'scatter', 'launching')
  textarea.style.opacity = ''
  textarea.style.animation = ''
  textarea.value = ''
  if (submitBtn) submitBtn.disabled = false
  if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (particles) particles.clear()
  const overlay = document.querySelector('.text-scatter-overlay')
  if (overlay) overlay.innerHTML = ''
  updateStat(true)
}

export function init(container) {
  animating = false

  container.innerHTML = `
    <div class="text-burn-container">
      <div class="text-burn-title">說出來，然後毀掉它</div>

      <div class="text-burn-textarea-wrap">
        <textarea class="text-burn-textarea"
          placeholder="寫下你的委屈、憤怒、煩躁，或任何他媽的廢話……"
          rows="7"
        ></textarea>
        <canvas class="text-burn-canvas"></canvas>
        <div class="text-scatter-overlay"></div>
      </div>

      <div class="destroy-method">
        <button class="destroy-btn active" data-method="burn">🔥 燒掉它</button>
        <button class="destroy-btn" data-method="scatter">💢 粉碎</button>
        <button class="destroy-btn" data-method="space">🚀 送入太空</button>
      </div>

      <button class="text-burn-submit">釋放</button>
      <div class="text-burn-stat"></div>
    </div>
  `

  textarea = container.querySelector('.text-burn-textarea')
  submitBtn = container.querySelector('.text-burn-submit')
  statEl = container.querySelector('.text-burn-stat')
  canvas = container.querySelector('.text-burn-canvas')
  ctx = canvas.getContext('2d')
  particles = createParticleSystem(canvas)
  selectedMethod = 'burn'

  const wrap = container.querySelector('.text-burn-textarea-wrap')

  // Use ResizeObserver for canvas sizing
  resizeRO = new ResizeObserver(() => setupCanvas())
  resizeRO.observe(wrap)
  waitForSize(wrap, setupCanvas)

  container.querySelectorAll('.destroy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMethod = btn.dataset.method
      container.querySelectorAll('.destroy-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
    })
  })

  submitBtn.addEventListener('click', () => doDestroy(wrap))
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doDestroy(wrap)
  })

  updateStat(false)
}

export function destroy() {
  cancelAnimationFrame(raf)
  if (resizeRO) { resizeRO.disconnect(); resizeRO = null }
  raf = null; canvas = null; ctx = null; particles = null
  textarea = null; submitBtn = null; statEl = null; animating = false
}
