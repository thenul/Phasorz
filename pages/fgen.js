import { parseEngineeringNotation } from '../shared/units.js';

const cv = document.getElementById('scope');
const ctx = cv.getContext('2d');

const S = {
  shape: 'sine',
  freq: 1000,
  vpp: 5,
  offset: 0,
  duty: 0.5,
  tdiv: 1e-4,
  vdiv: 1,
  ch2: false,
  phase: -90,
  rolling: false,
  t0: 0
};

const DIV_X = 10, DIV_Y = 8;

function shapeAt(shape, p, duty) {
  if (p < 0) p += 1;
  switch (shape) {
    case 'sine':     return Math.sin(2 * Math.PI * p);
    case 'square':   return p < duty ? 1 : -1;
    case 'triangle':
      if (p < 0.25) return 4 * p;
      if (p < 0.75) return 2 - 4 * p;
      return 4 * p - 4;
    case 'saw':      return 2 * ((p + 0.5) % 1) - 1;
  }
  return 0;
}

function voltsAt(t, phaseDeg) {
  let p = (t * S.freq + (phaseDeg || 0) / 360) % 1;
  if (p < 0) p += 1;
  return S.offset + (S.vpp / 2) * shapeAt(S.shape, p, S.duty);
}

function measure() {
  const N = 4096;
  let sum = 0, sumSq = 0, mx = -Infinity, mn = Infinity;
  for (let i = 0; i < N; i++) {
    const v = S.offset + (S.vpp / 2) * shapeAt(S.shape, i / N, S.duty);
    sum += v; sumSq += v * v;
    if (v > mx) mx = v;
    if (v < mn) mn = v;
  }
  return { vpp: mx - mn, vrms: Math.sqrt(sumSq / N), vavg: sum / N, vmax: mx, vmin: mn };
}

function fmtV(v) {
  const a = Math.abs(v);
  if (a < 0.999) return (v * 1000).toFixed(0) + ' mV';
  return v.toFixed(2) + ' V';
}
function fmtT(t) {
  if (t >= 1)    return t.toFixed(2) + ' s';
  if (t >= 1e-3) return (t * 1e3).toFixed(t * 1e3 < 10 ? 2 : 0) + ' ms';
  if (t >= 1e-6) return (t * 1e6).toFixed(t * 1e6 < 10 ? 2 : 0) + ' µs';
  return (t * 1e9).toFixed(0) + ' ns';
}
function fmtTDiv(t) {
  if (t >= 1)    return '1 s';
  if (t >= 1e-3) return Math.round(t * 1e3) + ' ms';
  if (t >= 1e-6) return Math.round(t * 1e6) + ' µs';
  return Math.round(t * 1e9) + ' ns';
}
function fmtHz(f) {
  if (f >= 1e6) return (f / 1e6).toFixed(2) + ' MHz';
  if (f >= 1e3) return (f / 1e3).toFixed(f / 1e3 < 10 ? 2 : 1) + ' kHz';
  return f.toFixed(f < 10 ? 2 : 0) + ' Hz';
}

function snap125(x) {
  const e = Math.pow(10, Math.floor(Math.log10(x)));
  const m = x / e;
  const s = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return s * e;
}

function trace(g, W, H, phase, colour) {
  const pxPerDivY = H / DIV_Y;
  const span = S.tdiv * DIV_X;
  const lim = H * 3;
  g.strokeStyle = colour;
  g.lineWidth = 1.8;
  g.lineJoin = 'round';
  g.beginPath();
  for (let x = 0; x <= W; x++) {
    const t = S.t0 + (x / W) * span;
    let y = H / 2 - (voltsAt(t, phase) / S.vdiv) * pxPerDivY;
    if (y < -lim) y = -lim;
    if (y > lim) y = lim;
    if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
}

function draw() {
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const css = getComputedStyle(document.documentElement);
  ctx.fillStyle = css.getPropertyValue('--screen-bg').trim();
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = css.getPropertyValue('--screen-grid').trim();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < DIV_X; i++) { const x = Math.round(i * W / DIV_X) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let i = 1; i < DIV_Y; i++) { const y = Math.round(i * H / DIV_Y) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  ctx.strokeStyle = css.getPropertyValue('--screen-axis').trim();
  ctx.beginPath();
  ctx.moveTo(0, Math.round(H / 2) + 0.5); ctx.lineTo(W, Math.round(H / 2) + 0.5);
  ctx.moveTo(Math.round(W / 2) + 0.5, 0); ctx.lineTo(Math.round(W / 2) + 0.5, H);
  ctx.stroke();

  trace(ctx, W, H, 0, css.getPropertyValue('--ch1').trim());
  if (S.ch2) trace(ctx, W, H, S.phase, css.getPropertyValue('--ch2').trim());

  ctx.font = '12px ' + css.getPropertyValue('--font-mono').trim();
  ctx.fillStyle = css.getPropertyValue('--screen-text').trim();
  ctx.fillText(
    fmtTDiv(S.tdiv) + '/div    ' + (S.vdiv >= 1 ? S.vdiv + ' V' : (S.vdiv * 1000) + ' mV') + '/div',
    10, H - 10
  );

  const cycles = S.freq * S.tdiv * DIV_X;
  if (cycles > 60) {
    ctx.fillStyle = css.getPropertyValue('--ch1').trim();
    ctx.fillText('too many cycles on screen — speed up the timebase', 10, 18);
  }

  const m = measure();
  document.getElementById('m-vpp').textContent  = fmtV(m.vpp);
  document.getElementById('m-vrms').textContent = fmtV(m.vrms);
  document.getElementById('m-vavg').textContent = fmtV(m.vavg);
  document.getElementById('m-vmax').textContent = fmtV(m.vmax);
  document.getElementById('m-vmin').textContent = fmtV(m.vmin);
  document.getElementById('m-per').textContent  = fmtT(1 / S.freq);
}

// ---------- wiring ----------

const shapeBtns = document.querySelectorAll('.shape');
shapeBtns.forEach(b => {
  b.addEventListener('click', () => {
    S.shape = b.dataset.shape;
    shapeBtns.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    document.getElementById('duty-row').classList.toggle('off', S.shape !== 'square');
    draw();
  });
});

const freqSlider = document.getElementById('freq');
const freqText = document.getElementById('freq-txt');

function setFreq(f, fromText) {
  S.freq = Math.min(1e6, Math.max(1, f));
  freqSlider.value = Math.log10(S.freq);
  if (!fromText) {
    freqText.value = fmtHz(S.freq).replace(' Hz', '').replace(' kHz', 'k').replace(' MHz', 'M');
  }
  draw();
}
freqSlider.addEventListener('input', () => setFreq(Math.pow(10, parseFloat(freqSlider.value))));
freqText.addEventListener('change', () => {
  try {
    const v = parseEngineeringNotation(freqText.value);
    if (v <= 0) throw new Error('non-positive');
    setFreq(v, true);
  } catch (e) {
    freqText.value = '1k';
    setFreq(1000, true);
  }
});

function bind(id, outId, apply, fmt) {
  const el = document.getElementById(id), out = document.getElementById(outId);
  el.addEventListener('input', () => {
    apply(parseFloat(el.value));
    out.textContent = fmt(parseFloat(el.value));
    draw();
  });
}
bind('amp',   'amp-out',   v => { S.vpp = v; },              v => v.toFixed(1) + ' Vpp');
bind('off',   'off-out',   v => { S.offset = v; },           v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + ' V');
bind('duty',  'duty-out',  v => { S.duty = v / 100; },       v => v.toFixed(0) + ' %');
bind('tdiv',  'tdiv-out',  v => { S.tdiv = Math.pow(10, v); }, v => fmtTDiv(Math.pow(10, v)));
bind('vdiv',  'vdiv-out',  v => { S.vdiv = Math.pow(10, v); },
     v => { const x = Math.pow(10, v); return x >= 1 ? x + ' V' : Math.round(x * 1000) + ' mV'; });
bind('phase', 'phase-out', v => { S.phase = v; },
     v => (v < 0 ? '−' : '') + Math.abs(v) + '°');

document.getElementById('ch2on').addEventListener('change', function () {
  S.ch2 = this.checked;
  document.getElementById('ph-row').classList.toggle('off', !S.ch2);
  draw();
});

document.getElementById('auto').addEventListener('click', () => {
  const tSlider = document.getElementById('tdiv');
  const vSlider = document.getElementById('vdiv');
  const wantT = 2 / (S.freq * DIV_X);
  const wantV = (S.vpp / 2 + Math.abs(S.offset)) / 3;
  tSlider.value = Math.max(-7, Math.min(0, Math.round(Math.log10(snap125(wantT)))));
  vSlider.value = Math.max(-2, Math.min(1, Math.round(Math.log10(snap125(wantV)))));
  tSlider.dispatchEvent(new Event('input'));
  vSlider.dispatchEvent(new Event('input'));
});

const runBtn = document.getElementById('run');
let raf = null, last = 0;
runBtn.addEventListener('click', () => {
  S.rolling = !S.rolling;
  runBtn.setAttribute('aria-pressed', String(S.rolling));
  runBtn.textContent = S.rolling ? 'Trigger' : 'Untrigger';
  if (S.rolling) {
    last = performance.now();
    raf = requestAnimationFrame(function step(now) {
      S.t0 += (now - last) / 1000 * S.tdiv * 2;
      last = now;
      draw();
      raf = requestAnimationFrame(step);
    });
  } else {
    cancelAnimationFrame(raf);
    S.t0 = 0;
    draw();
  }
});

window.addEventListener('resize', draw);
draw();
