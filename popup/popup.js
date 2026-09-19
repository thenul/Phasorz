import { parseEngineeringNotation } from '/shared/units.js';

// ==========================================================================
// Router — hide/show sections and remember which tool was last open
// ==========================================================================

const LAST_TOOL_KEY = 'phasorz.lastTool';

function show(view) {
  document.querySelectorAll('section[data-view]').forEach(s => {
    s.hidden = s.dataset.view !== view;
  });
  if (view === 'home') {
    chrome.storage.local.remove(LAST_TOOL_KEY);
  } else {
    chrome.storage.local.set({ [LAST_TOOL_KEY]: view });
  }
}

document.querySelectorAll('[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    if (tool === 'fgen') {
      chrome.tabs.create({ url: chrome.runtime.getURL('pages/fgen.html') });
    } else {
      show(tool);
    }
  });
});

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => show('home'));
});

// ==========================================================================
// Impedance tool
// ==========================================================================

let totalZ = null;
let sysFrequency = 1000;

function lockFrequency() {
  const input = document.getElementById('frequency').value;
  const errorDiv = document.getElementById('freq-error');
  try {
    const val = parseEngineeringNotation(input);
    if (val < 0) throw new Error('Negative');
    sysFrequency = val;
    errorDiv.style.display = 'none';
    document.getElementById('freq-display').innerText =
      `Frequency: ${sysFrequency.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} Hz`;
    resetSystem();
  } catch (e) {
    errorDiv.style.display = 'block';
  }
}

function reciprocal(z) {
  if (z.re === Infinity || z.im === Infinity) return { re: 0, im: 0 };
  const denom = z.re * z.re + z.im * z.im;
  if (denom === 0) return { re: Infinity, im: 0 };
  return { re: z.re / denom, im: -z.im / denom };
}

function addComponent() {
  const type = document.getElementById('comp-type').value;
  const valStr = document.getElementById('comp-value').value;
  const conn = document.getElementById('comp-conn').value;
  const errorDiv = document.getElementById('val-error');

  let val;
  try {
    val = parseEngineeringNotation(valStr);
    if (val < 0) throw new Error('Negative');
    errorDiv.style.display = 'none';
  } catch (e) {
    errorDiv.style.display = 'block';
    return;
  }

  let newZ = { re: 0, im: 0 };
  const omega = 2 * Math.PI * sysFrequency;

  if (type === 'R') {
    newZ.re = val;
  } else if (type === 'L') {
    newZ.im = omega * val;
  } else if (type === 'C') {
    newZ.im = omega === 0 ? -Infinity : -1 / (omega * val);
  }

  if (totalZ === null) {
    totalZ = newZ;
    document.getElementById('connection-container').hidden = false;
    document.getElementById('frequency').disabled = true;
  } else if (conn === 's') {
    totalZ.re += newZ.re;
    totalZ.im += newZ.im;
  } else {
    if ((totalZ.re === 0 && totalZ.im === 0) || (newZ.re === 0 && newZ.im === 0)) {
      totalZ = { re: 0, im: 0 };
    } else {
      const y1 = reciprocal(totalZ);
      const y2 = reciprocal(newZ);
      totalZ = reciprocal({ re: y1.re + y2.re, im: y1.im + y2.im });
    }
  }

  updateDisplay();
  document.getElementById('comp-value').value = '';
}

function updateDisplay() {
  const rectEl = document.getElementById('rect-output');
  const polarEl = document.getElementById('polar-output');

  if (totalZ === null) {
    rectEl.innerText = 'Rectangular: 0.00 + 0.00j Ω';
    polarEl.innerText = 'Polar: 0.00 ∠ 0.00°';
    return;
  }
  if (totalZ.re === Infinity || Math.abs(totalZ.re) > 1e12 || Math.abs(totalZ.im) > 1e12) {
    rectEl.innerText = 'Rectangular: ∞ Ω (Open circuit)';
    polarEl.innerText = 'Polar: ∞ ∠ 0.00°';
    return;
  }

  const sign = totalZ.im >= 0 ? '+' : '-';
  rectEl.innerText = `Rectangular: ${totalZ.re.toFixed(2)} ${sign} ${Math.abs(totalZ.im).toFixed(2)}j Ω`;

  const mag = Math.sqrt(totalZ.re * totalZ.re + totalZ.im * totalZ.im);
  const angle = Math.atan2(totalZ.im, totalZ.re) * (180 / Math.PI);
  polarEl.innerText = `Polar: ${mag.toFixed(2)} ∠ ${angle.toFixed(2)}°`;
}

function resetSystem() {
  totalZ = null;
  document.getElementById('connection-container').hidden = true;
  document.getElementById('frequency').disabled = false;
  updateDisplay();
}

document.getElementById('frequency').addEventListener('change', lockFrequency);
document.getElementById('add-btn').addEventListener('click', addComponent);
document.getElementById('reset-btn').addEventListener('click', resetSystem);

// ==========================================================================
// Boot — restore last-used tool, or land on home
// ==========================================================================

chrome.storage.local.get(LAST_TOOL_KEY).then(res => {
  const last = res && res[LAST_TOOL_KEY];
  show(last === 'impedance' ? 'impedance' : 'home');
});
