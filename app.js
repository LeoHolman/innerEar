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
const exerciseScaleType = document.getElementById('exerciseScaleType');
const exerciseScaleTypeField = document.getElementById(
  'exerciseScaleTypeField',
);
const exerciseScaleDirection = document.getElementById(
  'exerciseScaleDirection',
);
const exerciseScaleDirectionField = document.getElementById(
  'exerciseScaleDirectionField',
);
const exerciseGrading = document.getElementById('exerciseGrading');
const exerciseHints = document.getElementById('exerciseHints');
const exerciseRandomTonicField = document.getElementById(
  'exerciseRandomTonicField',
);
const exerciseRandomTonic = document.getElementById('exerciseRandomTonic');
const exerciseFixedTonicField = document.getElementById(
  'exerciseFixedTonicField',
);
const exerciseFixedTonic = document.getElementById('exerciseFixedTonic');
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
const EXERCISE_DEFAULT_DELAY_SECONDS = 3;
const EXERCISE_MEMORY_DEFAULT_DELAY_SECONDS = 8;
const EXERCISE_MEMORY_MIN_DELAY_SECONDS = 1;
const EXERCISE_MEMORY_MAX_DELAY_SECONDS = 100;
const EXERCISE_MEMORY_COUNTDOWN_SECONDS = 3;
const EXERCISE_MEMORY_ATTEMPT_WINDOW_MS = 3000;
const EXERCISE_SCALE_STEP_HOLD_MS = 1000;
const EXERCISE_SCALE_TOTAL_TIMEOUT_MS = 36000;
const FOLLOW_SCALE_PROMPT_MS = 1000;
const FOLLOW_SCALE_TOAST_PAUSE_MS = 500;
const RANDOM_SCALE_DEGREE_SCALE_TYPE = 'major';
const EXERCISE_LAX_TOLERANCE_MULTIPLIER = 1.5;
const EXERCISE_LAX_HOLD_MULTIPLIER = 0.75;

const SCALE_PATTERNS = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  minor: [0, 2, 3, 5, 7, 8, 10, 12],
  pentatonic: [0, 2, 4, 7, 9, 12],
};

const SCALE_LABELS = {
  major: 'Major',
  minor: 'Minor',
  pentatonic: 'Pentatonic',
};

const SCALE_DIRECTIONS = {
  ascending: 'ascending',
  descending: 'descending',
};

const GRADING_MODES = {
  strict: 'strict',
  lax: 'lax',
};

const HINT_MODES = {
  all: 'all',
  gentle: 'gentle',
  none: 'none',
};

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
  'match-scale': {
    badge: 'Scale exercise',
    title: 'Sing the Scale',
    description:
      'Hear the tonic, then sing upward through each scale degree and hold every note for one second.',
    startLabel: 'Start sing the scale',
  },
  'random-scale-degree': {
    badge: 'Scale exercise',
    title: 'Random Scale Degree',
    description:
      'Hear a tonic, then sing the requested major scale degree and hold it for one second.',
    startLabel: 'Start random scale degree',
  },
  'follow-scale': {
    badge: 'Scale exercise',
    title: 'Follow the Scale',
    description:
      'Hear each scale tone for one second, clear it with the toast cue, then sing it back before moving on.',
    startLabel: 'Start follow the scale',
  },
};

const exerciseState = {
  panelOpen: true,
  selectedExercise: 'pitch-matching',
  active: false,
  phase: 'idle',
  targetMidi: null,
  rangeLowMidi: 48,
  rangeHighMidi: 60,
  memoryDelaySeconds: EXERCISE_MEMORY_DEFAULT_DELAY_SECONDS,
  gradingMode: GRADING_MODES.strict,
  hintMode: HINT_MODES.all,
  scaleType: 'major',
  scaleDirection: SCALE_DIRECTIONS.ascending,
  scaleNotes: [],
  scaleStepIndex: 0,
  scaleSingStartedAt: null,
  scaleRecordedSamples: [],
  scaleReview: null,
  randomDegreeTonicMidi: null,
  randomDegreeNumber: null,
  randomDegreeUseRandomTonic: true,
  randomDegreeFixedTonicMidi: 60,
  followScaleAdvanceTimerId: null,
  memoryTimerId: null,
  memoryCountdownIntervalId: null,
  memoryCountdownHideTimerId: null,
  memoryEvaluationEndTime: null,
  holdStartTime: null,
  lastInTuneTime: null,
  attemptStartedAt: null,
  lastResult: null,
  lastDetectedSample: null,
  detailsCollapsed: true,
};

const SETTINGS_STORAGE_KEY = 'innerEar.settings.v1';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function waitMs(durationMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, Math.max(0, durationMs));
  });
}

function hideExerciseToast() {
  if (
    window.innerEarToast &&
    typeof window.innerEarToast.dismiss === 'function'
  ) {
    window.innerEarToast.dismiss();
  }
}

function showExerciseToast(message, tone = 'neutral') {
  if (window.innerEarToast && typeof window.innerEarToast.show === 'function') {
    window.innerEarToast.show(message, tone);
    return;
  }

  setExerciseFeedback(message, tone === 'success' ? 'success' : 'neutral');
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

function savePersistedSettings() {
  try {
    const payload = {
      selectedExercise: exerciseState.selectedExercise,
      rangeLowMidi: exerciseState.rangeLowMidi,
      rangeHighMidi: exerciseState.rangeHighMidi,
      memoryDelaySeconds: exerciseState.memoryDelaySeconds,
      gradingMode: exerciseState.gradingMode,
      hintMode: exerciseState.hintMode,
      scaleType: exerciseState.scaleType,
      scaleDirection: exerciseState.scaleDirection,
      randomDegreeUseRandomTonic: exerciseState.randomDegreeUseRandomTonic,
      randomDegreeFixedTonicMidi: exerciseState.randomDegreeFixedTonicMidi,
      panelOpen: exerciseState.panelOpen,
      detailsCollapsed: exerciseState.detailsCollapsed,
      followPitchEnabled,
      referenceVolume: referenceVolume ? Number(referenceVolume.value) : null,
    };

    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures (private mode, quota, etc.) and keep app usable.
  }
}

function loadPersistedSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const settings = JSON.parse(raw);
    if (!settings || typeof settings !== 'object') {
      return;
    }

    if (
      typeof settings.selectedExercise === 'string' &&
      EXERCISE_PRESETS[settings.selectedExercise]
    ) {
      exerciseState.selectedExercise = settings.selectedExercise;
    }

    const low = Number(settings.rangeLowMidi);
    const high = Number(settings.rangeHighMidi);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      exerciseState.rangeLowMidi = Math.round(
        clamp(
          Math.min(low, high),
          EXERCISE_RANGE_LOW_MIDI,
          EXERCISE_RANGE_HIGH_MIDI,
        ),
      );
      exerciseState.rangeHighMidi = Math.round(
        clamp(
          Math.max(low, high),
          EXERCISE_RANGE_LOW_MIDI,
          EXERCISE_RANGE_HIGH_MIDI,
        ),
      );
    }

    const memoryDelay = Number(settings.memoryDelaySeconds);
    if (Number.isFinite(memoryDelay)) {
      exerciseState.memoryDelaySeconds = Math.round(
        clamp(
          memoryDelay,
          EXERCISE_MEMORY_MIN_DELAY_SECONDS,
          EXERCISE_MEMORY_MAX_DELAY_SECONDS,
        ),
      );
    }

    if (
      settings.gradingMode === GRADING_MODES.strict ||
      settings.gradingMode === GRADING_MODES.lax
    ) {
      exerciseState.gradingMode = settings.gradingMode;
    }

    if (
      settings.hintMode === HINT_MODES.all ||
      settings.hintMode === HINT_MODES.gentle ||
      settings.hintMode === HINT_MODES.none
    ) {
      exerciseState.hintMode = settings.hintMode;
    }

    if (
      typeof settings.scaleType === 'string' &&
      SCALE_PATTERNS[settings.scaleType]
    ) {
      exerciseState.scaleType = settings.scaleType;
    }

    if (
      settings.scaleDirection === SCALE_DIRECTIONS.ascending ||
      settings.scaleDirection === SCALE_DIRECTIONS.descending
    ) {
      exerciseState.scaleDirection = settings.scaleDirection;
    }

    if (typeof settings.randomDegreeUseRandomTonic === 'boolean') {
      exerciseState.randomDegreeUseRandomTonic =
        settings.randomDegreeUseRandomTonic;
    }

    const fixedTonic = Number(settings.randomDegreeFixedTonicMidi);
    if (Number.isFinite(fixedTonic)) {
      exerciseState.randomDegreeFixedTonicMidi = Math.round(
        clamp(fixedTonic, EXERCISE_RANGE_LOW_MIDI, EXERCISE_RANGE_HIGH_MIDI),
      );
    }

    if (typeof settings.panelOpen === 'boolean') {
      exerciseState.panelOpen = settings.panelOpen;
    }

    if (typeof settings.detailsCollapsed === 'boolean') {
      exerciseState.detailsCollapsed = settings.detailsCollapsed;
    }

    if (typeof settings.followPitchEnabled === 'boolean') {
      followPitchEnabled = settings.followPitchEnabled;
    }

    if (referenceVolume) {
      const volume = Number(settings.referenceVolume);
      if (Number.isFinite(volume)) {
        referenceVolume.value = String(Math.round(clamp(volume, 0, 100)));
      }
    }
  } catch {
    // Ignore malformed settings and continue with defaults.
  }
}

function applyExerciseStateToInputs() {
  if (exerciseType) {
    exerciseType.value = exerciseState.selectedExercise;
  }

  if (exerciseLowNote) {
    exerciseLowNote.value = String(exerciseState.rangeLowMidi);
  }

  if (exerciseHighNote) {
    exerciseHighNote.value = String(exerciseState.rangeHighMidi);
  }

  if (exerciseMemoryDelay) {
    exerciseMemoryDelay.value = String(exerciseState.memoryDelaySeconds);
  }

  if (exerciseGrading) {
    exerciseGrading.value = exerciseState.gradingMode;
  }

  if (exerciseHints) {
    exerciseHints.value = exerciseState.hintMode;
  }

  if (exerciseScaleType) {
    exerciseScaleType.value = exerciseState.scaleType;
  }

  if (exerciseScaleDirection) {
    exerciseScaleDirection.value = exerciseState.scaleDirection;
  }

  if (exerciseRandomTonic) {
    exerciseRandomTonic.checked = exerciseState.randomDegreeUseRandomTonic;
  }

  if (exerciseFixedTonic) {
    exerciseFixedTonic.value = String(exerciseState.randomDegreeFixedTonicMidi);
  }
}

function setExercisePanelOpen(isOpen) {
  if (!exercisePanel || !exerciseToggleButton) {
    return;
  }

  exerciseState.panelOpen = Boolean(isOpen);

  exercisePanel.hidden = !exerciseState.panelOpen;
  exerciseToggleButton.setAttribute(
    'aria-expanded',
    exerciseState.panelOpen ? 'true' : 'false',
  );
  exerciseToggleButton.classList.toggle('is-active', exerciseState.panelOpen);

  if (rollLayout) {
    rollLayout.classList.toggle('is-exercise-open', exerciseState.panelOpen);
  }

  savePersistedSettings();
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

  savePersistedSettings();
}

function describeDirectionFromTarget(deltaSemitones) {
  if (exerciseState.hintMode === HINT_MODES.none) {
    return '';
  }

  if (Math.abs(deltaSemitones) <= getMatchToleranceSemitones()) {
    return 'On target';
  }

  if (deltaSemitones < 0) {
    if (exerciseState.hintMode === HINT_MODES.gentle) {
      return 'Too low';
    }

    return `Too low by ${Math.abs(deltaSemitones).toFixed(2)} semitones`;
  }

  if (exerciseState.hintMode === HINT_MODES.gentle) {
    return 'Too high';
  }

  return `Too high by ${deltaSemitones.toFixed(2)} semitones`;
}

function withDirectionalHint(baseText, deltaSemitones) {
  const hint = describeDirectionFromTarget(deltaSemitones);
  if (!hint) {
    return baseText;
  }

  return `${baseText} ${hint}.`;
}

function isLaxGrading() {
  return exerciseState.gradingMode === GRADING_MODES.lax;
}

function getMatchToleranceSemitones() {
  return (
    EXERCISE_MATCH_TOLERANCE *
    (isLaxGrading() ? EXERCISE_LAX_TOLERANCE_MULTIPLIER : 1)
  );
}

function getMatchToleranceCents() {
  return Math.round(getMatchToleranceSemitones() * 100);
}

function getHoldTargetMs() {
  return Math.round(
    EXERCISE_SUCCESS_HOLD_MS *
      (isLaxGrading() ? EXERCISE_LAX_HOLD_MULTIPLIER : 1),
  );
}

function getScaleStepHoldTargetMs() {
  return Math.round(
    EXERCISE_SCALE_STEP_HOLD_MS *
      (isLaxGrading() ? EXERCISE_LAX_HOLD_MULTIPLIER : 1),
  );
}

function getHoldTargetSecondsText() {
  const seconds = getHoldTargetMs() / 1000;
  const rendered = Number.isInteger(seconds)
    ? String(seconds)
    : seconds.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${rendered} second${seconds === 1 ? '' : 's'}`;
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

  if (
    exerciseState.selectedExercise === 'pitch-memory' &&
    exerciseState.phase !== 'memory-sing'
  ) {
    exerciseCurrentDelta.textContent =
      'Current match guidance: hidden until Go';
    return;
  }

  if (
    exerciseState.selectedExercise === 'follow-scale' &&
    exerciseState.phase !== 'follow-sing'
  ) {
    exerciseCurrentDelta.textContent =
      'Current match guidance: hidden until the prompt ends';
    return;
  }

  let targetMidi = exerciseState.targetMidi;
  if (
    exerciseState.selectedExercise === 'match-scale' &&
    exerciseState.active &&
    exerciseState.phase === 'scale-sing' &&
    exerciseState.scaleNotes.length > 0
  ) {
    const scaleTargetIndex = clamp(
      exerciseState.scaleStepIndex,
      0,
      exerciseState.scaleNotes.length - 1,
    );
    targetMidi = exerciseState.scaleNotes[scaleTargetIndex];
  }

  const deltaSemitones = sample.midi - targetMidi;
  if (exerciseState.hintMode === HINT_MODES.none) {
    exerciseCurrentDelta.textContent = 'Current match guidance: hints off';
    return;
  }

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

  populateRandomDegreeFixedTonicOptions();
  savePersistedSettings();
}

function populateRandomDegreeFixedTonicOptions() {
  if (!exerciseFixedTonic) {
    return;
  }

  const options = [];
  for (
    let midi = exerciseState.rangeLowMidi;
    midi <= exerciseState.rangeHighMidi;
    midi += 1
  ) {
    options.push(`<option value="${midi}">${midiToNoteName(midi)}</option>`);
  }

  exerciseFixedTonic.innerHTML = options.join('');

  const clamped = clamp(
    exerciseState.randomDegreeFixedTonicMidi,
    exerciseState.rangeLowMidi,
    exerciseState.rangeHighMidi,
  );
  exerciseState.randomDegreeFixedTonicMidi = clamped;
  exerciseFixedTonic.value = String(clamped);
}

function syncRandomDegreeUseRandomTonicFromInput() {
  if (!exerciseRandomTonic) {
    return;
  }

  exerciseState.randomDegreeUseRandomTonic = Boolean(
    exerciseRandomTonic.checked,
  );
  updateExercisePresetUi();
  savePersistedSettings();
}

function syncRandomDegreeFixedTonicFromInput() {
  if (!exerciseFixedTonic) {
    return;
  }

  const parsed = Number(exerciseFixedTonic.value);
  const normalized = Math.round(
    clamp(
      Number.isFinite(parsed) ? parsed : exerciseState.rangeLowMidi,
      exerciseState.rangeLowMidi,
      exerciseState.rangeHighMidi,
    ),
  );

  exerciseState.randomDegreeFixedTonicMidi = normalized;
  exerciseFixedTonic.value = String(normalized);
  savePersistedSettings();
}

function resetExerciseAttemptState() {
  exerciseState.active = false;
  exerciseState.phase = 'idle';
  exerciseState.targetMidi = null;
  exerciseState.scaleNotes = [];
  exerciseState.scaleStepIndex = 0;
  exerciseState.scaleSingStartedAt = null;
  exerciseState.scaleRecordedSamples = [];
  exerciseState.randomDegreeTonicMidi = null;
  exerciseState.randomDegreeNumber = null;
  exerciseState.memoryEvaluationEndTime = null;
  exerciseState.holdStartTime = null;
  exerciseState.lastInTuneTime = null;
  exerciseState.attemptStartedAt = null;
  exerciseState.lastDetectedSample = null;
  hideExerciseToast();
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

  if (exerciseState.followScaleAdvanceTimerId != null) {
    window.clearTimeout(exerciseState.followScaleAdvanceTimerId);
    exerciseState.followScaleAdvanceTimerId = null;
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
      Number.isFinite(parsed) ? parsed : EXERCISE_MEMORY_MIN_DELAY_SECONDS,
      EXERCISE_MEMORY_MIN_DELAY_SECONDS,
      EXERCISE_MEMORY_MAX_DELAY_SECONDS,
    ),
  );

  exerciseState.memoryDelaySeconds = normalized;
  exerciseMemoryDelay.value = String(normalized);
  savePersistedSettings();
}

function syncExerciseGradingFromInput() {
  if (!exerciseGrading) {
    return;
  }

  const nextMode =
    exerciseGrading.value === GRADING_MODES.lax
      ? GRADING_MODES.lax
      : GRADING_MODES.strict;

  exerciseState.gradingMode = nextMode;
  exerciseGrading.value = nextMode;
  savePersistedSettings();
}

function syncExerciseHintsFromInput() {
  if (!exerciseHints) {
    return;
  }

  const nextMode =
    exerciseHints.value === HINT_MODES.gentle
      ? HINT_MODES.gentle
      : exerciseHints.value === HINT_MODES.none
        ? HINT_MODES.none
        : HINT_MODES.all;

  exerciseState.hintMode = nextMode;
  exerciseHints.value = nextMode;
  savePersistedSettings();
}

function syncExerciseScaleTypeFromInput() {
  if (!exerciseScaleType) {
    return;
  }

  const nextScaleType = SCALE_PATTERNS[exerciseScaleType.value]
    ? exerciseScaleType.value
    : 'major';

  exerciseState.scaleType = nextScaleType;
  exerciseScaleType.value = nextScaleType;
  savePersistedSettings();
}

function syncExerciseScaleDirectionFromInput() {
  if (!exerciseScaleDirection) {
    return;
  }

  const nextDirection =
    exerciseScaleDirection.value === SCALE_DIRECTIONS.descending
      ? SCALE_DIRECTIONS.descending
      : SCALE_DIRECTIONS.ascending;

  exerciseState.scaleDirection = nextDirection;
  exerciseScaleDirection.value = nextDirection;
  savePersistedSettings();
}

function clearExerciseReview() {
  exerciseState.scaleReview = null;
}

function updateExercisePresetUi() {
  const preset =
    EXERCISE_PRESETS[exerciseState.selectedExercise] ||
    EXERCISE_PRESETS['pitch-matching'];
  const isPitchMemory = exerciseState.selectedExercise === 'pitch-memory';
  const isScaleMatch = exerciseState.selectedExercise === 'match-scale';
  const isFollowScale = exerciseState.selectedExercise === 'follow-scale';
  const isRandomScaleDegree =
    exerciseState.selectedExercise === 'random-scale-degree';
  const usesScaleSettings =
    exerciseState.selectedExercise === 'match-scale' ||
    exerciseState.selectedExercise === 'follow-scale' ||
    exerciseState.selectedExercise === 'random-scale-degree';
  const usesTonicSettings =
    exerciseState.selectedExercise === 'match-scale' ||
    exerciseState.selectedExercise === 'follow-scale' ||
    exerciseState.selectedExercise === 'random-scale-degree';

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

  if (exerciseScaleTypeField) {
    exerciseScaleTypeField.hidden = !usesScaleSettings;
  }

  if (exerciseScaleDirectionField) {
    exerciseScaleDirectionField.hidden = !isScaleMatch;
  }

  if (exerciseRandomTonicField) {
    exerciseRandomTonicField.hidden = !usesTonicSettings;
  }

  if (exerciseFixedTonicField) {
    exerciseFixedTonicField.hidden =
      !usesTonicSettings || exerciseState.randomDegreeUseRandomTonic;
  }

  if (
    exerciseScaleType &&
    exerciseScaleType.value !== exerciseState.scaleType
  ) {
    exerciseScaleType.value = exerciseState.scaleType;
  }

  if (
    exerciseScaleDirection &&
    exerciseScaleDirection.value !== exerciseState.scaleDirection
  ) {
    exerciseScaleDirection.value = exerciseState.scaleDirection;
  }

  if (exerciseScaleDirectionField && isFollowScale) {
    exerciseScaleDirectionField.hidden = true;
  }

  if (exerciseGrading && exerciseGrading.value !== exerciseState.gradingMode) {
    exerciseGrading.value = exerciseState.gradingMode;
  }

  if (exerciseHints && exerciseHints.value !== exerciseState.hintMode) {
    exerciseHints.value = exerciseState.hintMode;
  }

  if (exerciseRandomTonic) {
    exerciseRandomTonic.checked = exerciseState.randomDegreeUseRandomTonic;
  }

  if (exerciseFixedTonic) {
    const value = String(exerciseState.randomDegreeFixedTonicMidi);
    if (exerciseFixedTonic.value !== value) {
      exerciseFixedTonic.value = value;
    }
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
  clearExerciseReview();
  updateExercisePresetUi();
  resetExerciseUi();
  savePersistedSettings();
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

function getScalePattern(scaleType) {
  return SCALE_PATTERNS[scaleType] || SCALE_PATTERNS.major;
}

function getScaleDirectionLabel(direction) {
  return direction === SCALE_DIRECTIONS.descending ? 'Descending' : 'Ascending';
}

function getDirectedScaleOffsets(scaleType, direction) {
  const pattern = getScalePattern(scaleType);

  if (direction !== SCALE_DIRECTIONS.descending) {
    return [...pattern];
  }

  if (pattern.length < 2) {
    return [0];
  }

  const steps = [];
  for (let index = 1; index < pattern.length; index += 1) {
    steps.push(pattern[index] - pattern[index - 1]);
  }

  const descendingOffsets = [0];
  let current = 0;
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    current -= steps[index];
    descendingOffsets.push(current);
  }

  return descendingOffsets;
}

function chooseScaleRootMidi() {
  const offsets = getDirectedScaleOffsets(
    exerciseState.scaleType,
    exerciseState.scaleDirection,
  );
  const lowestOffset = Math.min(...offsets);
  const highestOffset = Math.max(...offsets);
  const minRoot = exerciseState.rangeLowMidi - lowestOffset;
  const maxRoot = exerciseState.rangeHighMidi - highestOffset;

  if (maxRoot < minRoot) {
    return {
      rootMidi: null,
      error: null,
    };
  }

  if (!exerciseState.randomDegreeUseRandomTonic) {
    const fixedTonicMidi = exerciseState.randomDegreeFixedTonicMidi;
    if (fixedTonicMidi < minRoot || fixedTonicMidi > maxRoot) {
      return {
        rootMidi: null,
        error:
          'The selected fixed tonic cannot fit this scale and direction in the current range. Choose another tonic or widen the range.',
      };
    }

    return {
      rootMidi: fixedTonicMidi,
      error: null,
    };
  }

  return {
    rootMidi: minRoot + Math.floor(Math.random() * (maxRoot - minRoot + 1)),
    error: null,
  };
}

function buildScaleNotes(rootMidi, scaleType) {
  const offsets = getDirectedScaleOffsets(
    scaleType,
    exerciseState.scaleDirection,
  );
  return offsets.map((offset) => rootMidi + offset);
}

function chooseFollowScaleRootMidi(scaleType) {
  const offsets = getScalePattern(scaleType);
  const highestOffset = Math.max(...offsets);
  const minRoot = exerciseState.rangeLowMidi;
  const maxRoot = exerciseState.rangeHighMidi - highestOffset;

  if (maxRoot < minRoot) {
    return {
      rootMidi: null,
      error: null,
    };
  }

  if (!exerciseState.randomDegreeUseRandomTonic) {
    const fixedTonicMidi = exerciseState.randomDegreeFixedTonicMidi;
    if (fixedTonicMidi < minRoot || fixedTonicMidi > maxRoot) {
      return {
        rootMidi: null,
        error:
          'The selected fixed tonic cannot fit this ascending scale in the current range. Choose another tonic or widen the range.',
      };
    }

    return {
      rootMidi: fixedTonicMidi,
      error: null,
    };
  }

  return {
    rootMidi: minRoot + Math.floor(Math.random() * (maxRoot - minRoot + 1)),
    error: null,
  };
}

function buildFollowScaleNotes(rootMidi, scaleType) {
  return getScalePattern(scaleType).map((offset) => rootMidi + offset);
}

function chooseRandomScaleDegreePrompt() {
  const offsets = getScalePattern(RANDOM_SCALE_DEGREE_SCALE_TYPE);
  const degreeCandidates = [];
  const addCandidatesForTonic = (tonicMidi) => {
    for (let index = 0; index < offsets.length; index += 1) {
      const targetMidi = tonicMidi + offsets[index];

      if (
        targetMidi < exerciseState.rangeLowMidi ||
        targetMidi > exerciseState.rangeHighMidi
      ) {
        continue;
      }

      degreeCandidates.push({
        tonicMidi,
        degreeNumber: index + 1,
        targetMidi,
      });
    }
  };

  if (exerciseState.randomDegreeUseRandomTonic) {
    for (
      let tonicMidi = exerciseState.rangeLowMidi;
      tonicMidi <= exerciseState.rangeHighMidi;
      tonicMidi += 1
    ) {
      addCandidatesForTonic(tonicMidi);
    }

    if (degreeCandidates.length === 0) {
      return {
        error:
          'This range cannot fit a tonic and target degree for the major scale. Widen your range and try again.',
      };
    }

    const randomIndex = Math.floor(Math.random() * degreeCandidates.length);
    return degreeCandidates[randomIndex];
  }

  const fixedTonicMidi = exerciseState.randomDegreeFixedTonicMidi;
  if (
    fixedTonicMidi < exerciseState.rangeLowMidi ||
    fixedTonicMidi > exerciseState.rangeHighMidi
  ) {
    return {
      error:
        'The selected fixed tonic is outside your current exercise range. Choose a tonic within the range.',
    };
  }

  addCandidatesForTonic(fixedTonicMidi);
  if (degreeCandidates.length === 0) {
    return {
      error:
        'No major-scale degree from the selected tonic stays inside this range. Pick another tonic or widen the range.',
    };
  }

  const randomIndex = Math.floor(Math.random() * degreeCandidates.length);
  return degreeCandidates[randomIndex];
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
  clearExerciseReview();
  exerciseState.targetMidi = chooseExerciseTargetMidi();
  exerciseState.active = true;
  exerciseState.phase = 'matching-prompt';
  exerciseState.attemptStartedAt = null;
  exerciseState.lastResult = null;
  exerciseState.lastDetectedSample = null;
  exerciseState.lastInTuneTime = null;
  exerciseState.holdStartTime = null;

  setExerciseAttemptText('Listen to the prompt');
  setExercisePhaseText('Prompt');
  const toleranceCents = getMatchToleranceCents();
  const holdTargetText = getHoldTargetSecondsText();
  setExerciseFeedback(
    `Listen first, then match the hidden tone within +/-${toleranceCents} cents and hold it for ${holdTargetText}.`,
    'neutral',
  );
  setExerciseRevealText('Hidden');
  setExerciseProgress(0);
  setExerciseLiveReadout(null);

  setStatus('Exercise prompt playing', true);
  await replayExerciseTone();

  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'pitch-matching'
  ) {
    return;
  }

  exerciseState.phase = 'matching-wait';
  setExerciseAttemptText('Get ready');
  setExercisePhaseText('Delay');
  setExerciseFeedback(
    `Starting in ${EXERCISE_DEFAULT_DELAY_SECONDS} seconds...`,
    'neutral',
  );
  await waitMs(EXERCISE_DEFAULT_DELAY_SECONDS * 1000);

  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'pitch-matching'
  ) {
    return;
  }

  exerciseState.phase = 'matching-listening';
  exerciseState.attemptStartedAt = performance.now();
  setExerciseAttemptText('Listening for a match');
  setExercisePhaseText('Match');
  setExerciseFeedback(
    `Match the hidden tone now and hold for ${holdTargetText}.`,
    'neutral',
  );
}

function finalizePitchMemoryAttempt(success) {
  if (exerciseState.targetMidi == null) {
    return;
  }

  const revealedNote = midiToNoteName(exerciseState.targetMidi);
  const detectedSample = exerciseState.lastDetectedSample;
  const attemptSummary = detectedSample
    ? ` Your closest stable note was ${midiToNoteName(detectedSample.midi)} at ${detectedSample.frequency.toFixed(1)} Hz.`
    : ` No stable sung note was detected during the ${getHoldTargetSecondsText()} sing window.`;
  const message = success
    ? `Success. You recalled ${revealedNote} and held it for ${getHoldTargetSecondsText()}.`
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
  showExerciseToast(
    success ? 'Pitch Memory cleared' : 'Pitch Memory failed',
    success ? 'success' : 'warning',
  );
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
  const holdTargetText = getHoldTargetSecondsText();
  setExerciseFeedback(
    `Sing the remembered pitch for up to 3 seconds. Hold in tune for ${holdTargetText} within +/-${getMatchToleranceCents()} cents.`,
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
  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'pitch-memory'
  ) {
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
  clearExerciseReview();
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

  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'pitch-memory'
  ) {
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

function finalizeScaleExerciseAttempt(success, failureReason = '') {
  const scaleNotes = [...exerciseState.scaleNotes];
  const stepHoldMs = getScaleStepHoldTargetMs();
  const scaleTypeLabel = SCALE_LABELS[exerciseState.scaleType] || 'Scale';
  const directionLabel = getScaleDirectionLabel(exerciseState.scaleDirection);
  const rootMidi = exerciseState.targetMidi;
  const rootName = rootMidi != null ? midiToNoteName(rootMidi) : '--';
  const singStartedAt = exerciseState.scaleSingStartedAt;
  const scaleRecordedSamples = [...exerciseState.scaleRecordedSamples];
  const now = performance.now();

  const recordedDurationMs =
    singStartedAt == null
      ? scaleNotes.length * stepHoldMs
      : Math.max(1, now - singStartedAt);

  const targetDurationMs = scaleNotes.length * stepHoldMs;
  const reviewDurationMs = Math.max(recordedDurationMs, targetDurationMs);

  exerciseState.scaleReview = {
    expectedSegments: scaleNotes.map((midi, index) => ({
      midi,
      startMs: index * stepHoldMs,
      endMs: (index + 1) * stepHoldMs,
    })),
    actualSamples: scaleRecordedSamples,
    durationMs: reviewDurationMs,
    label: `${rootName} ${scaleTypeLabel} ${directionLabel}`,
  };

  clearExerciseTimers();
  resetExerciseAttemptState();
  setExerciseCountdownText('--');
  setExerciseProgress(success ? 1 : 0);
  setExercisePhaseText('Review');
  setExerciseAttemptText(success ? 'Scale matched' : 'Scale attempt ended');

  if (success) {
    setExerciseFeedback(
      `Success. You completed ${rootName} ${scaleTypeLabel} ${directionLabel.toLowerCase()} with ${getHoldTargetSecondsText()} holds.`,
      'success',
    );
    setStatus('Exercise success', true);
    showExerciseToast('Sing the Scale cleared', 'success');
  } else {
    const reasonText = failureReason
      ? ` ${failureReason}`
      : ' Try again and hold each scale degree for one full second.';
    setExerciseFeedback(`Scale not completed.${reasonText}`, 'warning');
    setStatus('Exercise try again', true);
    showExerciseToast('Sing the Scale failed', 'warning');
  }

  setExerciseRevealText(`${rootName} ${scaleTypeLabel} ${directionLabel}`);
}

function updateScaleExercise(sample) {
  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'match-scale' ||
    exerciseState.phase !== 'scale-sing' ||
    exerciseState.scaleNotes.length === 0
  ) {
    return;
  }

  const now = performance.now();
  const currentIndex = clamp(
    exerciseState.scaleStepIndex,
    0,
    exerciseState.scaleNotes.length - 1,
  );
  const targetMidi = exerciseState.scaleNotes[currentIndex];
  const tolerance = getMatchToleranceSemitones();
  const stepHoldMs = getScaleStepHoldTargetMs();

  if (exerciseState.scaleSingStartedAt != null) {
    exerciseState.scaleRecordedSamples.push({
      timeMs: now - exerciseState.scaleSingStartedAt,
      midi: sample.midi,
      confidence: sample.confidence,
    });
  }

  const withinTolerance =
    sample.confidence >= EXERCISE_MIN_CONFIDENCE &&
    Math.abs(sample.midi - targetMidi) <= tolerance;

  if (withinTolerance) {
    if (exerciseState.holdStartTime == null) {
      exerciseState.holdStartTime = now;
    }

    exerciseState.lastInTuneTime = now;
    const heldMs = now - exerciseState.holdStartTime;
    const progress =
      (currentIndex + heldMs / stepHoldMs) / exerciseState.scaleNotes.length;
    setExerciseProgress(progress);
    setExerciseAttemptText(
      `Degree ${currentIndex + 1}/${exerciseState.scaleNotes.length}: ${midiToNoteName(targetMidi)} (${(heldMs / 1000).toFixed(2)}s)`,
    );
    setExerciseFeedback(
      'Hold the note steady, then move to the next scale degree.',
      'neutral',
    );

    if (heldMs >= stepHoldMs) {
      const nextIndex = currentIndex + 1;
      const clearedLabel = midiToNoteName(targetMidi);
      showExerciseToast(`Cleared ${clearedLabel}`, 'success');
      exerciseState.scaleStepIndex = nextIndex;
      exerciseState.holdStartTime = null;
      exerciseState.lastInTuneTime = null;

      if (nextIndex >= exerciseState.scaleNotes.length) {
        finalizeScaleExerciseAttempt(true);
        return;
      }

      const nextTarget = exerciseState.scaleNotes[nextIndex];
      setExerciseAttemptText(
        `Next degree ${nextIndex + 1}/${exerciseState.scaleNotes.length}: ${midiToNoteName(nextTarget)}`,
      );
      setExerciseFeedback(
        `Move up to the next scale note and hold for ${getHoldTargetSecondsText()}.`,
        'neutral',
      );
    }

    return;
  }

  if (
    exerciseState.holdStartTime != null &&
    exerciseState.lastInTuneTime != null &&
    now - exerciseState.lastInTuneTime <= EXERCISE_HOLD_GRACE_MS
  ) {
    const heldMs = now - exerciseState.holdStartTime;
    const progress =
      (currentIndex + heldMs / stepHoldMs) / exerciseState.scaleNotes.length;
    setExerciseProgress(progress);
    setExerciseAttemptText(
      `Degree ${currentIndex + 1}/${exerciseState.scaleNotes.length}: ${midiToNoteName(targetMidi)} (${(heldMs / 1000).toFixed(2)}s)`,
    );
    setExerciseFeedback(
      'Close. Keep this degree centered and steady.',
      'neutral',
    );
    return;
  }

  exerciseState.holdStartTime = null;
  exerciseState.lastInTuneTime = null;
  setExerciseAttemptText(
    `Degree ${currentIndex + 1}/${exerciseState.scaleNotes.length}: ${midiToNoteName(targetMidi)}`,
  );
  setExerciseFeedback(
    withDirectionalHint('Find the target degree.', sample.midi - targetMidi),
    'neutral',
  );

  if (
    exerciseState.scaleSingStartedAt != null &&
    now - exerciseState.scaleSingStartedAt >= EXERCISE_SCALE_TOTAL_TIMEOUT_MS
  ) {
    finalizeScaleExerciseAttempt(
      false,
      'Time ran out before all scale degrees were completed.',
    );
  }
}

function updateFollowScaleExercise(sample) {
  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'follow-scale' ||
    exerciseState.phase !== 'follow-sing' ||
    exerciseState.scaleNotes.length === 0
  ) {
    return;
  }

  const now = performance.now();
  const currentIndex = clamp(
    exerciseState.scaleStepIndex,
    0,
    exerciseState.scaleNotes.length - 1,
  );
  const targetMidi = exerciseState.scaleNotes[currentIndex];
  const tolerance = getMatchToleranceSemitones();
  const stepHoldMs = getScaleStepHoldTargetMs();

  if (exerciseState.scaleSingStartedAt != null) {
    exerciseState.scaleRecordedSamples.push({
      timeMs: now - exerciseState.scaleSingStartedAt,
      midi: sample.midi,
      confidence: sample.confidence,
    });
  }

  const withinTolerance =
    sample.confidence >= EXERCISE_MIN_CONFIDENCE &&
    Math.abs(sample.midi - targetMidi) <= tolerance;

  if (withinTolerance) {
    if (exerciseState.holdStartTime == null) {
      exerciseState.holdStartTime = now;
    }

    exerciseState.lastInTuneTime = now;
    const heldMs = now - exerciseState.holdStartTime;
    const progress =
      (currentIndex + heldMs / stepHoldMs) / exerciseState.scaleNotes.length;
    setExerciseProgress(progress);
    setExerciseAttemptText(
      `Degree ${currentIndex + 1}/${exerciseState.scaleNotes.length}: ${midiToNoteName(targetMidi)} (${(heldMs / 1000).toFixed(2)}s)`,
    );
    setExerciseFeedback(
      currentIndex === 0
        ? 'Hold the tonic steady, then the scale will move on.'
        : 'Hold the note steady, then the scale will move on.',
      'neutral',
    );

    if (heldMs >= stepHoldMs) {
      const nextIndex = currentIndex + 1;
      exerciseState.scaleStepIndex = nextIndex;
      exerciseState.holdStartTime = null;
      exerciseState.lastInTuneTime = null;
      exerciseState.phase = 'follow-transition';

      const clearedLabel = midiToNoteName(targetMidi);
      showExerciseToast(`Cleared ${clearedLabel}`, 'success');

      if (exerciseState.followScaleAdvanceTimerId != null) {
        window.clearTimeout(exerciseState.followScaleAdvanceTimerId);
      }

      exerciseState.followScaleAdvanceTimerId = window.setTimeout(() => {
        exerciseState.followScaleAdvanceTimerId = null;

        if (
          !exerciseState.active ||
          exerciseState.selectedExercise !== 'follow-scale'
        ) {
          return;
        }

        if (nextIndex >= exerciseState.scaleNotes.length) {
          finalizeFollowScaleExerciseAttempt(true);
          return;
        }

        void startFollowScaleStep(nextIndex);
      }, FOLLOW_SCALE_TOAST_PAUSE_MS);

      if (nextIndex >= exerciseState.scaleNotes.length) {
        return;
      }

      return;
    }

    return;
  }

  if (
    exerciseState.holdStartTime != null &&
    exerciseState.lastInTuneTime != null &&
    now - exerciseState.lastInTuneTime <= EXERCISE_HOLD_GRACE_MS
  ) {
    const heldMs = now - exerciseState.holdStartTime;
    const progress =
      (currentIndex + heldMs / stepHoldMs) / exerciseState.scaleNotes.length;
    setExerciseProgress(progress);
    setExerciseAttemptText(
      `Degree ${currentIndex + 1}/${exerciseState.scaleNotes.length}: ${midiToNoteName(targetMidi)} (${(heldMs / 1000).toFixed(2)}s)`,
    );
    setExerciseFeedback(
      'Close. Keep this degree centered and steady.',
      'neutral',
    );
    return;
  }

  exerciseState.holdStartTime = null;
  exerciseState.lastInTuneTime = null;
  setExerciseAttemptText(
    `Degree ${currentIndex + 1}/${exerciseState.scaleNotes.length}: ${midiToNoteName(targetMidi)}`,
  );
  setExerciseFeedback(
    withDirectionalHint('Find the target degree.', sample.midi - targetMidi),
    'neutral',
  );

  if (
    exerciseState.scaleSingStartedAt != null &&
    now - exerciseState.scaleSingStartedAt >= EXERCISE_SCALE_TOTAL_TIMEOUT_MS
  ) {
    finalizeFollowScaleExerciseAttempt(
      false,
      'Time ran out before the scale was completed.',
    );
  }
}

async function startScaleExercise() {
  syncExerciseRangeFromInputs();
  syncExerciseScaleTypeFromInput();
  syncExerciseScaleDirectionFromInput();
  syncRandomDegreeUseRandomTonicFromInput();
  syncRandomDegreeFixedTonicFromInput();

  if (!running) {
    await startAudio();
  }

  if (!running) {
    return;
  }

  clearExerciseTimers();
  resetExerciseAttemptState();
  clearExerciseReview();

  const rootSelection = chooseScaleRootMidi();
  const rootMidi = rootSelection.rootMidi;
  const scaleTypeLabel = SCALE_LABELS[exerciseState.scaleType] || 'Scale';
  const directionLabel = getScaleDirectionLabel(exerciseState.scaleDirection);
  if (rootMidi == null) {
    setExercisePhaseText('Idle');
    setExerciseAttemptText('Range too narrow');
    setExerciseFeedback(
      rootSelection.error ||
        `This range cannot fit a ${directionLabel.toLowerCase()} ${scaleTypeLabel.toLowerCase()} scale. Adjust the range and try again.`,
      'warning',
    );
    setExerciseRevealText('--');
    setExerciseProgress(0);
    return;
  }

  const scaleNotes = buildScaleNotes(rootMidi, exerciseState.scaleType);

  exerciseState.targetMidi = rootMidi;
  exerciseState.active = true;
  exerciseState.phase = 'scale-prompt';
  exerciseState.scaleNotes = scaleNotes;
  exerciseState.scaleStepIndex = 0;
  exerciseState.scaleSingStartedAt = null;
  exerciseState.scaleRecordedSamples = [];
  exerciseState.lastDetectedSample = null;
  exerciseState.holdStartTime = null;
  exerciseState.lastInTuneTime = null;

  setExerciseRevealText(
    `${midiToNoteName(rootMidi)} ${scaleTypeLabel} ${directionLabel}`,
  );
  setExerciseCountdownText('--');
  setExerciseProgress(0);
  setExercisePhaseText('Prompt');
  setExerciseAttemptText('Listen to the tonic');
  setExerciseFeedback(
    `Tonic is ${midiToNoteName(rootMidi)}. Then sing each degree of the ${directionLabel.toLowerCase()} ${scaleTypeLabel.toLowerCase()} scale, holding each note for ${getHoldTargetSecondsText()}.`,
    'neutral',
  );
  setExerciseLiveReadout(null);

  setStatus('Scale tonic playing', true);
  await playReferenceToneForDuration(rootMidi);

  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'match-scale'
  ) {
    return;
  }

  exerciseState.phase = 'scale-wait';
  setExercisePhaseText('Delay');
  setExerciseAttemptText('Get ready');
  setExerciseFeedback(
    `Scale starts in ${EXERCISE_DEFAULT_DELAY_SECONDS} seconds...`,
    'neutral',
  );
  await waitMs(EXERCISE_DEFAULT_DELAY_SECONDS * 1000);

  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'match-scale'
  ) {
    return;
  }

  exerciseState.phase = 'scale-sing';
  exerciseState.scaleSingStartedAt = performance.now();
  setExercisePhaseText('Sing scale');
  setExerciseAttemptText(
    `Degree 1/${scaleNotes.length}: ${midiToNoteName(scaleNotes[0])}`,
  );
  setExerciseFeedback(
    directionLabel === 'Descending'
      ? 'Start on the tonic and move downward one degree at a time.'
      : 'Start on the tonic and move upward one degree at a time.',
    'neutral',
  );
  setStatus('Scale exercise listening', true);
}

function finalizeFollowScaleExerciseAttempt(success, failureReason = '') {
  const scaleNotes = [...exerciseState.scaleNotes];
  const stepHoldMs = getScaleStepHoldTargetMs();
  const scaleTypeLabel = SCALE_LABELS[exerciseState.scaleType] || 'Scale';
  const rootMidi = exerciseState.targetMidi;
  const rootName = rootMidi != null ? midiToNoteName(rootMidi) : '--';
  const singStartedAt = exerciseState.scaleSingStartedAt;
  const scaleRecordedSamples = [...exerciseState.scaleRecordedSamples];
  const now = performance.now();

  const recordedDurationMs =
    singStartedAt == null
      ? scaleNotes.length * stepHoldMs
      : Math.max(1, now - singStartedAt);

  const targetDurationMs = scaleNotes.length * stepHoldMs;
  const reviewDurationMs = Math.max(recordedDurationMs, targetDurationMs);

  exerciseState.scaleReview = {
    expectedSegments: scaleNotes.map((midi, index) => ({
      midi,
      startMs: index * stepHoldMs,
      endMs: (index + 1) * stepHoldMs,
    })),
    actualSamples: scaleRecordedSamples,
    durationMs: reviewDurationMs,
    label: `${rootName} ${scaleTypeLabel} follow-through`,
  };

  clearExerciseTimers();
  resetExerciseAttemptState();
  setExerciseCountdownText('--');
  setExerciseProgress(success ? 1 : 0);
  setExercisePhaseText('Review');
  setExerciseAttemptText(success ? 'Scale followed' : 'Sequence stopped');

  if (success) {
    setExerciseFeedback(
      `Success. You followed ${rootName} ${scaleTypeLabel.toLowerCase()} from tonic to octave.`,
      'success',
    );
    setStatus('Exercise success', true);
    showExerciseToast('Follow the Scale cleared', 'success');
  } else {
    const reasonText = failureReason
      ? ` ${failureReason}`
      : ' Try again and hold each scale degree for one full second.';
    setExerciseFeedback(
      `Scale sequence not completed.${reasonText}`,
      'warning',
    );
    setStatus('Exercise try again', true);
    showExerciseToast('Follow the Scale failed', 'warning');
  }

  setExerciseRevealText(`${rootName} ${scaleTypeLabel} ascending`);
}

async function startFollowScaleStep(stepIndex) {
  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'follow-scale' ||
    exerciseState.scaleNotes.length === 0
  ) {
    return;
  }

  const currentIndex = clamp(stepIndex, 0, exerciseState.scaleNotes.length - 1);
  const targetMidi = exerciseState.scaleNotes[currentIndex];

  exerciseState.scaleStepIndex = currentIndex;
  exerciseState.targetMidi = targetMidi;
  exerciseState.phase = 'follow-prompt';
  exerciseState.holdStartTime = null;
  exerciseState.lastInTuneTime = null;

  setExercisePhaseText('Prompt');
  setExerciseAttemptText(
    `Listen to degree ${currentIndex + 1}/${exerciseState.scaleNotes.length}`,
  );
  setExerciseFeedback(
    currentIndex === 0
      ? `Hear the tonic ${midiToNoteName(targetMidi)} for one second, then sing it back.`
      : `Hear degree ${currentIndex + 1} (${midiToNoteName(targetMidi)}) for one second, then sing it back.`,
    'neutral',
  );
  setExerciseRevealText(
    `${midiToNoteName(exerciseState.scaleNotes[0])} ${SCALE_LABELS[exerciseState.scaleType] || 'Scale'}`,
  );
  setExerciseProgress(currentIndex / exerciseState.scaleNotes.length);
  setStatus('Follow the scale prompt playing', true);

  await playReferenceToneForDuration(targetMidi, FOLLOW_SCALE_PROMPT_MS);
  await waitMs(FOLLOW_SCALE_PROMPT_MS);

  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'follow-scale' ||
    exerciseState.scaleStepIndex !== currentIndex
  ) {
    return;
  }

  exerciseState.phase = 'follow-sing';
  if (exerciseState.scaleSingStartedAt == null) {
    exerciseState.scaleSingStartedAt = performance.now();
  }
  exerciseState.attemptStartedAt = exerciseState.scaleSingStartedAt;
  setExercisePhaseText('Sing');
  setExerciseAttemptText(
    `Degree ${currentIndex + 1}/${exerciseState.scaleNotes.length}: ${midiToNoteName(targetMidi)}`,
  );
  setExerciseFeedback(
    `Sing the prompt pitch and hold it for ${getHoldTargetSecondsText()} before the scale moves on.`,
    'neutral',
  );
  setStatus('Follow the scale listening', true);
}

async function startFollowScaleExercise() {
  syncExerciseRangeFromInputs();
  syncExerciseScaleTypeFromInput();
  syncRandomDegreeUseRandomTonicFromInput();
  syncRandomDegreeFixedTonicFromInput();

  if (!running) {
    await startAudio();
  }

  if (!running) {
    return;
  }

  clearExerciseTimers();
  resetExerciseAttemptState();
  clearExerciseReview();

  const rootSelection = chooseFollowScaleRootMidi(exerciseState.scaleType);
  const rootMidi = rootSelection.rootMidi;
  const scaleTypeLabel = SCALE_LABELS[exerciseState.scaleType] || 'Scale';
  if (rootMidi == null) {
    setExercisePhaseText('Idle');
    setExerciseAttemptText('Range too narrow');
    setExerciseFeedback(
      rootSelection.error ||
        `This range cannot fit an ascending ${scaleTypeLabel.toLowerCase()} scale. Adjust the range and try again.`,
      'warning',
    );
    setExerciseRevealText('--');
    setExerciseProgress(0);
    return;
  }

  const scaleNotes = buildFollowScaleNotes(rootMidi, exerciseState.scaleType);

  exerciseState.targetMidi = rootMidi;
  exerciseState.active = true;
  exerciseState.phase = 'follow-prompt';
  exerciseState.scaleNotes = scaleNotes;
  exerciseState.scaleStepIndex = 0;
  exerciseState.scaleSingStartedAt = null;
  exerciseState.scaleRecordedSamples = [];
  exerciseState.lastDetectedSample = null;
  exerciseState.holdStartTime = null;
  exerciseState.lastInTuneTime = null;
  exerciseState.attemptStartedAt = null;

  setExerciseRevealText(`${midiToNoteName(rootMidi)} ${scaleTypeLabel}`);
  setExerciseCountdownText('--');
  setExerciseProgress(0);
  setExercisePhaseText('Prompt');
  setExerciseAttemptText('Listen to the tonic');
  setExerciseFeedback(
    `Hear the tonic ${midiToNoteName(rootMidi)} for one second, then sing it back before moving through the rest of the ${scaleTypeLabel.toLowerCase()} scale.`,
    'neutral',
  );
  setExerciseLiveReadout(null);

  setStatus('Follow the scale prompt playing', true);
  await startFollowScaleStep(0);
}

function finalizeRandomScaleDegreeAttempt(success) {
  const tonicMidi = exerciseState.randomDegreeTonicMidi;
  const degreeNumber = exerciseState.randomDegreeNumber;
  const targetMidi = exerciseState.targetMidi;
  const targetNote = targetMidi != null ? midiToNoteName(targetMidi) : '--';
  const tonicNote = tonicMidi != null ? midiToNoteName(tonicMidi) : '--';
  const detectedSample = exerciseState.lastDetectedSample;
  const attemptSummary = detectedSample
    ? ` Your closest stable note was ${midiToNoteName(detectedSample.midi)} at ${detectedSample.frequency.toFixed(1)} Hz.`
    : ' No stable sung note was detected during the attempt.';

  clearExerciseTimers();
  resetExerciseAttemptState();
  setExerciseCountdownText('--');
  setExerciseProgress(success ? 1 : 0);
  setExercisePhaseText('Complete');
  setExerciseAttemptText(success ? 'Correct' : 'Incorrect');

  if (success) {
    setExerciseFeedback(
      `Correct. Degree ${degreeNumber} from ${tonicNote} is ${targetNote}.`,
      'success',
    );
    setStatus('Exercise success', true);
    showExerciseToast('Random Scale Degree cleared', 'success');
  } else {
    setExerciseFeedback(
      `Incorrect. Degree ${degreeNumber} from ${tonicNote} is ${targetNote}.${attemptSummary}`,
      'warning',
    );
    setStatus('Exercise try again', true);
    showExerciseToast('Random Scale Degree failed', 'warning');
  }

  setExerciseRevealText(`Degree ${degreeNumber} -> ${targetNote}`);
}

function updateRandomScaleDegreeExercise(sample) {
  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'random-scale-degree' ||
    exerciseState.targetMidi == null ||
    exerciseState.phase !== 'random-degree-sing'
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
      getMatchToleranceSemitones();

  const holdTargetMs = getHoldTargetMs();

  if (withinTolerance) {
    if (exerciseState.holdStartTime == null) {
      exerciseState.holdStartTime = now;
    }

    exerciseState.lastInTuneTime = now;
    const heldMs = now - exerciseState.holdStartTime;
    setExerciseAttemptText(`Hold steady: ${(heldMs / 1000).toFixed(2)}s`);
    setExerciseFeedback(
      'Keep holding the target degree until the bar fills.',
      'neutral',
    );
    setExerciseProgress(heldMs / holdTargetMs);

    if (heldMs >= holdTargetMs) {
      finalizeRandomScaleDegreeAttempt(true);
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
      'Close. Keep the degree centered and steady.',
      'neutral',
    );
    setExerciseProgress(heldMs / holdTargetMs);

    if (heldMs >= holdTargetMs) {
      finalizeRandomScaleDegreeAttempt(true);
    }

    return;
  }

  exerciseState.holdStartTime = null;
  exerciseState.lastInTuneTime = null;
  setExerciseProgress(0);
  setExerciseAttemptText('Searching for the target degree');
  setExerciseFeedback(
    withDirectionalHint(
      'Try to land the requested degree.',
      sample.midi - exerciseState.targetMidi,
    ),
    'neutral',
  );

  if (now - exerciseState.attemptStartedAt >= EXERCISE_ATTEMPT_WINDOW_MS) {
    finalizeRandomScaleDegreeAttempt(false);
  }
}

async function startRandomScaleDegreeExercise() {
  syncExerciseRangeFromInputs();

  if (!running) {
    await startAudio();
  }

  if (!running) {
    return;
  }

  clearExerciseTimers();
  resetExerciseAttemptState();
  clearExerciseReview();

  const prompt = chooseRandomScaleDegreePrompt();
  if (!prompt || prompt.error) {
    setExercisePhaseText('Idle');
    setExerciseAttemptText('Range too narrow');
    setExerciseFeedback(
      prompt?.error ||
        'This range cannot fit a tonic and target degree for the major scale. Widen your range and try again.',
      'warning',
    );
    setExerciseRevealText('--');
    setExerciseProgress(0);
    return;
  }

  exerciseState.active = true;
  exerciseState.phase = 'random-degree-prompt';
  exerciseState.targetMidi = prompt.targetMidi;
  exerciseState.randomDegreeTonicMidi = prompt.tonicMidi;
  exerciseState.randomDegreeNumber = prompt.degreeNumber;
  exerciseState.lastDetectedSample = null;
  exerciseState.holdStartTime = null;
  exerciseState.lastInTuneTime = null;
  exerciseState.attemptStartedAt = null;

  setExerciseRevealText(`Degree ${prompt.degreeNumber}`);
  setExerciseCountdownText('--');
  setExerciseProgress(0);
  setExercisePhaseText('Prompt');
  setExerciseAttemptText('Listen to the tonic');
  setExerciseFeedback(
    exerciseState.randomDegreeUseRandomTonic
      ? `Tonic is ${midiToNoteName(prompt.tonicMidi)}. Sing scale degree ${prompt.degreeNumber} and hold for ${getHoldTargetSecondsText()}.`
      : `Fixed tonic is ${midiToNoteName(prompt.tonicMidi)}. Sing scale degree ${prompt.degreeNumber} and hold for ${getHoldTargetSecondsText()}.`,
    'neutral',
  );
  setExerciseLiveReadout(null);

  setStatus('Scale tonic playing', true);
  await playReferenceToneForDuration(prompt.tonicMidi);

  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'random-scale-degree'
  ) {
    return;
  }

  exerciseState.phase = 'random-degree-wait';
  setExercisePhaseText('Delay');
  setExerciseAttemptText('Get ready');
  setExerciseFeedback(
    `Sing degree ${prompt.degreeNumber} in ${EXERCISE_DEFAULT_DELAY_SECONDS} seconds...`,
    'neutral',
  );
  await waitMs(EXERCISE_DEFAULT_DELAY_SECONDS * 1000);

  if (
    !exerciseState.active ||
    exerciseState.selectedExercise !== 'random-scale-degree'
  ) {
    return;
  }

  exerciseState.phase = 'random-degree-sing';
  exerciseState.attemptStartedAt = performance.now();
  setExercisePhaseText('Sing degree');
  setExerciseAttemptText(`Sing degree ${prompt.degreeNumber}`);
  setExerciseFeedback(
    `Match the requested degree and hold for ${getHoldTargetSecondsText()}.`,
    'neutral',
  );
  setStatus('Random degree listening', true);
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
    ? `Success. You matched ${revealedNote} for ${getHoldTargetSecondsText()}.`
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
  showExerciseToast(
    success ? 'Pitch Matching cleared' : 'Pitch Matching failed',
    success ? 'success' : 'warning',
  );
}

function updatePitchMatchingExercise(sample) {
  if (
    !exerciseState.active ||
    exerciseState.targetMidi == null ||
    exerciseState.phase !== 'matching-listening'
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
      getMatchToleranceSemitones();
  const holdTargetMs = getHoldTargetMs();
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
    setExerciseProgress(heldMs / holdTargetMs);

    if (heldMs >= holdTargetMs) {
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
    setExerciseProgress(heldMs / holdTargetMs);

    if (heldMs >= holdTargetMs) {
      finalizePitchMatchingAttempt(true);
    }

    return;
  }

  exerciseState.holdStartTime = null;
  exerciseState.lastInTuneTime = null;
  setExerciseProgress(0);
  setExerciseAttemptText('Searching for the target');
  setExerciseFeedback(
    withDirectionalHint(
      'Try to center on the prompt pitch and sustain it.',
      deltaSemitones,
    ),
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
      getMatchToleranceSemitones();
  const holdTargetMs = getHoldTargetMs();

  if (withinTolerance) {
    if (exerciseState.holdStartTime == null) {
      exerciseState.holdStartTime = now;
    }

    exerciseState.lastInTuneTime = now;
    const heldMs = now - exerciseState.holdStartTime;

    setExerciseAttemptText(`Sing now: ${(heldMs / 1000).toFixed(2)}s`);
    setExerciseFeedback(
      'Keep holding through the end of the sing window.',
      'neutral',
    );
    setExerciseProgress(heldMs / holdTargetMs);

    if (heldMs >= holdTargetMs) {
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
    setExerciseProgress(heldMs / holdTargetMs);

    if (heldMs >= holdTargetMs) {
      finalizePitchMemoryAttempt(true);
      return;
    }
  } else {
    exerciseState.holdStartTime = null;
    exerciseState.lastInTuneTime = null;
    setExerciseProgress(0);
    setExerciseAttemptText('Sing now');
    setExerciseFeedback(
      withDirectionalHint(
        'Center on the remembered pitch.',
        sample.midi - exerciseState.targetMidi,
      ),
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
  savePersistedSettings();
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  devicePixelRatioValue = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * devicePixelRatioValue));
  canvas.height = Math.max(1, Math.round(rect.height * devicePixelRatioValue));
  canvasReady = true;
}

function getExerciseViewportBoundsIfActive() {
  if (!exerciseState.active) {
    return null;
  }

  const low = clamp(
    exerciseState.rangeLowMidi,
    VOCAL_LOW_MIDI,
    VOCAL_HIGH_MIDI,
  );
  const high = clamp(
    exerciseState.rangeHighMidi,
    VOCAL_LOW_MIDI,
    VOCAL_HIGH_MIDI,
  );

  if (high <= low) {
    return {
      low: low - 0.5,
      high: low + 0.5,
    };
  }

  return { low, high };
}

function getViewportBounds(centerMidi) {
  const exerciseBounds = getExerciseViewportBoundsIfActive();
  if (exerciseBounds) {
    return exerciseBounds;
  }

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
  if (exerciseState.active) {
    setStatus('Exercise range locked', true);
    return;
  }

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

function drawScaleReviewOverlay(ctx, width, height, centerMidi) {
  if (
    !exerciseState.scaleReview ||
    !exerciseState.scaleReview.expectedSegments ||
    exerciseState.scaleReview.expectedSegments.length === 0
  ) {
    return;
  }

  const { expectedSegments, actualSamples, durationMs, label } =
    exerciseState.scaleReview;
  const leftRailWidth = 132 * devicePixelRatioValue;
  const rightPadding = 20 * devicePixelRatioValue;
  const trailWidth = Math.max(1, width - leftRailWidth - rightPadding);
  const safeDuration = Math.max(1, durationMs);

  ctx.save();
  ctx.setLineDash([7 * devicePixelRatioValue, 5 * devicePixelRatioValue]);
  ctx.strokeStyle = 'rgba(255, 214, 110, 0.92)';
  ctx.lineWidth = 1.5 * devicePixelRatioValue;

  for (const segment of expectedSegments) {
    const y = midiToY(segment.midi, height, centerMidi);
    const x1 = leftRailWidth + (segment.startMs / safeDuration) * trailWidth;
    const x2 = leftRailWidth + (segment.endMs / safeDuration) * trailWidth;
    const bandHalf = 7 * devicePixelRatioValue;
    ctx.strokeRect(x1, y - bandHalf, Math.max(1, x2 - x1), bandHalf * 2);
  }

  ctx.setLineDash([]);

  if (actualSamples && actualSamples.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(125, 240, 195, 0.78)';
    ctx.lineWidth = 2 * devicePixelRatioValue;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    actualSamples.forEach((sample, index) => {
      const x = leftRailWidth + (sample.timeMs / safeDuration) * trailWidth;
      const y = midiToY(sample.midi, height, centerMidi);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 214, 110, 0.92)';
  ctx.font = `${11 * devicePixelRatioValue}px Space Grotesk, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(
    `Target outline (${label})`,
    leftRailWidth + 8 * devicePixelRatioValue,
    10 * devicePixelRatioValue,
  );
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
  drawScaleReviewOverlay(context, width, height, viewportCenterMidi);

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
      } else if (exerciseState.selectedExercise === 'follow-scale') {
        updateFollowScaleExercise(sample);
      } else if (exerciseState.selectedExercise === 'match-scale') {
        updateScaleExercise(sample);
      } else if (exerciseState.selectedExercise === 'random-scale-degree') {
        updateRandomScaleDegreeExercise(sample);
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
        (exerciseState.selectedExercise === 'random-scale-degree' &&
          exerciseState.phase === 'random-degree-sing') ||
        (exerciseState.selectedExercise === 'follow-scale' &&
          exerciseState.phase === 'follow-sing') ||
        (exerciseState.selectedExercise === 'match-scale' &&
          exerciseState.phase === 'scale-sing') ||
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
      exerciseState.selectedExercise === 'random-scale-degree' &&
      exerciseState.phase === 'random-degree-sing' &&
      exerciseState.attemptStartedAt != null &&
      now - exerciseState.attemptStartedAt >= EXERCISE_ATTEMPT_WINDOW_MS
    ) {
      finalizeRandomScaleDegreeAttempt(false);
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

    if (
      exerciseState.active &&
      exerciseState.selectedExercise === 'follow-scale' &&
      exerciseState.phase === 'follow-sing' &&
      exerciseState.scaleSingStartedAt != null &&
      now - exerciseState.scaleSingStartedAt >= EXERCISE_SCALE_TOTAL_TIMEOUT_MS
    ) {
      finalizeFollowScaleExerciseAttempt(
        false,
        'Time ran out before the scale was completed.',
      );
    }

    if (
      exerciseState.active &&
      exerciseState.selectedExercise === 'match-scale' &&
      exerciseState.phase === 'scale-sing' &&
      exerciseState.scaleSingStartedAt != null &&
      now - exerciseState.scaleSingStartedAt >= EXERCISE_SCALE_TOTAL_TIMEOUT_MS
    ) {
      finalizeScaleExerciseAttempt(
        false,
        'Time ran out before all scale degrees were completed.',
      );
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
  clearExerciseReview();
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
  exerciseMemoryDelay.addEventListener(
    'change',
    syncExerciseMemoryDelayFromInput,
  );
  exerciseMemoryDelay.addEventListener(
    'blur',
    syncExerciseMemoryDelayFromInput,
  );
}

if (exerciseScaleType) {
  exerciseScaleType.addEventListener('change', syncExerciseScaleTypeFromInput);
}

if (exerciseScaleDirection) {
  exerciseScaleDirection.addEventListener(
    'change',
    syncExerciseScaleDirectionFromInput,
  );
}

if (exerciseGrading) {
  exerciseGrading.addEventListener('change', syncExerciseGradingFromInput);
}

if (exerciseHints) {
  exerciseHints.addEventListener('change', syncExerciseHintsFromInput);
}

if (exerciseRandomTonic) {
  exerciseRandomTonic.addEventListener(
    'change',
    syncRandomDegreeUseRandomTonicFromInput,
  );
}

if (exerciseFixedTonic) {
  exerciseFixedTonic.addEventListener(
    'change',
    syncRandomDegreeFixedTonicFromInput,
  );
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

    if (exerciseState.selectedExercise === 'random-scale-degree') {
      await startRandomScaleDegreeExercise();
      return;
    }

    if (exerciseState.selectedExercise === 'follow-scale') {
      await startFollowScaleExercise();
      return;
    }

    if (exerciseState.selectedExercise === 'match-scale') {
      await startScaleExercise();
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
    savePersistedSettings();
  });
}

window.addEventListener('resize', () => {
  resizeCanvas();
});

resizeCanvas();
setPitchDisplay(null);
loadPersistedSettings();
updateFollowToggleUi();
populateExerciseRangeOptions();
populateRandomDegreeFixedTonicOptions();
applyExerciseStateToInputs();
setReferenceVolumeLabel();
syncExerciseMemoryDelayFromInput();
syncExerciseGradingFromInput();
syncExerciseHintsFromInput();
syncExerciseScaleTypeFromInput();
syncExerciseScaleDirectionFromInput();
syncRandomDegreeUseRandomTonicFromInput();
syncRandomDegreeFixedTonicFromInput();
syncExerciseRangeFromInputs();
setExerciseDetailsCollapsed(exerciseState.detailsCollapsed);
updateExercisePresetUi();
resetExerciseUi();
setExercisePanelOpen(exerciseState.panelOpen);
setStatus('Mic idle');
render();

if (!navigator.mediaDevices?.getUserMedia) {
  toggleButton.disabled = true;
  setStatus('Mic input unsupported');
  stabilityLabel.textContent = 'This browser cannot access the microphone';
}

window.addEventListener('beforeunload', stopAudio);
