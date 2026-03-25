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
      lifetime = 60,
      size = 4,
      sizeVariance = 2,
      spread = Math.PI * 2,
      angle = 0,
    } = opts

    for (let i = 0; i < count; i++) {
      const dir = angle + (Math.random() - 0.5) * spread
      const spd = speed * (0.5 + Math.random() * 0.8)
      particles.push({
        x, y,
        vx: Math.cos(dir) * spd,
        vy: Math.sin(dir) * spd,
        gravity,
        life: lifetime,
        maxLife: lifetime,
        size: size + (Math.random() - 0.5) * sizeVariance,
        color: colors ? colors[Math.floor(Math.random() * colors.length)] : color,
      })
    }
  }

  function update() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += p.gravity
      p.vx *= 0.98
      p.life--
      if (p.life <= 0) particles.splice(i, 1)
    }
  }

  function draw() {
    for (const p of particles) {
      const alpha = p.life / p.maxLife
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
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
