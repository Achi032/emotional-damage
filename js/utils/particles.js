// ===== Shared Particle System =====

export function createParticleSystem(canvas) {
  const ctx = canvas.getContext('2d')
  const particles = []

  function emit(x, y, count, opts = {}) {
    const {
      color = '#ff6b35',
      colors = null,
      speed = 5,
      gravity = 0.3,
      lifetime = 75,
      size = 6,
      sizeVariance = 3,
      spread = Math.PI * 2,
      angle = 0,
      trail = false,
    } = opts

    for (let i = 0; i < count; i++) {
      const dir = angle + (Math.random() - 0.5) * spread
      const spd = speed * (0.4 + Math.random() * 0.9)
      particles.push({
        x, y,
        px: x, py: y,  // previous position for trail
        vx: Math.cos(dir) * spd,
        vy: Math.sin(dir) * spd,
        gravity,
        life: lifetime,
        maxLife: lifetime,
        size: size + (Math.random() - 0.5) * sizeVariance,
        color: colors ? colors[Math.floor(Math.random() * colors.length)] : color,
        trail,
      })
    }
  }

  function update() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.px = p.x
      p.py = p.y
      p.x += p.vx
      p.y += p.vy
      p.vy += p.gravity
      p.vx *= 0.97
      p.life--
      if (p.life <= 0) particles.splice(i, 1)
    }
  }

  function draw() {
    for (const p of particles) {
      const alpha = p.life / p.maxLife
      ctx.save()
      ctx.globalAlpha = alpha

      if (p.trail) {
        // Draw trail line from previous to current
        ctx.strokeStyle = p.color
        ctx.lineWidth = p.size * alpha * 0.7
        ctx.lineCap = 'round'
        ctx.globalAlpha = alpha * 0.5
        ctx.beginPath()
        ctx.moveTo(p.px, p.py)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
        ctx.globalAlpha = alpha
      }

      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(0.5, p.size * alpha), 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  function clear() {
    particles.length = 0
  }

  function count() {
    return particles.length
  }

  return { emit, update, draw, clear, count }
}
