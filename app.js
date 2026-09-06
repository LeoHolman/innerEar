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
const VIEWPORT_SEMITONES = 20;
const WINDOW_MS = 5200;
const TOP_GAP = 34;
const BOTTOM_GAP = 110;
const SMOOTHING = 0.22;
const MAX_PITCH_STEP = 7;
const LOW_CONFIDENCE_SLEW_LIMIT = 2.4;
const HIGH_CONFIDENCE_SLEW_LIMIT = 5.5;
const MIN_DETECT_HZ = 65;
const MAX_DETECT_HZ = 1000;

const canvas = document.getElementById('pianoRoll');
const toggleButton = document.getElementById('toggleButton');
const resetButton = document.getElementById('resetButton');
const followToggleButton = document.getElementById('followToggleButton');
const exerciseToggleButton = document.getElementById('exerciseToggleButton');
const rollLayout = document.getElementById('rollLayout');
const statusPill = document.getElementById('statusPill');
const noteName = document.getElementById('noteName');
const frequencyLabel = document.getElementById('frequency');
const centsLabel = document.getElementById('cents');
const meterFill = document.getElementById('meterFill');
const stabilityLabel = document.getElementById('stabilityLabel');
const currentChip = document.getElementById('currentChip');
const referenceVolume = document.getElementById('referenceVolume');
const referenceVolumeValue = document.getElementById('referenceVolumeValue');
const exercisePanel = document.getElementById('exercisePanel');
const exerciseDetails = document.getElementById('exerciseDetails');
const exerciseType = document.getElementById('exerciseType');
const exerciseBadge = document.getElementById('exerciseBadge');
const exerciseTitle = document.getElementById('exerciseTitle');
const exerciseDescription = document.getElementById('exerciseDescription');
const exerciseLowNote = document.getElementById('exerciseLowNote');
const exerciseHighNote = document.getElementById('exerciseHighNote');
const exerciseMemoryDelay = document.getElementById('exerciseMemoryDelay');
const exerciseMemoryDelayField = document.getElementById(
  'exerciseMemoryDelayField',
);
const exerciseStartButton = document.getElementById('exerciseStartButton');
const exerciseDetailsToggle = document.getElementById('exerciseDetailsToggle');
const exerciseFeedback = document.getElementById('exerciseFeedback');
const exerciseReveal = document.getElementById('exerciseReveal');
const exerciseProgressFill = document.getElementById('exerciseProgressFill');
const exerciseAttemptLabel = document.getElementById('exerciseAttemptLabel');
const exercisePhaseLabel = document.getElementById('exercisePhaseLabel');
const exerciseMemoryCountdown = document.getElementById(
  'exerciseMemoryCountdown',
);
const exerciseCurrentNote = document.getElementById('exerciseCurrentNote');
const exerciseCurrentFrequency = document.getElementById(
  'exerciseCurrentFrequency',
);
const exerciseCurrentDelta = document.getElementById('exerciseCurrentDelta');
const exerciseLiveStatus = document.getElementById('exerciseLiveStatus');

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
let followPitchEnabled = false;
let lastStableMidi = null;
let pitchHistory = [];
let recentMidiSamples = [];
let recentRawMidiSamples = [];
let activeReferencePointerId = null;

const REFERENCE_LOW_MIDI = 24;
const REFERENCE_HIGH_MIDI = 96;
const VIEWPORT_MIN_CENTER_MIDI = 30;
const VIEWPORT_MAX_CENTER_MIDI = 90;
const EXERCISE_RANGE_LOW_MIDI = 36;
const EXERCISE_RANGE_HIGH_MIDI = 84;
const EXERCISE_SUCCESS_HOLD_MS = 1000;
const EXERCISE_ATTEMPT_WINDOW_MS = 8000;
const EXERCISE_MATCH_TOLERANCE_CENTS = 35;
const EXERCISE_MATCH_TOLERANCE = EXERCISE_MATCH_TOLERANCE_CENTS / 100;
const EXERCISE_HOLD_GRACE_MS = 180;
const EXERCISE_MIN_CONFIDENCE = 0.72;
const EXERCISE_MEMORY_MIN_DELAY_SECONDS = 1;
const EXERCISE_MEMORY_MAX_DELAY_SECONDS = 100;
const EXERCISE_MEMORY_COUNTDOWN_SECONDS = 3;
const EXERCISE_MEMORY_ATTEMPT_WINDOW_MS = 3000;

const EXERCISE_PRESETS = {
  'pitch-matching': {
    badge: 'Preset exercise',
    title: 'Pitch Matching',
    description:
      'Choose the comfortable range you want to practice in, then sing the prompt tone back without seeing the note name first.',
    startLabel: 'Start pitch matching',
  },
  'pitch-memory': {
    badge: 'Memory exercise',
    title: 'Pitch Memory',
    description:
      'Hear a target tone, hold it in memory, then reproduce it after a timed countdown.',
    startLabel: 'Start pitch memory',
  },
};

const exerciseState = {
  panelOpen: false,
  selectedExercise: 'pitch-matching',
  active: false,
  phase: 'idle',
  targetMidi: null,
  rangeLowMidi: 48,
  rangeHighMidi: 60,
  memoryDelaySeconds: 8,
  memoryTimerId: null,
  memoryCountdownIntervalId: null,
  memoryCountdownHideTimerId: null,
  memoryEvaluationEndTime: null,
  holdStartTime: null,
  lastInTuneTime: null,
  attemptStartedAt: null,
  lastResult: null,
  lastDetectedSample: null,
  detailsCollapsed: false,
};

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

function getExerciseSelectableMidis() {
  const midis = [];

  for (
    let midi = EXERCISE_RANGE_LOW_MIDI;
    midi <= EXERCISE_RANGE_HIGH_MIDI;
    midi += 1
  ) {
    midis.push(midi);
  }

  return midis;
}

function populateExerciseRangeOptions() {
  if (!exerciseLowNote || !exerciseHighNote) {
    return;
  }

  const options = getExerciseSelectableMidis()
    .map((midi) => `<option value="${midi}">${midiToNoteName(midi)}</option>`)
    .join('');

  exerciseLowNote.innerHTML = options;
  exerciseHighNote.innerHTML = options;
  exerciseLowNote.value = String(exerciseState.rangeLowMidi);
  exerciseHighNote.value = String(exerciseState.rangeHighMidi);
}

function setExercisePanelOpen(isOpen) {
  if (!exercisePanel || !exerciseToggleButton) {
    return;
  }

  exerciseState.panelOpen = Boolean(isOpen);

  if (exerciseState.panelOpen) {
    setExerciseDetailsCollapsed(true);
  }

  exercisePanel.hidden = !exerciseState.panelOpen;
  exerciseToggleButton.setAttribute(
    'aria-expanded',
    exerciseState.panelOpen ? 'true' : 'false',
  );
  exerciseToggleButton.classList.toggle('is-active', exerciseState.panelOpen);

  if (rollLayout) {
    rollLayout.classList.toggle('is-exercise-open', exerciseState.panelOpen);
  }
}

function setExerciseDetailsCollapsed(isCollapsed) {
  exerciseState.detailsCollapsed = Boolean(isCollapsed);

  if (exercisePanel) {
    exercisePanel.classList.toggle(
      'is-details-collapsed',
      exerciseState.detailsCollapsed,
    );
  }

  if (exerciseDetails) {
    exerciseDetails.hidden = exerciseState.detailsCollapsed;
  }

  if (exerciseDetailsToggle) {
    exerciseDetailsToggle.textContent = exerciseState.detailsCollapsed
      ? 'Show explanation'
      : 'Hide explanation';
    exerciseDetailsToggle.setAttribute(
      'aria-expanded',
      exerciseState.detailsCollapsed ? 'false' : 'true',
    );
  }
}

function describeDirectionFromTarget(deltaSemitones) {
  if (Math.abs(deltaSemitones) <= EXERCISE_MATCH_TOLERANCE) {
    return 'On target';
  }

  if (deltaSemitones < 0) {
    return `Too low by ${Math.abs(deltaSemitones).toFixed(2)} semitones`;
  }

  return `Too high by ${deltaSemitones.toFixed(2)} semitones`;
}

function setExerciseLiveReadout(sample) {
  if (
    !exerciseCurrentNote ||
    !exerciseCurrentFrequency ||
    !exerciseCurrentDelta ||
    !exerciseLiveStatus
  ) {
    return;
  }

  if (!sample) {
    exerciseCurrentNote.textContent = '--';
    exerciseCurrentFrequency.textContent = '--';
    exerciseCurrentDelta.textContent =
      'Current match guidance: waiting for a stable sung note';
    exerciseLiveStatus.textContent = 'Waiting';
    return;
  }

  exerciseCurrentNote.textContent = midiToNoteName(sample.midi);
  exerciseCurrentFrequency.textContent = `${sample.frequency.toFixed(sample.frequency >= 100 ? 1 : 2)} Hz`;
  exerciseLiveStatus.textContent =
    sample.confidence >= EXERCISE_MIN_CONFIDENCE ? 'Stable' : 'Searching';

  if (exerciseState.targetMidi == null) {
    exerciseCurrentDelta.textContent =
      'Current match guidance: exercise not running';
    return;
  }

  const deltaSemitones = sample.midi - exerciseState.targetMidi;
  exerciseCurrentDelta.textContent = `Current match guidance: ${describeDirectionFromTarget(deltaSemitones)}`;
}

function setExerciseFeedback(message, tone = 'neutral') {
  if (!exerciseFeedback) {
    return;
  }

  exerciseFeedback.textContent = message;
  exerciseFeedback.dataset.tone = tone;
}

function setExerciseRevealText(message) {
  if (!exerciseReveal) {
    return;
  }

  exerciseReveal.textContent = message;
}

function setExerciseProgress(progress) {
  if (!exerciseProgressFill) {
    return;
  }

  exerciseProgressFill.style.width = `${clamp(progress * 100, 0, 100)}%`;
}

function setExerciseAttemptText(message) {
  if (!exerciseAttemptLabel) {
    return;
  }

  exerciseAttemptLabel.textContent = message;
}

function setExercisePhaseText(message) {
  if (!exercisePhaseLabel) {
    return;
  }

  exercisePhaseLabel.textContent = message;
}

function syncExerciseRangeFromInputs() {
  if (!exerciseLowNote || !exerciseHighNote) {
    return;
  }

  const lowMidi = Number(exerciseLowNote.value);
  const highMidi = Number(exerciseHighNote.value);

  exerciseState.rangeLowMidi = Math.min(lowMidi, highMidi);
  exerciseState.rangeHighMidi = Math.max(lowMidi, highMidi);

  if (lowMidi !== exerciseState.rangeLowMidi) {
    exerciseLowNote.value = String(exerciseState.rangeLowMidi);
  }

  if (highMidi !== exerciseState.rangeHighMidi) {
    exerciseHighNote.value = String(exerciseState.rangeHighMidi);
  }
}

function resetExerciseAttemptState() {
  exerciseState.active = false;
  exerciseState.phase = 'idle';
  exerciseState.targetMidi = null;
  exerciseState.memoryEvaluationEndTime = null;
  exerciseState.holdStartTime = null;
  exerciseState.lastInTuneTime = null;
  exerciseState.attemptStartedAt = null;
  exerciseState.lastDetectedSample = null;
}

function clearExerciseTimers() {
  if (exerciseState.memoryTimerId != null) {
    window.clearTimeout(exerciseState.memoryTimerId);
    exerciseState.memoryTimerId = null;
  }

  if (exerciseState.memoryCountdownIntervalId != null) {
    window.clearInterval(exerciseState.memoryCountdownIntervalId);
    exerciseState.memoryCountdownIntervalId = null;
  }

  if (exerciseState.memoryCountdownHideTimerId != null) {
    window.clearTimeout(exerciseState.memoryCountdownHideTimerId);
    exerciseState.memoryCountdownHideTimerId = null;
  }
}

function setExerciseCountdownText(message) {
  if (!exerciseMemoryCountdown) {
    return;
  }

  exerciseMemoryCountdown.textContent = message;
}

function syncExerciseMemoryDelayFromInput() {
  if (!exerciseMemoryDelay) {
    return;
  }

  const parsed = Number(exerciseMemoryDelay.value);
  const normalized = Math.round(
    clamp(
      Number.isFinite(parsed)
        ? parsed
        : EXERCISE_MEMORY_MIN_DELAY_SECONDS,
      EXERCISE_MEMORY_MIN_DELAY_SECONDS,
      EXERCISE_MEMORY_MAX_DELAY_SECONDS,
    ),
  );

  exerciseState.memoryDelaySeconds = normalized;
  exerciseMemoryDelay.value = String(normalized);
}

function updateExercisePresetUi() {
  const preset =
    EXERCISE_PRESETS[exerciseState.selectedExercise] ||
    EXERCISE_PRESETS['pitch-matching'];
  const isPitchMemory = exerciseState.selectedExercise === 'pitch-memory';

  if (exerciseType && exerciseType.value !== exerciseState.selectedExercise) {
    exerciseType.value = exerciseState.selectedExercise;
  }

  if (exerciseBadge) {
    exerciseBadge.textContent = preset.badge;
  }

  if (exerciseTitle) {
    exerciseTitle.textContent = preset.title;
  }

  if (exerciseDescription) {
    exerciseDescription.textContent = preset.description;
  }

  if (exerciseStartButton) {
    exerciseStartButton.textContent = preset.startLabel;
  }

  if (exerciseMemoryDelayField) {
    exerciseMemoryDelayField.hidden = !isPitchMemory;
  }

  if (!isPitchMemory) {
    setExerciseCountdownText('--');
  }
}

function setSelectedExercise(exerciseId) {
  const normalized = EXERCISE_PRESETS[exerciseId]
    ? exerciseId
    : 'pitch-matching';
  exerciseState.selectedExercise = normalized;
  clearExerciseTimers();
  resetExerciseAttemptState();
  updateExercisePresetUi();
  resetExerciseUi();
}

function resetExerciseUi() {
  setExerciseAttemptText('Idle');
  setExercisePhaseText('Idle');
  setExerciseFeedback('Select your range and start when you are ready.');
  setExerciseRevealText('--');
  setExerciseProgress(0);
  setExerciseCountdownText('--');
  setExerciseLiveReadout(null);
}

function chooseExerciseTargetMidi() {
  const range = exerciseState.rangeHighMidi - exerciseState.rangeLowMidi + 1;
  return (
    exerciseState.rangeLowMidi + Math.floor(Math.random() * Math.max(1, range))
  );
}

async function playReferenceToneForDuration(midi, durationMs = 1200) {
  const roundedMidi = Math.round(
    clamp(midi, REFERENCE_LOW_MIDI, REFERENCE_HIGH_MIDI),
  );
  const frequency = midiToFrequency(roundedMidi);

  stopSustainedReferenceTone();

  const ctx = getReferenceAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const now = ctx.currentTime;
  const stopAt = now + durationMs / 1000;
  const mixGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const oscillators = [
    ctx.createOscillator(),
    ctx.createOscillator(),
    ctx.createOscillator(),
  ];
  const partialGains = [ctx.createGain(), ctx.createGain(), ctx.createGain()];

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3400, now);
  filter.Q.setValueAtTime(0.9, now);

  partialGains[0].gain.setValueAtTime(0.85, now);
  partialGains[1].gain.setValueAtTime(0.23, now);
  partialGains[2].gain.setValueAtTime(0.14, now);

  oscillators[0].type = 'triangle';
  oscillators[0].frequency.setValueAtTime(frequency, now);
  oscillators[1].type = 'sine';
  oscillators[1].frequency.setValueAtTime(frequency * 2, now);
  oscillators[2].type = 'sine';
  oscillators[2].frequency.setValueAtTime(frequency * 3, now);

  mixGain.gain.setValueAtTime(0.0001, now);
  mixGain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
  mixGain.gain.setValueAtTime(0.24, Math.max(now + 0.06, stopAt - 0.18));
  mixGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  for (let index = 0; index < oscillators.length; index += 1) {
    oscillators[index].connect(partialGains[index]);
    partialGains[index].connect(mixGain);
    oscillators[index].start(now);
    oscillators[index].stop(stopAt + 0.02);
  }

  mixGain.connect(filter);
  filter.connect(referenceMasterGain);

  window.setTimeout(() => {
    for (const oscillator of oscillators) {
      oscillator.disconnect();
    }
    for (const gainNode of partialGains) {
      gainNode.disconnect();
    }
    mixGain.disconnect();
    filter.disconnect();
  }, durationMs + 180);
}

async function replayExerciseTone() {
  if (exerciseState.targetMidi == null) {
    return;
  }

  try {
    await playReferenceToneForDuration(exerciseState.targetMidi);
  } catch {
    setExerciseFeedback(
      'Audio playback was blocked. Tap again to replay.',
      'warning',
    );
  }
}

async function startPitchMatchingExercise() {
  syncExerciseRangeFromInputs();

  if (!running) {
    await startAudio();
  }

  if (!running) {
    return;
  }

  clearExerciseTimers();
  resetExerciseAttemptState();
  exerciseState.targetMidi = chooseExerciseTargetMidi();
  exerciseState.active = true;
  exerciseState.phase = 'matching-listening';
  exerciseState.attemptStartedAt = performance.now();
  exerciseState.lastResult = null;
  exerciseState.lastDetectedSample = null;
  exerciseState.lastInTuneTime = null;

  setExerciseAttemptText('Listening for a match');
  setExercisePhaseText('Prompt + matching');
  setExerciseFeedback(
    `Match the hidden tone within +/-${EXERCISE_MATCH_TOLERANCE_CENTS} cents and hold it for 1 second.`,
    'neutral',
  );
  setExerciseRevealText('Hidden');
  setExerciseProgress(0);
  setExerciseLiveReadout(null);

  setStatus('Exercise prompt playing', true);
  await replayExerciseTone();
}

function finalizePitchMemoryAttempt(success) {
  if (exerciseState.targetMidi == null) {
    return;
  }

  const revealedNote = midiToNoteName(exerciseState.targetMidi);
  const detectedSample = exerciseState.lastDetectedSample;
  const attemptSummary = detectedSample
    ? ` Your closest stable note was ${midiToNoteName(detectedSample.midi)} at ${detectedSample.frequency.toFixed(1)} Hz.`
    : ' No stable sung note was detected during the one-second sing window.';
  const message = success
    ? `Success. You recalled ${revealedNote} and held it for 1 second.`
    : `Try again. The target note was ${revealedNote}.${attemptSummary}`;

  clearExerciseTimers();
  resetExerciseAttemptState();
  setExerciseProgress(success ? 1 : 0);
  setExerciseAttemptText(success ? 'Matched from memory' : 'Memory miss');
  setExercisePhaseText('Complete');
  setExerciseFeedback(message, success ? 'success' : 'warning');
  setExerciseRevealText(revealedNote);
  setExerciseCountdownText('--');
  setStatus(success ? 'Exercise success' : 'Exercise try again', true);
}

function beginPitchMemorySingWindow() {
  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'pitch-memory' ||
    exerciseState.targetMidi == null
  ) {
    return;
  }

  exerciseState.phase = 'memory-sing';
  exerciseState.holdStartTime = null;
  exerciseState.lastInTuneTime = null;
  exerciseState.lastDetectedSample = null;
  exerciseState.attemptStartedAt = performance.now();
  exerciseState.memoryEvaluationEndTime =
    exerciseState.attemptStartedAt + EXERCISE_MEMORY_ATTEMPT_WINDOW_MS;

  setExerciseCountdownText('Go');
  setExerciseAttemptText('Sing now');
  setExercisePhaseText('Sing');
  setExerciseFeedback(
    `Sing the remembered pitch for up to 3 seconds. Hold in tune for 1 second within +/-${EXERCISE_MATCH_TOLERANCE_CENTS} cents.`,
    'neutral',
  );
  setStatus('Pitch memory: sing now', true);

  exerciseState.memoryCountdownHideTimerId = window.setTimeout(() => {
    if (
      exerciseState.active &&
      exerciseState.selectedExercise === 'pitch-memory' &&
      exerciseState.phase === 'memory-sing'
    ) {
      setExerciseCountdownText('--');
    }
  }, 850);
}

function startPitchMemoryCountdown() {
  if (!exerciseState.active || exerciseState.selectedExercise !== 'pitch-memory') {
    return;
  }

  exerciseState.phase = 'memory-countdown';
  let countdownValue = EXERCISE_MEMORY_COUNTDOWN_SECONDS;
  setExerciseCountdownText(String(countdownValue));
  setExerciseAttemptText('Get ready');
  setExercisePhaseText('Countdown');
  setExerciseFeedback('Countdown started. Prepare to sing on Go.', 'neutral');
  setStatus('Pitch memory countdown', true);

  exerciseState.memoryCountdownIntervalId = window.setInterval(() => {
    countdownValue -= 1;

    if (countdownValue > 0) {
      setExerciseCountdownText(String(countdownValue));
      return;
    }

    clearExerciseTimers();
    beginPitchMemorySingWindow();
  }, 1000);
}

async function startPitchMemoryExercise() {
  syncExerciseRangeFromInputs();
  syncExerciseMemoryDelayFromInput();

  if (!running) {
    await startAudio();
  }

  if (!running) {
    return;
  }

  clearExerciseTimers();
  resetExerciseAttemptState();
  exerciseState.targetMidi = chooseExerciseTargetMidi();
  exerciseState.active = true;
  exerciseState.phase = 'memory-prompt';
  exerciseState.lastResult = null;

  setExerciseAttemptText('Memorize the prompt tone');
  setExercisePhaseText('Prompt');
  setExerciseFeedback(
    `Listen now. You will sing the same pitch after ${exerciseState.memoryDelaySeconds} seconds.`,
    'neutral',
  );
  setExerciseRevealText('Hidden');
  setExerciseProgress(0);
  setExerciseCountdownText('--');
  setExerciseLiveReadout(null);

  setStatus('Exercise prompt playing', true);
  await replayExerciseTone();

  if (!exerciseState.active || exerciseState.selectedExercise !== 'pitch-memory') {
    return;
  }

  const preCountdownDelayMs = Math.max(
    0,
    (exerciseState.memoryDelaySeconds - EXERCISE_MEMORY_COUNTDOWN_SECONDS) *
      1000,
  );

  if (preCountdownDelayMs <= 0) {
    startPitchMemoryCountdown();
    return;
  }

  exerciseState.phase = 'memory-wait';
  setExerciseAttemptText('Waiting for countdown');
  setExercisePhaseText('Memory hold');
  setExerciseFeedback(
    'Hold the tone in memory. Countdown starts soon.',
    'neutral',
  );
  setStatus('Pitch memory: waiting', true);

  exerciseState.memoryTimerId = window.setTimeout(() => {
    startPitchMemoryCountdown();
  }, preCountdownDelayMs);
}

function finalizePitchMatchingAttempt(success) {
  if (exerciseState.targetMidi == null) {
    return;
  }

  const revealedNote = midiToNoteName(exerciseState.targetMidi);
  const detectedSample = exerciseState.lastDetectedSample;
  const attemptSummary = detectedSample
    ? ` You were closest to ${midiToNoteName(detectedSample.midi)} at ${detectedSample.frequency.toFixed(1)} Hz.`
    : ' No stable sung note was detected during the attempt.';
  const message = success
    ? `Success. You matched ${revealedNote} for 1 second.`
    : `Try again. The target note was ${revealedNote}.${attemptSummary}`;

  clearExerciseTimers();
  resetExerciseAttemptState();
  setExerciseProgress(success ? 1 : 0);
  setExerciseAttemptText(success ? 'Matched' : 'Try again');
  setExercisePhaseText('Complete');
  setExerciseFeedback(message, success ? 'success' : 'warning');
  setExerciseRevealText(revealedNote);
  setExerciseCountdownText('--');
  setStatus(success ? 'Exercise success' : 'Exercise try again', true);
}

function updatePitchMatchingExercise(sample) {
  if (!exerciseState.active || exerciseState.targetMidi == null) {
    return;
  }

  const now = performance.now();
  exerciseState.lastDetectedSample = {
    frequency: sample.frequency,
    midi: sample.midi,
    confidence: sample.confidence,
  };
  const withinTolerance =
    sample.confidence >= EXERCISE_MIN_CONFIDENCE &&
    Math.abs(sample.midi - exerciseState.targetMidi) <=
      EXERCISE_MATCH_TOLERANCE;
  const deltaSemitones = sample.midi - exerciseState.targetMidi;

  if (withinTolerance) {
    if (exerciseState.holdStartTime == null) {
      exerciseState.holdStartTime = now;
    }
    exerciseState.lastInTuneTime = now;

    const heldMs = now - exerciseState.holdStartTime;
    setExerciseAttemptText(`Hold steady: ${(heldMs / 1000).toFixed(2)}s`);
    setExerciseFeedback(
      'Keep holding the pitch steady until the bar fills.',
      'neutral',
    );
    setExerciseProgress(heldMs / EXERCISE_SUCCESS_HOLD_MS);

    if (heldMs >= EXERCISE_SUCCESS_HOLD_MS) {
      finalizePitchMatchingAttempt(true);
    }

    return;
  }

  if (
    exerciseState.holdStartTime != null &&
    exerciseState.lastInTuneTime != null &&
    now - exerciseState.lastInTuneTime <= EXERCISE_HOLD_GRACE_MS
  ) {
    const heldMs = now - exerciseState.holdStartTime;
    setExerciseAttemptText(`Hold steady: ${(heldMs / 1000).toFixed(2)}s`);
    setExerciseFeedback(
      'Close enough. Keep the pitch centered and steady.',
      'neutral',
    );
    setExerciseProgress(heldMs / EXERCISE_SUCCESS_HOLD_MS);

    if (heldMs >= EXERCISE_SUCCESS_HOLD_MS) {
      finalizePitchMatchingAttempt(true);
    }

    return;
  }

  exerciseState.holdStartTime = null;
  exerciseState.lastInTuneTime = null;
  setExerciseProgress(0);
  setExerciseAttemptText('Searching for the target');
  setExerciseFeedback(
    `Try to center on the prompt pitch and sustain it. ${describeDirectionFromTarget(deltaSemitones)}.`,
    'neutral',
  );

  if (now - exerciseState.attemptStartedAt >= EXERCISE_ATTEMPT_WINDOW_MS) {
    finalizePitchMatchingAttempt(false);
  }
}

function updatePitchMemoryExercise(sample) {
  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'pitch-memory' ||
    exerciseState.targetMidi == null ||
    exerciseState.phase !== 'memory-sing'
  ) {
    return;
  }

  const now = performance.now();
  exerciseState.lastDetectedSample = {
    frequency: sample.frequency,
    midi: sample.midi,
    confidence: sample.confidence,
  };

  const withinTolerance =
    sample.confidence >= EXERCISE_MIN_CONFIDENCE &&
    Math.abs(sample.midi - exerciseState.targetMidi) <=
      EXERCISE_MATCH_TOLERANCE;

  if (withinTolerance) {
    if (exerciseState.holdStartTime == null) {
      exerciseState.holdStartTime = now;
    }

    exerciseState.lastInTuneTime = now;
    const heldMs = now - exerciseState.holdStartTime;

    setExerciseAttemptText(`Sing now: ${(heldMs / 1000).toFixed(2)}s`);
    setExerciseFeedback('Keep holding through the end of the sing window.', 'neutral');
    setExerciseProgress(heldMs / EXERCISE_SUCCESS_HOLD_MS);

    if (heldMs >= EXERCISE_SUCCESS_HOLD_MS) {
      finalizePitchMemoryAttempt(true);
      return;
    }
  } else if (
    exerciseState.holdStartTime != null &&
    exerciseState.lastInTuneTime != null &&
    now - exerciseState.lastInTuneTime <= EXERCISE_HOLD_GRACE_MS
  ) {
    const heldMs = now - exerciseState.holdStartTime;
    setExerciseAttemptText(`Sing now: ${(heldMs / 1000).toFixed(2)}s`);
    setExerciseFeedback('Close. Keep steady and centered.', 'neutral');
    setExerciseProgress(heldMs / EXERCISE_SUCCESS_HOLD_MS);

    if (heldMs >= EXERCISE_SUCCESS_HOLD_MS) {
      finalizePitchMemoryAttempt(true);
      return;
    }
  } else {
    exerciseState.holdStartTime = null;
    exerciseState.lastInTuneTime = null;
    setExerciseProgress(0);
    setExerciseAttemptText('Sing now');
    setExerciseFeedback(
      `Center on the remembered pitch. ${describeDirectionFromTarget(sample.midi - exerciseState.targetMidi)}.`,
      'neutral',
    );
  }

  if (
    exerciseState.memoryEvaluationEndTime != null &&
    now >= exerciseState.memoryEvaluationEndTime
  ) {
    finalizePitchMemoryAttempt(false);
  }
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
    setExerciseLiveReadout(null);
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
  setExerciseLiveReadout(sample);
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

function stabilizeMidi(rawMidi, confidence = 0) {
  const vocalMidi = clamp(rawMidi, VOCAL_LOW_MIDI, VOCAL_HIGH_MIDI);

  if (lastStableMidi == null) {
    return vocalMidi;
  }

  let candidateMidi = vocalMidi;
  const maxStepPerFrame =
    confidence < 0.78 ? LOW_CONFIDENCE_SLEW_LIMIT : HIGH_CONFIDENCE_SLEW_LIMIT;
  const directedStep = candidateMidi - lastStableMidi;
  if (Math.abs(directedStep) > maxStepPerFrame) {
    candidateMidi = lastStableMidi + Math.sign(directedStep) * maxStepPerFrame;
  }

  const pitchStep = Math.abs(candidateMidi - lastStableMidi);

  if (pitchStep > MAX_PITCH_STEP && confidence < 0.78) {
    const conservativeSmoothing = SMOOTHING * 0.45;
    return (
      lastStableMidi * (1 - conservativeSmoothing) +
      candidateMidi * conservativeSmoothing
    );
  }

  return lastStableMidi * (1 - SMOOTHING) + candidateMidi * SMOOTHING;
}

function filterOnsetTransient(rawMidi, confidence = 0) {
  recentRawMidiSamples.push(rawMidi);
  recentRawMidiSamples = recentRawMidiSamples.slice(-4);

  if (recentRawMidiSamples.length < 3) {
    return rawMidi;
  }

  const previous = recentRawMidiSamples.slice(0, -1);
  const baseline = median(previous);
  const latest = recentRawMidiSamples[recentRawMidiSamples.length - 1];
  const transientJump = Math.abs(latest - baseline);

  if (transientJump > 3.2 && confidence < 0.82) {
    return baseline + clamp(latest - baseline, -1.8, 1.8);
  }

  return latest;
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

function autoCorrelate(buffer, sampleRate, referenceFrequency = null) {
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

  const localPeakThreshold = peakValue * 0.28;

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

  const localPeaks = [];

  for (let index = firstValley + 1; index < maxLag; index += 1) {
    const current = correlates[index];
    if (
      current > correlates[index - 1] &&
      current >= correlates[index + 1] &&
      current >= localPeakThreshold
    ) {
      localPeaks.push(index);
    }
  }

  if (localPeaks.length === 0) {
    for (let index = minLag; index < maxLag; index += 1) {
      const current = correlates[index];
      if (
        current > correlates[index - 1] &&
        current >= correlates[index + 1] &&
        current >= localPeakThreshold
      ) {
        localPeaks.push(index);
      }
    }
  }

  let best = -1;
  let bestScore = -Infinity;

  const expectedLag =
    referenceFrequency && isFinite(referenceFrequency) && referenceFrequency > 0
      ? sampleRate / referenceFrequency
      : null;

  for (const lag of localPeaks) {
    const normalized = correlates[lag] / (peakValue || 1);
    const octaveLag = lag * 2;
    const fifthLag = lag * 3;
    const octaveSupport =
      octaveLag <= maxLag ? correlates[octaveLag] / (peakValue || 1) : 0;
    const fifthSupport =
      fifthLag <= maxLag ? correlates[fifthLag] / (peakValue || 1) : 0;

    let score = normalized;

    // Favor candidates that also show harmonic structure and a lower-fundamental bias.
    score += clamp(octaveSupport, 0, 1) * 0.2;
    score += clamp(fifthSupport, 0, 1) * 0.12;
    score += (lag / maxLag) * 0.06;

    if (expectedLag) {
      const lagRatio = lag / expectedLag;
      const semitoneDistance = Math.abs(12 * Math.log2(lagRatio));
      const continuity = clamp(1 - semitoneDistance / 9, 0, 1);
      score += continuity * 0.18;
    }

    if (score > bestScore) {
      bestScore = score;
      best = lag;
    }
  }

  if (best === -1) {
    let bestValue = -Infinity;
    for (let index = minLag; index <= maxLag; index += 1) {
      if (correlates[index] > bestValue) {
        bestValue = correlates[index];
        best = index;
      }
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
  const referenceFrequency =
    lastStableMidi != null ? midiToFrequency(lastStableMidi) : null;
  const result = autoCorrelate(
    buffer,
    audioContext.sampleRate,
    referenceFrequency,
  );

  if (result.frequency > 0) {
    const rawMidi = frequencyToMidi(result.frequency);
    const filteredRawMidi = filterOnsetTransient(rawMidi, result.confidence);
    const stabilizedMidi = stabilizeMidi(filteredRawMidi, result.confidence);
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
    if (exerciseState.active) {
      if (exerciseState.selectedExercise === 'pitch-memory') {
        updatePitchMemoryExercise(sample);
      } else {
        updatePitchMatchingExercise(sample);
      }
    }
    setPitchDisplay(sample);
    if (!exerciseState.active) {
      setStatus('Listening', true);
    }
  } else if (performance.now() % 1000 < 25) {
    const expectsSingingNow =
      exerciseState.active &&
      (exerciseState.selectedExercise === 'pitch-matching' ||
        (exerciseState.selectedExercise === 'pitch-memory' &&
          exerciseState.phase === 'memory-sing'));

    if (expectsSingingNow) {
      setExerciseLiveReadout(null);
      setExerciseAttemptText('Waiting for a stable note');
      setExerciseFeedback(
        'Sing the prompt pitch clearly so the tracker can lock on.',
        'neutral',
      );
    } else if (!exerciseState.active) {
      setStatus('Listening for pitch...');
    }

    const now = performance.now();

    if (
      exerciseState.active &&
      exerciseState.selectedExercise === 'pitch-matching' &&
      exerciseState.attemptStartedAt != null &&
      now - exerciseState.attemptStartedAt >= EXERCISE_ATTEMPT_WINDOW_MS
    ) {
      finalizePitchMatchingAttempt(false);
    }

    if (
      exerciseState.active &&
      exerciseState.selectedExercise === 'pitch-memory' &&
      exerciseState.phase === 'memory-sing' &&
      exerciseState.memoryEvaluationEndTime != null &&
      now >= exerciseState.memoryEvaluationEndTime
    ) {
      finalizePitchMemoryAttempt(false);
    }
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
  recentRawMidiSamples = [];
  clearExerciseTimers();
  resetExerciseAttemptState();

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
  clearExerciseTimers();
  resetExerciseAttemptState();
  resetExerciseUi();
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

if (exerciseToggleButton) {
  exerciseToggleButton.addEventListener('click', () => {
    setExercisePanelOpen(!exerciseState.panelOpen);
  });
}

if (exerciseLowNote && exerciseHighNote) {
  exerciseLowNote.addEventListener('change', syncExerciseRangeFromInputs);
  exerciseHighNote.addEventListener('change', syncExerciseRangeFromInputs);
}

if (exerciseMemoryDelay) {
  exerciseMemoryDelay.addEventListener('change', syncExerciseMemoryDelayFromInput);
  exerciseMemoryDelay.addEventListener('blur', syncExerciseMemoryDelayFromInput);
}

if (exerciseType) {
  exerciseType.addEventListener('change', () => {
    setSelectedExercise(exerciseType.value);
  });
}

if (exerciseStartButton) {
  exerciseStartButton.addEventListener('click', async () => {
    if (exerciseState.selectedExercise === 'pitch-memory') {
      await startPitchMemoryExercise();
      return;
    }

    await startPitchMatchingExercise();
  });
}

if (exerciseDetailsToggle) {
  exerciseDetailsToggle.addEventListener('click', () => {
    setExerciseDetailsCollapsed(!exerciseState.detailsCollapsed);
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
populateExerciseRangeOptions();
syncExerciseMemoryDelayFromInput();
setExerciseDetailsCollapsed(true);
updateExercisePresetUi();
resetExerciseUi();
setStatus('Mic idle');
render();

if (!navigator.mediaDevices?.getUserMedia) {
  toggleButton.disabled = true;
  setStatus('Mic input unsupported');
  stabilityLabel.textContent = 'This browser cannot access the microphone';
}

window.addEventListener('beforeunload', stopAudio);
