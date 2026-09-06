const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];
const VOCAL_LOW_MIDI = 36;
const VOCAL_HIGH_MIDI = 84;
const VIEWPORT_SEMITONES = 12;
const WINDOW_MS = 5200;
const TOP_GAP = 34;
const BOTTOM_GAP = 110;
const SMOOTHING = 0.22;
const MAX_PITCH_STEP = 7;
const MIN_DETECT_HZ = 65;
const MAX_DETECT_HZ = 1000;

const canvas = document.getElementById('pianoRoll');
const toggleButton = document.getElementById('toggleButton');
const resetButton = document.getElementById('resetButton');
const followToggleButton = document.getElementById('followToggleButton');
const statusPill = document.getElementById('statusPill');
const noteName = document.getElementById('noteName');
const frequencyLabel = document.getElementById('frequency');
const centsLabel = document.getElementById('cents');
const meterFill = document.getElementById('meterFill');
const stabilityLabel = document.getElementById('stabilityLabel');
const currentChip = document.getElementById('currentChip');
const referenceVolume = document.getElementById('referenceVolume');
const referenceVolumeValue = document.getElementById('referenceVolumeValue');

const context = canvas.getContext('2d');

let audioContext = null;
let referenceAudioContext = null;
let referenceMasterGain = null;
let activeReferenceVoice = null;
let analyser = null;
let sourceNode = null;
let stream = null;
let animationFrameId = null;
let devicePixelRatioValue = Math.max(1, window.devicePixelRatio || 1);
let running = false;
let canvasReady = false;
let viewportCenterMidi = 60;
let followPitchEnabled = true;
let lastStableMidi = null;
let pitchHistory = [];
let recentMidiSamples = [];
let activeReferencePointerId = null;

const REFERENCE_LOW_MIDI = 24;
const REFERENCE_HIGH_MIDI = 96;
const VIEWPORT_MIN_CENTER_MIDI = 30;
const VIEWPORT_MAX_CENTER_MIDI = 90;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function median(values) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function frequencyToMidi(frequency) {
  return 69 + 12 * Math.log2(frequency / 440);
}

function midiToNoteName(midi) {
  const rounded = Math.round(midi);
  const note = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${note}${octave}`;
}

function midiToCents(midi) {
  return Math.round((midi - Math.round(midi)) * 100);
}

function setStatus(text, emphasis = false) {
  statusPill.textContent = text;
  statusPill.style.color = emphasis ? 'var(--accent)' : 'var(--muted)';
}

function setPitchDisplay(sample) {
  if (!sample) {
    noteName.textContent = '--';
    frequencyLabel.textContent = '--';
    centsLabel.textContent = '--';
    currentChip.textContent = '--';
    stabilityLabel.textContent = 'Waiting for input';
    meterFill.style.width = '0%';
    return;
  }

  noteName.textContent = midiToNoteName(sample.midi);
  frequencyLabel.textContent = `${sample.frequency.toFixed(sample.frequency >= 100 ? 1 : 2)} Hz`;
  const centsValue = midiToCents(sample.midi);
  centsLabel.textContent = `${centsValue >= 0 ? '+' : ''}${centsValue}¢`;
  currentChip.textContent = `${midiToNoteName(sample.midi)} · ${sample.frequency.toFixed(1)} Hz`;
  stabilityLabel.textContent =
    sample.confidence > 0.8
      ? 'Locked'
      : sample.confidence > 0.5
        ? 'Stable'
        : 'Searching';
  meterFill.style.width = `${clamp(sample.confidence * 100, 0, 100)}%`;
}

function updateFollowToggleUi() {
  if (!followToggleButton) {
    return;
  }

  followToggleButton.textContent = `Follow pitch: ${followPitchEnabled ? 'On' : 'Off'}`;
  followToggleButton.setAttribute(
    'aria-pressed',
    followPitchEnabled ? 'true' : 'false',
  );
  followToggleButton.classList.toggle('is-active', followPitchEnabled);
}

function setFollowPitchEnabled(enabled) {
  followPitchEnabled = Boolean(enabled);

  if (followPitchEnabled && lastStableMidi != null) {
    viewportCenterMidi = clamp(
      lastStableMidi,
      VIEWPORT_MIN_CENTER_MIDI,
      VIEWPORT_MAX_CENTER_MIDI,
    );
  }

  updateFollowToggleUi();
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  devicePixelRatioValue = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * devicePixelRatioValue));
  canvas.height = Math.max(1, Math.round(rect.height * devicePixelRatioValue));
  canvasReady = true;
}

function getViewportBounds(centerMidi) {
  const halfWindow = VIEWPORT_SEMITONES / 2;
  return {
    low: centerMidi - halfWindow,
    high: centerMidi + halfWindow,
  };
}

function midiToY(midi, height, centerMidi) {
  const { low, high } = getViewportBounds(centerMidi);
  const drawableHeight =
    height -
    TOP_GAP * devicePixelRatioValue -
    BOTTOM_GAP * devicePixelRatioValue;
  const normalized = (midi - low) / (high - low);
  return (
    height -
    BOTTOM_GAP * devicePixelRatioValue -
    clamp(normalized, 0, 1) * drawableHeight
  );
}

function yToMidi(y, height, centerMidi) {
  const { low, high } = getViewportBounds(centerMidi);
  const top = TOP_GAP * devicePixelRatioValue;
  const bottom = height - BOTTOM_GAP * devicePixelRatioValue;
  const clampedY = clamp(y, top, bottom);
  const drawableHeight = Math.max(1, bottom - top);
  const normalized = (bottom - clampedY) / drawableHeight;
  return low + normalized * (high - low);
}

function getReferenceAudioContext() {
  if (!referenceAudioContext || referenceAudioContext.state === 'closed') {
    referenceAudioContext = new AudioContext();
    referenceMasterGain = referenceAudioContext.createGain();
    referenceMasterGain.connect(referenceAudioContext.destination);
    applyReferenceVolume();
  }

  return referenceAudioContext;
}

function getReferenceVolumeScalar() {
  const percent = Number(referenceVolume?.value ?? 56);
  const normalized = clamp(percent / 100, 0, 1);
  return 0.04 + Math.pow(normalized, 1.3) * 0.56;
}

function applyReferenceVolume() {
  if (!referenceMasterGain || !referenceAudioContext) {
    return;
  }

  const now = referenceAudioContext.currentTime;
  const target = getReferenceVolumeScalar();
  referenceMasterGain.gain.cancelScheduledValues(now);
  referenceMasterGain.gain.setTargetAtTime(target, now, 0.02);
}

function setReferenceVolumeLabel() {
  if (!referenceVolumeValue || !referenceVolume) {
    return;
  }

  referenceVolumeValue.textContent = `${referenceVolume.value}%`;
}

function stopSustainedReferenceTone() {
  if (!activeReferenceVoice) {
    return;
  }

  const { ctx, mixGain, oscillators, cleanup } = activeReferenceVoice;
  const now = ctx.currentTime;
  const currentGain = Math.max(0.0001, mixGain.gain.value || 0.0001);
  mixGain.gain.cancelScheduledValues(now);
  mixGain.gain.setValueAtTime(currentGain, now);
  mixGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  const stopAt = now + 0.19;
  for (const osc of oscillators) {
    try {
      osc.stop(stopAt);
    } catch {
      // Oscillator may already be stopping.
    }
  }

  activeReferenceVoice = null;
  window.setTimeout(() => {
    cleanup();
  }, 260);
}

async function startSustainedReferenceTone(midi) {
  const roundedMidi = Math.round(
    clamp(midi, REFERENCE_LOW_MIDI, REFERENCE_HIGH_MIDI),
  );
  const frequency = midiToFrequency(roundedMidi);

  try {
    const ctx = getReferenceAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    stopSustainedReferenceTone();

    const now = ctx.currentTime;
    const mixGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const oscFundamental = ctx.createOscillator();
    const oscOctave = ctx.createOscillator();
    const oscTwelfth = ctx.createOscillator();
    const gainFundamental = ctx.createGain();
    const gainOctave = ctx.createGain();
    const gainTwelfth = ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3400, now);
    filter.Q.setValueAtTime(0.9, now);

    gainFundamental.gain.setValueAtTime(0.85, now);
    gainOctave.gain.setValueAtTime(0.23, now);
    gainTwelfth.gain.setValueAtTime(0.14, now);

    mixGain.gain.setValueAtTime(0.0001, now);
    mixGain.gain.exponentialRampToValueAtTime(0.32, now + 0.012);
    mixGain.gain.exponentialRampToValueAtTime(0.22, now + 0.08);

    oscFundamental.type = 'triangle';
    oscFundamental.frequency.setValueAtTime(frequency, now);

    oscOctave.type = 'sine';
    oscOctave.frequency.setValueAtTime(frequency * 2, now);

    oscTwelfth.type = 'sine';
    oscTwelfth.frequency.setValueAtTime(frequency * 3, now);

    oscFundamental.connect(gainFundamental);
    oscOctave.connect(gainOctave);
    oscTwelfth.connect(gainTwelfth);
    gainFundamental.connect(mixGain);
    gainOctave.connect(mixGain);
    gainTwelfth.connect(mixGain);
    mixGain.connect(filter);
    filter.connect(referenceMasterGain);

    oscFundamental.start(now);
    oscOctave.start(now);
    oscTwelfth.start(now);

    const cleanup = () => {
      oscFundamental.disconnect();
      oscOctave.disconnect();
      oscTwelfth.disconnect();
      gainFundamental.disconnect();
      gainOctave.disconnect();
      gainTwelfth.disconnect();
      mixGain.disconnect();
      filter.disconnect();
    };

    activeReferenceVoice = {
      midi: roundedMidi,
      ctx,
      mixGain,
      oscillators: [oscFundamental, oscOctave, oscTwelfth],
      cleanup,
    };

    currentChip.textContent = `Reference: ${midiToNoteName(roundedMidi)} · ${frequency.toFixed(1)} Hz`;
    setStatus('Reference tone playing', true);
  } catch {
    setStatus('Tap/click blocked audio');
  }
}

function getMidiFromCanvasPointer(event) {
  if (!canvasReady) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const cssY = event.clientY - rect.top;
  const canvasY = cssY * devicePixelRatioValue;
  const activeCenterMidi =
    followPitchEnabled && lastStableMidi != null
      ? lastStableMidi
      : viewportCenterMidi;
  return yToMidi(canvasY, canvas.height, activeCenterMidi);
}

function applyViewportShift(deltaSemitones) {
  const lowerBound = VIEWPORT_MIN_CENTER_MIDI;
  const upperBound = VIEWPORT_MAX_CENTER_MIDI;
  viewportCenterMidi = clamp(
    viewportCenterMidi + deltaSemitones,
    lowerBound,
    upperBound,
  );
  lastStableMidi = null;

  if (!running) {
    currentChip.textContent = `View center: ${midiToNoteName(viewportCenterMidi)}`;
    setStatus('Scroll to choose your starting note');
  } else if (!followPitchEnabled) {
    setStatus('Manual roll position', true);
  }
}

function handleCanvasWheel(event) {
  event.preventDefault();

  const semitoneDelta = clamp(event.deltaY, -160, 160) * 0.012;
  applyViewportShift(semitoneDelta);
}

async function handleCanvasPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  const targetMidi = getMidiFromCanvasPointer(event);
  if (targetMidi == null) {
    return;
  }

  activeReferencePointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  await startSustainedReferenceTone(targetMidi);
  event.preventDefault();
}

async function handleCanvasPointerMove(event) {
  if (
    activeReferencePointerId == null ||
    event.pointerId !== activeReferencePointerId
  ) {
    return;
  }

  const targetMidi = getMidiFromCanvasPointer(event);
  if (targetMidi == null || !activeReferenceVoice) {
    return;
  }

  const rounded = Math.round(
    clamp(targetMidi, REFERENCE_LOW_MIDI, REFERENCE_HIGH_MIDI),
  );

  if (rounded !== activeReferenceVoice.midi) {
    await startSustainedReferenceTone(rounded);
  }
}

function endReferencePointer(pointerId) {
  if (
    activeReferencePointerId == null ||
    pointerId !== activeReferencePointerId
  ) {
    return;
  }

  stopSustainedReferenceTone();
  activeReferencePointerId = null;
  setStatus(running ? 'Listening' : 'Mic idle', running);

  if (!running) {
    currentChip.textContent = '--';
  }
}

function handleCanvasPointerUp(event) {
  endReferencePointer(event.pointerId);
}

function handleCanvasPointerCancel(event) {
  endReferencePointer(event.pointerId);
}

function handleCanvasPointerLeave(event) {
  if (event.buttons === 0) {
    endReferencePointer(event.pointerId);
  }
}

function foldMidiToReference(
  midi,
  referenceMidi,
  minMidi = VOCAL_LOW_MIDI,
  maxMidi = VOCAL_HIGH_MIDI,
) {
  const boundedMidi = clamp(midi, minMidi, maxMidi);
  let bestMidi = boundedMidi;
  let bestDistance = Math.abs(boundedMidi - referenceMidi);

  for (let octaveShift = -6; octaveShift <= 6; octaveShift += 1) {
    const candidate = midi + octaveShift * 12;
    if (candidate < minMidi || candidate > maxMidi) {
      continue;
    }
    const candidateDistance = Math.abs(candidate - referenceMidi);
    if (candidateDistance < bestDistance) {
      bestMidi = candidate;
      bestDistance = candidateDistance;
    }
  }

  return bestMidi;
}

function stabilizeMidi(rawMidi, confidence = 0) {
  const vocalMidi = clamp(rawMidi, VOCAL_LOW_MIDI, VOCAL_HIGH_MIDI);

  if (lastStableMidi == null) {
    return vocalMidi;
  }

  const foldedMidi = foldMidiToReference(vocalMidi, lastStableMidi);
  const pitchStep = Math.abs(foldedMidi - lastStableMidi);

  if (pitchStep > MAX_PITCH_STEP && confidence < 0.78) {
    return lastStableMidi;
  }

  return lastStableMidi * (1 - SMOOTHING) + foldedMidi * SMOOTHING;
}

function smoothMidiForTrail(stableMidi) {
  recentMidiSamples.push(stableMidi);
  recentMidiSamples = recentMidiSamples.slice(-5);

  const middleMidi = median(recentMidiSamples);
  return recentMidiSamples.length < 3
    ? stableMidi
    : stableMidi * 0.35 + middleMidi * 0.65;
}

function drawBackground(ctx, width, height, centerMidi) {
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(12, 18, 38, 0.95)');
  gradient.addColorStop(1, 'rgba(5, 8, 16, 0.98)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const leftRailWidth = 132 * devicePixelRatioValue;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.fillRect(0, 0, leftRailWidth, height);

  const { low, high } = getViewportBounds(centerMidi);
  const activeReferenceMidi = activeReferenceVoice?.midi ?? null;
  const keyStartMidi = Math.floor(low) - 1;
  const keyEndMidi = Math.ceil(high) + 1;

  for (let midi = keyStartMidi; midi <= keyEndMidi; midi += 1) {
    const noteClass = ((midi % 12) + 12) % 12;
    const isNatural = [0, 2, 4, 5, 7, 9, 11].includes(noteClass);
    const isActive =
      activeReferenceMidi != null && midi === activeReferenceMidi;
    const keyTop = midiToY(midi + 0.5, height, centerMidi);
    const keyBottom = midiToY(midi - 0.5, height, centerMidi);
    const keyY = Math.min(keyTop, keyBottom);
    const keyHeight = Math.max(1, Math.abs(keyBottom - keyTop));
    const keyWidth = isNatural
      ? leftRailWidth - 8 * devicePixelRatioValue
      : (leftRailWidth - 22 * devicePixelRatioValue) * 0.72;

    ctx.fillStyle = isActive
      ? 'rgba(125, 240, 195, 0.5)'
      : isNatural
        ? 'rgba(224, 235, 255, 0.18)'
        : 'rgba(8, 14, 26, 0.68)';
    ctx.fillRect(0, keyY, keyWidth, keyHeight);

    if (isActive) {
      ctx.fillStyle = 'rgba(125, 240, 195, 0.98)';
      ctx.fillRect(
        keyWidth - 3 * devicePixelRatioValue,
        keyY,
        3 * devicePixelRatioValue,
        keyHeight,
      );
    }
  }

  const startMidi = Math.floor(low);
  const endMidi = Math.ceil(high);

  for (let midi = startMidi; midi <= endMidi; midi += 1) {
    const y = midiToY(midi, height, centerMidi);
    const noteClass = ((midi % 12) + 12) % 12;
    const isNatural = [0, 2, 4, 5, 7, 9, 11].includes(noteClass);

    ctx.strokeStyle = isNatural
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = isNatural ? 1.2 : 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    ctx.fillStyle = isNatural
      ? 'rgba(255, 255, 255, 0.74)'
      : 'rgba(255, 255, 255, 0.42)';
    ctx.font = `${11 * devicePixelRatioValue}px Space Grotesk, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(midiToNoteName(midi), 14 * devicePixelRatioValue, y);
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(leftRailWidth - 1, 0, 1, height);
}

function drawHistory(ctx, width, height, now, centerMidi) {
  const visibleHistory = pitchHistory.filter(
    (sample) => now - sample.time <= WINDOW_MS,
  );
  if (visibleHistory.length === 0) {
    return;
  }

  const leftRailWidth = 132 * devicePixelRatioValue;
  const rightPadding = 20 * devicePixelRatioValue;
  const trailWidth = Math.max(1, width - leftRailWidth - rightPadding);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(56, 214, 166, 0.4)';
  ctx.shadowBlur = 14 * devicePixelRatioValue;
  ctx.strokeStyle = 'rgba(125, 240, 195, 0.86)';
  ctx.lineWidth = 2.5 * devicePixelRatioValue;

  ctx.beginPath();
  visibleHistory.forEach((sample, index) => {
    const age = clamp((now - sample.time) / WINDOW_MS, 0, 1);
    const x = leftRailWidth + (1 - age) * trailWidth;
    const y = midiToY(sample.midi, height, centerMidi);

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  const latest = visibleHistory[visibleHistory.length - 1];
  const latestY = midiToY(latest.midi, height, centerMidi);
  const latestX = leftRailWidth + trailWidth;

  ctx.shadowBlur = 18 * devicePixelRatioValue;
  ctx.fillStyle = 'rgba(125, 240, 195, 0.98)';
  ctx.beginPath();
  ctx.arc(latestX, latestY, 6.5 * devicePixelRatioValue, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function render() {
  if (!canvasReady) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const now = performance.now();
  if (followPitchEnabled && lastStableMidi != null) {
    const followedMidi = clamp(
      lastStableMidi,
      VIEWPORT_MIN_CENTER_MIDI,
      VIEWPORT_MAX_CENTER_MIDI,
    );
    viewportCenterMidi = viewportCenterMidi * 0.9 + followedMidi * 0.1;
  }

  drawBackground(context, width, height, viewportCenterMidi);
  drawHistory(context, width, height, now, viewportCenterMidi);

  animationFrameId = requestAnimationFrame(render);
}

function autoCorrelate(buffer, sampleRate) {
  let rms = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const value = buffer[index];
    rms += value * value;
  }
  rms = Math.sqrt(rms / buffer.length);

  if (rms < 0.015) {
    return { frequency: -1, confidence: 0, rms };
  }

  let start = 0;
  let end = buffer.length - 1;

  for (let index = 0; index < buffer.length; index += 1) {
    if (Math.abs(buffer[index]) > 0.2) {
      start = index;
      break;
    }
  }

  for (let index = buffer.length - 1; index >= 0; index -= 1) {
    if (Math.abs(buffer[index]) > 0.2) {
      end = index;
      break;
    }
  }

  const trimmed = buffer.slice(start, end + 1);
  if (trimmed.length < 3) {
    return { frequency: -1, confidence: 0, rms };
  }

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_DETECT_HZ));
  const maxLag = Math.min(
    trimmed.length - 2,
    Math.ceil(sampleRate / MIN_DETECT_HZ),
  );

  if (maxLag <= minLag) {
    return { frequency: -1, confidence: 0, rms };
  }

  const correlates = new Array(maxLag + 1).fill(0);
  let peakValue = -Infinity;

  for (let offset = 0; offset <= maxLag; offset += 1) {
    let sum = 0;
    for (let index = 0; index < trimmed.length - offset; index += 1) {
      sum += trimmed[index] * trimmed[index + offset];
    }
    correlates[offset] = sum;
    if (sum > peakValue) {
      peakValue = sum;
    }
  }

  let best = -1;
  let bestValue = -Infinity;
  const localPeakThreshold = peakValue * 0.35;

  let firstValley = minLag;
  for (let index = minLag + 1; index < maxLag; index += 1) {
    if (
      correlates[index] <= correlates[index - 1] &&
      correlates[index] < correlates[index + 1]
    ) {
      firstValley = index;
      break;
    }
  }

  for (let index = firstValley + 1; index < maxLag; index += 1) {
    const current = correlates[index];
    if (
      current > correlates[index - 1] &&
      current >= correlates[index + 1] &&
      current >= localPeakThreshold
    ) {
      best = index;
      bestValue = current;
      break;
    }
  }

  if (best === -1) {
    for (let index = minLag; index < maxLag; index += 1) {
      const current = correlates[index];
      if (
        current > correlates[index - 1] &&
        current >= correlates[index + 1] &&
        current >= localPeakThreshold &&
        current > bestValue
      ) {
        best = index;
        bestValue = current;
      }
    }
  }

  if (best === -1) {
    for (let index = minLag; index <= maxLag; index += 1) {
      if (correlates[index] > bestValue) {
        bestValue = correlates[index];
        best = index;
      }
    }
  }

  if (best > 0) {
    const OCTAVE_SUBHARMONIC_RATIO = 0.84;
    const FIFTH_SUBHARMONIC_RATIO = 0.88;

    const octaveCandidate = best * 2;
    if (
      octaveCandidate <= maxLag &&
      correlates[octaveCandidate] >= bestValue * OCTAVE_SUBHARMONIC_RATIO
    ) {
      best = octaveCandidate;
      bestValue = correlates[octaveCandidate];
    }

    const fifthCandidate = best * 3;
    if (
      fifthCandidate <= maxLag &&
      correlates[fifthCandidate] >= bestValue * FIFTH_SUBHARMONIC_RATIO
    ) {
      best = fifthCandidate;
      bestValue = correlates[fifthCandidate];
    }
  }

  if (best <= 0 || !isFinite(best)) {
    return { frequency: -1, confidence: 0, rms };
  }

  const next = correlates[best + 1] ?? correlates[best];
  const previous = correlates[best - 1] ?? correlates[best];
  const denominator = previous - 2 * correlates[best] + next;
  const adjustment = denominator ? (next - previous) / (2 * denominator) : 0;
  const corrected = best + adjustment;
  const frequency = sampleRate / corrected;
  const confidence = clamp(correlates[best] / (peakValue || 1), 0, 1);

  if (!isFinite(frequency) || frequency <= 0) {
    return { frequency: -1, confidence: 0, rms };
  }

  return { frequency, confidence, rms };
}

function updateFromAudio() {
  if (!analyser || !running) {
    return;
  }

  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);
  const result = autoCorrelate(buffer, audioContext.sampleRate);

  if (result.frequency > 0) {
    const rawMidi = frequencyToMidi(result.frequency);
    const stabilizedMidi = stabilizeMidi(rawMidi, result.confidence);
    const displayMidi = smoothMidiForTrail(stabilizedMidi);
    lastStableMidi = stabilizedMidi;
    if (followPitchEnabled) {
      const boundedStable = clamp(
        stabilizedMidi,
        VIEWPORT_MIN_CENTER_MIDI,
        VIEWPORT_MAX_CENTER_MIDI,
      );
      viewportCenterMidi = viewportCenterMidi * 0.88 + boundedStable * 0.12;
    }

    const sample = {
      time: performance.now(),
      frequency: midiToFrequency(displayMidi),
      midi: displayMidi,
      confidence: clamp(
        result.confidence * clamp(result.rms * 15, 0.3, 1),
        0,
        1,
      ),
    };

    pitchHistory.push(sample);
    setPitchDisplay(sample);
    setStatus('Listening', true);
  } else if (performance.now() % 1000 < 25) {
    setStatus('Listening for pitch...');
  }

  pitchHistory = pitchHistory.filter(
    (sample) => performance.now() - sample.time <= WINDOW_MS,
  );
  requestAnimationFrame(updateFromAudio);
}

function stopAudio() {
  running = false;
  toggleButton.textContent = 'Start listening';
  setStatus('Mic idle');
  setPitchDisplay(null);
  lastStableMidi = null;
  pitchHistory = [];
  recentMidiSamples = [];

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
  }

  stopSustainedReferenceTone();

  stream = null;
  analyser = null;
  sourceNode = null;
  audioContext = null;
}

async function startAudio() {
  if (running) {
    return;
  }

  try {
    setStatus('Requesting microphone...');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    audioContext = new AudioContext();
    await audioContext.resume();

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.0;

    sourceNode = audioContext.createMediaStreamSource(stream);
    sourceNode.connect(analyser);

    running = true;
    toggleButton.textContent = 'Stop listening';
    setStatus('Listening', true);
    requestAnimationFrame(updateFromAudio);
  } catch (error) {
    setStatus('Mic permission needed');
    currentChip.textContent = 'Allow microphone access to begin';
    noteName.textContent = '--';
    frequencyLabel.textContent = '--';
    centsLabel.textContent = '--';
    stabilityLabel.textContent = 'Permission blocked';
    meterFill.style.width = '0%';
  }
}

function resetView() {
  pitchHistory = [];
  lastStableMidi = null;
  viewportCenterMidi = 60;
  recentMidiSamples = [];
  stopSustainedReferenceTone();
  activeReferencePointerId = null;
  setPitchDisplay(null);
  setStatus(running ? 'Listening' : 'Mic idle', running);
}

toggleButton.addEventListener('click', async () => {
  if (running) {
    stopAudio();
    return;
  }

  await startAudio();
});

resetButton.addEventListener('click', resetView);

if (followToggleButton) {
  followToggleButton.addEventListener('click', () => {
    setFollowPitchEnabled(!followPitchEnabled);
    setStatus(
      followPitchEnabled ? 'Pitch follow enabled' : 'Pitch follow paused',
      true,
    );
  });
}

canvas.addEventListener('pointerdown', handleCanvasPointerDown);
canvas.addEventListener('pointermove', handleCanvasPointerMove);
canvas.addEventListener('pointerup', handleCanvasPointerUp);
canvas.addEventListener('pointercancel', handleCanvasPointerCancel);
canvas.addEventListener('pointerleave', handleCanvasPointerLeave);
canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });

if (referenceVolume) {
  setReferenceVolumeLabel();
  referenceVolume.addEventListener('input', () => {
    setReferenceVolumeLabel();
    applyReferenceVolume();
  });
}

window.addEventListener('resize', () => {
  resizeCanvas();
});

resizeCanvas();
setPitchDisplay(null);
updateFollowToggleUi();
setStatus('Mic idle');
render();

if (!navigator.mediaDevices?.getUserMedia) {
  toggleButton.disabled = true;
  setStatus('Mic input unsupported');
  stabilityLabel.textContent = 'This browser cannot access the microphone';
}

window.addEventListener('beforeunload', stopAudio);
