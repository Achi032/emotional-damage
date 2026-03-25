// ===== Sound Manager (Web Audio API synthesis) =====

let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

// Resume on user gesture (required by browsers)
export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume()
}

export function synth(type = 'pop', opts = {}) {
  try {
    const ac = getCtx()
    resumeAudio()

    switch (type) {
      case 'pop': {
        // Soft bubble pop: quick sine blip
        const osc = ac.createOscillator()
        const gain = ac.createGain()
        osc.connect(gain)
        gain.connect(ac.destination)
        osc.type = 'sine'
        const freq = opts.freq ?? 400 + Math.random() * 200
        osc.frequency.setValueAtTime(freq, ac.currentTime)
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ac.currentTime + 0.08)
        gain.gain.setValueAtTime(0.3, ac.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12)
        osc.start(ac.currentTime)
        osc.stop(ac.currentTime + 0.12)
        break
      }
      case 'smash': {
        // Smash: noise burst
        const bufSize = ac.sampleRate * 0.15
        const buf = ac.createBuffer(1, bufSize, ac.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2)
        const src = ac.createBufferSource()
        src.buffer = buf
        const gain = ac.createGain()
        const dist = ac.createWaveShaper()
        const curve = new Float32Array(256)
        for (let i = 0; i < 256; i++) { const x = i * 2 / 256 - 1; curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x)) }
        dist.curve = curve
        src.connect(dist)
        dist.connect(gain)
        gain.connect(ac.destination)
        gain.gain.setValueAtTime(0.8, ac.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15)
        src.start()
        break
      }
      case 'burn': {
        // Burn: crackle noise fade
        const bufSize = ac.sampleRate * 0.4
        const buf = ac.createBuffer(1, bufSize, ac.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) {
          const t = i / bufSize
          data[i] = (Math.random() * 2 - 1) * 0.3 * (1 - t) * (Math.random() > 0.97 ? 3 : 1)
        }
        const src = ac.createBufferSource()
        src.buffer = buf
        const gain = ac.createGain()
        const filter = ac.createBiquadFilter()
        filter.type = 'highpass'
        filter.frequency.value = 1500
        src.connect(filter)
        filter.connect(gain)
        gain.connect(ac.destination)
        gain.gain.setValueAtTime(0.5, ac.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4)
        src.start()
        break
      }
      case 'tear': {
        // Tear: short noise rip
        const bufSize = ac.sampleRate * 0.2
        const buf = ac.createBuffer(1, bufSize, ac.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) {
          const t = i / bufSize
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 0.3) * 0.8
        }
        const src = ac.createBufferSource()
        src.buffer = buf
        const gain = ac.createGain()
        src.connect(gain)
        gain.connect(ac.destination)
        gain.gain.setValueAtTime(0.7, ac.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2)
        src.start()
        break
      }
      case 'whoosh': {
        const osc = ac.createOscillator()
        const gain = ac.createGain()
        osc.connect(gain)
        gain.connect(ac.destination)
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(300, ac.currentTime)
        osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.15)
        gain.gain.setValueAtTime(0.15, ac.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15)
        osc.start(ac.currentTime)
        osc.stop(ac.currentTime + 0.15)
        break
      }
    }
  } catch (e) {
    // Fail silently if AudioContext not available
  }
}
