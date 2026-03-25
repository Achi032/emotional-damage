// ===== Tear Paper Mode =====
import { synth, resumeAudio } from '../utils/sound.js'

let canvas = null
let ctx = null
let raf = null
let tearing = false
let tearPath = []
let tearDone = false
let tearCount = 0
let countEl = null
let container = null
let w = 0, h = 0, dpr = 1

// Paper content lines (fake work document)
const DOC_LINES = [
  '本週工作報告',
  '─────────────────',
  '完成項目：23 項待完成',
  '下週目標：39 項未確認',
  '加班時數：太多了',
  '睡眠時數：不夠',
  '身心狀態：需要放假',
  '─────────────────',
  '主管意見：再衝一下',
  '個人意見：？？？',
  '',
  '附件：1個靈魂（已售完）',
]

// Paper geometry
const PAD_X = 0.15, PAD_Y = 0.1
let pW = 0, pH = 0, pX = 0, pY = 0

// Falling pieces after tear
let pieces = []

function resize() {
  dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  w = rect.width
  h = rect.height
  canvas.width = w * dpr
  canvas.height = h * dpr
  ctx.scale(dpr, dpr)
  computePaper()
  if (!tearing && !tearDone) drawPaper()
}

function computePaper() {
  pW = w * (1 - PAD_X * 2)
  pH = h * (1 - PAD_Y * 2)
  pX = w * PAD_X
  pY = h * PAD_Y
}

function drawPaper(tearLinePoints) {
  ctx.clearRect(0, 0, w, h)
  ctx.save()

  if (tearLinePoints && tearLinePoints.length > 1) {
    // Draw left piece (clip to left of tear line)
    drawPaperPiece(tearLinePoints, 'left')
    drawPaperPiece(tearLinePoints, 'right')
  } else {
    // Draw intact paper
    drawFullPaper()
  }
  ctx.restore()
}

function drawFullPaper() {
  // Paper shadow
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 8

  ctx.fillStyle = '#f0ead8'
  ctx.beginPath()
  ctx.roundRect(pX, pY, pW, pH, 4)
  ctx.fill()
  ctx.shadowColor = 'transparent'

  // Ruled lines
  ctx.strokeStyle = 'rgba(0,0,100,0.08)'
  ctx.lineWidth = 1
  const lineSpacing = 24
  for (let ly = pY + 50; ly < pY + pH - 10; ly += lineSpacing) {
    ctx.beginPath()
    ctx.moveTo(pX + 15, ly)
    ctx.lineTo(pX + pW - 15, ly)
    ctx.stroke()
  }

  // Text
  ctx.fillStyle = '#2a2a3a'
  ctx.font = `bold ${Math.min(16, pW * 0.03)}px "Noto Sans TC", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(DOC_LINES[0], pX + pW / 2, pY + 30)

  ctx.font = `${Math.min(13, pW * 0.025)}px "Noto Sans TC", monospace`
  ctx.textAlign = 'left'
  const startY = pY + 60
  DOC_LINES.slice(1).forEach((line, i) => {
    ctx.fillText(line, pX + 20, startY + i * 22)
  })
}

function buildTearClipPath(pts, side) {
  ctx.beginPath()
  if (side === 'left') {
    ctx.moveTo(pX, pY)
    // Go down tear line
    ctx.lineTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y)
    }
    ctx.lineTo(pts[pts.length - 1].x, pY + pH)
    ctx.lineTo(pX, pY + pH)
    ctx.closePath()
  } else {
    ctx.moveTo(pX + pW, pY)
    ctx.lineTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y)
    }
    ctx.lineTo(pts[pts.length - 1].x, pY + pH)
    ctx.lineTo(pX + pW, pY + pH)
    ctx.closePath()
  }
}

function drawPaperPiece(pts, side) {
  ctx.save()
  buildTearClipPath(pts, side)
  ctx.clip()
  drawFullPaper()
  ctx.restore()

  // Tear edge (rough)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y)
  }
  ctx.strokeStyle = 'rgba(200,190,170,0.9)'
  ctx.lineWidth = 2
  ctx.setLineDash([2, 3])
  ctx.stroke()
  ctx.restore()
}

function buildRoughTearPath(rawPts) {
  // Add ±noise to simulate ragged tear
  return rawPts.map((p, i) => ({
    x: p.x + (Math.random() - 0.5) * 16,
    y: p.y + (Math.random() - 0.5) * 8,
  }))
}

// Falling piece animation
function startFallAnimation(pts) {
  pieces = [
    { side: 'left',  x: 0,  y: 0, vx: -1.5, vy: 1, rot: 0, rotV: -0.8, opacity: 1 },
    { side: 'right', x: 0,  y: 0, vx:  1.5, vy: 1.2, rot: 0, rotV: 0.9, opacity: 1 },
  ]
  const roughPts = buildRoughTearPath(pts)

  function fallLoop() {
    if (!canvas) return
    ctx.clearRect(0, 0, w, h)
    let allGone = true

    for (const p of pieces) {
      if (p.opacity <= 0) continue
      allGone = false
      p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.rot += p.rotV; p.opacity -= 0.015

      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.translate(w / 2, h / 2)
      ctx.rotate(p.rot * Math.PI / 180)
      ctx.translate(-w / 2, -h / 2)
      ctx.translate(p.x, p.y)
      buildTearClipPath(roughPts, p.side)
      ctx.clip()
      drawFullPaper()
      ctx.restore()
    }

    if (allGone) {
      tearDone = false
      tearing = false
      tearPath = []
      pieces = []
      drawPaper()
    } else {
      raf = requestAnimationFrame(fallLoop)
    }
  }
  fallLoop()
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect()
  if (e.touches) {
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
  }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function inPaper(x, y) {
  return x >= pX && x <= pX + pW && y >= pY && y <= pY + pH
}

function onDown(e) {
  const pos = getPos(e)
  if (!inPaper(pos.x, pos.y)) return
  e.preventDefault()
  resumeAudio()
  tearing = true
  tearDone = false
  tearPath = [pos]
  cancelAnimationFrame(raf)
}

function onMove(e) {
  if (!tearing) return
  e.preventDefault()
  const pos = getPos(e)
  tearPath.push(pos)
  drawPaper(tearPath)
}

function onUp(e) {
  if (!tearing) return
  tearing = false
  if (tearPath.length > 10) {
    tearDone = true
    tearCount++
    if (countEl) countEl.textContent = `📄 撕了 ${tearCount} 份`
    synth('tear')
    const roughPts = buildRoughTearPath(tearPath)
    setTimeout(() => startFallAnimation(roughPts), 200)
  } else {
    tearPath = []
    drawPaper()
  }
}

export function init(cont) {
  container = cont
  tearCount = 0
  tearPath = []
  tearing = false
  tearDone = false
  pieces = []

  cont.innerHTML = `
    <div class="tear-container">
      <canvas class="tear-canvas"></canvas>
      <div class="tear-count">📄 撕了 0 份</div>
      <div class="tear-hint">用滑鼠或手指在文件上拖動來撕裂它</div>
    </div>
  `

  canvas = cont.querySelector('.tear-canvas')
  ctx = canvas.getContext('2d')
  countEl = cont.querySelector('.tear-count')

  // Size canvas to fit container
  function fitCanvas() {
    const c = cont.querySelector('.tear-container')
    const rect = c.getBoundingClientRect()
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'
    resize()
  }
  setTimeout(fitCanvas, 30)
  window.addEventListener('resize', fitCanvas)

  canvas.addEventListener('mousedown', onDown)
  canvas.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  canvas.addEventListener('touchstart', onDown, { passive: false })
  canvas.addEventListener('touchmove', onMove, { passive: false })
  window.addEventListener('touchend', onUp)
}

export function destroy() {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', () => {})
  if (canvas) {
    canvas.removeEventListener('mousedown', onDown)
    canvas.removeEventListener('mousemove', onMove)
    canvas.removeEventListener('touchstart', onDown)
    canvas.removeEventListener('touchmove', onMove)
  }
  window.removeEventListener('mouseup', onUp)
  window.removeEventListener('touchend', onUp)
  raf = null
  canvas = null
  ctx = null
  container = null
}
