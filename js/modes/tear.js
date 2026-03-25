// ===== Tear Paper Mode =====
import { synth, resumeAudio } from '../utils/sound.js'
import { waitForSize } from '../utils/dom.js'

let canvas = null
let ctx = null
let raf = null
let tearing = false
let tearPath = []
let tearCount = 0
let countEl = null
let container = null
let w = 0, h = 0, dpr = 1

const PAD_X = 0.12, PAD_Y = 0.08
let pW = 0, pH = 0, pX = 0, pY = 0

const DOCS = [
  {
    title: '本週工作報告',
    lines: [
      '完成項目：23 項 / 待完成：無限多',
      '下週目標：活著就好',
      '加班時數：已超過人道標準',
      '睡眠時數：不夠',
      '身心狀態：瀕臨崩潰',
      '────────────────',
      '主管意見：再衝一下',
      '個人意見：？？？',
      '',
      '附件：1個靈魂（已售完）',
    ]
  },
  {
    title: 'OKR 季度目標',
    lines: [
      'O1：做到死也要達成 100%',
      'KR1.1：開更多會議來討論開會',
      'KR1.2：寫報告來說明為何沒進度',
      'KR1.3：把焦慮轉化為生產力',
      '────────────────',
      'O2：讓自己看起來很忙',
      'KR2.1：隨時在線上',
      'KR2.2：訊息秒回（含凌晨）',
      '',
      '負責人：就是你',
    ]
  },
  {
    title: '加班申請表（第 N 次）',
    lines: [
      '申請人：已不記得自己是誰',
      '加班原因：因為沒別人做',
      '預計完成時間：不知道',
      '實際完成時間：下輩子',
      '────────────────',
      '主管簽名：____________',
      '（主管已離職）',
      '',
      '備註：加班費請自行吸收',
      '謝謝您的奉獻',
    ]
  },
  {
    title: '年度績效考核',
    lines: [
      '工作態度：還算可以',
      '工作產出：不夠多',
      '工作時數：可以更多',
      '薪資調整：0%（維持原薪）',
      '────────────────',
      '主管評語：',
      '「你還有很大的成長空間」',
      '',
      '員工心聲欄：',
      '（此欄不會有人看）',
    ]
  }
]

let currentDoc = null

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
  computePaper()
}

function computePaper() {
  pW = w * (1 - PAD_X * 2)
  pH = h * (1 - PAD_Y * 2)
  pX = w * PAD_X
  pY = h * PAD_Y
}

function drawFullPaper() {
  if (!currentDoc) return
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 6

  ctx.fillStyle = '#f0ead8'
  ctx.beginPath()
  ctx.roundRect(pX, pY, pW, pH, 3)
  ctx.fill()
  ctx.shadowColor = 'transparent'

  // Ruled lines
  ctx.strokeStyle = 'rgba(0,0,100,0.07)'
  ctx.lineWidth = 1
  const ls = 24
  for (let ly = pY + 52; ly < pY + pH - 8; ly += ls) {
    ctx.beginPath()
    ctx.moveTo(pX + 12, ly)
    ctx.lineTo(pX + pW - 12, ly)
    ctx.stroke()
  }

  // Red margin line
  ctx.strokeStyle = 'rgba(255,80,80,0.3)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(pX + 38, pY + 10)
  ctx.lineTo(pX + 38, pY + pH - 10)
  ctx.stroke()

  // Title
  const titleSize = Math.min(15, pW * 0.032)
  ctx.fillStyle = '#1a1a2e'
  ctx.font = `bold ${titleSize}px "Noto Sans TC", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(currentDoc.title, pX + pW / 2, pY + 28)

  // Lines
  ctx.font = `${Math.min(12, pW * 0.024)}px "Noto Sans TC", monospace`
  ctx.textAlign = 'left'
  ctx.fillStyle = '#2a2040'
  const startY = pY + 55
  currentDoc.lines.forEach((line, i) => {
    ctx.fillText(line, pX + 46, startY + i * ls)
  })
}

function buildClipPath(pts, side) {
  ctx.beginPath()
  if (side === 'left') {
    ctx.moveTo(pX, pY)
    ctx.lineTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.lineTo(pts[pts.length-1].x, pY + pH)
    ctx.lineTo(pX, pY + pH)
  } else {
    ctx.moveTo(pX + pW, pY)
    ctx.lineTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.lineTo(pts[pts.length-1].x, pY + pH)
    ctx.lineTo(pX + pW, pY + pH)
  }
  ctx.closePath()
}

function drawPaper(tearPts) {
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  if (tearPts && tearPts.length > 1) {
    ctx.save(); buildClipPath(tearPts, 'left'); ctx.clip(); drawFullPaper(); ctx.restore()
    ctx.save(); buildClipPath(tearPts, 'right'); ctx.clip(); drawFullPaper(); ctx.restore()
    // Tear edge highlight
    ctx.beginPath()
    ctx.moveTo(tearPts[0].x, tearPts[0].y)
    for (let i = 1; i < tearPts.length; i++) ctx.lineTo(tearPts[i].x, tearPts[i].y)
    ctx.strokeStyle = 'rgba(210,195,170,0.85)'
    ctx.lineWidth = 2.5
    ctx.setLineDash([2, 4])
    ctx.stroke()
    ctx.setLineDash([])
  } else {
    drawFullPaper()
  }
  ctx.restore()
}

function noisyPath(rawPts) {
  return rawPts.map(p => ({
    x: p.x + (Math.random() - 0.5) * 18,
    y: p.y + (Math.random() - 0.5) * 10,
  }))
}

let pieces = []

function startFall(pts) {
  const roughPts = noisyPath(pts)
  const rotSpeeds = [(Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5]
  pieces = [
    { side: 'left',  x: 0, y: 0, vx: -1.8 - Math.random(), vy: 0.8 + Math.random(), rot: 0, rotV: rotSpeeds[0], opacity: 1 },
    { side: 'right', x: 0, y: 0, vx:  1.8 + Math.random(), vy: 1.0 + Math.random(), rot: 0, rotV: rotSpeeds[1], opacity: 1 },
  ]

  function fallLoop() {
    if (!canvas) return
    ctx.clearRect(0, 0, w, h)
    let allGone = true
    for (const p of pieces) {
      if (p.opacity <= 0) continue
      allGone = false
      p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.rot += p.rotV; p.opacity -= 0.012
      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.translate(w / 2, h / 2)
      ctx.rotate(p.rot * Math.PI / 180)
      ctx.translate(-w / 2 + p.x, -h / 2 + p.y)
      buildClipPath(roughPts, p.side)
      ctx.clip()
      drawFullPaper()
      ctx.restore()
    }
    if (allGone) {
      pieces = []; tearing = false; tearPath = []
      currentDoc = DOCS[Math.floor(Math.random() * DOCS.length)]
      drawPaper()
    } else {
      raf = requestAnimationFrame(fallLoop)
    }
  }
  fallLoop()
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect()
  if (e.touches) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
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
  tearPath = [pos]
  cancelAnimationFrame(raf)
}

function onMove(e) {
  if (!tearing) return
  e.preventDefault()
  tearPath.push(getPos(e))
  drawPaper(tearPath)
}

function onUp() {
  if (!tearing) return
  tearing = false
  if (tearPath.length > 8) {
    tearCount++
    if (countEl) countEl.textContent = `📄 撕了 ${tearCount} 份`
    synth('tear')
    const roughPts = noisyPath(tearPath)
    setTimeout(() => startFall(roughPts), 150)
  } else {
    tearPath = []
    drawPaper()
  }
}

export function init(cont) {
  container = cont
  tearCount = 0; tearPath = []; tearing = false; pieces = []
  currentDoc = DOCS[Math.floor(Math.random() * DOCS.length)]

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

  canvas.addEventListener('mousedown', onDown)
  canvas.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  canvas.addEventListener('touchstart', onDown, { passive: false })
  canvas.addEventListener('touchmove', onMove, { passive: false })
  window.addEventListener('touchend', onUp)

  waitForSize(cont.querySelector('.tear-container'), () => {
    resize()
    window.addEventListener('resize', () => { resize(); drawPaper() })
    drawPaper()
  })
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
  raf = null; canvas = null; ctx = null; container = null
}
