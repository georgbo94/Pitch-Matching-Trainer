(function(){
  "use strict";

  /* =========================
     DOM
     ========================= */
  const $ = (id) => document.getElementById(id);

  const els = {
    // NEW
    tuningInput: $("tuningInput"),
    transposeInput: $("transposeInput"),
    shiftInputChr: $("shiftInputChr"),
    shiftInputDia: $("shiftInputDia"),
    shiftType: $("shiftType"),
    shiftTypeWrap: $("shiftTypeWrap"),
    shiftChrWrap: $("shiftChrWrap"),
    shiftDiaWrap: $("shiftDiaWrap"),

    toggleBtn: $("toggleBtn"),
    tonicBtn: $("tonicBtn"),
    lastNote: $("lastNote"),

    elapsed: $("elapsed"),
    correct: $("correct"),
    noteTime: $("noteTime"),
    avgNote: $("avgNote"),

    rangeLow: $("rangeLow"),
    rangeHigh: $("rangeHigh"),

    intervalMode: $("intervalMode"),
    symmetrySelect: $("symmetrySelect"),

    intervalMinMaxRow: $("intervalMinMaxRow"),
    continuousRow: $("continuousRow"),
    intervalListsRow: $("intervalListsRow"),
    downIntervalsRow: $("downIntervalsRow"),
    upIntervalsLabel: $("upIntervalsLabel"),
    tonalRow1: $("tonalRow1"),
    tonalRow2: $("tonalRow2"),

    jumpMin: $("jumpMin"),
    jumpMax: $("jumpMax"),

    centMin: $("centMin"),
    centMax: $("centMax"),

    upIntervals: $("upIntervals"),
    downIntervals: $("downIntervals"),

    rootPc: $("rootPc"),
    tonalDegrees: $("tonalDegrees"),

    tolInput: $("tolInput"),
    soundInput: $("soundInput"),
    repeatInput: $("repeatInput"),

    replayToggle: $("replayToggle"),
    replayState: $("replayState"),

    tuner: $("tuner"),
    tunerNeedle: $("tunerNeedle"),
    tunerReadout: $("tunerReadout"),
    debugWrap: $("debugWrap"),
    debugToggleBtn: $("debugToggleBtn"),
    debugPanel: $("debugPanel"),
    dbgFreq: $("dbgFreq"),
    dbgGoal: $("dbgGoal"),
    dbgDiff: $("dbgDiff"),
    dbgClarity: $("dbgClarity"),
    dbgDb: $("dbgDb"),
    dbgTol: $("dbgTol"),
    dbgLoud: $("dbgLoud"),
    dbgClear: $("dbgClear"),
    dbgHasInput: $("dbgHasInput"),
    dbgMode: $("dbgMode"),
  };

  const SHOW_DEBUG_UI = false;

  const show = (el) => el && el.classList.remove("hidden");
  const hide = (el) => el && el.classList.add("hidden");

  /* =========================
     SETTINGS (A4 + TRANSPOSE) + STORAGE
     ========================= */
  const LS_TUNING = "tuningA4";
  const LS_TRANSPOSE = "transpose";
  const LS_SETTINGS = "pitchTrainerSettingsV1";
  const PERSIST_IDS = [
    "tuningInput", "transposeInput",
    "shiftType", "shiftInputChr", "shiftInputDia",
    "rangeLow", "rangeHigh",
    "intervalMode", "symmetrySelect",
    "jumpMin", "jumpMax",
    "centMin", "centMax",
    "upIntervals", "downIntervals",
    "rootPc", "tonalDegrees",
    "tolInput", "soundInput", "repeatInput",
    "replayToggle"
  ];

  function safeGetLS(key){
    try{ return localStorage.getItem(key); }catch{ return null; }
  }
  function safeSetLS(key, val){
    try{ localStorage.setItem(key, String(val)); }catch{}
  }

  const DEFAULT_INTERVAL_LIST = "0 1 2 3 4 5 6 7 8 9 10 11";
  let intervalsSymValue = "";
  let intervalsAsymUpValue = "";
  let intervalsAsymDownValue = "";
  let prevSymmetricMode = null;

  function parseIntOr(v, fb){
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fb;
  }

  function isTonalDiaActive(){
    return (
      els.intervalMode.value === "tonal" &&
      els.shiftType &&
      !!els.shiftType.checked
    );
  }


  function loadPersistedSettings(){
    const raw = safeGetLS(LS_SETTINGS);
    if(!raw) return null;
    try{
      const obj = JSON.parse(raw);
      return (obj && typeof obj === "object") ? obj : null;
    }catch{
      return null;
    }
  }

  function savePersistedSettings(){
    const state = {};
    for(const id of PERSIST_IDS){
      const el = els[id];
      if(!el) continue;
      state[id] = (el.type === "checkbox") ? !!el.checked : el.value;
    }
    state.intervalsSymValue = intervalsSymValue;
    state.intervalsAsymUpValue = intervalsAsymUpValue;
    state.intervalsAsymDownValue = intervalsAsymDownValue;
    safeSetLS(LS_SETTINGS, JSON.stringify(state));
  }

  function applyPersistedSettings(state){
    if(!state || typeof state !== "object") return;
    for(const id of PERSIST_IDS){
      if(!(id in state)) continue;
      const el = els[id];
      if(!el) continue;
      if(el.type === "checkbox"){
        el.checked = !!state[id];
      }else{
        el.value = String(state[id]);
      }
    }
    if(Object.prototype.hasOwnProperty.call(state, "intervalsSymValue")){
      intervalsSymValue = String(state.intervalsSymValue || "");
    }
    if(Object.prototype.hasOwnProperty.call(state, "intervalsAsymUpValue")){
      intervalsAsymUpValue = String(state.intervalsAsymUpValue || "");
    }
    if(Object.prototype.hasOwnProperty.call(state, "intervalsAsymDownValue")){
      intervalsAsymDownValue = String(state.intervalsAsymDownValue || "");
    }
  }

  function wireSettingsPersistence(){
    for(const id of PERSIST_IDS){
      const el = els[id];
      if(!el) continue;
      el.addEventListener("change", savePersistedSettings);
      if(el.tagName === "INPUT" || el.tagName === "TEXTAREA"){
        el.addEventListener("blur", savePersistedSettings);
      }
    }
  }

  function clampFloat(v, lo, hi, fb){
    const n = Number(v);
    if(!Number.isFinite(n)) return fb;
    return Math.min(hi, Math.max(lo, n));
  }

  function sanitizeTuning(){
    if(!els.tuningInput) return 440;
    const a4 = clampFloat(els.tuningInput.value, 50, 2000, 440);
    const s = String(a4);
    if(els.tuningInput.value !== s) els.tuningInput.value = s;
    return a4;
  }

  // Convention you asked for: Bb trumpet etc = -2.
  // Display-only uses: displayMidi = concertMidi - transpose
  function getTranspose(){
    if(!els.transposeInput) return 0;
    const n = parseInt(els.transposeInput.value, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function getShiftSemitones(){
    return parseIntOr(els.shiftInputChr?.value, 0);
  }

  function normalizeDiatonicOffsetValue(raw){
    if(raw >= -1 && raw <= 1) return 1;
    return raw;
  }

  function getDiatonicOffsetStepCount(){
    const raw = parseIntOr(els.shiftInputDia?.value, 1);
    const norm = normalizeDiatonicOffsetValue(raw);
    if(norm > 1) return norm - 1;
    if(norm < -1) return norm + 1;
    return 0;
  }

  function shiftMidiByTonalDegreeSteps(baseMidi, steps){
    if(!Number.isFinite(baseMidi) || steps === 0) return baseMidi;
    const rootPc = parseInt(els.rootPc.value,10) || 0;
    const degSet = getTonalDegreeSet();
    let m = baseMidi;
    if(steps > 0){
      for(let i=0; i<steps; i++){
        do{ m += 1; } while(!degSet.has(mod(m - rootPc, 12)));
      }
    }else{
      for(let i=0; i<Math.abs(steps); i++){
        do{ m -= 1; } while(!degSet.has(mod(m - rootPc, 12)));
      }
    }
    return m;
  }

  function updateOffsetUI(){
    const tonal = (els.intervalMode.value === "tonal");
    const dia = isTonalDiaActive();

    if(els.shiftTypeWrap){
      if(tonal) show(els.shiftTypeWrap);
      else hide(els.shiftTypeWrap);
    } else if(els.shiftType){
      if(tonal) show(els.shiftType);
      else hide(els.shiftType);
    }
    if(els.shiftChrWrap && els.shiftDiaWrap){
      if(dia){
        hide(els.shiftChrWrap);
        show(els.shiftDiaWrap);
      } else {
        show(els.shiftChrWrap);
        hide(els.shiftDiaWrap);
      }
    }
  }

  function onShiftInputStep(){
    if(!els.shiftInputDia) return;
    const tonalDia = isTonalDiaActive();
    const currRaw = parseInt(els.shiftInputDia.value, 10);
    const curr = Number.isFinite(currRaw) ? currRaw : 1;
    const prevRaw = parseInt(els.shiftInputDia.dataset.prevShift || "", 10);
    const prev = Number.isFinite(prevRaw) ? prevRaw : curr;

    if(tonalDia && (curr === 0 || curr === -1)){
      // Skip the dead zone so arrows can cross from + to - and back.
      if(curr < prev) els.shiftInputDia.value = "-2";
      else if(curr > prev) els.shiftInputDia.value = "1";
      else els.shiftInputDia.value = "1";
    }
    els.shiftInputDia.dataset.prevShift = els.shiftInputDia.value;
    updateOffsetUI();
  }

  function onShiftTypeToggle(){
    updateOffsetUI();
  }

  function goalFreqFromPlayedFreq(playedFreq, playedMidi){
    if(!(playedFreq > 0)) return 0;
    const isTonalDia = (
      els.intervalMode.value === "tonal" &&
      els.shiftType &&
      !!els.shiftType.checked
    );
    if(isTonalDia){
      const steps = getDiatonicOffsetStepCount();
      const goalMidi = shiftMidiByTonalDegreeSteps(playedMidi, steps);
      return midiToFreq(goalMidi);
    }
    const shiftSemi = getShiftSemitones();
    return playedFreq * Math.pow(2, shiftSemi / 12);
  }

  function displayMidiFromConcert(concertMidi){
    return concertMidi - getTranspose();
  }

  function getA4(){
    return els.tuningInput ? sanitizeTuning() : 440;
  }

  function applyTuningChange(){
    if(!els.tuningInput) return;
    const a4 = sanitizeTuning();
    safeSetLS(LS_TUNING, a4);
    savePersistedSettings();

    // If running in MIDI-based modes, refresh target frequency for the current target.
    if(running && targetMidi !== null && els.intervalMode && els.intervalMode.value !== "continuous"){
      targetFreq = midiToFreq(targetMidi);
    }
  }

  function applyTransposeChange(){
    if(!els.transposeInput) return;
    const t = getTranspose();
    // normalize field to integer string (no NaN)
    els.transposeInput.value = String(t);
    safeSetLS(LS_TRANSPOSE, t);
    savePersistedSettings();

    rebuildRootDropdown();
    rebuildAllOptions();
  }

  /* =========================
     NOTE NAMING / LABELS
     ========================= */
  const mod = (n,m)=>((n%m)+m)%m;

  // Range dropdown: stable names (display-only transpose applied)
  const PC_DROPDOWN = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  function midiToNameForDropdown(concertMidi){
    const m = displayMidiFromConcert(concertMidi);
    const pc = mod(m,12);
    const oct = Math.floor(m/12)-1;
    return `${PC_DROPDOWN[pc]}${oct}`;
  }

  // Random enharmonic spelling (single # or b, includes Cb/Fb/E#/B#) (display-only transpose applied)
  const PC_RANDOM = {
    0:  ["C","B#"],
    1:  ["C#","Db"],
    2:  ["D"],
    3:  ["D#","Eb"],
    4:  ["E","Fb"],
    5:  ["F","E#"],
    6:  ["F#","Gb"],
    7:  ["G"],
    8:  ["G#","Ab"],
    9:  ["A"],
    10: ["A#","Bb"],
    11: ["B","Cb"],
  };
  function randomEnharmonicName(concertMidi){
    const m = displayMidiFromConcert(concertMidi);
    const pc = mod(m,12);
    const oct = Math.floor(m/12)-1;
    const opts = PC_RANDOM[pc] || [PC_DROPDOWN[pc]];
    return `${opts[Math.floor(Math.random()*opts.length)]}${oct}`;
  }

  // Tonal mode: interval labels only (mod 12). Transpose cancels (root & target shift equally),
  // so do NOT apply transpose here.
  const TONAL_INTERVAL_LABELS = ["1","b2","2","b3","3","4","T","5","b6","6","b7","7"];
  function tonalIntervalLabelForMidi(targetMidi){
    const rootPc = parseInt(els.rootPc.value,10) || 0;
    const semi = mod(targetMidi - rootPc, 12);
    return TONAL_INTERVAL_LABELS[semi];
  }

  function midiToFreq(n){
    const a4 = getA4();
    return a4 * Math.pow(2,(n-69)/12);
  }
  function freqToMidiFloat(f){
    const a4 = getA4();
    return 69 + 12*Math.log2(f/a4);
  }

  /* =========================
     PARSING / SANITIZING
     ========================= */
  function parseUnsignedInts(s){
    const m = String(s).match(/\d+/g) || [];
    const out = [];
    for(const x of m){
      const n = parseInt(x,10);
      if(Number.isFinite(n) && n >= 0) out.push(n);
    }
    return out;
  }
  function dedupeKeepOrder(arr){
    const seen = new Set();
    const out = [];
    for(const n of arr){
      if(!seen.has(n)){
        seen.add(n);
        out.push(n);
      }
    }
    return out;
  }
  function sanitizeIntervalListString(s){
    return dedupeKeepOrder(parseUnsignedInts(s)).join(" ");
  }
  function sanitizeTonalDegreesString(s){
    const a = parseUnsignedInts(s).filter(n => n>=0 && n<=11);
    return dedupeKeepOrder(a).join(" ");
  }
  function clampInt(v, lo, hi, fb){
    const n = Math.floor(Number(v));
    if(!Number.isFinite(n)) return fb;
    return Math.min(hi, Math.max(lo, n));
  }
  function setIfChanged(input, val){
    if(!input) return;
    const s = String(val);
    if(input.value !== s) input.value = s;
  }
  function sanitizeCents(){
    const a = clampInt(els.centMin.value,0,1200,20);
    const b0 = clampInt(els.centMax.value,0,1200,1200);
    const b = Math.max(a,b0);
    setIfChanged(els.centMin, a);
    setIfChanged(els.centMax, b);
    return {min:a, max:b};
  }
  function sanitizeTolSoundRepeat(){
    const tol = clampInt(els.tolInput.value,1,200,25);
    const sndRaw = Number(els.soundInput.value);
    const repRaw = Number(els.repeatInput.value);
    const snd = Number.isFinite(sndRaw) ? sndRaw : 1000;
    const rep = Number.isFinite(repRaw) ? repRaw : 2000;
    setIfChanged(els.tolInput, tol);
    return {tol, soundMs:snd, gapMs:rep};
  }

  /* =========================
     UI VISIBILITY RULES
     ========================= */
  function storeVisibleIntervalListsForMode(sym){
    if(sym){
      intervalsSymValue = sanitizeIntervalListString(els.upIntervals.value);
    }else{
      intervalsAsymUpValue = sanitizeIntervalListString(els.upIntervals.value);
      intervalsAsymDownValue = sanitizeIntervalListString(els.downIntervals.value);
    }
  }

  function loadIntervalListsForSymMode(sym){
    if(sym){
      const v = intervalsSymValue || DEFAULT_INTERVAL_LIST;
      els.upIntervals.value = v;
    }else{
      const up = intervalsAsymUpValue || DEFAULT_INTERVAL_LIST;
      const dn = intervalsAsymDownValue || DEFAULT_INTERVAL_LIST;
      els.upIntervals.value = up;
      els.downIntervals.value = dn;
    }
  }

  function onSymmetryChange(){
    const sym = (els.symmetrySelect.value === "1");
    if(prevSymmetricMode !== null && prevSymmetricMode !== sym){
      // Persist values from the mode we are leaving, not the mode we are entering.
      storeVisibleIntervalListsForMode(prevSymmetricMode);
    }
    loadIntervalListsForSymMode(sym);
    prevSymmetricMode = sym;

    if(els.upIntervalsLabel){
      els.upIntervalsLabel.textContent = sym ? "Intervals" : "Intervals↑";
    }
    if(sym){
      hide(els.downIntervalsRow);
    }else{
      show(els.downIntervalsRow);
    }
    savePersistedSettings();
    rebuildAllOptions();
  }

  function setIntervalModeUI(){
    const m = els.intervalMode.value;

    hide(els.symmetrySelect);
    hide(els.intervalMinMaxRow);
    hide(els.continuousRow);
    hide(els.intervalListsRow);
    hide(els.tonalRow1);
    hide(els.tonalRow2);
    hide(els.tonicBtn);

    if(m === "minmax"){
      show(els.intervalMinMaxRow);
    } else if(m === "continuous"){
      show(els.continuousRow);
      sanitizeCents();
    } else if(m === "lists"){
      show(els.symmetrySelect);
      show(els.intervalListsRow);
      onSymmetryChange();
    } else if(m === "tonal"){
      show(els.intervalMinMaxRow);
      show(els.tonalRow1);
      show(els.tonalRow2);
      show(els.tonicBtn);
    }
    updateOffsetUI();
    rebuildAllOptions();
  }

  function syncReplayStateLabel(){
    els.replayState.textContent = els.replayToggle.checked ? "ON" : "OFF";
  }

  function updateDebugReadout(data){
    if(!els.debugPanel || els.debugPanel.classList.contains("hidden")) return;
    const fmt = (n, d=2)=> Number.isFinite(n) ? n.toFixed(d) : "—";
    if(els.dbgFreq) els.dbgFreq.textContent = fmt(data.freq, 2);
    if(els.dbgGoal) els.dbgGoal.textContent = fmt(data.goalFreq, 2);
    if(els.dbgDiff) els.dbgDiff.textContent = fmt(data.diffGoal, 1);
    if(els.dbgClarity) els.dbgClarity.textContent = fmt(data.clarity, 3);
    if(els.dbgDb) els.dbgDb.textContent = fmt(data.db, 1);
    if(els.dbgTol) els.dbgTol.textContent = fmt(data.tol, 1);
    if(els.dbgLoud) els.dbgLoud.textContent = data.loudEnough ? "Yes" : "No";
    if(els.dbgClear) els.dbgClear.textContent = data.clearEnough ? "Yes" : "No";
    if(els.dbgHasInput) els.dbgHasInput.textContent = data.hasInput ? "Yes" : "No";
    if(els.dbgMode) els.dbgMode.textContent = data.mode || "—";
  }

  /* =========================
     TUNER (Option A) - persistent row
     ========================= */
  const TUNER_MAX_CENTS = 50;
  const TUNER_HOLD_MS = 500;   // keep last reading ~500ms after signal drops
  const TUNER_UI_MS = 33;      // ~30 fps UI updates
  const TUNER_SMOOTH_A = 0.18; // cents low-pass factor

  let tunerSmooth = 0;
  let lastInputTs = 0;
  let lastTunerUiTs = 0;

  function tunerNoSignal(){
    els.tunerNeedle.classList.add("off");
    els.tunerNeedle.classList.remove("good");
    els.tunerReadout.textContent = "—";
  }

  function updateTuner(diffCents, tol){
    els.tunerNeedle.classList.remove("off");

    const c = Math.max(-TUNER_MAX_CENTS, Math.min(TUNER_MAX_CENTS, diffCents));
    const pct = (c / TUNER_MAX_CENTS) * 50;
    els.tunerNeedle.style.left = `calc(50% + ${pct}%)`;
    els.tunerReadout.textContent = `${c > 0 ? "+" : ""}${Math.round(c)}¢`;

    if(Math.abs(diffCents) < tol) els.tunerNeedle.classList.add("good");
    else els.tunerNeedle.classList.remove("good");
  }

  /* =========================
     DROPDOWN CONSTRAINTS
     ========================= */
  const GLOBAL_MIN_MIDI = 36;
  const GLOBAL_MAX_MIDI = 96;
  const JUMP_CAP = 36;

  function addOpt(sel, val, label){
    const o = document.createElement("option");
    o.value = String(val);
    o.textContent = label;
    sel.appendChild(o);
  }

  // Root dropdown labels must also be transposed (display-only)
  const ROOT_LABELS = ["C","C#/Db","D","D#/Eb","E","F","F#/Gb","G","G#/Ab","A","A#/Bb","B"];
  function rootLabelForPc(concertPc){
    const displayPc = mod(concertPc - getTranspose(), 12);
    return ROOT_LABELS[displayPc];
  }

  function rebuildRootDropdown(){
    if(!els.rootPc) return;
    const prev = els.rootPc.value || "0";
    els.rootPc.innerHTML = "";
    for(let pc=0; pc<12; pc++){
      addOpt(els.rootPc, pc, rootLabelForPc(pc));
    }
    if([...els.rootPc.options].some(o=>o.value===prev)) els.rootPc.value = prev;
    else els.rootPc.value = "0";
  }

  function numOrNull(v){
    if(v === "none") return null;
    const n = parseInt(v,10);
    return Number.isFinite(n) ? n : null;
  }
  const effMinJumpFrom = (v)=> (v==="none") ? 0 : parseInt(v,10);
  const effMaxJumpFrom = (v,cap)=> (v==="none") ? cap : parseInt(v,10);

  function capForCurrentRange(){
    const lo = parseInt(els.rangeLow.value,10);
    const hi = parseInt(els.rangeHigh.value,10);
    return Math.min(JUMP_CAP, Math.max(0, hi - lo));
  }

  function requiredSpan(){
    const mode = els.intervalMode.value;

    if(mode === "lists"){
      const cap = capForCurrentRange();
      const sym = (els.symmetrySelect.value === "1");
      const up = parseUnsignedInts(els.upIntervals.value);
      const dn = sym ? up : parseUnsignedInts(els.downIntervals.value);
      const all = dedupeKeepOrder(up.concat(dn)).map(n => Math.min(cap, Math.max(0,n)));
      return all.length ? Math.max(...all) : 0;
    }

    if(mode === "continuous"){
      const cap = capForCurrentRange();
      const maxC = clampInt(els.centMax.value,0,1200,1200);
      const semi = Math.ceil(maxC/100);
      return Math.min(cap, semi);
    }

    const a = numOrNull(els.jumpMin.value);
    const b = numOrNull(els.jumpMax.value);
    return Math.max(a ?? 0, b ?? 0);
  }

  function rebuildRangeLow(){
    const hi = parseInt(els.rangeHigh.value,10);
    const req = requiredSpan();
    const prev = els.rangeLow.value;

    els.rangeLow.innerHTML = "";
    for(let m=GLOBAL_MIN_MIDI; m<=GLOBAL_MAX_MIDI; m++){
      if(m<=hi && (hi-m)>=req) addOpt(els.rangeLow, m, midiToNameForDropdown(m));
    }
    if([...els.rangeLow.options].some(o=>o.value===prev)) els.rangeLow.value = prev;
  }

  function rebuildRangeHigh(){
    const lo = parseInt(els.rangeLow.value,10);
    const req = requiredSpan();
    const prev = els.rangeHigh.value;

    els.rangeHigh.innerHTML = "";
    for(let m=GLOBAL_MIN_MIDI; m<=GLOBAL_MAX_MIDI; m++){
      if(m>=lo && (m-lo)>=req) addOpt(els.rangeHigh, m, midiToNameForDropdown(m));
    }
    if([...els.rangeHigh.options].some(o=>o.value===prev)) els.rangeHigh.value = prev;
  }

  function rebuildJumpMin(){
    const cap = capForCurrentRange();
    const maxEff = effMaxJumpFrom(els.jumpMax.value, cap);
    const prev = els.jumpMin.value;

    els.jumpMin.innerHTML = "";
    addOpt(els.jumpMin, "none", "None");
    for(let j=0; j<=cap; j++){
      if(j<=maxEff) addOpt(els.jumpMin, j, String(j));
    }
    if([...els.jumpMin.options].some(o=>o.value===prev)) els.jumpMin.value = prev;
  }

  function rebuildJumpMax(){
    const cap = capForCurrentRange();
    const minEff = effMinJumpFrom(els.jumpMin.value);
    const prev = els.jumpMax.value;

    els.jumpMax.innerHTML = "";
    addOpt(els.jumpMax, "none", "None");
    for(let j=0; j<=cap; j++){
      if(j>=minEff) addOpt(els.jumpMax, j, String(j));
    }
    if([...els.jumpMax.options].some(o=>o.value===prev)) els.jumpMax.value = prev;
  }

  function rebuildAllOptions(){
    rebuildRangeLow();
    rebuildRangeHigh();
    rebuildJumpMin();
    rebuildJumpMax();
    rebuildRangeLow();
    rebuildRangeHigh();
  }

  /* =========================
     YIN (preserved logic)
     ========================= */
  const yin = (function(){
    let hist = [];
    return function yinFn(buffer, sr, o={}){
      const thr = o.threshold ?? 0.1;
      const interpolate = o.interpolate ?? true;
      const lowpass = o.lowpass ?? 0;
      const adaptive = o.adaptive ?? false;
      const smooth = o.smooth ?? 0;

      const n = buffer.length;
      const half = n >> 1;
      const yinBuf = new Float32Array(half);

      let tau = -1;
      let best = 1;

      if (lowpass > 0){
        const RC = 1 / (2 * Math.PI * lowpass);
        const dt = 1 / sr;
        const a = dt / (RC + dt);
        for (let i=1;i<n;i++){
          buffer[i] = buffer[i-1] + a * (buffer[i] - buffer[i-1]);
        }
      }

      let threshold = thr;
      if (adaptive){
        let e=0;
        for (let i=0;i<n;i++) e += buffer[i]*buffer[i];
        const rms = Math.sqrt(e/n);
        threshold = Math.min(0.2, Math.max(0.05, thr + (0.05 - rms)));
      }

      yinBuf[0] = 1;

      for (let t=1;t<half;t++){
        let sum=0;
        for (let i=0;i<half;i++){
          const d = buffer[i] - buffer[i+t];
          sum += d*d;
        }
        yinBuf[t]=sum;
      }

      let running=0;
      for (let t=1;t<half;t++){
        running += yinBuf[t];
        yinBuf[t] *= t / (running || 1e-12);
        if (tau < 0 && yinBuf[t] < threshold){
          tau = t;
          best = yinBuf[t];
        }
      }

      if (tau <= 0) return [0, 0];

      // Standard YIN refinement: after first threshold crossing,
      // move to the local minimum. This reduces cents bias/jitter.
      while (tau + 1 < half && yinBuf[tau + 1] < yinBuf[tau]){
        tau++;
      }
      best = yinBuf[tau];

      let betterTau = tau;
      const clarity = 1 - best;

      if (interpolate && tau > 1 && tau < half-1){
        const y0 = yinBuf[tau-1], y1 = yinBuf[tau], y2 = yinBuf[tau+1];
        const a = (y2 + y0 - 2*y1) / 2;
        const b = (y2 - y0) / 2;
        if (a !== 0) betterTau = tau - b / (2*a);
      }

      let freq = sr / betterTau;

      if (smooth > 1){
        hist.push(freq);
        if (hist.length > smooth) hist.shift();
        const sorted = hist.slice().sort((a,b)=>a-b);
        freq = sorted[Math.floor(sorted.length/2)];
      } else {
        hist.length = 0;
      }

      return [freq, clarity];
    };
  })();

  /* =========================
     AUDIO STATE
     ========================= */
  let running = false;

  let audioCtx = null;
  let micStream = null;
  let micSource = null;
  let analyser = null;

  let timeBuf = null;
  let yinWorkBuf = null;

  let pitchRaf = null;
  let repeatTimer = null;
  let uiTimer = null;

  const activeNodes = [];

  /* =========================
     GAME STATE
     ========================= */
  let targetMidi = null;
  let targetFreq = 0;
  let hitLocked = false;
  let inTolSinceTs = 0;

  let startTs = 0;
  let correctCount = 0;

  let noteStartTs = 0;
  let lastNoteSeconds = 0;
  let totalSolvedSeconds = 0;

  /* =========================
     FIXED INTERNAL PARAMS
     ========================= */
  const FIXED_MIN_DB = -73;
  const FIXED_CLARITY = 0.46;
  // Disable pre-filtering for pitch detection accuracy.
  // A low cutoff here can bias estimates for mid/high notes.
  const FIXED_LP_HZ = 0;
  const FIXED_SMOOTH = 1;

  const CONFIRM_MS = 450;
  const CONFIRM_GAP_MS = 120;
  const HIT_HOLD_MS = 100;

  /* =========================
     AUDIO HELPERS
     ========================= */
  function rmsToDbfs(rms){
    return 20 * Math.log10(Math.max(rms, 1e-9));
  }

  async function ensureAudioCtx(){
    if(!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(audioCtx.state === "suspended") await audioCtx.resume();
  }

  function stopActiveNodes(){
    const now = audioCtx?.currentTime ?? 0;
    const fadeSec = 0.012;
    const disconnectDelayMs = Math.ceil((fadeSec + 0.03) * 1000);
    for(const n of activeNodes){
      try{
        if(n.gain?.cancelScheduledValues){
          n.gain.cancelScheduledValues(now);
          const v = Math.max(0.0001, Number(n.gain.value) || 0.0001);
          n.gain.setValueAtTime(v, now);
          n.gain.exponentialRampToValueAtTime(0.0001, now + fadeSec);
        }
      }catch{}
      try{
        if(n.stop) n.stop(now + fadeSec + 0.01);
      }catch{}
      if(n.disconnect){
        setTimeout(()=>{ try{ n.disconnect(); }catch{} }, disconnectDelayMs);
      }
    }
    activeNodes.length = 0;
  }

  function playTone(freq, ms, {stopExisting=true} = {}){
    if(!audioCtx) return;
    if(stopExisting) stopActiveNodes();

    const t0 = audioCtx.currentTime;
    const dur = Math.max(0.05, ms/1000);

    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.connect(audioCtx.destination);

    const attack = 0.01, decay = 0.05, sustain = 0.75, release = 0.04;
    master.gain.exponentialRampToValueAtTime(0.18, t0 + attack);
    master.gain.exponentialRampToValueAtTime(0.18 * sustain, t0 + attack + decay);
    master.gain.setValueAtTime(
      0.18 * sustain,
      t0 + Math.max(attack + decay, dur - release)
    );
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const exp = 2.6;
    const maxPartials = 14;
    const nyquist = audioCtx.sampleRate / 2;

    let sum = 0;
    const partials = [];
    for(let n=1; n<=maxPartials; n++){
      const f = freq * n;
      if(f >= nyquist) break;
      const a = 1 / Math.pow(n, exp);
      partials.push([n, a]);
      sum += a;
    }
    const norm = sum > 0 ? 1/sum : 1;

    for(const [n,a] of partials){
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq*n, t0);

      const g = audioCtx.createGain();
      g.gain.setValueAtTime(a*norm, t0);

      osc.connect(g).connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);

      activeNodes.push(osc, g);
    }
    activeNodes.push(master);
  }

  function stopAllAudio(){
    if(pitchRaf) cancelAnimationFrame(pitchRaf);
    pitchRaf = null;

    if(repeatTimer) clearInterval(repeatTimer);
    repeatTimer = null;

    if(uiTimer) clearInterval(uiTimer);
    uiTimer = null;

    stopActiveNodes();

    if(micSource){ try{ micSource.disconnect(); }catch{} micSource=null; }
    if(analyser){ try{ analyser.disconnect(); }catch{} analyser=null; }

    if(micStream){
      micStream.getTracks().forEach(t=>t.stop());
      micStream = null;
    }

    timeBuf = null;
    yinWorkBuf = null;

    if(audioCtx){
      const ctx = audioCtx;
      audioCtx = null;
      ctx.close().catch(()=>{});
    }
  }

  /* =========================
     TARGET SELECTION HELPERS
     ========================= */
  const pickRandomMidi = (lo,hi)=> lo + Math.floor(Math.random()*(hi-lo+1));

  function computeLegalSignedJumpsMinMax(curr, lo, hi){
    const span = hi-lo;
    const cap = Math.min(JUMP_CAP, span);

    const minEff = effMinJumpFrom(els.jumpMin.value);
    const maxEff = effMaxJumpFrom(els.jumpMax.value, cap);

    const minJ = Math.min(minEff, maxEff);
    const maxJ = Math.max(minEff, maxEff);

    const legal = [];
    for(let j=minJ; j<=maxJ; j++){
      if(j === 0){
        if(curr>=lo && curr<=hi) legal.push(0);
      }else{
        if(curr+j <= hi) legal.push(+j);
        if(curr-j >= lo) legal.push(-j);
      }
    }
    return [...new Set(legal)];
  }

  function computeLegalSignedJumpsLists(curr, lo, hi){
    const span = hi-lo;
    const cap = Math.min(JUMP_CAP, span);
    const sym = (els.symmetrySelect.value === "1");

    const up = dedupeKeepOrder(parseUnsignedInts(els.upIntervals.value))
                .map(n=>Math.min(cap,n));
    const dn = sym
      ? up
      : dedupeKeepOrder(parseUnsignedInts(els.downIntervals.value)).map(n=>Math.min(cap,n));

    const legal = [];
    if(up.includes(0) || dn.includes(0)) legal.push(0);

    for(const j of up) if(j>0 && curr+j<=hi) legal.push(+j);
    for(const j of dn) if(j>0 && curr-j>=lo) legal.push(-j);

    return [...new Set(legal)];
  }

  function getTonalDegreeSet(){
    const clean = sanitizeTonalDegreesString(els.tonalDegrees.value);
    return clean.length
      ? new Set(clean.split(/\s+/).map(n=>parseInt(n,10)))
      : new Set([0]);
  }

  function getTonalCandidates(lo,hi){
    const rootPc = parseInt(els.rootPc.value,10) || 0;
    const degSet = getTonalDegreeSet();
    const out = [];
    for(let m=lo; m<=hi; m++){
      if(degSet.has(mod(m-rootPc,12))) out.push(m);
    }
    return out;
  }

  function pickNextTargetFreqContinuous(prevFreq){
    const cents = sanitizeCents();
    const lo = parseInt(els.rangeLow.value,10);
    const hi = parseInt(els.rangeHigh.value,10);
    const fLo = midiToFreq(lo), fHi = midiToFreq(hi);

    const minC = clampInt(cents.min,0,1200,20);
    const maxC = clampInt(cents.max,0,1200,1200);

    if(!(prevFreq > 0)){
      return midiToFreq(pickRandomMidi(lo,hi));
    }

    for(let t=0; t<24; t++){
      const c = minC + Math.random()*(maxC-minC);
      const dir = Math.random()<0.5 ? -1 : 1;

      let cand = prevFreq * Math.pow(2,(dir*c)/1200);
      if(cand>=fLo && cand<=fHi) return cand;

      cand = prevFreq * Math.pow(2,(-dir*c)/1200);
      if(cand>=fLo && cand<=fHi) return cand;
    }
    return midiToFreq(pickRandomMidi(lo,hi));
  }

  function pickNextTargetMidi(){
    const lo = parseInt(els.rangeLow.value,10);
    const hi = parseInt(els.rangeHigh.value,10);
    const mode = els.intervalMode.value;

    if(mode === "tonal"){
      const cand = getTonalCandidates(lo,hi);
      if(!cand.length) return pickRandomMidi(lo,hi);
      if(targetMidi === null) return cand[Math.floor(Math.random()*cand.length)];

      const legal = computeLegalSignedJumpsMinMax(targetMidi,lo,hi)
        .map(d=>targetMidi+d)
        .filter(m=>cand.includes(m));

      return legal.length
        ? legal[Math.floor(Math.random()*legal.length)]
        : cand[Math.floor(Math.random()*cand.length)];
    }

    if(mode === "continuous"){
      if(targetMidi === null) return pickRandomMidi(lo,hi);
      return targetMidi;
    }

    if(targetMidi === null) return pickRandomMidi(lo,hi);

    const legal = (mode === "lists")
      ? computeLegalSignedJumpsLists(targetMidi,lo,hi)
      : computeLegalSignedJumpsMinMax(targetMidi,lo,hi);

    if(!legal.length || (legal.length===1 && legal[0]===0)){
      return pickRandomMidi(lo,hi);
    }

    return targetMidi + legal[Math.floor(Math.random()*legal.length)];
  }

  /* =========================
     TIMERS / STATS
     ========================= */
  function updateAvgNote(){
    if(correctCount <= 0){
      els.avgNote.textContent = "0.00";
      return;
    }
    const avg = totalSolvedSeconds / correctCount;
    els.avgNote.textContent = avg.toFixed(2);
  }

  function startUITimer(){
    if(uiTimer) clearInterval(uiTimer);
    uiTimer = setInterval(()=>{
      if(!running) return;
      const elapsedSec = Math.floor((performance.now() - startTs) / 1000);
      els.elapsed.textContent = String(elapsedSec);
      els.correct.textContent = String(correctCount);
    }, 250);
  }

  /* =========================
     TARGET START / REPEAT
     ========================= */
  function playTargetNow(ms){
    const {soundMs} = sanitizeTolSoundRepeat();
    const durMs = (ms ?? soundMs);
    playTone(targetFreq, durMs, {stopExisting:true});
  }

  function startRepeating(){
    if(repeatTimer) clearInterval(repeatTimer);
    const {soundMs, gapMs} = sanitizeTolSoundRepeat();
    const cycleMs = soundMs + gapMs;

    repeatTimer = setInterval(()=>{
      if(!running) return;
      if(hitLocked) return;
      if(targetFreq <= 0) return;
      playTargetNow();
    }, cycleMs);
  }

  function startNewTarget(){
    hitLocked = false;
    inTolSinceTs = 0;

    const mode = els.intervalMode.value;

    if(mode === "continuous"){
      const lo = parseInt(els.rangeLow.value,10);
      const hi = parseInt(els.rangeHigh.value,10);

      if(!(targetFreq > 0) || targetMidi === null){
        targetMidi = pickRandomMidi(lo, hi);
        targetFreq = midiToFreq(targetMidi);
      } else {
        targetFreq = pickNextTargetFreqContinuous(targetFreq);
        const m = Math.round(freqToMidiFloat(targetFreq));
        targetMidi = Math.min(hi, Math.max(lo, m));
      }

      noteStartTs = performance.now();
      playTargetNow();
      startRepeating();
      return;
    }

    targetMidi = pickNextTargetMidi();
    targetFreq = midiToFreq(targetMidi);

    noteStartTs = performance.now();
    playTargetNow();
    startRepeating();
  }

  /* =========================
     START / STOP
     ========================= */
  async function start(){
    await ensureAudioCtx();

    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation:false, noiseSuppression:false, autoGainControl:false }
    });

    micSource = audioCtx.createMediaStreamSource(micStream);

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.0;

    timeBuf = new Float32Array(analyser.fftSize);
    yinWorkBuf = new Float32Array(analyser.fftSize);

    micSource.connect(analyser);

    startTs = performance.now();
    correctCount = 0;
    els.elapsed.textContent = "0";
    els.correct.textContent = "0";

    lastNoteSeconds = 0;
    els.noteTime.textContent = "0";

    totalSolvedSeconds = 0;
    els.avgNote.textContent = "0.00";

    startUITimer();

    targetMidi = null;
    targetFreq = 0;
    hitLocked = false;
    inTolSinceTs = 0;

    tunerSmooth = 0;
    lastInputTs = 0;
    lastTunerUiTs = 0;
    tunerNoSignal();

    startNewTarget();

    const pitchLoop = () => {
      if(!running || !analyser || !timeBuf || !yinWorkBuf){
        pitchRaf = null;
        return;
      }

      analyser.getFloatTimeDomainData(timeBuf);

      let e = 0;
      for(let i=0;i<timeBuf.length;i++) e += timeBuf[i]*timeBuf[i];
      const rms = Math.sqrt(e / timeBuf.length);
      const db = rmsToDbfs(rms);
      const loudEnough = db >= FIXED_MIN_DB;

      yinWorkBuf.set(timeBuf);
      const [freq, clar] = yin(yinWorkBuf, audioCtx.sampleRate, {
        interpolate:true,
        lowpass: FIXED_LP_HZ,
        adaptive:false,
        smooth: FIXED_SMOOTH
      });
      const clearEnough = clar >= FIXED_CLARITY;

      const {tol} = sanitizeTolSoundRepeat();
      const mode = els.intervalMode.value;
      const goalFreq = goalFreqFromPlayedFreq(targetFreq, targetMidi);

      const now = performance.now();
      const hasInput = (!hitLocked && goalFreq > 0 && loudEnough && clearEnough && freq > 0);
      let diffGoal = NaN;

      if(hasInput){
        lastInputTs = now;

        diffGoal = 1200 * Math.log2(freq / goalFreq);
        tunerSmooth = (1 - TUNER_SMOOTH_A) * tunerSmooth + TUNER_SMOOTH_A * diffGoal;

        if(now - lastTunerUiTs >= TUNER_UI_MS){
          updateTuner(tunerSmooth, tol);
          lastTunerUiTs = now;
        }

        if(Math.abs(diffGoal) < tol){
          if(inTolSinceTs <= 0) inTolSinceTs = now;
          if(now - inTolSinceTs >= HIT_HOLD_MS){
            hitLocked = true;
            correctCount += 1;

          lastNoteSeconds = Math.floor((performance.now() - noteStartTs) / 1000);
          els.noteTime.textContent = String(lastNoteSeconds);

          totalSolvedSeconds += lastNoteSeconds;
          updateAvgNote();

          if(mode === "continuous"){
            els.lastNote.textContent = "✔";
          } else if(mode === "tonal"){
            els.lastNote.textContent = tonalIntervalLabelForMidi(targetMidi);
          } else {
            els.lastNote.textContent = randomEnharmonicName(targetMidi);
          }

          const replay = !!els.replayToggle.checked;
          if(replay){
            playTone(targetFreq, CONFIRM_MS, {stopExisting:true});
            setTimeout(()=>{
              if(!running) return;
              startNewTarget();
            }, CONFIRM_MS + CONFIRM_GAP_MS);
          }else{
            startNewTarget();
          }
          }
        } else {
          inTolSinceTs = 0;
        }
      } else {
        inTolSinceTs = 0;
        if(now - lastInputTs > TUNER_HOLD_MS){
          tunerNoSignal();
        }
      }

      updateDebugReadout({
        freq,
        goalFreq,
        diffGoal,
        clarity: clar,
        db,
        tol,
        loudEnough,
        clearEnough,
        hasInput,
        mode
      });

      pitchRaf = requestAnimationFrame(pitchLoop);
    };

    pitchRaf = requestAnimationFrame(pitchLoop);
  }

  function stop(){
    if(running && noteStartTs){
      lastNoteSeconds = Math.floor((performance.now() - noteStartTs) / 1000);
      els.noteTime.textContent = String(lastNoteSeconds);
    }
    updateAvgNote();
    running = false;
    inTolSinceTs = 0;
    els.toggleBtn.textContent = "Start";
    tunerNoSignal();
    stopAllAudio();
  }

  /* =========================
     BUTTONS
     ========================= */
  els.toggleBtn.addEventListener("click", async () => {
    if(running){
      stop();
      return;
    }
    running = true;
    els.toggleBtn.textContent = "Stop";
    try{
      await start();
    }catch{
      stop();
    }
  });

  els.tonicBtn.addEventListener("click", async () => {
    if(els.intervalMode.value !== "tonal") return;
    try{ await ensureAudioCtx(); }catch{ return; }

    const lo = parseInt(els.rangeLow.value,10);
    const hi = parseInt(els.rangeHigh.value,10);
    const rootPc = parseInt(els.rootPc.value,10) || 0;

    const roots = [];
    for(let m=lo; m<=hi; m++){
      if(mod(m,12) === mod(rootPc,12)) roots.push(m);
    }
    if(!roots.length) return;

    const {soundMs} = sanitizeTolSoundRepeat();
    const m = roots[Math.floor(Math.random()*roots.length)];
    playTone(midiToFreq(m), soundMs, {stopExisting:false});
  });

  /* =========================
     VISIBILITY RESUME
     ========================= */
  document.addEventListener("visibilitychange", async ()=>{
    if(!audioCtx) return;
    if(document.visibilityState==="visible" && audioCtx.state==="suspended"){
      try{ await audioCtx.resume(); }catch{}
    }
  });

  /* =========================
     EVENT WIRING (inputs)
     ========================= */
  els.intervalMode.addEventListener("change", setIntervalModeUI);
  els.symmetrySelect.addEventListener("change", onSymmetryChange);

  els.upIntervals.addEventListener("blur", ()=>{
    els.upIntervals.value = sanitizeIntervalListString(els.upIntervals.value);
    storeVisibleIntervalListsForMode(els.symmetrySelect.value === "1");
    savePersistedSettings();
    rebuildAllOptions();
  });

  els.downIntervals.addEventListener("blur", ()=>{
    els.downIntervals.value = sanitizeIntervalListString(els.downIntervals.value);
    storeVisibleIntervalListsForMode(els.symmetrySelect.value === "1");
    savePersistedSettings();
    rebuildAllOptions();
  });

  els.tonalDegrees.addEventListener("blur", ()=>{
    els.tonalDegrees.value = sanitizeTonalDegreesString(els.tonalDegrees.value);
    rebuildAllOptions();
  });

  els.rootPc.addEventListener("change", rebuildAllOptions);

  els.rangeLow.addEventListener("change", rebuildAllOptions);
  els.rangeHigh.addEventListener("change", rebuildAllOptions);
  els.jumpMin.addEventListener("change", rebuildAllOptions);
  els.jumpMax.addEventListener("change", rebuildAllOptions);

  els.centMin.addEventListener("blur", ()=>{ sanitizeCents(); rebuildAllOptions(); });
  els.centMax.addEventListener("blur", ()=>{ sanitizeCents(); rebuildAllOptions(); });

  els.tolInput.addEventListener("blur", sanitizeTolSoundRepeat);
  els.soundInput.addEventListener("blur", sanitizeTolSoundRepeat);
  els.repeatInput.addEventListener("blur", sanitizeTolSoundRepeat);
  if(els.shiftInputDia){
    els.shiftInputDia.dataset.prevShift = els.shiftInputDia.value;
    els.shiftInputDia.addEventListener("input", onShiftInputStep);
    els.shiftInputDia.addEventListener("change", onShiftInputStep);
    els.shiftInputDia.addEventListener("blur", onShiftInputStep);
  }
  if(els.shiftType){
    els.shiftType.addEventListener("change", onShiftTypeToggle);
  }

  els.replayToggle.addEventListener("change", syncReplayStateLabel);
  if(els.debugToggleBtn && els.debugPanel){
    els.debugToggleBtn.addEventListener("click", ()=>{
      els.debugPanel.classList.toggle("hidden");
      els.debugToggleBtn.textContent = els.debugPanel.classList.contains("hidden") ? "Debug" : "Debug (On)";
    });
  }
  wireSettingsPersistence();

  // NEW: tuning + transpose persistence + live rebuild
  if(els.tuningInput){
    els.tuningInput.addEventListener("blur", applyTuningChange);
    els.tuningInput.addEventListener("change", applyTuningChange);
  }
  if(els.transposeInput){
    els.transposeInput.addEventListener("blur", applyTransposeChange);
    els.transposeInput.addEventListener("change", applyTransposeChange);
  }

  /* =========================
     INIT DROPDOWNS
     ========================= */
  (function init(){
    if(!SHOW_DEBUG_UI && els.debugWrap){
      hide(els.debugWrap);
    }

    const persisted = loadPersistedSettings();

    // Restore A4 + transpose first (so labels build correctly)
    if(els.tuningInput){
      const savedA4 = safeGetLS(LS_TUNING);
      if(savedA4 !== null) els.tuningInput.value = savedA4;
      if(persisted && Object.prototype.hasOwnProperty.call(persisted, "tuningInput")){
        els.tuningInput.value = String(persisted.tuningInput);
      }
      sanitizeTuning();
    }
    if(els.transposeInput){
      const savedT = safeGetLS(LS_TRANSPOSE);
      if(savedT !== null) els.transposeInput.value = savedT;
      if(persisted && Object.prototype.hasOwnProperty.call(persisted, "transposeInput")){
        els.transposeInput.value = String(persisted.transposeInput);
      }
      // normalize to int string
      els.transposeInput.value = String(getTranspose());
    }

    els.rangeLow.innerHTML = "";
    els.rangeHigh.innerHTML = "";
    for(let m=GLOBAL_MIN_MIDI; m<=GLOBAL_MAX_MIDI; m++){
      addOpt(els.rangeLow, m, midiToNameForDropdown(m));
      addOpt(els.rangeHigh, m, midiToNameForDropdown(m));
    }
    els.rangeLow.value = "45";  // A2 (concert value; label is transposed display)
    els.rangeHigh.value = "67"; // G4

    els.jumpMin.innerHTML = "";
    els.jumpMax.innerHTML = "";
    addOpt(els.jumpMin, "none", "None");
    addOpt(els.jumpMax, "none", "None");
    for(let j=0; j<=36; j++){
      addOpt(els.jumpMin, j, String(j));
      addOpt(els.jumpMax, j, String(j));
    }
    els.jumpMin.value = "1";
    els.jumpMax.value = "12";

    // Tonal root selector (display-only transposed labels)
    rebuildRootDropdown();
    els.rootPc.value = els.rootPc.value || "0";

    applyPersistedSettings(persisted);
    if(els.shiftInputChr) els.shiftInputChr.value = String(parseIntOr(els.shiftInputChr.value, 0));
    if(els.shiftInputDia) els.shiftInputDia.value = String(parseIntOr(els.shiftInputDia.value, 1));
    els.upIntervals.value = sanitizeIntervalListString(els.upIntervals.value);
    els.downIntervals.value = sanitizeIntervalListString(els.downIntervals.value);
    intervalsSymValue = intervalsSymValue || DEFAULT_INTERVAL_LIST;
    intervalsAsymUpValue = intervalsAsymUpValue || DEFAULT_INTERVAL_LIST;
    intervalsAsymDownValue = intervalsAsymDownValue || DEFAULT_INTERVAL_LIST;
    prevSymmetricMode = null;

    els.tonalDegrees.value = sanitizeTonalDegreesString(els.tonalDegrees.value);
    sanitizeCents();
    sanitizeTolSoundRepeat();
    onShiftInputStep();

    syncReplayStateLabel();

    tunerNoSignal();
    setIntervalModeUI();
    savePersistedSettings();
  })();

})();
