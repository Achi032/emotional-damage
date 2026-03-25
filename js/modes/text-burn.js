// ===== Text Burn Mode =====
import { createParticleSystem } from '../utils/particles.js'
import { synth, resumeAudio } from '../utils/sound.js'

let raf = null
let canvas = null
let ctx = null
let particles = null
let selectedMethod = 'burn'
let textarea = null
let submitBtn = null
let statEl = null
let animating = false

function getTotalChars() {
  return parseInt(localStorage.getItem('ed_total_chars') || '0')
}
function addChars(n) {
  localStorage.setItem('ed_total_chars', getTotalChars() + n)
}

function updateStat() {
  const n = getTotalChars()
  if (statEl) statEl.innerHTML = n > 0
    ? `你已經釋放了 <span>${n.toLocaleString()}</span> 字的壓力`
    : '寫下任何你想說的，然後毀掉它。'
}

// Flame particle loop
function startFlameLoop(wrap) {
  const rect = wrap.getBoundingClientRect()
  const containerRect = wrap.parentElement.getBoundingClientRect()
  const offX = rect.left - containerRect.left
  const offY = rect.top - containerRect.top

  let t = 0
  function flameLoop() {
    if (!canvas || !animating) return
    raf = requestAnimationFrame(flameLoop)
    ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1))
    t++
    // Emit flame particles along bottom of textarea
    if (t < 60) {
      const count = 4 + Math.floor(Math.random() * 4)
      const px = offX + Math.random() * rect.width
      const py = offY + rect.height
      particles.emit(px, py, count, {
        colors: ['#ff2d00', '#ff6b35', '#ffaa00', '#ffdd00', '#fff'],
        speed: 3 + Math.random() * 3,
        gravity: -0.15,
        lifetime: 50,
        size: 5,
        sizeVariance: 4,
        angle: -Math.PI / 2,
        spread: Math.PI * 0.6,
      })
    }
    particles.update()
    particles.draw()
  }
  flameLoop()
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
    setTimeout(reset, 1300)

  } else if (selectedMethod === 'scatter') {
    scatterWords(text, wrap)
    setTimeout(reset, 1200)

  } else if (selectedMethod === 'space') {
    textarea.classList.add('launching')
    synth('whoosh')
    setTimeout(reset, 1100)
  }
}

function scatterWords(text, wrap) {
  const words = text.replace(/\n/g, ' ').split(/\s+/).filter(Boolean)
  const overlay = wrap.querySelector('.text-scatter-overlay')
  const rect = textarea.getBoundingClientRect()
  const wrapRect = wrap.getBoundingClientRect()

  textarea.style.opacity = '0'

  words.forEach((word, i) => {
    const span = document.createElement('span')
    span.className = 'scatter-word'
    span.textContent = word
    const x = Math.random() * (rect.width - 60)
    const y = Math.random() * (rect.height - 20)
    span.style.left = (rect.left - wrapRect.left + x) + 'px'
    span.style.top = (rect.top - wrapRect.top + y) + 'px'
    const tx = (Math.random() - 0.5) * 400
    const ty = (Math.random() - 0.5) * 400
    span.style.setProperty('--scatter-to', `translate(${tx}px, ${ty}px) rotate(${(Math.random()-0.5)*180}deg) scale(0)`)
    span.style.setProperty('--delay', `${i * 0.02}s`)
    overlay.appendChild(span)
  })
}

function reset() {
  animating = false
  if (!textarea) return
  textarea.classList.remove('burning', 'scatter', 'launching')
  textarea.style.opacity = ''
  textarea.style.animation = ''
  textarea.value = ''
  if (submitBtn) submitBtn.disabled = false
  if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (particles) particles.clear()
  const overlay = document.querySelector('.text-scatter-overlay')
  if (overlay) overlay.innerHTML = ''
  updateStat()
  cancelAnimationFrame(raf)
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
  selectedMethod = 'burn'

  // Setup canvas size
  const dpr = window.devicePixelRatio || 1
  function resizeCanvas() {
    const wrap = container.querySelector('.text-burn-textarea-wrap')
    const rect = wrap.getBoundingClientRect()
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
  }
  setTimeout(resizeCanvas, 50)
  window.addEventListener('resize', resizeCanvas)

  particles = createParticleSystem(canvas)

  // Method buttons
  container.querySelectorAll('.destroy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMethod = btn.dataset.method
      container.querySelectorAll('.destroy-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
    })
  })

  const wrap = container.querySelector('.text-burn-textarea-wrap')
  submitBtn.addEventListener('click', () => doDestroy(wrap))
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doDestroy(wrap)
  })

  updateStat()

  return () => { window.removeEventListener('resize', resizeCanvas) }
}

export function destroy() {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', () => {})
  raf = null
  canvas = null
  ctx = null
  particles = null
  textarea = null
  submitBtn = null
  statEl = null
  animating = false
}
