// ===== EmotionalDamage — App Router =====

const menuView = document.getElementById('menu-view')
const modeView = document.getElementById('mode-view')
const modeContainer = document.getElementById('mode-container')
const backBtn = document.getElementById('back-btn')
const totalReleased = document.getElementById('total-released')

let currentDestroy = null

const modeMap = {
  text:    () => import('./modes/text-burn.js'),
  smash:   () => import('./modes/smash.js'),
  bubbles: () => import('./modes/bubbles.js'),
  scream:  () => import('./modes/scream.js'),
  tear:    () => import('./modes/tear.js'),
}

async function navigate() {
  const hash = location.hash.slice(1)

  // destroy current mode
  if (typeof currentDestroy === 'function') {
    currentDestroy()
    currentDestroy = null
  }
  modeContainer.innerHTML = ''

  if (hash && modeMap[hash]) {
    menuView.classList.remove('active')
    modeView.classList.add('active')

    try {
      const mod = await modeMap[hash]()
      currentDestroy = mod.destroy ?? null
      mod.init(modeContainer)
    } catch (e) {
      modeContainer.innerHTML = `<p style="color:var(--accent-red);padding:2rem">載入失敗：${e.message}</p>`
    }
  } else {
    modeView.classList.remove('active')
    menuView.classList.add('active')
    updateTotalReleased()
  }
}

backBtn.addEventListener('click', () => { location.hash = '' })
window.addEventListener('hashchange', navigate)

// Mode card clicks
document.querySelectorAll('.mode-card').forEach(btn => {
  btn.addEventListener('click', () => {
    location.hash = btn.dataset.mode
  })
})

function updateTotalReleased() {
  const n = parseInt(localStorage.getItem('ed_total_chars') || '0')
  if (n > 0) {
    totalReleased.textContent = `你已經釋放了 ${n.toLocaleString()} 字的壓力`
  }
}

// init
navigate()
