import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, Square, Circle, SkipBack, 
  Volume2, VolumeX, Mic, Music, Radio, 
  Settings, Users, Plus, Maximize2, MoreHorizontal,
  Folder, Sliders, History, UserCircle, Piano,
  MousePointer2, Pencil, Eraser, X, Grid, Trash2, Activity,
  Settings2, Plug, Power, LogOut, FileAudio, FileCode, Cpu,
  Repeat, Home, Save, Download, Upload, FileJson, Info, AlertTriangle, CheckCircle2
} from 'lucide-react';

const TOTAL_BEATS = 256; 

// --- Internal Engine Definitions ---
const INTERNAL_PLUGINS = [
  { id: 'fx-delay', name: 'Digital Delay', category: 'effect', type: 'delay', vendor: 'WebDAW Core', params: { time: 0.3, feedback: 0.4, mix: 0.5 } },
  { id: 'fx-reverb', name: 'Room Reverb', category: 'effect', type: 'reverb', vendor: 'WebDAW Core', params: { decay: 2.0, mix: 0.4 } },
  { id: 'fx-distortion', name: 'Tube Distortion', category: 'effect', type: 'distortion', vendor: 'WebDAW Core', params: { amount: 50, mix: 1.0 } },
  { id: 'fx-chorus', name: 'Stereo Chorus', category: 'effect', type: 'chorus', vendor: 'WebDAW Core', params: { rate: 1.5, depth: 0.003, mix: 0.5 } },
  { id: 'fx-filter', name: 'Pro-Q Filter', category: 'effect', type: 'filter', vendor: 'WebDAW Core', params: { freq: 1200, res: 1.5 } },
  { id: 'fx-compressor', name: 'Bus Compressor', category: 'effect', type: 'compressor', vendor: 'WebDAW Core', params: { threshold: -24, ratio: 4 } },
  { id: 'fx-bitcrusher', name: 'Lo-Fi Bitcrusher', category: 'effect', type: 'bitcrusher', vendor: 'WebDAW Core', params: { bitDepth: 4, mix: 1.0 } },
  { id: 'fx-autopan', name: 'Auto-Pan LFO', category: 'effect', type: 'autopan', vendor: 'WebDAW Core', params: { rate: 2.0, depth: 1.0 } },
  { id: 'fx-tremolo', name: 'Tremolo', category: 'effect', type: 'tremolo', vendor: 'WebDAW Core', params: { rate: 5.0, depth: 0.8 } },
  { id: 'fx-ringmod', name: 'Ring Modulator', category: 'effect', type: 'ringmod', vendor: 'WebDAW Core', params: { freq: 400, mix: 0.5 } },
  { id: 'fx-eq3', name: '3-Band EQ', category: 'effect', type: 'eq3', vendor: 'WebDAW Core', params: { low: 0, mid: 0, high: 0 } },
  
  { id: 'inst-subtractive', name: 'Analog Subtractive Synth', category: 'instrument', type: 'subtractive', vendor: 'WebDAW Core' },
  { id: 'inst-fm', name: 'Operator FM Synth', category: 'instrument', type: 'fm', vendor: 'WebDAW Core' },
  { id: 'inst-supersaw', name: 'Supersaw Pad', category: 'instrument', type: 'supersaw', vendor: 'WebDAW Core' },
  { id: 'inst-pluck', name: 'Karplus Pluck String', category: 'instrument', type: 'pluck', vendor: 'WebDAW Core' },
  { id: 'inst-acid', name: 'Acid Bassline (303)', category: 'instrument', type: 'acid', vendor: 'WebDAW Core' },
  { id: 'inst-organ', name: 'Tonewheel Organ', category: 'instrument', type: 'organ', vendor: 'WebDAW Core' },
  { id: 'inst-drum', name: 'Drum Sampler', category: 'instrument', type: 'drum', vendor: 'WebDAW Core' },
  { id: 'inst-sampler', name: 'Digital Sampler', category: 'instrument', type: 'sampler', vendor: 'WebDAW Core' }
];

const DEFAULT_DRUM_MAP = {
  36: { name: 'Kick (C1)', sampleId: null, tune: 150, decay: 0.5 },
  38: { name: 'Snare (D1)', sampleId: null, tune: 250, decay: 0.2 },
  39: { name: 'Clap (D#1)', sampleId: null },
  42: { name: 'CH Hat (F#1)', sampleId: null },
  46: { name: 'OH Hat (A#1)', sampleId: null },
  43: { name: 'Lo Tom (G1)', sampleId: null, tune: 100 },
  45: { name: 'Mid Tom (A1)', sampleId: null, tune: 150 },
  48: { name: 'Hi Tom (C2)', sampleId: null, tune: 200 },
  49: { name: 'Crash (C#2)', sampleId: null },
  51: { name: 'Ride (D#2)', sampleId: null }
};

// --- Mock Data ---
const INITIAL_TRACKS = [
  { id: 1, name: 'Lead Vocals', type: 'audio', color: 'bg-blue-500', volume: 80, pan: 0, muted: false, solo: false, armed: false, icon: Mic, 
    clips: [{ id: 101, start: 0, duration: 4 }, { id: 102, start: 5, duration: 3 }],
    effects: [
      { id: 'fx-1', type: 'eq3', name: '3-Band EQ', params: { low: -4, mid: 2, high: 3 } },
      { id: 'fx-2', type: 'reverb', name: 'Room Reverb', params: { decay: 2.5, mix: 0.4 } }
    ]
  },
  { id: 2, name: 'Drum Machine', type: 'midi', instrument: 'inst-drum', instrumentParams: { drumMap: DEFAULT_DRUM_MAP }, color: 'bg-orange-500', volume: 90, pan: 0, muted: false, solo: false, armed: false, icon: Radio, 
    effects: [
      { id: 'fx-3', type: 'compressor', name: 'Bus Compressor', params: { threshold: -15, ratio: 6 } }
    ],
    clips: [
      { id: 201, start: 0, duration: 8, notes: [
        { id: 'd1', pitch: 36, start: 0, duration: 0.25, velocity: 120 }, { id: 'd2', pitch: 42, start: 0.5, duration: 0.25, velocity: 80 },
        { id: 'd3', pitch: 38, start: 1, duration: 0.25, velocity: 110 }, { id: 'd4', pitch: 42, start: 1.5, duration: 0.25, velocity: 80 },
        { id: 'd5', pitch: 36, start: 2, duration: 0.25, velocity: 100 }, { id: 'd6', pitch: 36, start: 2.25, duration: 0.25, velocity: 70 },
        { id: 'd7', pitch: 38, start: 3, duration: 0.25, velocity: 110 }, { id: 'd8', pitch: 46, start: 3.5, duration: 0.25, velocity: 90 }
      ]}
    ] 
  },
  { id: 3, name: 'Acid Bass', type: 'midi', instrument: 'inst-acid', instrumentParams: { oscType: 'square', cutoff: 150, envMod: 2500, decay: 0.3, res: 5 }, color: 'bg-purple-500', volume: 75, pan: 0, muted: false, solo: false, armed: false, icon: Music, 
    effects: [
      { id: 'fx-4', type: 'distortion', name: 'Tube Distortion', params: { amount: 30, mix: 0.6 } }
    ],
    clips: [
      { id: 301, start: 0, duration: 4, notes: [
        { id: 'n1', pitch: 36, start: 0, duration: 0.25, velocity: 100 }, { id: 'n2', pitch: 36, start: 0.5, duration: 0.25, velocity: 127 },
        { id: 'n3', pitch: 48, start: 1, duration: 0.25, velocity: 90 }, { id: 'n4', pitch: 46, start: 1.5, duration: 0.25, velocity: 90 },
        { id: 'n5', pitch: 43, start: 2.5, duration: 0.5, velocity: 110 }, { id: 'n6', pitch: 39, start: 3.5, duration: 0.5, velocity: 110 }
      ]}
    ] 
  },
  { id: 4, name: 'Drawbar Organ', type: 'midi', instrument: 'inst-organ', instrumentParams: { sub: 0.8, fund: 1.0, fifth: 0.6, oct: 0.4 }, color: 'bg-teal-500', volume: 60, pan: -20, muted: false, solo: false, armed: false, icon: Music, 
    effects: [
      { id: 'fx-6', type: 'tremolo', name: 'Tremolo', params: { rate: 6, depth: 0.7 } }
    ], 
    clips: [{ id: 401, start: 4, duration: 4, notes: [{id: 'f1', pitch: 60, start:0, duration:2, velocity: 80}, {id:'f2', pitch:64, start:0, duration:2, velocity: 80}, {id:'f3', pitch:67, start:0, duration: 2, velocity: 80}] }] 
  },
];

const INITIAL_VST_LIBRARY = [
  { id: `wam-obxd`, name: 'OB-Xd Poly Synth', category: 'instrument', type: 'synth', vendor: 'WAM Community', url: 'https://mainline.i3s.unice.fr/wam2/packages/obxd/index.js' }
];

// --- Global Audio Buffer Cache for Samplers ---
const globalAudioBufferCache = new Map();

// --- DSP Utility: WAV Encoding ---
function interleaveWav(inputL, inputR) {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0, inputIndex = 0;
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function encodeWAV(samples, sampleRate, numChannels) {
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Format chunk size
  view.setUint16(20, 1, true); // PCM Format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, Math.round(s < 0 ? s * 0x8000 : s * 0x7FFF), true);
  }
  return new Uint8Array(buffer);
}

const audioBufferToWav = (buffer) => {
  const numChannels = Math.min(2, buffer.numberOfChannels); 
  const sampleRate = buffer.sampleRate;
  let result;
  if (numChannels >= 2) {
    result = interleaveWav(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }
  return encodeWAV(result, sampleRate, numChannels);
};

// --- DSP Utility: Generate Standard MIDI File (.mid) ---
function encodeMIDITrack(track, bpm) {
  const PPQ = 128; 
  let events = [];

  track.clips.forEach(clip => {
    if (!clip.notes) return;
    clip.notes.forEach(note => {
      const absStartBeat = clip.start + note.start;
      const absEndBeat = clip.start + note.start + note.duration;
      events.push({ time: Math.round(absStartBeat * PPQ), type: 'noteOn', pitch: Math.floor(note.pitch), velocity: Math.floor(note.velocity || 100) });
      events.push({ time: Math.round(absEndBeat * PPQ), type: 'noteOff', pitch: Math.floor(note.pitch), velocity: 0 });
    });
  });

  events.sort((a, b) => a.time - b.time);

  let trackData = [];
  const tempo = Math.round(60000000 / bpm);
  trackData.push(0x00, 0xFF, 0x51, 0x03, (tempo >> 16) & 0xFF, (tempo >> 8) & 0xFF, tempo & 0xFF);

  let lastTick = 0;
  events.forEach(ev => {
    let delta = ev.time - lastTick;
    lastTick = ev.time;

    let value = delta;
    let vlq = [value & 0x7F];
    while ((value >>= 7) > 0) {
        vlq.unshift((value & 0x7F) | 0x80);
    }
    trackData.push(...vlq);

    if (ev.type === 'noteOn') {
      trackData.push(0x90, ev.pitch, ev.velocity);
    } else {
      trackData.push(0x80, ev.pitch, 0);
    }
  });

  trackData.push(0x00, 0xFF, 0x2F, 0x00);

  const header = [
    0x4D, 0x54, 0x68, 0x64, 
    0x00, 0x00, 0x00, 0x06, 
    0x00, 0x00, 
    0x00, 0x01, 
    (PPQ >> 8) & 0xFF, PPQ & 0xFF 
  ];

  const trackHeader = [
    0x4D, 0x54, 0x72, 0x6B, 
    (trackData.length >> 24) & 0xFF,
    (trackData.length >> 16) & 0xFF,
    (trackData.length >> 8) & 0xFF,
    trackData.length & 0xFF
  ];

  return new Uint8Array([...header, ...trackHeader, ...trackData]);
}

// --- DSP Utility: Parse Standard MIDI File (.mid) ---
function parseMIDIFile(arrayBuffer, bpm) {
  const view = new DataView(arrayBuffer);
  let offset = 0;
  if (view.getUint32(offset) !== 0x4D546864) throw new Error("Not a valid MIDI file");
  offset += 8;
  const format = view.getUint16(offset); offset += 2;
  const numTracks = view.getUint16(offset); offset += 2;
  const ppq = view.getUint16(offset); offset += 2;

  let notes = [];
  let currentTrack = 0;

  while (offset < view.byteLength && currentTrack < numTracks) {
    if (view.getUint32(offset) !== 0x4D54726B) { offset += 1; continue; }
    offset += 4;
    const trackLen = view.getUint32(offset); offset += 4;
    const trackEnd = offset + trackLen;

    let absoluteTick = 0;
    let activeNotes = {};
    let runningStatus = 0;

    while (offset < trackEnd) {
      let delta = 0;
      while (true) {
        const byte = view.getUint8(offset++);
        delta = (delta << 7) | (byte & 0x7F);
        if (!(byte & 0x80)) break;
      }
      absoluteTick += delta;

      const eventTypeByte = view.getUint8(offset);
      if (eventTypeByte === 0xFF) {
         offset++;
         const metaType = view.getUint8(offset++);
         let metaLen = 0;
         while (true) {
           const b = view.getUint8(offset++);
           metaLen = (metaLen << 7) | (b & 0x7F);
           if (!(b & 0x80)) break;
         }
         offset += metaLen;
      } else if (eventTypeByte === 0xF0 || eventTypeByte === 0xF7) {
         offset++;
         let sysLen = 0;
         while (true) {
           const b = view.getUint8(offset++);
           sysLen = (sysLen << 7) | (b & 0x7F);
           if (!(b & 0x80)) break;
         }
         offset += sysLen;
      } else {
         let status = eventTypeByte;
         if (status < 0x80) { status = runningStatus; } 
         else { offset++; runningStatus = status; }

         const type = status >> 4;
         if (type === 0x8 || type === 0x9) {
            const pitch = view.getUint8(offset++);
            const velocity = view.getUint8(offset++);
            const isNoteOn = type === 0x9 && velocity > 0;

            if (isNoteOn) {
                activeNotes[pitch] = { startTick: absoluteTick, velocity };
            } else {
                if (activeNotes[pitch]) {
                    const startBeat = activeNotes[pitch].startTick / ppq;
                    const endBeat = absoluteTick / ppq;
                    notes.push({
                        id: `m_${Date.now()}_${Math.random()}`,
                        pitch: pitch,
                        start: startBeat,
                        duration: Math.max(0.05, endBeat - startBeat),
                        velocity: activeNotes[pitch].velocity
                    });
                    delete activeNotes[pitch];
                }
            }
         } else if (type === 0xA || type === 0xB || type === 0xE) { offset += 2; } 
         else if (type === 0xC || type === 0xD) { offset += 1; } 
         else { break; }
      }
    }
    currentTrack++;
  }
  return notes;
}

// --- DSP Utility: Generate Impulse Response for Reverb ---
const createReverbIR = (ctx, duration) => {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    const decay = Math.exp(-i / (sampleRate * (duration / 4)));
    left[i] = (Math.random() * 2 - 1) * decay;
    right[i] = (Math.random() * 2 - 1) * decay;
  }
  return impulse;
};

const getBitcrusherCurve = (bitDepth) => {
  const steps = Math.pow(2, bitDepth);
  const curve = new Float32Array(44100);
  for (let i = 0; i < 44100; i++) {
    const x = (i * 2) / 44100 - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
};

// --- Web Audio API Native FX Nodes ---
const createFXNode = (ctx, fx) => {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  
  input.connect(dry);
  dry.connect(output);

  if (fx.type === 'filter') {
    const node = ctx.createBiquadFilter();
    node.type = 'lowpass';
    node.frequency.value = fx.params.freq || 2000;
    node.Q.value = fx.params.res || 1;
    input.connect(node);
    node.connect(output);
    return { input, output, node, fxType: 'filter' };
  } 
  else if (fx.type === 'delay') {
    const delay = ctx.createDelay(5.0);
    delay.delayTime.value = fx.params.time || 0.3;
    const feedback = ctx.createGain();
    feedback.gain.value = fx.params.feedback || 0.3;
    
    wet.gain.value = fx.params.mix !== undefined ? fx.params.mix : 0.5;
    dry.gain.value = 1 - wet.gain.value;
    
    input.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(output);
    return { input, output, delay, feedback, wet, dry, fxType: 'delay' };
  } 
  else if (fx.type === 'distortion') {
      const node = ctx.createWaveShaper();
      const amount = fx.params.amount || 50;
      const curve = new Float32Array(44100);
      const deg = Math.PI / 180;
      for (let i = 0; i < 44100; ++i) {
        const x = (i * 2) / 44100 - 1;
        curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
      }
      node.curve = curve;
      node.oversample = '4x';
      
      wet.gain.value = fx.params.mix !== undefined ? fx.params.mix : 1.0;
      dry.gain.value = 1 - wet.gain.value;

      input.connect(node);
      node.connect(wet);
      wet.connect(output);
      return { input, output, node, wet, dry, fxType: 'distortion' };
  }
  else if (fx.type === 'reverb') {
      const convolver = ctx.createConvolver();
      convolver.buffer = createReverbIR(ctx, fx.params.decay || 2.0);
      
      wet.gain.value = fx.params.mix !== undefined ? fx.params.mix : 0.4;
      dry.gain.value = 1 - wet.gain.value;

      input.connect(convolver);
      convolver.connect(wet);
      wet.connect(output);
      return { input, output, convolver, wet, dry, fxType: 'reverb' };
  }
  else if (fx.type === 'chorus') {
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.03; 
      
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = fx.params.rate || 1.5; 
      
      const modGain = ctx.createGain();
      modGain.gain.value = fx.params.depth || 0.003; 
      
      osc.connect(modGain);
      modGain.connect(delay.delayTime);
      osc.start();

      wet.gain.value = fx.params.mix !== undefined ? fx.params.mix : 0.5;
      dry.gain.value = 1 - wet.gain.value;

      input.connect(delay);
      delay.connect(wet);
      wet.connect(output);
      return { input, output, delay, lfo: osc, lfoGain: modGain, wet, dry, fxType: 'chorus' };
  }
  else if (fx.type === 'compressor') {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = fx.params.threshold || -24;
      comp.ratio.value = fx.params.ratio || 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;

      input.connect(comp);
      comp.connect(output);
      return { input, output, comp, fxType: 'compressor' };
  }
  else if (fx.type === 'bitcrusher') {
      const node = ctx.createWaveShaper();
      node.curve = getBitcrusherCurve(fx.params.bitDepth || 4);
      
      wet.gain.value = fx.params.mix !== undefined ? fx.params.mix : 1.0;
      dry.gain.value = 1 - wet.gain.value;

      input.connect(node);
      node.connect(wet);
      wet.connect(output);
      return { input, output, node, wet, dry, fxType: 'bitcrusher' };
  }
  else if (fx.type === 'autopan') {
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createPanner();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = fx.params.rate || 2.0;
      
      const depthGain = ctx.createGain();
      depthGain.gain.value = fx.params.depth || 1.0;
      
      osc.connect(depthGain);
      if (panner.pan) {
          depthGain.connect(panner.pan);
      }
      osc.start();

      input.connect(panner);
      panner.connect(output);
      return { input, output, panner, lfo: osc, lfoGain: depthGain, fxType: 'autopan' };
  }
  else if (fx.type === 'tremolo') {
      const amp = ctx.createGain();
      const depth = fx.params.depth !== undefined ? fx.params.depth : 0.8;
      amp.gain.value = 1.0 - (depth / 2);
      
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = fx.params.rate || 5.0;
      
      const depthGain = ctx.createGain();
      depthGain.gain.value = depth / 2;
      
      osc.connect(depthGain);
      depthGain.connect(amp.gain);
      osc.start();
      
      input.connect(amp);
      amp.connect(output);
      return { input, output, amp, lfo: osc, lfoGain: depthGain, fxType: 'tremolo' };
  }
  else if (fx.type === 'ringmod') {
      const multiplier = ctx.createGain();
      multiplier.gain.value = 0; 
      
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = fx.params.freq || 400;
      osc.start();
      
      osc.connect(multiplier.gain);
      
      wet.gain.value = fx.params.mix !== undefined ? fx.params.mix : 0.5;
      dry.gain.value = 1 - wet.gain.value;

      input.connect(multiplier);
      multiplier.connect(wet);
      wet.connect(output);
      return { input, output, osc, wet, dry, fxType: 'ringmod' };
  }
  else if (fx.type === 'eq3') {
      const low = ctx.createBiquadFilter();
      low.type = 'lowshelf';
      low.frequency.value = 250;
      low.gain.value = fx.params.low || 0;
      
      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 1000;
      mid.Q.value = 1.0;
      mid.gain.value = fx.params.mid || 0;
      
      const high = ctx.createBiquadFilter();
      high.type = 'highshelf';
      high.frequency.value = 4000;
      high.gain.value = fx.params.high || 0;

      input.connect(low);
      low.connect(mid);
      mid.connect(high);
      high.connect(output);
      return { input, output, low, mid, high, fxType: 'eq3' };
  }

  return null;
};

// --- Native Synths & Samplers ---
const triggerSubtractive = (ctx, trackBus, pitch, time, vol, dur, params = {}, velocity = 100) => {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const ampEnv = ctx.createGain();
  
  const realVol = vol * (velocity / 127);

  osc.type = params.oscType || 'sawtooth';
  const freq = 440 * Math.pow(2, (pitch - 69) / 12);
  osc.frequency.setValueAtTime(freq, time);
  
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(params.cutoff || 2000, time);
  filter.Q.value = params.res || 1.5;
  filter.frequency.exponentialRampToValueAtTime(100, time + dur);
  
  const attack = params.attack || 0.01;
  const release = params.release || 0.1;
  
  ampEnv.gain.setValueAtTime(0, time);
  ampEnv.gain.linearRampToValueAtTime(realVol, time + attack);
  ampEnv.gain.setValueAtTime(realVol, time + dur);
  ampEnv.gain.exponentialRampToValueAtTime(0.001, time + dur + release);
  
  osc.connect(filter);
  filter.connect(ampEnv);
  ampEnv.connect(trackBus);
  
  osc.start(time);
  osc.stop(time + dur + release);
};

const triggerFMSynth = (ctx, trackBus, pitch, time, vol, dur, params = {}, velocity = 100) => {
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modIndexGain = ctx.createGain();
  const ampEnv = ctx.createGain();
  
  const realVol = vol * (velocity / 127);
  const freq = 440 * Math.pow(2, (pitch - 69) / 12);
  const ratio = params.ratio || 2;
  const modIndex = (params.modIndex || 5) * (velocity / 100);

  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(freq, time);
  
  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(freq * ratio, time);
  
  modIndexGain.gain.setValueAtTime(freq * modIndex, time);
  
  const attack = params.attack || 0.05;
  const release = params.release || 0.2;
  
  ampEnv.gain.setValueAtTime(0, time);
  ampEnv.gain.linearRampToValueAtTime(realVol, time + attack);
  ampEnv.gain.setValueAtTime(realVol, time + dur);
  ampEnv.gain.exponentialRampToValueAtTime(0.001, time + dur + release);
  
  modulator.connect(modIndexGain);
  modIndexGain.connect(carrier.frequency);
  carrier.connect(ampEnv);
  ampEnv.connect(trackBus);
  
  carrier.start(time);
  modulator.start(time);
  carrier.stop(time + dur + release);
  modulator.stop(time + dur + release);
};

const triggerSupersaw = (ctx, trackBus, pitch, time, vol, dur, params = {}, velocity = 100) => {
  const ampEnv = ctx.createGain();
  const attack = params.attack || 0.05;
  const release = params.release || 0.5;
  
  const safeVol = vol * 0.3 * (velocity / 127);
  ampEnv.gain.setValueAtTime(0, time);
  ampEnv.gain.linearRampToValueAtTime(safeVol, time + attack);
  ampEnv.gain.setValueAtTime(safeVol, time + dur);
  ampEnv.gain.exponentialRampToValueAtTime(0.001, time + dur + release);
  
  const oscs = [];
  const count = 5;
  const baseFreq = 440 * Math.pow(2, (pitch - 69) / 12);
  const detuneSpread = params.detune || 25;
  
  for(let i=0; i < count; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const detuneAmount = detuneSpread * ((i / (count - 1)) * 2 - 1);
      osc.frequency.setValueAtTime(baseFreq, time);
      osc.detune.setValueAtTime(detuneAmount, time);
      osc.connect(ampEnv);
      osc.start(time);
      osc.stop(time + dur + release);
      oscs.push(osc);
  }
  ampEnv.connect(trackBus);
};

const triggerPluck = (ctx, trackBus, pitch, time, vol, dur, params = {}, velocity = 100) => {
  const freq = 440 * Math.pow(2, (pitch - 69) / 12);
  const realVol = vol * (velocity / 127);
  
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for(let i=0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;
  
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = (params.damping || 4000) * (velocity / 100);
  
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = 1 / freq;
  
  const feedback = ctx.createGain();
  feedback.gain.value = params.decay || 0.95; 
  
  const outputGain = ctx.createGain();
  outputGain.gain.setValueAtTime(realVol, time);
  outputGain.gain.setTargetAtTime(0, time + dur + 1.0, 0.1); 
  
  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(delay);
  noiseFilter.connect(outputGain); 
  
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(outputGain);
  
  outputGain.connect(trackBus);
  noiseSrc.start(time);
};

const triggerAcid = (ctx, trackBus, pitch, time, vol, dur, params = {}, velocity = 100) => {
  const osc = ctx.createOscillator();
  const realVol = vol * (velocity / 127);

  osc.type = params.oscType || 'square';
  osc.frequency.setValueAtTime(440 * Math.pow(2, (pitch - 69) / 12), time);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = params.res || 5; 
  
  const baseCutoff = params.cutoff || 150;
  const envMod = (params.envMod || 2500) * (velocity / 100);
  const decay = params.decay || 0.3;

  filter.frequency.setValueAtTime(baseCutoff + envMod, time);
  filter.frequency.setTargetAtTime(baseCutoff, time, decay / 3); 

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(realVol, time);
  amp.gain.setTargetAtTime(0, time + dur, 0.05);

  osc.connect(filter);
  filter.connect(amp);
  amp.connect(trackBus);
  
  osc.start(time);
  osc.stop(time + dur + 0.5);
};

const triggerOrgan = (ctx, trackBus, pitch, time, vol, dur, params = {}, velocity = 100) => {
  const freq = 440 * Math.pow(2, (pitch - 69) / 12);
  const amp = ctx.createGain();
  const realVol = vol * (velocity / 127);
  
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(realVol, time + 0.02);
  amp.gain.setValueAtTime(realVol, time + dur);
  amp.gain.linearRampToValueAtTime(0, time + dur + 0.1);

  const ratios = [0.5, 1, 1.5, 2];
  const levels = [
      params.sub !== undefined ? params.sub : 0.8, 
      params.fund !== undefined ? params.fund : 1.0, 
      params.fifth !== undefined ? params.fifth : 0.5, 
      params.oct !== undefined ? params.oct : 0.5
  ];

  ratios.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * ratio;
      
      const g = ctx.createGain();
      g.gain.value = levels[i] / ratios.length;
      
      osc.connect(g);
      g.connect(amp);
      osc.start(time);
      osc.stop(time + dur + 0.2);
  });

  amp.connect(trackBus);
};

const triggerDrum = (ctx, trackBus, pitch, time, vol, params = {}, velocity = 100) => {
  const drumMap = params.drumMap || DEFAULT_DRUM_MAP;
  const pad = drumMap[pitch];
  
  const sampleId = pad ? pad.sampleId : (pitch === 36 ? params.kickSampleId : pitch === 38 ? params.snareSampleId : pitch === 42 ? params.hihatSampleId : null);
  const realVol = vol * (velocity / 127);

  if (sampleId && globalAudioBufferCache.has(sampleId)) {
     const sampleData = globalAudioBufferCache.get(sampleId);
     const source = ctx.createBufferSource();
     source.buffer = sampleData.buffer;
     const gain = ctx.createGain();
     gain.gain.setValueAtTime(realVol, time);
     
     source.connect(gain);
     gain.connect(trackBus);
     
     const startOffset = pad?.startOffset || 0;
     const endOffset = pad?.endOffset || sampleData.duration;
     
     source.start(time, startOffset, Math.max(0, endOffset - startOffset));
     return;
  }

  if (pitch === 36) { 
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(trackBus);
    const startPitch = pad?.tune || params.kickPitch || 150;
    osc.frequency.setValueAtTime(startPitch, time);
    osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.5);
    gain.gain.setValueAtTime(realVol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
    osc.start(time);
    osc.stop(time + 0.5);
  } else if (pitch === 38 || pitch === 39) { 
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const snareDecay = pad?.decay || params.snareDecay || 0.2;
    osc.type = pitch === 39 ? 'square' : 'triangle';
    osc.connect(oscGain);
    oscGain.connect(trackBus);
    osc.frequency.setValueAtTime(pitch === 39 ? 400 : 250, time);
    oscGain.gain.setValueAtTime(realVol * 0.5, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + snareDecay);
    osc.start(time);
    osc.stop(time + snareDecay);

    const bufferSize = ctx.sampleRate * snareDecay;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = pitch === 39 ? 'bandpass' : 'highpass';
    noiseFilter.frequency.value = pitch === 39 ? 1500 : 1000;
    if (pitch === 39) noiseFilter.Q.value = 1.5;
    const noiseGain = ctx.createGain();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(trackBus);
    
    if (pitch === 39) {
       noiseGain.gain.setValueAtTime(0, time);
       noiseGain.gain.linearRampToValueAtTime(realVol, time + 0.01);
       noiseGain.gain.exponentialRampToValueAtTime(0.1, time + 0.03);
       noiseGain.gain.linearRampToValueAtTime(realVol * 0.8, time + 0.04);
       noiseGain.gain.exponentialRampToValueAtTime(0.01, time + snareDecay);
    } else {
       noiseGain.gain.setValueAtTime(realVol * 0.8, time);
       noiseGain.gain.exponentialRampToValueAtTime(0.01, time + snareDecay);
    }
    noise.start(time);
  } else if (pitch === 43 || pitch === 45 || pitch === 48) { 
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(trackBus);
    const startPitch = pad?.tune || (pitch === 43 ? 100 : pitch === 45 ? 150 : 200);
    osc.frequency.setValueAtTime(startPitch, time);
    osc.frequency.exponentialRampToValueAtTime(startPitch * 0.1, time + 0.4);
    gain.gain.setValueAtTime(realVol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    osc.start(time);
    osc.stop(time + 0.4);
  } else { 
    const isCrash = pitch === 49;
    const isRide = pitch === 51;
    const isOpen = pitch === 46;
    const decay = pad?.decay || (isCrash ? 1.5 : isRide ? 1.0 : isOpen ? 0.3 : 0.05);
    
    if (isCrash || isRide) {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const fmGain = ctx.createGain();
        const outGain = ctx.createGain();
        
        osc1.type = 'square';
        osc2.type = 'square';
        osc1.frequency.value = isCrash ? 300 : 400;
        osc2.frequency.value = isCrash ? 453 : 605;
        
        osc1.connect(fmGain);
        fmGain.connect(osc2.frequency);
        fmGain.gain.value = 1000;
        
        osc2.connect(outGain);
        outGain.connect(trackBus);
        outGain.gain.setValueAtTime(realVol * 0.3, time);
        outGain.gain.exponentialRampToValueAtTime(0.001, time + decay);
        
        osc1.start(time); osc2.start(time);
        osc1.stop(time + decay); osc2.stop(time + decay);
    }

    const bufferSize = ctx.sampleRate * decay;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = isCrash ? 'bandpass' : 'highpass';
    noiseFilter.frequency.value = isCrash ? 4000 : 7000;
    if (isCrash) noiseFilter.Q.value = 0.5;
    const noiseGain = ctx.createGain();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(trackBus);
    noiseGain.gain.setValueAtTime(realVol * (isCrash ? 0.6 : 0.4), time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + decay);
    noise.start(time);
  }
};

const triggerSampler = (ctx, trackBus, pitch, time, vol, dur, params = {}, velocity = 100) => {
  const realVol = vol * (velocity / 127);

  if (params.sampleId && globalAudioBufferCache.has(params.sampleId)) {
     const sampleData = globalAudioBufferCache.get(params.sampleId);
     const source = ctx.createBufferSource();
     source.buffer = sampleData.buffer;
     
     const playbackRate = Math.pow(2, (pitch - 69) / 12);
     source.playbackRate.value = playbackRate * (params.pitchShift || 1);
     
     const gain = ctx.createGain();
     gain.gain.setValueAtTime(realVol, time);
     gain.gain.setTargetAtTime(0, time + dur, 0.05);
     
     source.connect(gain);
     gain.connect(trackBus);
     
     const startOffset = params.sampleStart || 0;
     const endOffset = params.sampleEnd || sampleData.duration;
     
     source.start(time, startOffset, Math.max(0, endOffset - startOffset));
     source.stop(time + dur + 0.5);
     return;
  }

  const duration = 1.0;
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 5); 
    data[i] = Math.sin(2 * Math.PI * 440 * t) * env * (Math.random() * 0.2 + 0.8);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const playbackRate = Math.pow(2, (pitch - 69) / 12);
  source.playbackRate.value = playbackRate * (params.pitchShift || 1);
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(realVol, time);
  gain.gain.setTargetAtTime(0, time + dur, 0.1);
  
  source.connect(gain);
  gain.connect(trackBus);
  
  source.start(time);
  source.stop(time + dur + 0.5);
};

// --- Real WAM 2.0 Host Integration ---
const loadWamPlugin = async (ctx, url) => {
  if (!ctx.audioWorklet) {
      throw new Error("AudioWorklet not supported. HTTPS required.");
  }
  let hostGroupId = 'webdaw-group';
  if (!window.WamEnvInitialized) {
      try {
          const { default: initializeWamHost } = await import('https://mainline.i3s.unice.fr/wam2/packages/sdk/src/initializeWamHost.js');
          const [groupId] = await initializeWamHost(ctx);
          window.WamHostGroupId = groupId;
          window.WamEnvInitialized = true;
      } catch (initErr) {
          console.warn("WAM Host Init bypass:", initErr);
      }
  }
  const groupId = window.WamHostGroupId || hostGroupId;
  const wamModule = await import(url);
  const WamPlugin = wamModule.default;
  
  let instance;
  try {
     instance = await WamPlugin.createInstance(groupId, ctx);
  } catch(e) {
     instance = await WamPlugin.createInstance(ctx);
  }
  return instance;
};

const WamHostWrapper = ({ pluginName, wamInstance, wamError }) => {
  const containerRef = useRef(null);
  const [errorStr, setErrorStr] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (wamError) {
        setErrorStr(`Plugin Load Error: ${wamError}`);
        return;
    }
    if (!wamInstance) {
        setErrorStr("Plugin failed to initialize. Please check the console.");
        return;
    }
    setErrorStr(null);
    wamInstance.createGui().then(guiElement => {
        if (!isMounted) return;
        if (containerRef.current) {
           containerRef.current.innerHTML = ''; 
           containerRef.current.appendChild(guiElement); 
        }
    }).catch(err => {
        if (isMounted) setErrorStr(`Failed to load WAM Interface: ${err.message}.`);
    });
    return () => { isMounted = false; };
  }, [wamInstance, wamError]);

  return (
    <div className="flex-1 relative flex flex-col border-t border-neutral-800 rounded-b-xl overflow-hidden bg-neutral-950 min-h-[400px]">
      {errorStr && (
         <div className="absolute inset-0 z-10 bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
           <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-xs font-mono max-w-md leading-relaxed">
             {errorStr}
           </div>
         </div>
      )}
      <div ref={containerRef} className="w-full h-full flex flex-col overflow-auto custom-scrollbar items-center justify-center bg-neutral-900" />
    </div>
  );
};

// Async graph initialization
const initTrackRouting = async (track, ctx, masterGain, library) => {
  const inputBus = ctx.createGain();
  const faderGain = ctx.createGain();
  
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createPanner();
  if (panner.pan) {
      panner.pan.value = (track.pan || 0) / 50; 
  }

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64; 
  
  faderGain.gain.value = track.volume / 100;
  
  let currentOutput = inputBus;
  const fxNodes = {};
  
  let instrumentWamInstance = null;
  let instrumentWamError = null;
  
  if (track.type === 'midi' && track.instrument && !track.instrument.startsWith('inst-')) {
     const vstDef = library.find(v => v.id === track.instrument);
     if (vstDef && vstDef.url) {
         try {
            instrumentWamInstance = await loadWamPlugin(ctx, vstDef.url);
            const wamNode = instrumentWamInstance.audioNode || instrumentWamInstance.getAudioNode();
            wamNode.connect(inputBus);
         } catch(e) {
            console.error(`Failed to instantiate WAM Instrument ${vstDef.name}:`, e);
            instrumentWamError = e.message;
         }
     }
  }

  if (track.effects) {
    for (const fx of track.effects) {
      if (fx.url) {
        try {
            const fxWamInstance = await loadWamPlugin(ctx, fx.url);
            const wamNode = fxWamInstance.audioNode || fxWamInstance.getAudioNode();
            currentOutput.connect(wamNode);
            currentOutput = wamNode;
            fxNodes[fx.id] = { type: 'wam', instance: fxWamInstance, node: wamNode, error: null };
        } catch(e) {
            console.error(`Failed to instantiate WAM FX ${fx.name}:`, e);
            fxNodes[fx.id] = { type: 'wam', instance: null, node: null, error: e.message };
        }
      } else {
        const nodeObj = createFXNode(ctx, fx);
        if (nodeObj) {
          currentOutput.connect(nodeObj.input);
          currentOutput = nodeObj.output;
          fxNodes[fx.id] = nodeObj;
        }
      }
    }
  }

  currentOutput.connect(panner);
  panner.connect(faderGain);
  faderGain.connect(analyser);
  analyser.connect(masterGain);
  
  let instrument = { inputBus, faderGain, panner, analyser, fxNodes, currentNoteId: null, activeNoteIds: new Set(), type: track.type, wamInstance: instrumentWamInstance, wamError: instrumentWamError, activeSource: null };

  if (track.type === 'audio') {
    const gateGain = ctx.createGain();
    gateGain.gain.value = 0; 
    instrument.gateGain = gateGain;
    gateGain.connect(inputBus);
  }
  return instrument;
};

export default function App() {
  const [appView, setAppView] = useState('home'); 
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState('New Project');
  const [savedProjectsList, setSavedProjectsList] = useState([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [currentTime, setCurrentTime] = useState(0); 
  const [masterVolume, setMasterVolume] = useState(80);
  const [tracks, setTracks] = useState(INITIAL_TRACKS);
  const [vstLibrary, setVstLibrary] = useState(INITIAL_VST_LIBRARY);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [activeView, setActiveView] = useState('arrangement'); 
  const [draggingClip, setDraggingClip] = useState(null);
  const [bottomDock, setBottomDock] = useState(null); 
  const [draggingNote, setDraggingNote] = useState(null); 
  const [editorTool, setEditorTool] = useState('select'); 
  const [isRecording, setIsRecording] = useState(false);
  const [draggingEdge, setDraggingEdge] = useState(null);
  const [editingTrackId, setEditingTrackId] = useState(null);
  const [draggedTrackId, setDraggedTrackId] = useState(null);
  const [showAddFxMenu, setShowAddFxMenu] = useState(null); 
  const [isFetchingWAMs, setIsFetchingWAMs] = useState(false); 
  const [toasts, setToasts] = useState([]);
  
  const [openPluginUI, setOpenPluginUI] = useState(null); 
  
  const [vstStatus, setVstStatus] = useState({}); 
  const vstStatusRef = useRef({});
  
  const [loopRegion, setLoopRegion] = useState({ start: 0, end: 8, enabled: false });
  const [draggingLoop, setDraggingLoop] = useState(null);
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [zoom, setZoom] = useState(1);
  const BEAT_WIDTH = 64 * zoom;
  
  const [dragOverlay, setDragOverlay] = useState(null);

  // Advanced Piano Roll State
  const [snapGrid, setSnapGrid] = useState(0.25);
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);

  const timelineRef = useRef(null);
  const headerRef = useRef(null);
  const pianoKeysRef = useRef(null);
  const pianoRulerRef = useRef(null);

  // Drum Pad State
  const [newPadPitch, setNewPadPitch] = useState(60);
  const [newPadName, setNewPadName] = useState('Custom Perc');

  // --- I/O & Settings State ---
  const [showIOSettings, setShowIOSettings] = useState(false);
  const [audioInputs, setAudioInputs] = useState([]);
  const [midiInputs, setMidiInputs] = useState([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [selectedMidiInput, setSelectedMidiInput] = useState('');

  const [usersDb, setUsersDb] = useState(() => {
    try { return JSON.parse(localStorage.getItem('webdaw_users')) || []; } catch(e) { return []; }
  }); 
  const [activeSessionUsers, setActiveSessionUsers] = useState([]); 
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('webdaw_current_user')) || null; } catch(e) { return null; }
  });
  const [authMode, setAuthMode] = useState('signin'); 
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const masterAnalyserRef = useRef(null);
  const synthsRef = useRef({});
  const lastTimeRef = useRef(0);
  
  // Recording State Refs
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(0);
  const pendingMidiClipsRef = useRef({}); 
  const activeLiveMidiNotesRef = useRef({});
  
  const tracksRef = useRef(tracks); 
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  const vstLibraryRef = useRef(vstLibrary);
  useEffect(() => { vstLibraryRef.current = vstLibrary; }, [vstLibrary]);

  const loopRegionRef = useRef(loopRegion);
  useEffect(() => { loopRegionRef.current = loopRegion; }, [loopRegion]);

  const stateRefs = useRef({ currentTime: 0, isPlaying, isRecording, bpm, autoScroll: true });
  useEffect(() => { 
     stateRefs.current.isPlaying = isPlaying;
     stateRefs.current.isRecording = isRecording;
     stateRefs.current.bpm = bpm;
     stateRefs.current.autoScroll = autoScroll;
  }, [isPlaying, isRecording, bpm, autoScroll]);

  // Toast Notification Helper
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // Custom Scrollbar styling & Persistent Auth sync
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.15); border-radius: 4px; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
      .custom-scrollbar-hide::-webkit-scrollbar { display: none; }
    `;
    document.head.appendChild(style);

    if (currentUser) {
        setActiveSessionUsers(prev => {
          if (prev.find(u => u.id === currentUser.id)) return prev;
          return [...prev, { ...currentUser, activeTrack: null }];
        });
    }

    return () => {
        if (document.head.contains(style)) document.head.removeChild(style);
    };
  }, []);

  // Sync Auth states to LocalStorage
  useEffect(() => { localStorage.setItem('webdaw_users', JSON.stringify(usersDb)); }, [usersDb]);
  useEffect(() => { 
    if (currentUser) localStorage.setItem('webdaw_current_user', JSON.stringify(currentUser));
    else localStorage.removeItem('webdaw_current_user');
  }, [currentUser]);

  // Load local projects list
  useEffect(() => {
    const loadLocalProjects = () => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('webdaw_proj_'));
      const projs = keys.map(k => {
          try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; }
      }).filter(Boolean).sort((a,b) => b.lastModified - a.lastModified);
      setSavedProjectsList(projs);
    };
    if (appView === 'home') {
      loadLocalProjects();
    }
  }, [appView]);

  // Context Menu & Utility Handlers
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e, type, payload) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, payload });
  };

  const deleteClip = (trackId, clipId) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, clips: t.clips.filter(c => c.id !== clipId) } : t));
    if (bottomDock?.clipId === clipId) setBottomDock(null);
    updateUserPresence(trackId);
  };

  const handleTrackDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggedTrackId || draggedTrackId === targetId) return;
    
    setTracks(prev => {
        const newTracks = [...prev];
        const draggedIdx = newTracks.findIndex(t => t.id === draggedTrackId);
        const targetIdx = newTracks.findIndex(t => t.id === targetId);
        
        const [draggedTrack] = newTracks.splice(draggedIdx, 1);
        newTracks.splice(targetIdx, 0, draggedTrack);
        return newTracks;
    });
    setDraggedTrackId(null);
  };

  const duplicateClip = (trackId, clipId) => {
    setTracks(prev => prev.map(t => {
       if (t.id !== trackId) return t;
       const clipToDup = t.clips.find(c => c.id === clipId);
       if (!clipToDup) return t;
       const newClip = {
           ...clipToDup,
           id: Date.now(),
           start: clipToDup.start + clipToDup.duration
       };
       if (newClip.notes) {
           newClip.notes = newClip.notes.map(n => ({...n, id: `n_${Date.now()}_${Math.random()}`}));
       }
       return { ...t, clips: [...t.clips, newClip] };
    }));
    updateUserPresence(trackId);
  };

  const deleteNote = (trackId, clipId, noteId) => {
    setTracks(prev => prev.map(t => t.id === trackId ? {
        ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, notes: c.notes.filter(n => n.id !== noteId) } : c)
    } : t));
  };

  // I/O Initialization
  const requestIO = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const aInputs = devices.filter(d => d.kind === 'audioinput');
      setAudioInputs(aInputs);
      if(aInputs.length && !selectedAudioInput) setSelectedAudioInput(aInputs[0].deviceId);
    } catch(e) { 
      console.warn("Mic access denied or unavailable", e);
      showToast("Microphone access denied or unavailable", "error");
    }

    if (navigator.requestMIDIAccess) {
       try {
         navigator.requestMIDIAccess().then(midiAccess => {
           const mInputs = Array.from(midiAccess.inputs.values());
           setMidiInputs(mInputs);
           if(mInputs.length && !selectedMidiInput) setSelectedMidiInput(mInputs[0].id);
         }).catch(e => {
           console.warn("MIDI access denied", e);
         });
       } catch (e) { 
         console.warn("MIDI access denied synchronously", e); 
       }
    }
  };

  // MIDI Event Handler setup
  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;
    let currentAccess = null;

    const onMidiMessage = (msg) => {
      const [command, note, velocity] = msg.data;
      const isNoteOn = command === 144 && velocity > 0;
      const isNoteOff = command === 128 || (command === 144 && velocity === 0);

      const armedTrack = tracksRef.current.find(t => t.type === 'midi' && t.armed);
      if (!armedTrack) return;
      const synth = synthsRef.current[armedTrack.id];
      if (!synth || !audioCtxRef.current) return;

      const now = audioCtxRef.current.currentTime;
      const state = stateRefs.current;

      if (isNoteOn) {
          if (armedTrack.instrument === 'inst-drum') triggerDrum(audioCtxRef.current, synth.inputBus, note, now, 1, armedTrack.instrumentParams, velocity);
          else if (armedTrack.instrument === 'inst-fm') triggerFMSynth(audioCtxRef.current, synth.inputBus, note, now, 1, 0.25, armedTrack.instrumentParams, velocity);
          else if (armedTrack.instrument === 'inst-sampler') triggerSampler(audioCtxRef.current, synth.inputBus, note, now, 1, 0.25, armedTrack.instrumentParams, velocity);
          else if (armedTrack.instrument === 'inst-supersaw') triggerSupersaw(audioCtxRef.current, synth.inputBus, note, now, 1, 0.25, armedTrack.instrumentParams, velocity);
          else if (armedTrack.instrument === 'inst-pluck') triggerPluck(audioCtxRef.current, synth.inputBus, note, now, 1, 0.25, armedTrack.instrumentParams, velocity);
          else if (armedTrack.instrument === 'inst-acid') triggerAcid(audioCtxRef.current, synth.inputBus, note, now, 1, 0.25, armedTrack.instrumentParams, velocity);
          else if (armedTrack.instrument === 'inst-organ') triggerOrgan(audioCtxRef.current, synth.inputBus, note, now, 1, 0.25, armedTrack.instrumentParams, velocity);
          else if (armedTrack.instrument.startsWith('inst-')) triggerSubtractive(audioCtxRef.current, synth.inputBus, note, now, 1, 0.25, armedTrack.instrumentParams, velocity);
          else if (synth.wamInstance?.audioNode?.scheduleEvents) {
              synth.wamInstance.audioNode.scheduleEvents({ type: 'wam-midi', time: now, data: { bytes: [0x90, note, velocity] } });
          }

          if (state.isRecording && state.isPlaying) {
              activeLiveMidiNotesRef.current[note] = { start: state.currentTime, velocity };
          }
      } else if (isNoteOff) {
          if (synth.wamInstance?.audioNode?.scheduleEvents) {
              synth.wamInstance.audioNode.scheduleEvents({ type: 'wam-midi', time: now, data: { bytes: [0x80, note, 0] } });
          }

          if (state.isRecording && state.isPlaying && activeLiveMidiNotesRef.current[note]) {
              const startBeat = activeLiveMidiNotesRef.current[note].start;
              const recordedVelocity = activeLiveMidiNotesRef.current[note].velocity;
              const durBeat = state.currentTime - startBeat;
              
              if (!pendingMidiClipsRef.current[armedTrack.id]) pendingMidiClipsRef.current[armedTrack.id] = [];
              pendingMidiClipsRef.current[armedTrack.id].push({
                 id: `n_${Date.now()}_${note}`,
                 pitch: note,
                 start: startBeat - recordingStartTimeRef.current, 
                 duration: Math.max(0.1, durBeat),
                 velocity: recordedVelocity
              });
              delete activeLiveMidiNotesRef.current[note];
          }
      }
    };

    try {
      navigator.requestMIDIAccess().then(access => {
        currentAccess = access;
        access.inputs.forEach(input => {
           if (!selectedMidiInput || input.id === selectedMidiInput) {
              input.onmidimessage = onMidiMessage;
           } else {
              input.onmidimessage = null;
           }
        });
      }).catch(err => {
        console.warn("MIDI access blocked by environment or user:", err);
      });
    } catch (err) {
      console.warn("MIDI access blocked synchronously by environment:", err);
    }

    return () => {
      if (currentAccess) {
         currentAccess.inputs.forEach(input => input.onmidimessage = null);
      }
    };
  }, [selectedMidiInput]);

  // VST Pre-Caching & Verification
  useEffect(() => {
    let mounted = true;
    vstLibrary.forEach(vst => {
      if (!vstStatusRef.current[vst.id]) {
        vstStatusRef.current[vst.id] = 'loading';
        setVstStatus(prev => ({ ...prev, [vst.id]: 'loading' }));
        
        if (!vst.url) {
          vstStatusRef.current[vst.id] = 'ok';
          setVstStatus(prev => ({ ...prev, [vst.id]: 'ok' }));
        } else {
          import(vst.url)
            .then(() => {
              if (!mounted) return;
              vstStatusRef.current[vst.id] = 'ok';
              setVstStatus(prev => ({ ...prev, [vst.id]: 'ok' }));
            })
            .catch((e) => {
              if (!mounted) return;
              vstStatusRef.current[vst.id] = 'error';
              setVstStatus(prev => ({ ...prev, [vst.id]: 'error' }));
            });
        }
      }
    });
    return () => { mounted = false; };
  }, [vstLibrary]);

  // Scroll Zoom handler
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(prev => {
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          return Math.min(Math.max(0.25, prev + delta), 4);
        });
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [appView]);

  const handleScroll = (e) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handlePianoScroll = (e) => {
    if (pianoKeysRef.current) pianoKeysRef.current.scrollTop = e.currentTarget.scrollTop;
    if (pianoRulerRef.current) pianoRulerRef.current.scrollLeft = e.currentTarget.scrollLeft;
  };

  const playClick = (time, isAccent) => {
    try {
      if (!audioCtxRef.current || !masterGainRef.current) return;
      const ctx = audioCtxRef.current;
      const safeTime = Math.max(ctx.currentTime, time);
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(masterGainRef.current);
      osc.frequency.value = isAccent ? 1200 : 800;
      gainNode.gain.setValueAtTime(1, safeTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, safeTime + 0.1);
      osc.start(safeTime);
      osc.stop(safeTime + 0.1);
    } catch (e) {
      console.warn("Metronome click error:", e);
    }
  };

  const stopAudio = () => {
    Object.values(synthsRef.current).forEach(synth => {
      try {
        if (synth.gateGain) synth.gateGain.gain.setTargetAtTime(0, audioCtxRef.current?.currentTime || 0, 0.05);
        synth.currentNoteId = null;
        if (synth.activeNoteIds) synth.activeNoteIds.clear();
        if (synth.activeSource) {
           synth.activeSource.stop();
           synth.activeSource = null;
        }
      } catch(e) {}
    });
  };

  const initAudioEngine = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      masterGainRef.current = audioCtxRef.current.createGain();
      masterGainRef.current.gain.value = masterVolume / 100;
      
      masterAnalyserRef.current = audioCtxRef.current.createAnalyser();
      masterAnalyserRef.current.fftSize = 4096; 
      masterAnalyserRef.current.smoothingTimeConstant = 0.85; 
      
      masterGainRef.current.connect(masterAnalyserRef.current);
      masterAnalyserRef.current.connect(audioCtxRef.current.destination);
    }
    
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    
    const buildPromises = tracksRef.current.map(track => {
      if (!synthsRef.current[track.id]) {
          return initTrackRouting(track, audioCtxRef.current, masterGainRef.current, vstLibraryRef.current).then(synthObj => {
             synthsRef.current[track.id] = synthObj;
          });
      }
      return Promise.resolve();
    });
    
    await Promise.all(buildPromises);
  };

  // --- RECORDING LIFECYCLE ---
  const startRecording = async () => {
     recordingStartTimeRef.current = stateRefs.current.currentTime;
     activeLiveMidiNotesRef.current = {};
     pendingMidiClipsRef.current = {};

     const armedAudioTrack = tracksRef.current.find(t => t.type === 'audio' && t.armed);
     const armedMidiTrack = tracksRef.current.find(t => t.type === 'midi' && t.armed);
     
     if (!armedAudioTrack && !armedMidiTrack) {
        showToast("Please arm a track first by clicking the record circle icon.", "error");
        setIsRecording(false);
        return;
     }

     setTracks(prev => prev.map(t => {
        if (t.armed) {
           return { ...t, clips: [...t.clips, { id: `rec_temp_${t.id}`, start: recordingStartTimeRef.current, duration: 0.1, isRecording: true, notes: [] }] };
        }
        return t;
     }));

     if (armedAudioTrack) {
        try {
           const audioConstraints = selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true;
           const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
           const mediaRecorder = new MediaRecorder(stream);
           recordedChunksRef.current = [];
           
           mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) recordedChunksRef.current.push(e.data);
           };
           
           mediaRecorder.onstop = async () => {
              const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
              const arrayBuffer = await blob.arrayBuffer();
              
              if (!audioCtxRef.current) return;
              const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
              
              const sampleId = `rec_${Date.now()}`;
              
              const peaks = [];
              const data = audioBuffer.getChannelData(0);
              const step = Math.max(1, Math.floor(data.length / 100));
              for(let i=0; i<100; i++) {
                 let min = 1.0; let max = -1.0;
                 for(let j=0; j<step; j++) {
                    const val = data[(i*step)+j];
                    if(val < min) min = val;
                    if(val > max) max = val;
                 }
                 peaks.push([min, max]);
              }

              globalAudioBufferCache.set(sampleId, { buffer: audioBuffer, peaks, duration: audioBuffer.duration });
              
              const durationBeats = audioBuffer.duration * (stateRefs.current.bpm / 60);
              const startBeat = recordingStartTimeRef.current;
              
              setTracks(prev => prev.map(t => {
                 if (t.id === armedAudioTrack.id) {
                    const filteredClips = t.clips.filter(c => !c.isRecording);
                    return { 
                       ...t, 
                       clips: [...filteredClips, { id: Date.now(), start: startBeat, duration: durationBeats, isRecording: false, sampleId: sampleId }] 
                    };
                 }
                 return t;
              }));
           };
           
           mediaRecorderRef.current = mediaRecorder;
           mediaRecorder.start();
        } catch(e) {
           console.error("Failed to start audio recording", e);
           showToast("Could not access microphone. Please check permissions or settings.", "error");
           setIsRecording(false);
           setTracks(prev => prev.map(t => ({ ...t, clips: t.clips.filter(c => !c.isRecording) })));
        }
     }
  };

  const endRecording = () => {
     if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
         mediaRecorderRef.current.stop();
         mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
         mediaRecorderRef.current = null;
     }

     const startBeat = recordingStartTimeRef.current;
     const durBeats = stateRefs.current.currentTime - startBeat;

     setTracks(prev => prev.map(t => {
        if (t.armed) {
           const filteredClips = t.clips.filter(c => !c.isRecording);
           if (t.type === 'midi') {
               const notes = pendingMidiClipsRef.current[t.id] || [];
               const newClip = {
                   id: Date.now(),
                   start: startBeat,
                   duration: Math.max(1, durBeats),
                   notes: notes
               };
               return { ...t, clips: [...filteredClips, newClip] };
           }
           if (t.type === 'audio') {
               return t; 
           }
        }
        return t;
     }));
     
     pendingMidiClipsRef.current = {};
  };

  const togglePlay = useCallback(async () => {
    if (!stateRefs.current.isPlaying) {
      await initAudioEngine();
      setIsPlaying(true);
      if (stateRefs.current.isRecording) {
         startRecording();
      }
    } else {
      setIsPlaying(false);
      stopAudio();
      if (stateRefs.current.isRecording) {
         setIsRecording(false);
         endRecording();
      }
    }
  }, []);

  const stopPlayback = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    stateRefs.current.currentTime = 0;
    stopAudio();
    if (isRecording) {
        setIsRecording(false);
        endRecording();
    }
    document.querySelectorAll('canvas').forEach(canvas => {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  };

  const toggleRecord = () => {
    if (!isRecording) {
        setIsRecording(true);
        if (isPlaying) startRecording(); 
    } else {
        setIsRecording(false);
        endRecording();
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input/textarea
      const targetTag = e.target.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if ((e.code === 'Delete' || e.code === 'Backspace') && bottomDock?.type === 'piano-roll') {
        if (selectedNotes.length > 0) {
          e.preventDefault();
          setTracks(prev => prev.map(t => t.id === bottomDock.trackId ? {
              ...t,
              clips: t.clips.map(c => c.id === bottomDock.clipId ? {
                  ...c,
                  notes: c.notes.filter(n => !selectedNotes.includes(n.id))
              } : c)
          } : t));
          setSelectedNotes([]);
          showToast(`Deleted ${selectedNotes.length} note(s)`);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, bottomDock, selectedNotes, showToast]);

  const closeDawToHome = () => {
    stopPlayback();
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      audioCtxRef.current.suspend();
    }
    setAppView('home');
  };

  const loadProjectToDaw = (projectData) => {
    stopPlayback();
    synthsRef.current = {};
    
    setBpm(projectData.bpm || 120);
    setTracks(projectData.tracks || INITIAL_TRACKS);
    setProjectName(projectData.name || 'Imported Project');
    setProjectId(projectData.id || `proj_${Date.now()}`);
    setAppView('daw');
    showToast(`Loaded ${projectData.name}`, "success");
  };

  const createNewProject = () => {
    loadProjectToDaw({
      id: `proj_${Date.now()}`,
      name: 'New Project',
      bpm: 120,
      tracks: []
    });
  };

  const saveProjectToLocal = () => {
    const projId = projectId || `proj_${Date.now()}`;
    if (!projectId) setProjectId(projId);
    
    const projectData = {
      id: projId,
      name: projectName,
      bpm,
      tracks,
      lastModified: Date.now(),
      version: "0.9.0"
    };
    
    localStorage.setItem(`webdaw_proj_${projId}`, JSON.stringify(projectData));
    showToast(`Project "${projectName}" saved locally!`, "success");
  };

  const exportProjectToFile = async () => {
    setIsProcessingFile(true);
    try {
      const JSZip = (await import('https://esm.sh/jszip')).default;
      const zip = new JSZip();

      const projectData = {
        id: projectId || `proj_${Date.now()}`,
        name: projectName,
        bpm,
        tracks,
        lastModified: Date.now(),
        version: "0.9.0"
      };

      // 1. Add arrangement data
      zip.file("project.json", JSON.stringify(projectData, null, 2));

      // 2. Identify all used audio samples
      const usedSampleIds = new Set();
      tracks.forEach(t => {
        if (t.type === 'audio') {
          t.clips.forEach(c => {
            if (c.sampleId) usedSampleIds.add(c.sampleId);
          });
        }
        if (t.instrumentParams) {
          if (t.instrumentParams.sampleId) usedSampleIds.add(t.instrumentParams.sampleId);
          if (t.instrumentParams.drumMap) {
             Object.values(t.instrumentParams.drumMap).forEach(pad => {
                if (pad.sampleId) usedSampleIds.add(pad.sampleId);
             });
          }
        }
      });

      // 3. Render and package samples as true WAV files
      if (usedSampleIds.size > 0) {
          const samplesFolder = zip.folder("samples");
          for (const sampleId of usedSampleIds) {
             if (globalAudioBufferCache.has(sampleId)) {
                const cacheItem = globalAudioBufferCache.get(sampleId);
                const wavBuffer = audioBufferToWav(cacheItem.buffer);
                samplesFolder.file(`${sampleId}.wav`, wavBuffer);
             }
          }
      }

      // 4. Encode and export all MIDI tracks as standard .mid files
      const midiFolder = zip.folder("midi");
      tracks.forEach(t => {
        if (t.type === 'midi' && t.clips.some(c => c.notes && c.notes.length > 0)) {
           const midiBytes = encodeMIDITrack(t, bpm);
           const safeName = t.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
           midiFolder.file(`${safeName}_track_${t.id}.mid`, midiBytes);
        }
      });

      // 5. Generate the complete archive
      const content = await zip.generateAsync({ type: "blob", compression: "STORE" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/\s+/g, '_')}.webdaw`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${projectName}.webdaw`, "success");
    } catch(e) {
      console.error("Export failed", e);
      showToast("Failed to export project archive: " + e.message, "error");
    }
    setIsProcessingFile(false);
  };

  const handleImportProjectFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsProcessingFile(true);
    try {
      let isZip = false;
      let projectData;
      let zip;

      try {
        const JSZip = (await import('https://esm.sh/jszip')).default;
        zip = await JSZip.loadAsync(file);
        isZip = true;
      } catch(zipErr) {
        isZip = false;
      }

      if (isZip) {
        if (!audioCtxRef.current) await initAudioEngine();
        
        // 1. Read JSON
        const projectJsonString = await zip.file("project.json").async("string");
        projectData = JSON.parse(projectJsonString);

        // 2. Decode and inject bundled audio samples
        const sampleFiles = Object.keys(zip.files).filter(name => name.startsWith('samples/') && !zip.files[name].dir);
        for (const samplePath of sampleFiles) {
           const sampleId = samplePath.replace('samples/', '').replace('.wav', '');
           const sampleData = await zip.file(samplePath).async("arraybuffer");
           
           const audioBuffer = await audioCtxRef.current.decodeAudioData(sampleData);
           
           const peaks = [];
           const data = audioBuffer.getChannelData(0);
           const step = Math.max(1, Math.floor(data.length / 100));
           for(let i=0; i<100; i++) {
              let min = 1.0; let max = -1.0;
              for(let j=0; j<step; j++) {
                 const val = data[(i*step)+j];
                 if(val < min) min = val;
                 if(val > max) max = val;
              }
              peaks.push([min, max]);
           }
           globalAudioBufferCache.set(sampleId, { buffer: audioBuffer, peaks, duration: audioBuffer.duration });
        }
      } else {
        const text = await file.text();
        projectData = JSON.parse(text);
      }

      projectData.id = `proj_${Date.now()}`; 
      loadProjectToDaw(projectData);
    } catch (err) {
      console.error("Import error:", err);
      showToast("Failed to load project: " + err.message, "error");
    }
    
    setIsProcessingFile(false);
    e.target.value = null;
  };

  const handleOpenPlugin = async (trackId, isEffect, fxId) => {
    setOpenPluginUI({ trackId, isEffect, fxId, loading: true });
    try {
        await initAudioEngine();
    } catch (e) {}
    setOpenPluginUI({ trackId, isEffect, fxId, loading: false });
  };

  // Unified Game Loop
  useEffect(() => {
    if (!isPlaying) return;

    let reqId;
    const update = () => {
      if (!audioCtxRef.current) {
         reqId = requestAnimationFrame(update);
         return;
      }
      const now = audioCtxRef.current.currentTime;
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;

      const prevTime = stateRefs.current.currentTime;
      let newTime = prevTime + (dt * (bpm / 60));
      const loop = loopRegionRef.current;
      let wrapped = false;

      if (loop.enabled && prevTime < loop.end && newTime >= loop.end) {
          newTime = loop.start + (newTime - loop.end);
          wrapped = true;
          Object.values(synthsRef.current).forEach(synth => { synth.currentNoteId = null; if (synth.activeNoteIds) synth.activeNoteIds.clear(); });
      } else if (loop.enabled && newTime >= loop.end) {
          newTime = loop.start;
          wrapped = true;
          Object.values(synthsRef.current).forEach(synth => { synth.currentNoteId = null; if (synth.activeNoteIds) synth.activeNoteIds.clear(); });
      }

      if (metronomeEnabled && (wrapped || Math.floor(newTime) > Math.floor(prevTime))) {
        playClick(now, Math.floor(newTime) % 4 === 0);
      }

      setCurrentTime(newTime);
      stateRefs.current.currentTime = newTime;

      if (stateRefs.current.autoScroll && timelineRef.current) {
          const playheadX = newTime * BEAT_WIDTH;
          const containerWidth = timelineRef.current.clientWidth;
          const scrollLeft = timelineRef.current.scrollLeft;
          if (playheadX > scrollLeft + containerWidth * 0.85) {
              timelineRef.current.scrollLeft = playheadX - (containerWidth * 0.1);
          } else if (playheadX < scrollLeft) {
              timelineRef.current.scrollLeft = Math.max(0, playheadX - (containerWidth * 0.1));
          }
      }

      const currentTracks = tracksRef.current;
      const anySolo = currentTracks.some(t => t.solo);
      
      currentTracks.forEach(track => {
        const synth = synthsRef.current[track.id];
        if (!synth) return;

        const activeClip = track.clips.find(c => newTime >= c.start && newTime < c.start + c.duration);
        const shouldPlayTrack = activeClip && !track.muted && (!anySolo || track.solo);

        const targetVolume = (!track.muted && (!anySolo || track.solo)) ? track.volume / 100 : 0;
        if (Math.abs(synth.faderGain.gain.value - targetVolume) > 0.01) {
          synth.faderGain.gain.setTargetAtTime(targetVolume, now, 0.05);
        }

        if (track.type === 'midi') {
          if (activeClip && shouldPlayTrack) {
            const clipTime = newTime - activeClip.start;
            const activeNotes = activeClip.notes?.filter(n => clipTime >= n.start && clipTime < n.start + n.duration) || [];

            activeNotes.forEach(activeNote => {
              if (!synth.activeNoteIds) synth.activeNoteIds = new Set();
              if (!synth.activeNoteIds.has(activeNote.id)) {
                synth.activeNoteIds.add(activeNote.id);
                const durSeconds = activeNote.duration * (60/bpm);
                const velocity = activeNote.velocity ?? 100; 
                
                if (synth.wamInstance && synth.wamInstance.audioNode && synth.wamInstance.audioNode.scheduleEvents) {
                   synth.wamInstance.audioNode.scheduleEvents({
                       type: 'wam-midi', time: now, data: { bytes: [0x90, activeNote.pitch, velocity] }
                   });
                   synth.wamInstance.audioNode.scheduleEvents({
                       type: 'wam-midi', time: now + durSeconds, data: { bytes: [0x80, activeNote.pitch, 0] }
                   });
                } else if (track.instrument === 'inst-drum') {
                  triggerDrum(audioCtxRef.current, synth.inputBus, activeNote.pitch, now, 1, track.instrumentParams, velocity);
                } else if (track.instrument === 'inst-fm') {
                  triggerFMSynth(audioCtxRef.current, synth.inputBus, activeNote.pitch, now, 1, durSeconds, track.instrumentParams, velocity);
                } else if (track.instrument === 'inst-sampler') {
                  triggerSampler(audioCtxRef.current, synth.inputBus, activeNote.pitch, now, 1, durSeconds, track.instrumentParams, velocity);
                } else if (track.instrument === 'inst-supersaw') {
                  triggerSupersaw(audioCtxRef.current, synth.inputBus, activeNote.pitch, now, 1, durSeconds, track.instrumentParams, velocity);
                } else if (track.instrument === 'inst-pluck') {
                  triggerPluck(audioCtxRef.current, synth.inputBus, activeNote.pitch, now, 1, durSeconds, track.instrumentParams, velocity);
                } else if (track.instrument === 'inst-acid') {
                  triggerAcid(audioCtxRef.current, synth.inputBus, activeNote.pitch, now, 1, durSeconds, track.instrumentParams, velocity);
                } else if (track.instrument === 'inst-organ') {
                  triggerOrgan(audioCtxRef.current, synth.inputBus, activeNote.pitch, now, 1, durSeconds, track.instrumentParams, velocity);
                } else {
                  triggerSubtractive(audioCtxRef.current, synth.inputBus, activeNote.pitch, now, 1, durSeconds, track.instrumentParams, velocity);
                }
              }
            });

            if (synth.activeNoteIds) {
               const activeNoteIdsArr = activeNotes.map(n => n.id);
               for (const id of synth.activeNoteIds) {
                  if (!activeNoteIdsArr.includes(id)) {
                     synth.activeNoteIds.delete(id);
                  }
               }
            }
          } else {
            if (synth.activeNoteIds) synth.activeNoteIds.clear();
          }
        } else {
          // Audio track routing & playback
          if (activeClip && shouldPlayTrack && !activeClip.isRecording) {
             if (!synth.activeNoteIds) synth.activeNoteIds = new Set();
             if (!synth.activeNoteIds.has(activeClip.id)) {
                 synth.activeNoteIds.add(activeClip.id);
                 
                 if (activeClip.sampleId && globalAudioBufferCache.has(activeClip.sampleId)) {
                     const sampleData = globalAudioBufferCache.get(activeClip.sampleId);
                     const source = audioCtxRef.current.createBufferSource();
                     source.buffer = sampleData.buffer;
                     const offset = (newTime - activeClip.start) / (bpm / 60);
                     source.connect(synth.inputBus);
                     source.start(now, Math.max(0, offset));
                     synth.activeSource = source;
                 } else {
                     synth.gateGain.gain.setTargetAtTime(1, now, 0.02);
                 }
             }
          } else {
             if (synth.activeNoteIds && synth.activeNoteIds.size > 0) {
                 synth.activeNoteIds.clear();
                 synth.gateGain.gain.setTargetAtTime(0, now, 0.02);
                 if (synth.activeSource) {
                     try { synth.activeSource.stop(now); } catch(e){}
                     synth.activeSource = null;
                 }
             }
          }
        }
      });

      currentTracks.forEach(track => {
          const synth = synthsRef.current[track.id];
          if (synth && synth.analyser) {
              const data = new Uint8Array(synth.analyser.frequencyBinCount);
              synth.analyser.getByteFrequencyData(data);
              let sum = 0;
              for(let i=0; i<data.length; i++) sum += data[i];
              const avg = sum / data.length;
              
              const vuCanvas = document.getElementById(`vu-meter-${track.id}`);
              if (vuCanvas) {
                  const ctx = vuCanvas.getContext('2d');
                  if (vuCanvas.width !== vuCanvas.clientWidth) vuCanvas.width = vuCanvas.clientWidth;
                  if (vuCanvas.height !== vuCanvas.clientHeight) vuCanvas.height = vuCanvas.clientHeight;
                  
                  ctx.clearRect(0, 0, vuCanvas.width, vuCanvas.height);
                  const h = (avg / 128) * vuCanvas.height; 
                  const gradient = ctx.createLinearGradient(0, vuCanvas.height, 0, 0);
                  gradient.addColorStop(0, '#22c55e');
                  gradient.addColorStop(0.7, '#eab308');
                  gradient.addColorStop(1, '#ef4444');
                  ctx.fillStyle = gradient;
                  ctx.fillRect(0, vuCanvas.height - h, vuCanvas.width, h);
              }
          }
      });

      if (masterAnalyserRef.current) {
          const data = new Uint8Array(masterAnalyserRef.current.frequencyBinCount);
          masterAnalyserRef.current.getByteFrequencyData(data);
          
          let sum = 0;
          for(let i=0; i<data.length; i++) sum += data[i];
          const avg = sum / data.length;

          ['vu-meter-master-l', 'vu-meter-master-r'].forEach(id => {
              const vuCanvas = document.getElementById(id);
              if (vuCanvas) {
                  const ctx = vuCanvas.getContext('2d');
                  if (vuCanvas.width !== vuCanvas.clientWidth) vuCanvas.width = vuCanvas.clientWidth;
                  if (vuCanvas.height !== vuCanvas.clientHeight) vuCanvas.height = vuCanvas.clientHeight;
                  ctx.clearRect(0, 0, vuCanvas.width, vuCanvas.height);
                  const mockStereoAvg = Math.max(0, avg + (id === 'vu-meter-master-l' ? Math.random()*2 : -Math.random()*2)); 
                  const h = Math.min(vuCanvas.height, (mockStereoAvg / 128) * vuCanvas.height);
                  const gradient = ctx.createLinearGradient(0, vuCanvas.height, 0, 0);
                  gradient.addColorStop(0, '#22c55e');
                  gradient.addColorStop(0.7, '#eab308');
                  gradient.addColorStop(1, '#ef4444');
                  ctx.fillStyle = gradient;
                  ctx.fillRect(0, vuCanvas.height - h, vuCanvas.width, h);
              }
          });

          const specCanvas = document.getElementById('spectral-canvas');
          if (specCanvas) {
              const ctx = specCanvas.getContext('2d');
              if (specCanvas.width !== specCanvas.clientWidth) specCanvas.width = specCanvas.clientWidth;
              if (specCanvas.height !== specCanvas.clientHeight) specCanvas.height = specCanvas.clientHeight;
              
              ctx.clearRect(0, 0, specCanvas.width, specCanvas.height);
              
              const nyquist = audioCtxRef.current.sampleRate / 2;
              const minFreq = 20; 
              const minLog = Math.log10(minFreq);
              const maxLog = Math.log10(nyquist);
              const logRange = maxLog - minLog;

              ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
              ctx.lineWidth = 1;
              [100, 1000, 10000].forEach(f => {
                  const x = ((Math.log10(f) - minLog) / logRange) * specCanvas.width;
                  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, specCanvas.height); ctx.stroke();
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                  ctx.font = '10px monospace';
                  ctx.fillText(`${f >= 1000 ? f/1000+'k' : f}Hz`, x + 5, 15);
              });

              ctx.beginPath();
              let firstPoint = true;
              
              for (let i = 0; i < data.length; i++) {
                  const freq = (i * nyquist) / data.length;
                  if (freq < minFreq) continue; 
                  const x = ((Math.log10(freq) - minLog) / logRange) * specCanvas.width;
                  const y = specCanvas.height - ((data[i] / 255) * specCanvas.height);
                  
                  if (firstPoint) {
                      ctx.moveTo(x, y);
                      firstPoint = false;
                  } else {
                      ctx.lineTo(x, y);
                  }
              }
              
              ctx.strokeStyle = 'rgba(236, 72, 153, 0.9)';
              ctx.lineWidth = 2;
              ctx.stroke();

              ctx.lineTo(specCanvas.width, specCanvas.height);
              ctx.lineTo(0, specCanvas.height);
              ctx.closePath();
              
              const gradient = ctx.createLinearGradient(0, specCanvas.height, 0, 0);
              gradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)'); 
              gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.4)'); 
              gradient.addColorStop(1, 'rgba(236, 72, 153, 0.8)'); 
              ctx.fillStyle = gradient;
              ctx.fill();
          }
      }

      reqId = requestAnimationFrame(update);
    };

    lastTimeRef.current = audioCtxRef.current?.currentTime || 0;
    reqId = requestAnimationFrame(update);

    return () => cancelAnimationFrame(reqId);
  }, [isPlaying, bpm, metronomeEnabled]); 

  const rebuildTrackRouting = async (trackId, latestTracks) => {
    if (audioCtxRef.current) {
      const updatedTrack = latestTracks.find(t => t.id === trackId);
      if (synthsRef.current[trackId]) {
          try {
              if (synthsRef.current[trackId].osc1) {
                  synthsRef.current[trackId].osc1.stop();
                  synthsRef.current[trackId].osc2.stop();
                  synthsRef.current[trackId].lfo.stop();
              }
              synthsRef.current[trackId].faderGain.disconnect();
          } catch(e) {}
      }
      synthsRef.current[trackId] = await initTrackRouting(updatedTrack, audioCtxRef.current, masterGainRef.current, vstLibraryRef.current);
    }
  };

  const handleAddEffect = (trackId, fxDef) => {
    const newFx = {
      id: `fx-${Date.now()}`,
      type: fxDef.type,
      name: fxDef.name,
      url: fxDef.url,
      params: fxDef.params ? { ...fxDef.params } : {}
    };
    
    setTracks(prev => {
      const newTracks = prev.map(t => t.id === trackId ? { ...t, effects: [...(t.effects||[]), newFx] } : t);
      rebuildTrackRouting(trackId, newTracks);
      return newTracks;
    });
    showToast(`Added ${fxDef.name}`, 'success');
  };

  const handleRemoveEffect = (trackId, fxId) => {
    setTracks(prev => {
      const newTracks = prev.map(t => t.id === trackId ? { ...t, effects: t.effects.filter(fx => fx.id !== fxId) } : t);
      rebuildTrackRouting(trackId, newTracks);
      return newTracks;
    });
  };

  const handleEffectParamChange = (trackId, fxId, param, value) => {
    const numValue = Number(value);
    setTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      return {
        ...t,
        effects: t.effects.map(fx => fx.id === fxId ? { ...fx, params: { ...fx.params, [param]: numValue } } : fx)
      };
    }));

    if (synthsRef.current[trackId] && synthsRef.current[trackId].fxNodes[fxId]) {
      const nodeObj = synthsRef.current[trackId].fxNodes[fxId];
      const now = audioCtxRef.current?.currentTime || 0;
      
      if (nodeObj.type !== 'wam') {
          if (nodeObj.fxType === 'filter') {
            if (param === 'freq') nodeObj.node.frequency.setTargetAtTime(numValue, now, 0.05);
            if (param === 'res') nodeObj.node.Q.setTargetAtTime(numValue, now, 0.05);
          } else if (nodeObj.fxType === 'delay') {
            if (param === 'time') nodeObj.delay.delayTime.setTargetAtTime(numValue, now, 0.05);
            if (param === 'feedback') nodeObj.feedback.gain.setTargetAtTime(numValue, now, 0.05);
            if (param === 'mix') {
              nodeObj.wet.gain.setTargetAtTime(numValue, now, 0.05);
              nodeObj.dry.gain.setTargetAtTime(1 - numValue, now, 0.05);
            }
          } else if (nodeObj.fxType === 'distortion' || nodeObj.fxType === 'reverb') {
             if (param === 'mix') {
              nodeObj.wet.gain.setTargetAtTime(numValue, now, 0.05);
              nodeObj.dry.gain.setTargetAtTime(1 - numValue, now, 0.05);
             }
          } else if (nodeObj.fxType === 'chorus') {
             if (param === 'rate') nodeObj.lfo.frequency.setTargetAtTime(numValue, now, 0.05);
             if (param === 'depth') nodeObj.lfoGain.gain.setTargetAtTime(numValue, now, 0.05);
             if (param === 'mix') {
              nodeObj.wet.gain.setTargetAtTime(numValue, now, 0.05);
              nodeObj.dry.gain.setTargetAtTime(1 - numValue, now, 0.05);
             }
          } else if (nodeObj.fxType === 'compressor') {
             if (param === 'threshold') nodeObj.comp.threshold.setTargetAtTime(numValue, now, 0.05);
             if (param === 'ratio') nodeObj.comp.ratio.setTargetAtTime(numValue, now, 0.05);
          } else if (nodeObj.fxType === 'bitcrusher') {
             if (param === 'bitDepth') nodeObj.node.curve = getBitcrusherCurve(numValue);
             if (param === 'mix') {
              nodeObj.wet.gain.setTargetAtTime(numValue, now, 0.05);
              nodeObj.dry.gain.setTargetAtTime(1 - numValue, now, 0.05);
             }
          } else if (nodeObj.fxType === 'autopan') {
             if (param === 'rate') nodeObj.lfo.frequency.setTargetAtTime(numValue, now, 0.05);
             if (param === 'depth') nodeObj.lfoGain.gain.setTargetAtTime(numValue, now, 0.05);
          } else if (nodeObj.fxType === 'tremolo') {
             if (param === 'rate') nodeObj.lfo.frequency.setTargetAtTime(numValue, now, 0.05);
             if (param === 'depth') {
                 nodeObj.amp.gain.setTargetAtTime(1.0 - numValue / 2, now, 0.05);
                 nodeObj.lfoGain.gain.setTargetAtTime(numValue / 2, now, 0.05);
             }
          } else if (nodeObj.fxType === 'ringmod') {
             if (param === 'freq') nodeObj.osc.frequency.setTargetAtTime(numValue, now, 0.05);
             if (param === 'mix') {
              nodeObj.wet.gain.setTargetAtTime(numValue, now, 0.05);
              nodeObj.dry.gain.setTargetAtTime(1 - numValue, now, 0.05);
             }
          } else if (nodeObj.fxType === 'eq3') {
             if (param === 'low') nodeObj.low.gain.setTargetAtTime(numValue, now, 0.05);
             if (param === 'mid') nodeObj.mid.gain.setTargetAtTime(numValue, now, 0.05);
             if (param === 'high') nodeObj.high.gain.setTargetAtTime(numValue, now, 0.05);
          }
      }
    }
  };

  const handleInstrumentChange = (trackId, newInstrumentId) => {
    setTracks(prev => {
        const newTracks = prev.map(t => {
          if (t.id !== trackId) return t;
          let newParams = {};
          if (newInstrumentId === 'inst-drum') newParams = { drumMap: DEFAULT_DRUM_MAP };
          else if (newInstrumentId === 'inst-subtractive') newParams = { oscType: 'sawtooth', cutoff: 2000, res: 1.5, attack: 0.01, release: 0.2 };
          else if (newInstrumentId === 'inst-fm') newParams = { ratio: 2, modIndex: 5, attack: 0.01, release: 0.2 };
          else if (newInstrumentId === 'inst-supersaw') newParams = { detune: 25, attack: 0.05, release: 0.5 };
          else if (newInstrumentId === 'inst-pluck') newParams = { damping: 4000, decay: 0.95 };
          else if (newInstrumentId === 'inst-acid') newParams = { oscType: 'square', cutoff: 150, envMod: 2500, decay: 0.3, res: 5 };
          else if (newInstrumentId === 'inst-organ') newParams = { sub: 0.8, fund: 1.0, fifth: 0.6, oct: 0.4 };
          else if (newInstrumentId === 'inst-sampler') newParams = { pitchShift: 1 };
          
          return { 
            ...t, 
            instrument: newInstrumentId,
            instrumentParams: newParams,
            icon: newInstrumentId === 'inst-drum' ? Radio : Music 
          };
        });
        rebuildTrackRouting(trackId, newTracks);
        return newTracks;
    });
  };

  const handleInstrumentParamChange = (trackId, param, value) => {
    setTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      return {
        ...t,
        instrumentParams: { ...t.instrumentParams, [param]: value }
      };
    }));
  };

  const handleSampleUpload = async (e, trackId, paramKey) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!audioCtxRef.current) await initAudioEngine();
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
      const sampleId = `sample_${Date.now()}_${file.name}`;
      
      const peaks = [];
      const data = audioBuffer.getChannelData(0);
      const step = Math.max(1, Math.floor(data.length / 100));
      for(let i=0; i<100; i++) {
         let min = 1.0; let max = -1.0;
         for(let j=0; j<step; j++) {
            const val = data[(i*step)+j];
            if(val < min) min = val;
            if(val > max) max = val;
         }
         peaks.push([min, max]);
      }

      globalAudioBufferCache.set(sampleId, { buffer: audioBuffer, peaks, duration: audioBuffer.duration });
      
      setTracks(prev => prev.map(t => {
        if (t.id !== trackId) return t;
        const prefix = paramKey.replace('SampleId', '');
        return {
          ...t,
          instrumentParams: { 
              ...t.instrumentParams, 
              [paramKey]: sampleId,
              [`${prefix}Start`]: 0,
              [`${prefix}End`]: audioBuffer.duration
          }
        };
      }));
      showToast("Sample loaded successfully", "success");
    } catch (err) {
      console.error("Failed to decode audio file", err);
      showToast("Failed to process audio file", "error");
    }
    e.target.value = null; 
  };

  const handleDrumSampleUpload = async (e, trackId, pitch) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!audioCtxRef.current) await initAudioEngine();
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
      const sampleId = `sample_${Date.now()}_${file.name}`;
      
      const peaks = [];
      const data = audioBuffer.getChannelData(0);
      const step = Math.max(1, Math.floor(data.length / 100));
      for(let i=0; i<100; i++) {
         let min = 1.0; let max = -1.0;
         for(let j=0; j<step; j++) {
            const val = data[(i*step)+j];
            if(val < min) min = val;
            if(val > max) max = val;
         }
         peaks.push([min, max]);
      }

      globalAudioBufferCache.set(sampleId, { buffer: audioBuffer, peaks, duration: audioBuffer.duration });
      
      setTracks(prev => prev.map(t => {
        if (t.id !== trackId) return t;
        const currentMap = t.instrumentParams?.drumMap || DEFAULT_DRUM_MAP;
        return {
          ...t,
          instrumentParams: { 
              ...t.instrumentParams, 
              drumMap: {
                  ...currentMap,
                  [pitch]: {
                      ...(currentMap[pitch] || { name: `Pad ${pitch}` }),
                      sampleId: sampleId,
                      startOffset: 0,
                      endOffset: audioBuffer.duration
                  }
              }
          }
        };
      }));
    } catch (err) {
      console.error("Failed to decode audio file", err);
      showToast("Failed to decode audio file", "error");
    }
    e.target.value = null; 
  };

  const handleAddDrumPad = (trackId) => {
     setTracks(prev => prev.map(t => {
        if (t.id !== trackId) return t;
        const currentMap = t.instrumentParams?.drumMap || DEFAULT_DRUM_MAP;
        return {
           ...t,
           instrumentParams: {
              ...t.instrumentParams,
              drumMap: {
                 ...currentMap,
                 [newPadPitch]: { name: newPadName || `Pad ${newPadPitch}`, sampleId: null, tune: 150, decay: 0.2 }
              }
           }
        };
     }));
  };

  const handleRemoveDrumPad = (trackId, pitch) => {
     setTracks(prev => prev.map(t => {
        if (t.id !== trackId) return t;
        const currentMap = { ...(t.instrumentParams?.drumMap || DEFAULT_DRUM_MAP) };
        delete currentMap[pitch];
        return {
           ...t,
           instrumentParams: {
              ...t.instrumentParams,
              drumMap: currentMap
           }
        };
     }));
  };

  const handleDrumParamChange = (trackId, pitch, param, value) => {
     setTracks(prev => prev.map(t => {
        if (t.id !== trackId) return t;
        const currentMap = t.instrumentParams?.drumMap || DEFAULT_DRUM_MAP;
        return {
           ...t,
           instrumentParams: {
              ...t.instrumentParams,
              drumMap: {
                 ...currentMap,
                 [pitch]: {
                     ...currentMap[pitch],
                     [param]: value
                 }
              }
           }
        };
     }));
  };

  const handleFetchPublicWAMs = () => {
    setIsFetchingWAMs(true);
    setTimeout(() => {
      const publicWAMs = [
        { id: `wam-obxd-${Date.now()}`, name: 'OB-Xd Poly Synth', category: 'instrument', type: 'synth', vendor: 'WAM Community', url: 'https://mainline.i3s.unice.fr/wam2/packages/obxd/index.js' },
        { id: `wam-dexed-${Date.now()}`, name: 'Dexed FM Synth', category: 'instrument', type: 'synth', vendor: 'WAM Community', url: 'https://mainline.i3s.unice.fr/wam2/packages/dexed/index.js' }, 
        { id: `wam-talnoise-${Date.now()}`, name: 'TAL-NoiseMaker', category: 'instrument', type: 'synth', vendor: 'Togu Audio Line', url: 'https://mainline.i3s.unice.fr/wam2/packages/tal-noisemaker/index.js' }, 
        { id: `wam-juceopl-${Date.now()}`, name: 'JuceOPLVSTi', category: 'instrument', type: 'synth', vendor: 'WAM Community', url: 'https://mainline.i3s.unice.fr/wam2/packages/juceoplvsti/index.js' }, 
        
        { id: `wam-pingpong-${Date.now()}`, name: 'Ping Pong Delay', category: 'effect', type: 'delay', vendor: 'WAM Community', url: 'https://mainline.i3s.unice.fr/wam2/packages/pingpongdelay/index.js' },
        { id: `wam-quadrafuzz-${Date.now()}`, name: 'Quadrafuzz', category: 'effect', type: 'distortion', vendor: 'WAM Community', url: 'https://mainline.i3s.unice.fr/wam2/packages/quadrafuzz/index.js' },
        { id: `wam-freeverb-${Date.now()}`, name: 'Freeverb', category: 'effect', type: 'delay', vendor: 'WAM Community', url: 'https://mainline.i3s.unice.fr/wam2/packages/freeverb/index.js' },
        { id: `wam-chorus-${Date.now()}`, name: 'Tuna Chorus', category: 'effect', type: 'filter', vendor: 'WebAudio API / WAM2', url: 'https://mainline.i3s.unice.fr/wam2/packages/chorus/index.js' },
        { id: `wam-compressor-${Date.now()}`, name: 'Bus Compressor', category: 'effect', type: 'filter', vendor: 'WAM Community', url: 'https://mainline.i3s.unice.fr/wam2/packages/compressor/index.js' }
      ];
      setVstLibrary(prev => {
        const newLibs = publicWAMs.filter(pw => !prev.some(v => v.url === pw.url || v.name === pw.name));
        return [...prev, ...newLibs];
      });
      setIsFetchingWAMs(false);
      showToast("Fetched public plugins from registry.", "success");
    }, 1800); 
  };

  const handleUploadVST = (e) => {
    const file = e.target.files[0];
    if (file) {
      const isInst = file.name.toLowerCase().includes('synth') || file.name.toLowerCase().includes('inst');
      const customName = file.name.replace(/\.[^/.]+$/, "");
      const newVst = { 
        id: `vst-custom-${Date.now()}`, 
        name: customName, 
        category: isInst ? 'instrument' : 'effect',
        type: 'filter', 
        vendor: currentUser ? currentUser.name : 'Local User'
      };
      setVstLibrary(prev => [...prev, newVst]);
      e.target.value = null; 
      showToast(`Added VST: ${customName}`, "success");
    }
  };

  const updateUserPresence = (trackId) => {
    if (currentUser) {
      setActiveSessionUsers(prev => prev.map(c => c.id === currentUser.id ? { ...c, activeTrack: trackId } : c));
    }
  };

  const handleAddTrack = async (trackType = 'midi') => {
    const newId = tracks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
    const isMidi = trackType === 'midi'; 
    const newTrack = {
      id: newId,
      name: `Track ${newId}`,
      type: isMidi ? 'midi' : 'audio',
      instrument: isMidi ? 'inst-subtractive' : null,
      instrumentParams: isMidi ? { oscType: 'sawtooth', cutoff: 2000, res: 1.5, attack: 0.01, release: 0.2 } : null,
      color: ['bg-pink-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-emerald-500'][newId % 4],
      volume: 80, 
      pan: 0, 
      muted: false, 
      solo: false,
      armed: false,
      icon: isMidi ? Music : Mic,
      clips: [],
      effects: []
    };
    
    setTracks(prev => [...prev, newTrack]);
    
    if (audioCtxRef.current) {
      synthsRef.current[newId] = await initTrackRouting(newTrack, audioCtxRef.current, masterGainRef.current, vstLibrary);
    }
    updateUserPresence(newId);
  };

  const handleDeleteTrack = (trackId) => {
    setTracks(prev => prev.filter(t => t.id !== trackId));
    if (synthsRef.current[trackId]) {
      try {
        if (synthsRef.current[trackId].osc1) {
          synthsRef.current[trackId].osc1.stop();
          synthsRef.current[trackId].osc2.stop();
          synthsRef.current[trackId].lfo.stop();
        }
        synthsRef.current[trackId].faderGain.disconnect();
      } catch(e) {}
      delete synthsRef.current[trackId];
    }
    if (bottomDock?.trackId === trackId) setBottomDock(null);
  };

  const handleTrackLaneDoubleClick = (e, track) => {
    if (e.target !== e.currentTarget) return; 
    
    const x = e.nativeEvent.offsetX;
    const startBeat = Math.floor(x / BEAT_WIDTH); 
    
    const newClipId = tracks.reduce((max, t) => Math.max(max, ...t.clips.map(c => c.id), 0), 0) + 1;
    const newClip = { id: newClipId, start: startBeat, duration: 4, notes: [] };
    
    setTracks(prev => prev.map(t => t.id === track.id ? { ...t, clips: [...t.clips, newClip] } : t));
    updateUserPresence(track.id);
  };

  const handleDeleteClip = (e, trackId, clipId) => {
    e.stopPropagation(); 
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, clips: t.clips.filter(c => c.id !== clipId) } : t));
    if (bottomDock?.clipId === clipId) setBottomDock(null);
    updateUserPresence(trackId);
  };

  // --- Drag and Drop Handlers for Timeline ---
  const handleTimelineDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer.types.includes('Files')) return;

    let beat = 0;
    let targetTrackId = 'new';

    if (timelineRef.current) {
        const timelineRect = timelineRef.current.getBoundingClientRect();
        if (e.clientX >= timelineRect.left) {
            const x = e.clientX - timelineRect.left + timelineRef.current.scrollLeft;
            const snap = snapGrid || 0.25;
            beat = Math.max(0, Math.round((x / BEAT_WIDTH) / snap) * snap);
        }
        
        const y = e.clientY - timelineRect.top + timelineRef.current.scrollTop;
        if (y >= 0) {
            const trackIndex = Math.floor(y / 96); // 96px is track height (h-24)
            if (trackIndex >= 0 && trackIndex < tracks.length) {
                targetTrackId = tracks[trackIndex].id;
            }
        }
    }

    setDragOverlay(prev => {
        if (prev && prev.active && prev.beat === beat && prev.trackId === targetTrackId) return prev;
        return { active: true, beat, trackId: targetTrackId };
    });
  };

  const handleTimelineDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverlay(null);
  };

  const handleTimelineDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const dropState = dragOverlay;
    setDragOverlay(null);

    if (!dropState || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const file = e.dataTransfer.files[0];
    const fileName = file.name.toLowerCase();
    const isMidi = fileName.endsWith('.mid') || fileName.endsWith('.midi');
    const isAudio = file.type.startsWith('audio/') || fileName.endsWith('.wav') || fileName.endsWith('.mp3') || fileName.endsWith('.ogg') || fileName.endsWith('.flac');

    if (!isMidi && !isAudio) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        let newClip = null;

        if (isMidi) {
            const notes = parseMIDIFile(arrayBuffer, bpm);
            if (notes.length === 0) throw new Error("No notes found in MIDI file");

            const minStart = Math.min(...notes.map(n => n.start));
            const maxEnd = Math.max(...notes.map(n => n.start + n.duration));
            const normalizedNotes = notes.map(n => ({
                ...n,
                start: n.start - minStart
            }));

            newClip = {
                id: Date.now(),
                start: dropState.beat,
                duration: Math.max(1, maxEnd - minStart),
                notes: normalizedNotes
            };
        } else if (isAudio) {
            if (!audioCtxRef.current) await initAudioEngine();
            const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
            const sampleId = `import_${Date.now()}_${file.name}`;

            const peaks = [];
            const data = audioBuffer.getChannelData(0);
            const step = Math.max(1, Math.floor(data.length / 100));
            for(let i=0; i<100; i++) {
               let min = 1.0; let max = -1.0;
               for(let j=0; j<step; j++) {
                  const val = data[(i*step)+j];
                  if(val < min) min = val;
                  if(val > max) max = val;
               }
               peaks.push([min, max]);
            }

            globalAudioBufferCache.set(sampleId, { buffer: audioBuffer, peaks, duration: audioBuffer.duration });
            const durationBeats = audioBuffer.duration * (bpm / 60);

            newClip = {
                id: Date.now(),
                start: dropState.beat,
                duration: durationBeats,
                sampleId: sampleId
            };
        }

        setTracks(prevTracks => {
            let newTracks = [...prevTracks];
            let trackIdx = newTracks.findIndex(t => t.id === dropState.trackId);
            let targetTrackId = dropState.trackId;

            if (targetTrackId === 'new') {
                const newId = newTracks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
                const newTrack = {
                   id: newId,
                   name: file.name.replace(/\.[^/.]+$/, ""),
                   type: isMidi ? 'midi' : 'audio',
                   instrument: isMidi ? 'inst-subtractive' : null,
                   instrumentParams: isMidi ? { oscType: 'sawtooth', cutoff: 2000, res: 1.5, attack: 0.01, release: 0.2 } : null,
                   color: ['bg-pink-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-emerald-500'][newId % 4],
                   volume: 80, pan: 0, muted: false, solo: false, armed: false,
                   icon: isMidi ? Music : Mic,
                   clips: [newClip],
                   effects: []
                };
                newTracks.push(newTrack);
                
                setTimeout(() => {
                    if (audioCtxRef.current) {
                        initTrackRouting(newTrack, audioCtxRef.current, masterGainRef.current, vstLibraryRef.current).then(synth => {
                            synthsRef.current[newId] = synth;
                        });
                    }
                }, 0);
                return newTracks;
            }

            const targetTrack = newTracks[trackIdx];
            if (isMidi && targetTrack.type !== 'midi') {
                showToast("Cannot drop MIDI on an Audio track.", "error");
                return prevTracks;
            }
            if (isAudio && targetTrack.type !== 'audio') {
                showToast("Cannot drop Audio on a MIDI track.", "error");
                return prevTracks;
            }

            newTracks[trackIdx] = { ...targetTrack, clips: [...targetTrack.clips, newClip] };
            return newTracks;
        });

    } catch (err) {
        console.error("Import error", err);
        showToast("Failed to parse file: " + err.message, "error");
    }
  };

  const toggleArmTrack = (trackId) => {
     setTracks(prev => prev.map(t => {
        if (t.id === trackId) return { ...t, armed: !t.armed };
        return { ...t, armed: false }; 
     }));
  };

  const PITCH_HEIGHT = 16; 
  const PITCH_MAX = 108; // C7
  const PITCH_MIN = 24;  // C0

  const handleClipMouseDown = (e, trackId, clip) => {
    if (e.target.dataset.edge) return; 
    e.stopPropagation();
    setDraggingClip({ trackId, clipId: clip.id, startX: e.clientX, initialStart: clip.start });
    updateUserPresence(trackId);
  };

  const handleClipEdgeMouseDown = (e, trackId, clip, edge) => {
    e.stopPropagation();
    setDraggingEdge({ trackId, clipId: clip.id, edge, startX: e.clientX, initialStart: clip.start, initialDuration: clip.duration });
    updateUserPresence(trackId);
  };

  const handleNoteMouseDown = (e, trackId, clipId, note) => {
    e.stopPropagation();
    const isEdge = e.target.dataset.edge === 'right';

    if (isEdge) {
      setDraggingNote({
        trackId, clipId, noteId: note.id,
        startX: e.clientX,
        initialDuration: note.duration,
        tool: 'resize'
      });
      return;
    }

    if (editorTool === 'erase') {
      setTracks(prev => prev.map(t => t.id === trackId ? {
        ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, notes: c.notes.filter(n => n.id !== note.id) } : c)
      } : t));
      return;
    }
    if (editorTool === 'select' || editorTool === 'velocity') {
      let newSelected = [...selectedNotes];
      if (e.shiftKey) {
         if (newSelected.includes(note.id)) {
            newSelected = newSelected.filter(id => id !== note.id);
         } else {
            newSelected.push(note.id);
         }
         setSelectedNotes(newSelected);
      } else if (!newSelected.includes(note.id)) {
         newSelected = [note.id];
         setSelectedNotes(newSelected);
      }
      setDraggingNote({ 
        trackId, 
        clipId, 
        noteId: note.id, 
        startX: e.clientX, 
        startY: e.clientY, 
        initialStart: note.start, 
        initialPitch: note.pitch,
        initialVelocity: note.velocity ?? 100,
        tool: editorTool,
        selectionSnapshot: newSelected
      });
    }
  };

  const handleGridMouseDown = (e, trackId, clipId) => {
    if (editorTool !== 'draw' || draggingNote) {
       if (!e.shiftKey) setSelectedNotes([]);
       return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const snap = snapGrid || 0.25;
    const timeBeat = e.ctrlKey || e.metaKey ? (x / BEAT_WIDTH) : Math.max(0, Math.floor((x / BEAT_WIDTH) / snap) * snap); 
    const pitchIndex = Math.floor(y / PITCH_HEIGHT);
    const pitch = PITCH_MAX - pitchIndex;

    const newNoteId = `new_${Date.now()}`;
    const newNote = { id: newNoteId, pitch: pitch, start: timeBeat, duration: snap, velocity: 100 };
    
    setTracks(prev => prev.map(t => t.id === trackId ? {
      ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, notes: [...(c.notes || []), newNote] } : c)
    } : t));

    // Immediately trigger resize mode so dragging after clicking extends the note
    setDraggingNote({
      trackId, 
      clipId, 
      noteId: newNoteId,
      startX: e.clientX,
      initialDuration: snap,
      tool: 'resize'
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (draggingClip) {
        const deltaX = e.clientX - draggingClip.startX;
        const deltaBeats = deltaX / BEAT_WIDTH;
        let newStart = Math.max(0, draggingClip.initialStart + deltaBeats);
        newStart = Math.round(newStart * 4) / 4; 

        setTracks(prev => prev.map(t => t.id === draggingClip.trackId ? {
          ...t, clips: t.clips.map(c => c.id === draggingClip.clipId ? { ...c, start: newStart } : c)
        } : t));
      } else if (draggingLoop) {
        const deltaX = e.clientX - draggingLoop.startX;
        const deltaBeats = Math.round((deltaX / BEAT_WIDTH) * 4) / 4; 
        
        setLoopRegion(prev => {
          let newStart = prev.start;
          let newEnd = prev.end;

          if (draggingLoop.edge === 'start') {
            newStart = Math.max(0, draggingLoop.initialStart + deltaBeats);
            newStart = Math.min(newStart, prev.end - 1);
          } else if (draggingLoop.edge === 'end') {
            newEnd = Math.max(prev.start + 1, draggingLoop.initialEnd + deltaBeats);
          } else if (draggingLoop.edge === 'body') {
            const width = draggingLoop.initialEnd - draggingLoop.initialStart;
            newStart = Math.max(0, draggingLoop.initialStart + deltaBeats);
            newEnd = newStart + width;
          }
          return { ...prev, start: newStart, end: newEnd };
        });
      } else if (draggingEdge) {
        const deltaX = e.clientX - draggingEdge.startX;
        const deltaBeats = Math.round((deltaX / BEAT_WIDTH) * 4) / 4; 

        setTracks(prev => prev.map(t => t.id === draggingEdge.trackId ? {
          ...t, clips: t.clips.map(c => {
            if (c.id !== draggingEdge.clipId) return c;
            if (draggingEdge.edge === 'right') {
              return { ...c, duration: Math.max(0.25, draggingEdge.initialDuration + deltaBeats) };
            } else {
              const newStart = Math.min(draggingEdge.initialStart + draggingEdge.initialDuration - 0.25, Math.max(0, draggingEdge.initialStart + deltaBeats));
              const newDuration = draggingEdge.initialStart + draggingEdge.initialDuration - newStart;
              return { ...c, start: newStart, duration: newDuration };
            }
          })
        } : t));
      } else if (draggingPlayhead) {
         const rect = timelineRef.current?.getBoundingClientRect();
         if (rect) {
             const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
             const newTime = Math.max(0, x / BEAT_WIDTH);
             setCurrentTime(newTime);
             stateRefs.current.currentTime = newTime;
         }
      } else if (draggingNote) {
        if (draggingNote.tool === 'velocity') {
           const deltaY = draggingNote.startY - e.clientY; 
           const deltaVel = Math.round(deltaY / 2);
           const newVel = Math.min(127, Math.max(1, draggingNote.initialVelocity + deltaVel));
           
           setTracks(prev => prev.map(t => t.id === draggingNote.trackId ? {
             ...t, clips: t.clips.map(c => c.id === draggingNote.clipId ? {
                ...c, notes: c.notes.map(n => draggingNote.selectionSnapshot?.includes(n.id) || n.id === draggingNote.noteId ? {
                  ...n, velocity: newVel
                } : n)
             } : c)
           } : t));
        } else if (draggingNote.tool === 'resize') {
           const deltaX = e.clientX - draggingNote.startX;
           const snap = e.ctrlKey || e.metaKey ? 0.01 : (snapGrid || 0.25);
           const deltaBeats = Math.round((deltaX / BEAT_WIDTH) / snap) * snap;
           
           setTracks(prev => prev.map(t => t.id === draggingNote.trackId ? {
             ...t, clips: t.clips.map(c => c.id === draggingNote.clipId ? {
                ...c, notes: c.notes.map(n => n.id === draggingNote.noteId ? {
                  ...n, duration: Math.max(snap, draggingNote.initialDuration + deltaBeats)
                } : n)
             } : c)
           } : t));
        } else {
           const deltaX = e.clientX - draggingNote.startX;
           const snap = e.ctrlKey || e.metaKey ? 0.01 : (snapGrid || 0.25); 
           const deltaBeats = Math.round((deltaX / BEAT_WIDTH) / snap) * snap;
           
           const deltaY = e.clientY - draggingNote.startY;
           const deltaPitch = Math.round(deltaY / PITCH_HEIGHT); 

           setTracks(prev => prev.map(t => t.id === draggingNote.trackId ? {
             ...t, clips: t.clips.map(c => c.id === draggingNote.clipId ? {
                ...c, notes: c.notes.map(n => draggingNote.selectionSnapshot?.includes(n.id) || n.id === draggingNote.noteId ? {
                  ...n,
                  start: Math.max(0, (n.initialStart ?? n.start) + deltaBeats),
                  pitch: Math.min(PITCH_MAX, Math.max(PITCH_MIN, (n.initialPitch ?? n.pitch) - deltaPitch))
                } : n)
             } : c)
           } : t));
        }
      }
    };

    const handleMouseUp = () => {
      setDraggingClip(null);
      setDraggingNote(null);
      setDraggingEdge(null);
      setDraggingLoop(null);
      setDraggingPlayhead(false);
      
      if (draggingNote) {
         setTracks(prev => prev.map(t => t.id === draggingNote.trackId ? {
             ...t, clips: t.clips.map(c => c.id === draggingNote.clipId ? {
                ...c, notes: c.notes.map(n => {
                   const { initialStart, initialPitch, initialDuration, ...rest } = n;
                   return rest;
                })
             } : c)
         } : t));
         setDraggingNote(null);
      }
    };

    if (draggingClip || draggingNote || draggingEdge || draggingLoop || draggingPlayhead) {
      if (draggingNote && !draggingNote.initialsSet && draggingNote.tool !== 'resize') {
          setTracks(prev => prev.map(t => t.id === draggingNote.trackId ? {
             ...t, clips: t.clips.map(c => c.id === draggingNote.clipId ? {
                ...c, notes: c.notes.map(n => draggingNote.selectionSnapshot?.includes(n.id) || n.id === draggingNote.noteId ? {
                  ...n, initialStart: n.start, initialPitch: n.pitch, initialDuration: n.duration
                } : n)
             } : c)
          } : t));
          setDraggingNote(prev => ({...prev, initialsSet: true}));
      }
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingClip, draggingNote, draggingEdge, draggingLoop, draggingPlayhead, BEAT_WIDTH, snapGrid, selectedNotes]);

  const handleTimelineMouseDown = (e) => {
    if (e.target.closest('.group') || draggingClip || draggingNote || draggingLoop) return;
    setDraggingPlayhead(true);

    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = e.currentTarget.scrollLeft || 0;
    const x = e.clientX - rect.left + scrollLeft;
    const newTime = Math.max(0, x / BEAT_WIDTH);
    
    setCurrentTime(newTime);
    stateRefs.current.currentTime = newTime;
    
    if (audioCtxRef.current) {
      Object.values(synthsRef.current).forEach(synth => {
        if (synth.gateGain) synth.gateGain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.01);
        if (synth.activeNoteIds) synth.activeNoteIds.clear();
        if (synth.activeSource) {
           try { synth.activeSource.stop(audioCtxRef.current.currentTime); } catch(err){}
           synth.activeSource = null;
        }
      });
      document.querySelectorAll('canvas').forEach(canvas => {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }
  };

  const toggleMute = (trackId) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
  };

  const toggleSolo = (trackId) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, solo: !t.solo } : t));
  };

  const handleVolumeChange = (trackId, val) => {
    const numVal = Number(val);
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume: numVal } : t));
    if (synthsRef.current[trackId]) {
      synthsRef.current[trackId].faderGain.gain.setTargetAtTime(numVal / 100, audioCtxRef.current?.currentTime || 0, 0.05);
    }
  };

  const handlePanChange = (trackId, val) => {
    const numVal = Number(val);
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, pan: numVal } : t));
    
    if (synthsRef.current[trackId] && synthsRef.current[trackId].panner && synthsRef.current[trackId].panner.pan) {
      synthsRef.current[trackId].panner.pan.setTargetAtTime(numVal / 50, audioCtxRef.current?.currentTime || 0, 0.05);
    }
  };

  const handleMasterVolumeChange = (val) => {
    const numVal = Number(val);
    setMasterVolume(numVal);
    if (masterGainRef.current && audioCtxRef.current) {
        masterGainRef.current.gain.setTargetAtTime(numVal / 100, audioCtxRef.current.currentTime, 0.05);
    }
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setAuthMessage('');
    const isFirstUser = usersDb.length === 0;
    const currentAuthMode = isFirstUser ? 'register' : authMode;

    if (authName.trim() && authPassword.trim()) {
      if (currentAuthMode === 'register') {
        const existing = usersDb.find(u => u.name === authName.trim());
        if (existing) {
          setAuthMessage('Name already taken.');
          return;
        }
        
        const colors = ['bg-yellow-500', 'bg-red-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const newUser = { 
          id: `u-${Date.now()}`, 
          name: authName.trim(), 
          password: authPassword.trim(),
          role: isFirstUser ? 'admin' : 'user',
          status: isFirstUser ? 'approved' : 'pending',
          color: randomColor, 
          activeTrack: null 
        };
        
        setUsersDb(prev => [...prev, newUser]);
        
        if (isFirstUser) {
          setCurrentUser(newUser);
          setActiveSessionUsers(prev => [...prev, newUser]);
          setAuthName(''); setAuthPassword('');
          showToast("Welcome to WebDAW", "success");
        } else {
          setAuthMessage('Registered! Waiting for admin approval.');
          setAuthMode('signin');
          setAuthPassword('');
        }
      } else { 
        const user = usersDb.find(u => u.name === authName.trim() && u.password === authPassword.trim());
        if (!user) {
          setAuthMessage('Invalid name or password.');
          return;
        }
        if (user.status === 'pending') {
          setAuthMessage('Account pending admin approval.');
          return;
        }
        
        setCurrentUser(user);
        setActiveSessionUsers(prev => {
          if (prev.find(u => u.id === user.id)) return prev;
          return [...prev, { ...user, activeTrack: null }];
        });
        setAuthName(''); setAuthPassword('');
        showToast(`Welcome back, ${user.name}`, "success");
      }
    }
  };

  const handleSignOut = () => {
    setActiveSessionUsers(prev => prev.filter(c => c.id !== currentUser.id));
    setCurrentUser(null);
    showToast("Signed out successfully");
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        const updatedUser = { ...currentUser, avatar: dataUrl };
        setCurrentUser(updatedUser);
        setUsersDb(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
        setActiveSessionUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
        showToast("Profile avatar updated", "success");
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = null; 
  };

  // Helper for formatted time display (MM:SS.ms)
  const renderFormattedTime = () => {
    const timeInSeconds = currentTime * (60/bpm);
    const mins = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    const ms = Math.floor((timeInSeconds % 1) * 100).toString().padStart(2, '0');
    return `${mins}:${secs}.${ms}`;
  };

  // ==========================================
  // AUTHENTICATION SCREEN RENDER BLOCK
  // ==========================================
  if (!currentUser) {
    const isFirstUser = usersDb.length === 0;
    const currentAuthMode = isFirstUser ? 'register' : authMode;

    return (
      <div className="flex flex-col h-screen bg-neutral-950 items-center justify-center text-neutral-300 font-sans selection:bg-blue-500/30 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
          <div className="px-6 py-8 border-b border-neutral-800 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-md gap-3">
             <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-blue-500/20">W</div>
             <h2 className="text-xl font-bold text-white tracking-wide">WebDAW <span className="text-sm font-normal text-blue-400">Pro</span></h2>
             <p className="text-xs text-neutral-500">
               {isFirstUser ? 'Create the first admin account' : 'Collaborate on your music'}
             </p>
          </div>

          {!isFirstUser && (
            <div className="flex w-full bg-neutral-950 border-b border-neutral-800">
              <button 
                type="button"
                className={`flex-1 py-3 text-sm font-semibold transition-all ${currentAuthMode === 'signin' ? 'text-white border-b-2 border-blue-500 bg-neutral-900' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/50'}`}
                onClick={() => { setAuthMode('signin'); setAuthMessage(''); }}
              >
                Sign In
              </button>
              <button 
                type="button"
                className={`flex-1 py-3 text-sm font-semibold transition-all ${currentAuthMode === 'register' ? 'text-white border-b-2 border-blue-500 bg-neutral-900' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/50'}`}
                onClick={() => { setAuthMode('register'); setAuthMessage(''); }}
              >
                Register
              </button>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="p-6 flex flex-col gap-4">
            {authMessage && (
              <div className={`text-xs text-center p-2.5 rounded-lg font-medium ${authMessage.includes('Waiting') || authMessage.includes('pending') ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {authMessage}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Name</label>
              <input 
                type="text" 
                value={authName} 
                onChange={(e) => setAuthName(e.target.value)} 
                required 
                autoFocus
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner" 
                placeholder="Enter your name" 
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Password</label>
              <input 
                type="password" 
                value={authPassword} 
                onChange={(e) => setAuthPassword(e.target.value)} 
                required 
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner" 
                placeholder="••••••••" 
              />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium py-2.5 rounded-lg mt-2 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]">
              {currentAuthMode === 'signin' ? 'Sign In' : 'Register'}
            </button>
          </form>
        </div>

        {/* Custom Global Toast Notifications Container */}
        <div className="fixed bottom-4 right-4 z-[110] flex flex-col gap-2 pointer-events-none">
           {toasts.map(toast => (
             <div key={toast.id} className="animate-in slide-in-from-right-4 fade-in duration-300">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border ${
                    toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                    toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                    'bg-blue-500/10 border-blue-500/20 text-blue-400'
                }`}>
                   {toast.type === 'success' ? <CheckCircle2 size={16} /> :
                    toast.type === 'error' ? <AlertTriangle size={16} /> :
                    <Info size={16} />}
                   <span className="text-sm font-medium">{toast.message}</span>
                </div>
             </div>
           ))}
        </div>
      </div>
    );
  }

  // ==========================================
  // HOME SCREEN RENDER BLOCK
  // ==========================================
  if (appView === 'home') {
    return (
      <div className="flex flex-col h-screen bg-neutral-950 text-neutral-300 font-sans selection:bg-blue-500/30 overflow-hidden">
        {/* App Bar */}
        <header className="h-14 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-6 shrink-0 shadow-sm z-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">W</div>
            <span className="text-white font-bold text-lg tracking-wide">WebDAW <span className="text-xs font-normal text-neutral-500 ml-2">v0.9.0 Pro</span></span>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-3 pl-2">
                <div className="flex items-center gap-2">
                  <label className="relative cursor-pointer group" title="Upload Profile Picture">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-xs text-white font-bold shadow-sm overflow-hidden border border-neutral-700 group-hover:border-blue-400 transition-colors">
                      {currentUser.avatar ? <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" /> : currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <input type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
                  </label>
                  <span className="text-sm font-medium text-white">{currentUser.name}</span>
                </div>
                <button onClick={handleSignOut} className="p-2 text-neutral-500 hover:text-red-400 transition-colors rounded-lg hover:bg-neutral-800" title="Sign Out">
                  <LogOut size={16} />
                </button>
             </div>
          </div>
        </header>
        
        {/* Home Content */}
        <div className="flex-1 flex flex-col items-center pt-24 px-8 overflow-y-auto custom-scrollbar relative">
           <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
           
           <div className="w-full max-w-5xl z-10">
              <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Your Projects</h1>
              <p className="text-neutral-400 mb-12 max-w-2xl text-lg">Create a new session, resume your saved work, or drop in an exported project file from anywhere.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Create New */}
                <div 
                   onClick={createNewProject}
                   className="group relative bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-2 border-dashed border-blue-500/30 hover:border-blue-500 hover:from-blue-900/30 hover:to-purple-900/30 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 min-h-[220px] shadow-lg"
                >
                   <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-blue-500 transition-all duration-300">
                      <Plus size={32} className="text-blue-400 group-hover:text-white transition-colors" />
                   </div>
                   <h3 className="text-lg font-bold text-white">Create Empty Project</h3>
                   <p className="text-xs text-neutral-400 text-center mt-2">Start fresh with native engines</p>
                </div>

                {/* Import External */}
                <label className="group relative bg-neutral-900/50 border border-neutral-800 hover:border-neutral-600 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 min-h-[220px] shadow-lg">
                   <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Upload size={28} className="text-neutral-400 group-hover:text-white transition-colors" />
                   </div>
                   <h3 className="text-lg font-bold text-white">Load Saved .webdaw File</h3>
                   <p className="text-xs text-neutral-400 text-center mt-2">Import from your computer</p>
                   <input type="file" accept=".webdaw,.json" hidden onChange={handleImportProjectFile} />
                </label>

                {/* Saved Projects List */}
                {savedProjectsList.map((proj) => (
                  <div 
                     key={proj.id} 
                     onClick={() => loadProjectToDaw(proj)}
                     className="group relative bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-2xl p-6 flex flex-col cursor-pointer transition-all duration-300 min-h-[220px] shadow-lg overflow-hidden"
                  >
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                     
                     <div className="flex items-start justify-between mb-4">
                       <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center">
                          <FileJson size={20} className="text-blue-400" />
                       </div>
                       <span className="text-[10px] font-mono text-neutral-500 bg-neutral-950 px-2 py-1 rounded">
                         {new Date(proj.lastModified).toLocaleDateString()}
                       </span>
                     </div>
                     
                     <h3 className="text-lg font-bold text-white truncate w-full mb-1 group-hover:text-blue-400 transition-colors">{proj.name}</h3>
                     <p className="text-xs text-neutral-400 font-mono mb-auto">{proj.bpm} BPM &bull; {proj.tracks?.length || 0} Tracks</p>
                     
                     <div className="flex gap-2 mt-4">
                       {proj.tracks?.slice(0,5).map(t => (
                         <div key={t.id} className={`w-3 h-3 rounded-full shadow-sm ${t.color}`} title={t.name} />
                       ))}
                       {proj.tracks?.length > 5 && <span className="text-[10px] text-neutral-500 font-bold ml-1">+{proj.tracks.length - 5}</span>}
                     </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // DAW STUDIO RENDER BLOCK
  // ==========================================
  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-neutral-300 font-sans selection:bg-blue-500/30 relative">
      
      {/* Top Navigation, Transport & App Bar */}
      <header className="h-14 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-4 shrink-0 z-40">
        {/* LEFT: Project Info */}
        <div className="flex items-center gap-4 flex-1">
          <button onClick={closeDawToHome} className="flex items-center justify-center p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors group">
             <Home size={18} className="group-active:scale-95 transition-transform" />
          </button>
          <div className="w-px h-6 bg-neutral-800" />
          <div className="flex items-center gap-2 group max-w-[150px] lg:max-w-[200px]">
             <input 
               value={projectName}
               onChange={(e) => setProjectName(e.target.value)}
               className="bg-transparent text-white font-bold text-sm lg:text-base outline-none w-full focus:border-b-2 focus:border-blue-500 px-1 placeholder:text-neutral-600 truncate"
               placeholder="Project Name"
             />
             <Pencil size={12} className="text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        </div>

        {/* CENTER: Transport Controls */}
        <div className="flex items-center gap-1.5 bg-neutral-900/80 px-3 py-1.5 rounded-xl border border-neutral-800 shadow-sm shrink-0 backdrop-blur-sm">
          <button onClick={stopPlayback} className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"><SkipBack size={16} /></button>
          <button onClick={togglePlay} className={`p-2 rounded-full transition-all flex items-center justify-center ${isPlaying ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]' : 'bg-neutral-800 hover:bg-neutral-700 text-white'}`}>
            {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
          </button>
          <button onClick={stopPlayback} className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"><Square size={16} /></button>
          <button onClick={toggleRecord} className={`p-1.5 rounded-lg transition-all ml-1 ${isRecording ? 'text-red-500 bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'text-red-400 hover:text-red-300 hover:bg-neutral-800'}`} title="Record (Requires Armed Track)">
            <Circle size={16} fill="currentColor" />
          </button>
          
          <div className="w-px h-5 bg-neutral-800 mx-1" />
          
          <button onClick={() => setLoopRegion(prev => ({...prev, enabled: !prev.enabled}))} className={`p-1.5 rounded-lg transition-colors ${loopRegion.enabled ? 'text-blue-400 bg-blue-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Toggle Loop Region">
            <Repeat size={16} />
          </button>
          <button onClick={() => setAutoScroll(!autoScroll)} className={`p-1.5 rounded-lg transition-colors ${autoScroll ? 'text-green-400 bg-green-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Auto-Scroll Timeline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 5l7 7-7 7M4 12h16"/></svg>
          </button>
        </div>

        {/* RIGHT: Info & Settings */}
        <div className="flex items-center justify-end gap-3 flex-1">
          <div className="hidden lg:flex items-center gap-4 bg-neutral-900/80 px-4 py-1.5 rounded-xl border border-neutral-800 font-mono text-[11px] shadow-inner">
            <div className="flex items-center gap-1.5 text-neutral-400"><span className="uppercase text-[9px] font-bold text-neutral-600">Time</span> <span className="text-white w-14">{renderFormattedTime()}</span></div>
            <div className="flex items-center gap-1.5 text-neutral-400"><span className="uppercase text-[9px] font-bold text-neutral-600">Pos</span> <span className="text-white">{Math.floor(currentTime / 4) + 1}.{Math.floor(currentTime % 4) + 1}.1</span></div>
            <div className="flex items-center gap-1 text-neutral-400"><span className="uppercase text-[9px] font-bold text-neutral-600">BPM</span> <input type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="bg-transparent w-8 text-white focus:outline-none" min="40" max="300" /></div>
            <button onClick={() => setMetronomeEnabled(!metronomeEnabled)} className={`flex items-center justify-center p-1 rounded-full transition-all ${metronomeEnabled ? 'text-blue-400 bg-blue-500/10 shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`} title="Metronome Click">
               <Activity size={12} />
            </button>
          </div>
          
          <div className="w-px h-6 bg-neutral-800" />

          <button onClick={() => { requestIO(); setShowIOSettings(true); }} className="p-1.5 text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-neutral-800" title="Project Settings & I/O">
              <Settings2 size={18} />
          </button>
          
          <div className="flex items-center gap-1.5 bg-neutral-900 px-2 py-1.5 rounded-full border border-neutral-800">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-1" />
            <div className="flex -space-x-1.5 pr-0.5">
              {activeSessionUsers.map(collab => (
                <div key={collab.id} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold ring-2 ring-neutral-900 ${collab.color} overflow-hidden`} title={`${collab.name} is editing`}>
                  {collab.avatar ? <img src={collab.avatar} alt={collab.name} className="w-full h-full object-cover" /> : collab.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <label className="relative cursor-pointer group" title="Upload Profile Picture">
               <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-xs text-white font-bold shadow-sm overflow-hidden border border-neutral-700 group-hover:border-blue-400 transition-colors">
                 {currentUser.avatar ? <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" /> : currentUser.name.charAt(0).toUpperCase()}
               </div>
               <input type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
             </label>
             <button onClick={handleSignOut} className="p-1 text-neutral-500 hover:text-red-400 transition-colors rounded-full hover:bg-neutral-800 flex items-center justify-center" title="Sign Out">
                <LogOut size={16} />
             </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div 
        className="flex flex-1 overflow-hidden relative"
        onDragOver={handleTimelineDragOver}
        onDragLeave={handleTimelineDragLeave}
        onDrop={handleTimelineDrop}
      >
        {/* Left Vertical Navigation Menu */}
        <div className="w-12 bg-neutral-950 border-r border-neutral-800 flex flex-col items-center py-4 z-30 shrink-0 shadow-[4px_0_15px_rgba(0,0,0,0.2)]">
          <button onClick={() => { setActiveView('arrangement'); setBottomDock(null); }} className={`p-2.5 rounded-xl transition-all ${activeView === 'arrangement' && !bottomDock ? 'text-blue-400 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`} title="Arrangement View">
            <Piano size={20} />
          </button>
          
          <div className="mt-auto flex flex-col items-center gap-3">
            <button onClick={() => setActiveView('mixer')} className={`p-2.5 rounded-xl transition-all ${activeView === 'mixer' ? 'text-blue-400 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`} title="Mixer Console">
              <Sliders size={20} />
            </button>
            <button onClick={() => setActiveView('browser')} className={`p-2.5 rounded-xl transition-all ${activeView === 'browser' ? 'text-blue-400 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`} title="Project Browser">
              <Folder size={20} />
            </button>
          </div>
        </div>

        {activeView === 'browser' ? (
          <div className="flex-1 flex overflow-hidden bg-neutral-900 z-10">
            <div className="w-72 bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0">
              <div className="p-4 border-b border-neutral-800">
                <h3 className="text-white font-semibold flex items-center gap-2"><Folder size={18} className="text-blue-400"/> Library</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                
                <div className="text-[10px] font-bold text-neutral-500 mb-2 mt-2 uppercase tracking-wider px-2">Native Engines & Effects</div>
                {INTERNAL_PLUGINS.map(vst => (
                  <div key={vst.id} className="flex items-center justify-between p-2 hover:bg-neutral-800/50 rounded-lg text-sm text-neutral-300 group cursor-pointer border border-transparent hover:border-neutral-700 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded bg-neutral-800 flex items-center justify-center ${vst.category === 'instrument' ? 'text-purple-400' : 'text-blue-400'}`}>
                        {vst.category === 'instrument' ? <Piano size={14} /> : <Plug size={14} />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-white text-xs">{vst.name}</span>
                        <span className="text-[9px] text-neutral-500">{vst.vendor} &bull; {vst.category?.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="text-[10px] font-bold text-neutral-500 mb-2 mt-6 uppercase tracking-wider px-2">WAM Plugins</div>
                {vstLibrary.map(vst => {
                  const status = vstStatus[vst.id] || 'loading';
                  return (
                  <div key={vst.id} className={`flex items-center justify-between p-2 rounded-lg text-sm text-neutral-300 group border border-transparent transition-colors animate-in fade-in duration-300 ${status === 'error' ? 'opacity-50' : 'hover:bg-neutral-800/50 hover:border-neutral-700 cursor-pointer'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded bg-neutral-800 flex items-center justify-center ${vst.category === 'instrument' ? 'text-purple-400' : 'text-blue-400'}`}>
                        {vst.category === 'instrument' ? <Piano size={14} /> : <Plug size={14} />}
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-medium text-xs ${status === 'error' ? 'text-red-400 line-through' : 'text-white'}`}>{vst.name}</span>
                        <span className="text-[9px] text-neutral-500">{vst.vendor} &bull; {vst.category?.toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="shrink-0 pr-2">
                       {status === 'loading' && <Activity size={12} className="animate-spin text-blue-400" title="Testing Plugin..." />}
                       {status === 'error' && <X size={12} className="text-red-500" title="Offline / Failed to load" />}
                       {status === 'ok' && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]" title="Verified & Ready" />}
                    </div>
                  </div>
                )})}
                
                <div className="text-[10px] font-bold text-neutral-500 mb-2 mt-6 uppercase tracking-wider px-2">Project Files</div>
                <div className="flex items-center gap-3 p-2 hover:bg-neutral-800/50 rounded-lg text-sm text-neutral-300 cursor-pointer">
                   <div className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center text-emerald-400"><FileAudio size={14} /></div>
                   <div className="flex flex-col"><span className="font-medium text-white text-xs">vocal_take_01.wav</span><span className="text-[9px] text-neutral-500">2.4 MB</span></div>
                </div>
              </div>
              <div className="p-4 border-t border-neutral-800 bg-neutral-900/50 flex flex-col gap-2">
                 <label className="flex items-center justify-center gap-2 w-full bg-neutral-800 hover:bg-neutral-700 hover:text-white text-neutral-300 text-xs font-medium py-2.5 rounded-lg cursor-pointer transition-colors shadow-sm border border-neutral-700">
                    <FileCode size={14} /> Upload VST (.wasm)
                    <input type="file" className="hidden" onChange={handleUploadVST} accept=".js,.wasm,.json" />
                 </label>
                 <button 
                   onClick={handleFetchPublicWAMs}
                   disabled={isFetchingWAMs}
                   className="flex items-center justify-center gap-2 w-full bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 text-xs font-medium py-2.5 rounded-lg cursor-pointer transition-colors shadow-sm border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    {isFetchingWAMs ? <Activity size={14} className="animate-spin" /> : <Plug size={14} />}
                    {isFetchingWAMs ? 'Fetching Registry...' : 'Browse Public WAMs'}
                 </button>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 bg-neutral-900 relative">
               <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
               <Plug size={64} className="mb-6 opacity-20" />
               <h2 className="text-2xl font-semibold text-white mb-3">Plugin & File Browser</h2>
               <p className="max-w-md text-center text-sm leading-relaxed">
                 Manage your custom WebAssembly plugins and audio files here. Click <strong>Browse Public WAMs</strong> to securely pull from open-source community registries. The system will automatically verify WAM URLs in the background to prevent audio engine crashes.
               </p>
            </div>
          </div>
        ) : activeView === 'mixer' ? (
          <div className="flex-1 flex flex-col bg-neutral-900 border-l border-neutral-800 relative z-10 overflow-hidden">
            <div className="flex-1 bg-neutral-900 overflow-x-auto flex items-stretch p-4 gap-2 custom-scrollbar">
              {tracks.map(track => {
                return (
                <div key={track.id} className={`w-32 bg-neutral-950 border rounded-xl flex flex-col items-center py-4 shrink-0 shadow-lg relative transition-colors ${track.armed ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-neutral-800'}`}>
                  <div className="w-full text-center px-2 mb-4 border-b border-neutral-800 pb-2">
                     <div className={`w-3 h-3 rounded-full mx-auto mb-1 shadow-sm ${track.color}`} />
                     <div className="text-xs font-semibold text-neutral-300 truncate">{track.name}</div>
                  </div>
                  
                  <div className="w-full px-4 mb-4 flex flex-col items-center">
                     <span className="text-[9px] text-neutral-500 mb-1 font-mono">PAN</span>
                     <input type="range" min="-50" max="50" value={track.pan} onDoubleClick={() => handlePanChange(track.id, 0)} onChange={(e) => handlePanChange(track.id, e.target.value)} className="w-full h-1 bg-neutral-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-neutral-400 hover:[&::-webkit-slider-thumb]:bg-white cursor-pointer" title="Double-click to reset" />
                  </div>
                  
                  <div className="flex gap-1.5 mb-6">
                    <button onClick={() => toggleArmTrack(track.id)} className={`w-7 h-7 rounded flex items-center justify-center transition-all border ${track.armed ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-neutral-800 text-neutral-500 border-transparent hover:bg-neutral-700 hover:text-red-400'}`}>
                      <Circle size={12} fill={track.armed ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={() => toggleMute(track.id)} className={`w-7 h-7 rounded text-[10px] font-bold transition-all border ${track.muted ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.2)]' : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300 border-transparent hover:bg-neutral-700'}`}>M</button>
                    <button onClick={() => toggleSolo(track.id)} className={`w-7 h-7 rounded text-[10px] font-bold transition-all border ${track.solo ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300 border-transparent hover:bg-neutral-700'}`}>S</button>
                  </div>
                  
                  <div className="flex-1 w-full flex justify-center relative min-h-[250px] py-4">
                     <canvas id={`vu-meter-${track.id}`} className="absolute left-4 top-4 bottom-4 w-1.5 bg-black rounded-full shadow-inner border border-neutral-800/50" />
                     
                     <div className="w-2 bg-black rounded-full h-full relative shadow-inner flex justify-center border border-neutral-800/50">
                       <div className={`absolute bottom-0 w-1/2 rounded-full opacity-30 ${track.color}`} style={{ height: `${track.volume}%` }} />
                     </div>
                     
                     <div className="absolute inset-y-4 inset-x-0 group">
                         <input 
                           type="range" orient="vertical" min="0" max="100" 
                           value={track.volume}
                           onDoubleClick={() => handleVolumeChange(track.id, 80)}
                           onChange={(e) => handleVolumeChange(track.id, e.target.value)}
                           className="h-full w-full appearance-none bg-transparent cursor-pointer z-20 absolute inset-0 opacity-0"
                           style={{ WebkitAppearance: 'slider-vertical' }}
                           title="Double-click to reset"
                         />
                         <div className="absolute left-1/2 -translate-x-1/2 w-10 h-6 bg-gradient-to-b from-neutral-300 to-neutral-400 rounded shadow-[0_4px_6px_rgba(0,0,0,0.5)] border-b-4 border-neutral-500 pointer-events-none z-10 transition-colors group-hover:from-white group-hover:to-neutral-300" style={{ bottom: `calc(${track.volume}% - 12px)` }}>
                           <div className="w-full h-0.5 bg-black/50 absolute top-1/2 -translate-y-1/2 shadow-[0_1px_0_rgba(255,255,255,0.5)]" />
                         </div>
                     </div>
                  </div>
                  
                  <div className="mt-4 text-[10px] font-mono text-green-400 bg-black px-3 py-1.5 rounded border border-neutral-800 shadow-inner w-20 text-center">
                    {track.volume === 0 ? '-inf' : `${(track.volume - 80).toFixed(1)}`} dB
                  </div>
                </div>
              )})}

              {/* Master Fader */}
              <div className="w-32 bg-neutral-900 border-l border-neutral-800 flex flex-col items-center py-4 shrink-0 ml-auto shadow-[-8px_0_15px_rgba(0,0,0,0.2)] rounded-r-xl">
                  <div className="w-full text-center px-2 mb-4 border-b border-neutral-800 pb-2">
                     <div className="w-3 h-3 rounded-full mx-auto mb-1 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                     <div className="text-xs font-bold text-white truncate">MASTER</div>
                  </div>
                  
                  <div className="w-full px-4 mb-4 flex flex-col items-center opacity-0"><span className="text-[9px] mb-1">PAN</span><input type="range" className="h-1"/></div>
                  <div className="flex gap-2 mb-6 opacity-0"><button className="w-8 h-8">M</button></div>
                  
                  <div className="flex-1 w-full flex justify-center relative min-h-[250px] py-4">
                     <div className="absolute left-3 top-4 bottom-4 flex gap-1">
                       <canvas id="vu-meter-master-l" className="w-1.5 h-full bg-black rounded-full shadow-inner border border-neutral-800/50" />
                       <canvas id="vu-meter-master-r" className="w-1.5 h-full bg-black rounded-full shadow-inner border border-neutral-800/50" />
                     </div>
                     
                     <div className="w-2 bg-black rounded-full h-full relative shadow-inner border border-neutral-800/50" />
                     
                     <div className="absolute inset-y-4 inset-x-0 group">
                         <input type="range" orient="vertical" min="0" max="100" value={masterVolume} onDoubleClick={() => handleMasterVolumeChange(80)} onChange={(e) => handleMasterVolumeChange(e.target.value)} className="h-full w-full appearance-none bg-transparent cursor-pointer z-20 absolute inset-0 opacity-0" style={{ WebkitAppearance: 'slider-vertical' }} title="Double-click to reset" />
                         <div className="absolute left-1/2 -translate-x-1/2 w-10 h-6 bg-gradient-to-b from-red-500 to-red-600 rounded shadow-[0_4px_6px_rgba(0,0,0,0.5)] border-b-4 border-red-800 pointer-events-none z-10" style={{ bottom: `calc(${masterVolume}% - 12px)` }}>
                           <div className="w-full h-0.5 bg-black/50 absolute top-1/2 -translate-y-1/2 shadow-[0_1px_0_rgba(255,255,255,0.3)]" />
                         </div>
                     </div>
                  </div>
                  
                  <div className="mt-4 text-[10px] font-mono text-red-400 bg-black px-3 py-1.5 rounded border border-neutral-800 shadow-inner w-20 text-center">
                    {masterVolume === 0 ? '-inf' : `${(masterVolume - 80).toFixed(1)}`} dB
                  </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 flex overflow-hidden">
              {/* Track Headers (Left Pane) */}
              <div className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
                <div className="h-8 border-b border-neutral-800 bg-neutral-950 flex justify-between px-2 items-center">
                   {/* Zoom Controls */}
                   <div className="flex items-center bg-neutral-900 rounded border border-neutral-800 h-5">
                     <button onClick={() => setZoom(prev => Math.max(0.25, prev - 0.25))} className="px-2 h-full text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-l border-r border-neutral-800 transition-colors">-</button>
                     <span className="text-[9px] font-mono text-neutral-400 w-10 text-center select-none" title="Zoom Level">{Math.round(zoom * 100)}%</span>
                     <button onClick={() => setZoom(prev => Math.min(4, prev + 0.25))} className="px-2 h-full text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-r border-l border-neutral-800 transition-colors">+</button>
                   </div>
                   
                   {/* Track Actions */}
                   <div className="flex gap-1.5">
                     <button onClick={() => handleAddTrack('midi')} className="flex items-center gap-1 text-[9px] uppercase font-semibold text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-800 px-1.5 py-1 rounded transition-colors" title="Add MIDI Track">
                        <Plus size={10}/> MIDI
                     </button>
                     <button onClick={() => handleAddTrack('audio')} className="flex items-center gap-1 text-[9px] uppercase font-semibold text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-800 px-1.5 py-1 rounded transition-colors" title="Add Audio Track">
                        <Plus size={10}/> Audio
                     </button>
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  {tracks.map((track) => {
                    const Icon = track.icon;
                    const hasActiveCollab = activeSessionUsers.find(c => c.activeTrack === track.id);
                    const isDeviceRackOpen = bottomDock?.type === 'devices' && bottomDock?.trackId === track.id;
                    
                    return (
                      <div 
                        key={track.id} 
                        draggable
                        onDragStart={(e) => setDraggedTrackId(track.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleTrackDrop(e, track.id)}
                        onContextMenu={(e) => handleContextMenu(e, 'track', { trackId: track.id })} 
                        className={`h-24 border-b flex flex-col p-2 transition-colors group relative ${isDeviceRackOpen ? 'bg-neutral-800/70 border-neutral-700' : 'hover:bg-neutral-800/50 border-neutral-800'} ${track.armed ? 'border-l-4 border-l-red-500 bg-red-500/5' : ''} cursor-grab active:cursor-grabbing`}
                      >
                        {hasActiveCollab && <div className={`absolute left-0 top-0 bottom-0 w-1 ${hasActiveCollab.color}`} />}

                        <div className="flex items-center justify-between mb-2 pl-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded flex items-center justify-center ${track.color} text-white/90 shadow-sm shrink-0`}><Icon size={12} /></div>
                            {editingTrackId === track.id ? (
                              <input 
                                autoFocus onBlur={() => setEditingTrackId(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingTrackId(null)}
                                onChange={(e) => setTracks(prev => prev.map(t => t.id === track.id ? { ...t, name: e.target.value } : t))}
                                value={track.name}
                                className="text-sm font-medium bg-neutral-950 text-white w-[80px] border border-neutral-700 rounded px-1 outline-none"
                              />
                            ) : (
                              <span onDoubleClick={() => setEditingTrackId(track.id)} className="text-sm text-neutral-200 font-medium truncate w-[80px] cursor-text" title="Double-click to rename">{track.name}</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => toggleArmTrack(track.id)} className={`w-6 h-6 rounded flex items-center justify-center transition-all ${track.armed ? 'text-red-500 bg-red-500/20' : 'text-neutral-500 hover:text-red-400 hover:bg-neutral-800'}`} title="Record Arm">
                               <Circle size={10} fill={track.armed ? 'currentColor' : 'none'} />
                            </button>
                            {track.type === 'midi' && (
                               <button 
                                 onClick={() => handleOpenPlugin(track.id, false)}
                                 className={`w-6 h-6 flex items-center justify-center rounded transition-all ${openPluginUI?.trackId === track.id && !openPluginUI?.isEffect ? 'text-purple-400 bg-purple-500/20' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`}
                                 title="Open Instrument Interface"
                               >
                                 <Piano size={13} />
                               </button>
                            )}
                            <button 
                              onClick={() => { setBottomDock(isDeviceRackOpen ? null : { type: 'devices', trackId: track.id }); }} 
                              className={`w-6 h-6 flex items-center justify-center rounded transition-all ${isDeviceRackOpen ? 'text-blue-400 bg-blue-500/20' : 'text-neutral-500 hover:text-white hover:bg-neutral-800'}`} 
                              title="Device Rack (VSTs & Effects)"
                            >
                              <Plug size={13} />
                            </button>
                            <button onClick={() => handleDeleteTrack(track.id)} className="w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded transition-all" title="Delete Track"><Trash2 size={13} /></button>
                            <button onClick={() => toggleMute(track.id)} className={`w-6 h-6 rounded text-xs font-bold transition-all ${track.muted ? 'bg-orange-500/20 text-orange-400' : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300 border border-transparent'}`}>M</button>
                            <button onClick={() => toggleSolo(track.id)} className={`w-6 h-6 rounded text-xs font-bold transition-all ${track.solo ? 'bg-yellow-500/20 text-yellow-400' : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300 border border-transparent'}`}>S</button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 px-2 mt-auto pb-1">
                          <Volume2 size={12} className="text-neutral-500" />
                          <input type="range" min="0" max="100" value={track.volume} onDoubleClick={() => handleVolumeChange(track.id, 80)} onChange={(e) => handleVolumeChange(track.id, e.target.value)} className="w-full h-1.5 bg-neutral-950 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-neutral-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-white cursor-pointer" title="Double-click to reset" />
                          <div className="w-8 flex justify-end"><span className="text-[10px] text-neutral-500 font-mono">{track.volume}</span></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Arrangement View / Timeline (Right Pane) */}
              <div className="flex-1 bg-neutral-900 relative flex flex-col overflow-hidden">
                
                {/* Scroll-Synced Header */}
                <div ref={headerRef} className="h-8 bg-neutral-950 border-b border-neutral-800 overflow-hidden shrink-0 cursor-pointer relative" onMouseDown={handleTimelineMouseDown}>
                   <div className="absolute top-0 bottom-0" style={{ width: `${TOTAL_BEATS * BEAT_WIDTH}px` }}>
                       {Array.from({ length: TOTAL_BEATS }).map((_, i) => {
                         const isBar = i % 4 === 0;
                         return (
                         <div key={i} className={`absolute h-full flex items-end border-l ${isBar ? 'border-neutral-600' : 'border-neutral-800/50'} pl-1 text-[10px] ${isBar ? 'text-neutral-400 font-bold' : 'text-neutral-600'} font-mono select-none pointer-events-none`} style={{ left: `${i * BEAT_WIDTH}px`, width: `${BEAT_WIDTH}px` }}>
                            {isBar ? (i / 4) + 1 : `.${(i % 4) + 1}`}
                         </div>
                       )})}
                       
                       {/* Loop Region Brace */}
                       <div 
                         className={`absolute top-0 bottom-0 border-x-[3px] border-t-[3px] z-20 transition-colors rounded-t-sm ${loopRegion.enabled ? 'border-blue-500 bg-blue-500/10' : 'border-neutral-500/80 bg-neutral-500/10 hover:bg-neutral-500/20'}`}
                         style={{
                           left: `${loopRegion.start * BEAT_WIDTH}px`,
                           width: `${(loopRegion.end - loopRegion.start) * BEAT_WIDTH}px`,
                           cursor: 'grab'
                         }}
                         onMouseDown={(e) => { e.stopPropagation(); setDraggingLoop({ edge: 'body', startX: e.clientX, initialStart: loopRegion.start, initialEnd: loopRegion.end }); }}
                       >
                         <div className="absolute left-0 top-0 bottom-0 w-3 cursor-w-resize -ml-1.5 hover:bg-white/30 transition-colors" onMouseDown={(e) => { e.stopPropagation(); setDraggingLoop({ edge: 'start', startX: e.clientX, initialStart: loopRegion.start, initialEnd: loopRegion.end }); }} />
                         <div className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize -mr-1.5 hover:bg-white/30 transition-colors" onMouseDown={(e) => { e.stopPropagation(); setDraggingLoop({ edge: 'end', startX: e.clientX, initialStart: loopRegion.start, initialEnd: loopRegion.end }); }} />
                       </div>
                   </div>
                </div>

                <div ref={timelineRef} onScroll={handleScroll} className="flex-1 overflow-auto relative custom-scrollbar cursor-text" onMouseDown={handleTimelineMouseDown}>
                  <div className="relative min-h-full" style={{ width: `${TOTAL_BEATS * BEAT_WIDTH}px` }}>
                      <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundSize: `${BEAT_WIDTH}px 100%`, backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px)' }} />
                      <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundSize: `${BEAT_WIDTH * 4}px 100%`, backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px)' }} />

                      <div className="absolute top-0 bottom-0 w-[2px] bg-blue-500 z-30 pointer-events-none flex justify-center shadow-[0_0_10px_rgba(59,130,246,0.8)]" style={{ left: `${currentTime * BEAT_WIDTH}px`, transition: isPlaying ? 'none' : 'left 0.1s' }}>
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-blue-500 absolute -top-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                      </div>

                      {dragOverlay?.active && (
                        <div 
                          className="absolute z-[60] rounded-xl border-2 border-dashed pointer-events-none flex items-center justify-center font-bold text-xs bg-white/10 border-white/50 text-white shadow-lg backdrop-blur-sm"
                          style={{
                            left: `${dragOverlay.beat * BEAT_WIDTH}px`,
                            top: dragOverlay.trackId === 'new' ? `${tracks.length * 96 + 8}px` : `${tracks.findIndex(t => t.id === dragOverlay.trackId) * 96 + 8}px`,
                            width: `${4 * BEAT_WIDTH}px`,
                            height: '80px'
                          }}
                        >
                          DROP TO IMPORT {dragOverlay.trackId === 'new' ? 'AS NEW TRACK' : ''}
                        </div>
                      )}

                      {tracks.map((track) => (
                        <div key={track.id} className={`h-24 border-b relative z-10 w-full ${track.armed && isRecording && isPlaying ? 'border-red-500/30 bg-red-500/5' : 'border-neutral-800/50'}`} onDoubleClick={(e) => handleTrackLaneDoubleClick(e, track)}>
                          {track.clips.map(clip => {
                            const clipDuration = clip.isRecording ? Math.max(0.1, currentTime - clip.start) : clip.duration;
                            return (
                            <div 
                              key={clip.id}
                              onMouseDown={(e) => handleClipMouseDown(e, track.id, clip)}
                              onDoubleClick={(e) => { e.stopPropagation(); setBottomDock({type: track.type === 'audio' ? 'audio-editor' : 'piano-roll', trackId: track.id, clipId: clip.id}); }}
                              onContextMenu={(e) => handleContextMenu(e, 'clip', { trackId: track.id, clipId: clip.id })}
                              className={`absolute top-2 bottom-2 rounded-lg border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),_0_2px_6px_rgba(0,0,0,0.3)] overflow-hidden group cursor-grab active:cursor-grabbing hover:brightness-110 transition-all ${clip.isRecording ? 'bg-red-500 opacity-80' : `bg-gradient-to-r ${track.color.replace('bg-', 'from-')}/90 ${track.color.replace('bg-', 'to-')}/70`} ${track.muted ? 'opacity-40 grayscale' : 'opacity-100'}`}
                              style={{ left: `${clip.start * BEAT_WIDTH}px`, width: `${clipDuration * BEAT_WIDTH}px`, transition: draggingClip?.clipId === clip.id ? 'none' : 'left 0.1s' }}
                            >
                              <button onClick={(e) => deleteClip(track.id, clip.id)} className="absolute top-1 right-1 p-0.5 bg-black/40 text-white/70 hover:text-white rounded opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all z-20" title="Delete Clip"><X size={10} /></button>

                              <div className="absolute inset-x-0 bottom-1 top-5 opacity-90 flex items-center justify-center px-1 pointer-events-none">
                                {track.type === 'audio' ? (
                                  clip.isRecording ? (
                                      <Activity className="text-white/50 animate-pulse" size={24}/>
                                  ) : clip.sampleId && globalAudioBufferCache.has(clip.sampleId) ? (
                                      <svg preserveAspectRatio="none" viewBox="0 0 100 100" className="w-full h-full text-white/80 drop-shadow-md">
                                          {globalAudioBufferCache.get(clip.sampleId).peaks.map((p, i) => (
                                              <line key={i} x1={i} y1={50 - (p[1]*40)} x2={i} y2={50 - (p[0]*40)} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                          ))}
                                      </svg>
                                  ) : (
                                  <svg preserveAspectRatio="none" viewBox="0 0 100 100" className="w-full h-full drop-shadow-md text-white">
                                    <polygon 
                                      fill="currentColor" 
                                      points={(() => {
                                        const res = Math.max(20, Math.floor(clip.duration * 20));
                                        let pts = [];
                                        const isVocals = track.name.toLowerCase().includes('vocal');
                                        const vol = track.volume / 100;
                                        
                                        for (let i = 0; i <= res; i++) {
                                            const t = i / res;
                                            const phrase = Math.max(0, Math.sin(t * Math.PI * (clip.id % 4 + 2)));
                                            const noise = (((i * 1103515245) + clip.id) % 100) / 100;
                                            const amplitude = isVocals ? (phrase * 0.7 + noise * 0.3) : (Math.exp(-((t % 0.25) * 20)) * 0.8 + noise * 0.2);
                                            const y = amplitude * 45 * vol;
                                            pts.push(`${(t * 100).toFixed(1)},${(50 - y).toFixed(1)}`);
                                        }
                                        for (let i = res; i >= 0; i--) {
                                            const t = i / res;
                                            const phrase = Math.max(0, Math.sin(t * Math.PI * (clip.id % 4 + 2)));
                                            const noise = (((i * 1103515245) + clip.id) % 100) / 100;
                                            const amplitude = isVocals ? (phrase * 0.7 + noise * 0.3) : (Math.exp(-((t % 0.25) * 20)) * 0.8 + noise * 0.2);
                                            const y = amplitude * 45 * vol;
                                            pts.push(`${(t * 100).toFixed(1)},${(50 + y).toFixed(1)}`);
                                        }
                                        return pts.join(' ');
                                      })()} 
                                    />
                                  </svg>
                                  )
                                ) : (
                                  clip.notes ? clip.notes.map(n => (
                                    <div key={n.id} className="absolute bg-white rounded-[2px] shadow-sm border border-black/30" style={{ bottom: `${Math.max(5, Math.min(80, ((n.pitch - 36) / 36) * 100))}%`, left: `${(n.start / clipDuration) * 100}%`, width: `${(n.duration / clipDuration) * 100}%`, height: '15%', opacity: Math.max(0.2, (n.velocity ?? 100) / 127) }} />
                                  )) : null
                                )}
                              </div>
                              
                              <div className="absolute top-0 left-0 right-0 h-5 bg-black/20 flex items-center px-2 text-[10px] text-white/90 font-medium truncate pointer-events-none border-b border-black/10">
                                 {clip.isRecording ? 'RECORDING...' : track.name}
                              </div>
                              {!clip.isRecording && (
                                <>
                                  <div data-edge="true" onMouseDown={(e) => handleClipEdgeMouseDown(e, track.id, clip, 'left')} className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize z-30 hover:bg-white/30" title="Drag to resize" />
                                  <div data-edge="true" onMouseDown={(e) => handleClipEdgeMouseDown(e, track.id, clip, 'right')} className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize z-30 hover:bg-white/30" title="Drag to resize" />
                                </>
                              )}
                            </div>
                          )})}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* --- BOTTOM DOCK PANELS --- */}
            {bottomDock?.type === 'devices' && (() => {
              const track = tracks.find(t => t.id === bottomDock.trackId);
              if (!track) return null;
              return (
                <div className="h-[35vh] bg-neutral-900 border-t border-neutral-800 flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-40 shrink-0">
                  <div className="h-10 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-4 shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-sm ${track.color}`} />
                        <span className="text-xs font-semibold text-white">{track.name} - Device Rack</span>
                      </div>
                    </div>
                    <button onClick={() => setBottomDock(null)} className="p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors" title="Close Rack"><X size={16} /></button>
                  </div>
                  <div className="flex-1 flex overflow-x-auto p-4 gap-4 bg-neutral-950 custom-scrollbar items-center relative">
                     {/* Audio Source / Instrument */}
                     <div className="w-56 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col overflow-hidden shrink-0 shadow-sm h-full max-h-48">
                       <div className="h-8 bg-neutral-800/50 border-b border-neutral-800 flex items-center justify-between px-3">
                         <span className="font-semibold text-xs text-white">Source Generator</span>
                       </div>
                       <div className="p-4 flex-1 flex flex-col items-center justify-center text-neutral-500">
                         {track.type === 'midi' ? (
                           track.instrument && track.instrument.includes('drum') ? <Radio size={24} className="mb-2 opacity-50"/> : <Music size={24} className="mb-2 opacity-50"/>
                         ) : (
                           <Mic size={24} className="mb-2 opacity-50"/>
                         )}
                         
                         {track.type === 'midi' ? (
                           <>
                             <select 
                               value={track.instrument || 'inst-subtractive'}
                               onChange={(e) => handleInstrumentChange(track.id, e.target.value)}
                               className="bg-neutral-800 text-xs text-white px-2 py-1.5 rounded-lg border border-neutral-700 outline-none hover:border-neutral-500 cursor-pointer max-w-full"
                             >
                               <optgroup label="Internal Synths & Samplers">
                                 {INTERNAL_PLUGINS.filter(p => p.category === 'instrument').map(inst => (
                                     <option key={inst.id} value={inst.id}>{inst.name}</option>
                                 ))}
                               </optgroup>
                               <optgroup label="Downloaded WAMs">
                                 {vstLibrary.filter(v => v.category === 'instrument').map(vst => (
                                   <option key={vst.id} value={vst.id} disabled={vstStatus[vst.id] === 'error'}>
                                     {vst.name} {vstStatus[vst.id] === 'error' ? '(Offline)' : ''}
                                   </option>
                                 ))}
                               </optgroup>
                             </select>
                           </>
                         ) : (
                           <span className="text-xs">Audio Clip Input</span>
                         )}
                       </div>
                     </div>
                     
                     {/* Dynamic VST Effects Chain */}
                     {track.effects?.map((fx, idx) => {
                       const isNative = INTERNAL_PLUGINS.some(p => p.type === fx.type);
                       return (
                       <div key={fx.id} className="w-56 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col overflow-hidden shrink-0 shadow-sm h-full max-h-48 relative group">
                         {/* Chain flow indicator */}
                         <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-neutral-700" />
                         
                         <div className="h-8 bg-neutral-800/50 border-b border-neutral-800 flex items-center justify-between px-3">
                            <span onContextMenu={(e) => handleContextMenu(e, 'effect', { trackId: track.id, fxId: fx.id })} className="font-semibold text-xs text-white flex items-center gap-1.5 truncate pr-2 cursor-context-menu"><Activity size={10} className="text-blue-400 shrink-0"/> {fx.name || fx.type}</span>
                            <div className="flex items-center gap-1 shrink-0">
                               <button onClick={() => handleOpenPlugin(track.id, true, fx.id)} className="text-neutral-400 hover:text-white p-0.5" title="Open Effect GUI"><Maximize2 size={12}/></button>
                               <button className="text-green-400 hover:text-green-300 p-0.5"><Power size={12}/></button>
                               <button onClick={() => handleRemoveEffect(track.id, fx.id)} className="text-neutral-500 hover:text-red-400 p-0.5"><Trash2 size={12}/></button>
                            </div>
                         </div>
                         <div className="p-4 flex-1 grid grid-cols-2 gap-y-4 gap-x-4">
                            {Object.entries(fx.params).map(([key, value]) => {
                               let min = 0, max = 1, step = 0.01;
                               if (key === 'freq') { min = 20; max = 20000; step = 1; }
                               else if (key === 'time') { max = 2; }
                               else if (key === 'amount') { max = 100; step = 1; }
                               else if (key === 'res') { max = 10; }
                               else if (key === 'decay') { max = 10; }
                               else if (key === 'rate') { max = 20; step = 0.1; }
                               else if (key === 'depth') { max = 1; step = 0.01; }
                               else if (key === 'threshold') { min = -60; max = 0; step = 1; }
                               else if (key === 'ratio') { min = 1; max = 20; step = 0.1; }
                               else if (key === 'bitDepth') { min = 2; max = 16; step = 1; }
                               else if (key === 'low' || key === 'mid' || key === 'high') { min = -24; max = 24; step = 0.5; }

                               return (
                               <div key={key} className="flex flex-col items-center">
                                 <span className="text-[9px] text-neutral-400 uppercase mb-2 font-mono tracking-wider truncate w-full text-center">{key}</span>
                                 <input 
                                   type="range" 
                                   min={min} max={max} step={step}
                                   value={value} 
                                   onChange={(e) => handleEffectParamChange(track.id, fx.id, key, e.target.value)}
                                   className="w-full h-1 bg-neutral-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-white cursor-pointer"
                                 />
                                 <span className="text-[8px] text-neutral-600 font-mono mt-1">{value}</span>
                               </div>
                            )})}
                         </div>
                       </div>
                     )})}
                     
                     {/* Add Effect Interactive Dropdown */}
                     <div className="relative shrink-0 h-full max-h-48 ml-2 flex flex-col">
                        <div onClick={() => setShowAddFxMenu(showAddFxMenu === track.id ? null : track.id)} className="w-32 flex-1 border border-dashed border-neutral-700 rounded-xl flex flex-col items-center justify-center text-neutral-500 hover:text-white hover:border-neutral-500 hover:bg-neutral-800/30 transition-all cursor-pointer">
                           <Plus size={20} className="mb-2" />
                           <span className="text-xs font-medium">Add Effect</span>
                        </div>
                        {showAddFxMenu === track.id && (
                           <>
                             {/* Transparent overlay to capture click outside */}
                             <div className="fixed inset-0 z-40" onClick={() => setShowAddFxMenu(null)} />
                             <div className="absolute bottom-full mb-2 left-0 w-56 bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-150">
                               
                               <div className="px-3 py-2 bg-neutral-900 border-b border-neutral-700 text-xs font-semibold text-neutral-400 flex items-center gap-2">
                                  <Folder size={12} /> Native Effects
                               </div>
                               <div className="max-h-32 overflow-y-auto custom-scrollbar border-b border-neutral-700">
                                 {INTERNAL_PLUGINS.filter(v => v.category === 'effect').map(fx => (
                                    <button 
                                      key={fx.id} 
                                      onClick={() => { handleAddEffect(track.id, fx); setShowAddFxMenu(null); }} 
                                      className="w-full text-left px-3 py-2.5 text-xs text-white hover:bg-blue-600 transition-colors border-b border-neutral-700/50 last:border-0 flex items-center justify-between"
                                    >
                                       <span className="font-medium">{fx.name}</span>
                                       <span className="text-[9px] text-neutral-400 block">{fx.vendor}</span>
                                    </button>
                                 ))}
                               </div>

                               <div className="px-3 py-2 bg-neutral-900 border-b border-neutral-700 text-xs font-semibold text-neutral-400 flex items-center gap-2">
                                  <Folder size={12} /> WAM Plugins
                               </div>
                               <div className="max-h-32 overflow-y-auto custom-scrollbar">
                                 {vstLibrary.filter(v => v.category === 'effect').map(vst => (
                                    <button 
                                      key={vst.id}
                                      disabled={vstStatus[vst.id] === 'error' || vstStatus[vst.id] === 'loading'}
                                      onClick={() => { handleAddEffect(track.id, vst); setShowAddFxMenu(null); }} 
                                      className={`w-full text-left px-3 py-2.5 text-xs text-white transition-colors border-b border-neutral-700/50 last:border-0 flex items-center justify-between ${vstStatus[vst.id] === 'error' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                                    >
                                       <span className="font-medium">{vst.name} {vstStatus[vst.id] === 'error' && '(Offline)'}</span>
                                       <span className="text-[9px] text-neutral-400 block">{vst.vendor}</span>
                                    </button>
                                 ))}
                               </div>
                             </div>
                           </>
                        )}
                     </div>
                  </div>
                </div>
              )
            })()}

            {bottomDock?.type === 'audio-editor' && (() => {
              const track = tracks.find(t => t.id === bottomDock.trackId);
              if (!track) return null;
              return (
                  <div className="h-[40vh] bg-neutral-900 border-t border-neutral-800 flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-40 shrink-0">
                    <div className="h-10 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-4 shrink-0">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-sm ${track.color}`} />
                          <span className="text-xs font-semibold text-white">{track.name} - Audio Editor (Spectral View)</span>
                        </div>
                        <div className="w-px h-4 bg-neutral-800" />
                        <button className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-400 hover:text-white transition-colors rounded hover:bg-neutral-800">
                           <Activity size={12} /><span>Live Master Output FFT</span>
                        </button>
                      </div>
                      <button onClick={() => setBottomDock(null)} className="p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors" title="Close Editor"><X size={16} /></button>
                    </div>
                    <div className="flex-1 p-4 flex flex-col items-center justify-center relative overflow-hidden bg-neutral-950">
                       <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent)', backgroundSize: '50px 50px' }} />
                       <div className="w-full max-w-4xl h-full flex items-end justify-center pb-4 z-10"><canvas id="spectral-canvas" className="w-full h-full opacity-90" /></div>
                    </div>
                  </div>
              )
            })()}
            
            {bottomDock?.type === 'piano-roll' && (() => {
              const track = tracks.find(t => t.id === bottomDock.trackId);
              const clip = track?.clips.find(c => c.id === bottomDock.clipId);
              if (!clip) return null;
              
              const pitches = [];
              for(let p = PITCH_MAX; p >= PITCH_MIN; p--) pitches.push(p);

              const maxNoteEnd = clip.notes?.reduce((max, n) => Math.max(max, n.start + n.duration), 0) || 0;
              const pianoRollDuration = Math.max(clip.duration, maxNoteEnd);

              return (
                <div className="h-[40vh] bg-neutral-900 border-t border-neutral-800 flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-40 shrink-0">
                  <div className="h-10 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-4 shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-sm ${track.color}`} />
                        <span className="text-xs font-semibold text-white">{track.name} - Clip Editor</span>
                      </div>
                      <div className="w-px h-4 bg-neutral-800" />
                      <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
                        <button onClick={() => setEditorTool('select')} className={`p-1.5 rounded-md transition-colors ${editorTool === 'select' ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Select / Move (Hold Ctrl for Free Drag)"><MousePointer2 size={14} /></button>
                        <button onClick={() => setEditorTool('draw')} className={`p-1.5 rounded-md transition-colors ${editorTool === 'draw' ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Draw Notes"><Pencil size={14} /></button>
                        <button onClick={() => setEditorTool('velocity')} className={`p-1.5 rounded-md transition-colors ${editorTool === 'velocity' ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Velocity (Drag Up/Down on Note)"><Activity size={14} /></button>
                        <button onClick={() => setEditorTool('erase')} className={`p-1.5 rounded-md transition-colors ${editorTool === 'erase' ? 'bg-red-500/20 text-red-400' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Erase"><Eraser size={14} /></button>
                      </div>
                      <div className="w-px h-4 bg-neutral-800" />
                      <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-400 rounded-lg bg-neutral-900 border border-neutral-800">
                         <Grid size={12} />
                         <select value={snapGrid} onChange={e => { setSnapGrid(Number(e.target.value)); showToast(`Snap changed to ${e.target.options[e.target.selectedIndex].text}`); }} className="bg-transparent outline-none cursor-pointer text-white">
                            <option value={1}>1/4 Note Snap</option>
                            <option value={0.5}>1/8 Note Snap</option>
                            <option value={0.25}>1/16 Note Snap</option>
                            <option value={0.125}>1/32 Note Snap</option>
                         </select>
                      </div>
                    </div>
                    <button onClick={() => setBottomDock(null)} className="p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors" title="Close Editor"><X size={16} /></button>
                  </div>

                  <div className="flex-1 flex overflow-hidden relative bg-neutral-950">
                    <div className="w-16 flex flex-col shrink-0 bg-neutral-950 border-r border-neutral-800 z-20">
                       <div className="h-8 border-b border-neutral-800 shrink-0 bg-neutral-950" />
                       <div ref={pianoKeysRef} className="flex-1 overflow-y-hidden custom-scrollbar-hide">
                          <div style={{ height: `${pitches.length * PITCH_HEIGHT}px` }}>
                             {pitches.map(p => {
                                const isBlack = [1, 3, 6, 8, 10].includes(p % 12);
                                return <div key={p} className={`border-b border-neutral-900 ${isBlack ? 'bg-neutral-950 text-neutral-600' : 'bg-neutral-200 text-neutral-800'} text-[9px] font-bold flex items-center justify-end pr-1 select-none`} style={{height: `${PITCH_HEIGHT}px`}}>{p % 12 === 0 ? `C${Math.floor(p/12)-2}` : ''}</div>
                             })}
                          </div>
                       </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col overflow-hidden relative">
                       <div ref={pianoRulerRef} className="h-8 bg-neutral-950 border-b border-neutral-800 shrink-0 overflow-x-hidden sticky top-0 z-40">
                         <div className="relative min-w-max h-full bg-neutral-900 border-r border-neutral-700" style={{ width: `${pianoRollDuration * BEAT_WIDTH}px` }}>
                            {Array.from({ length: Math.ceil(pianoRollDuration) }).map((_, i) => {
                               const isBar = i % 4 === 0;
                               return (
                                 <div key={i} className={`absolute top-0 bottom-0 flex items-end border-l ${isBar ? 'border-neutral-600' : 'border-neutral-800/50'} pl-1 text-[10px] ${isBar ? 'text-neutral-400 font-bold' : 'text-neutral-600'} font-mono select-none`} style={{ left: `${i * BEAT_WIDTH}px`, width: `${BEAT_WIDTH}px` }}>
                                    {isBar ? (i / 4) + 1 : `.${(i % 4) + 1}`}
                                 </div>
                               );
                            })}
                         </div>
                       </div>
                       
                       <div className={`flex-1 overflow-auto relative custom-scrollbar ${editorTool === 'draw' ? 'cursor-crosshair' : editorTool === 'erase' ? 'cursor-cell' : editorTool === 'velocity' ? 'cursor-ns-resize' : 'cursor-text'}`} onScroll={handlePianoScroll}>
                          <div className="relative min-w-max bg-neutral-900 border-r border-neutral-700 shadow-[4px_0_15px_rgba(0,0,0,0.5)]" style={{ height: `${pitches.length * PITCH_HEIGHT}px`, width: `${pianoRollDuration * BEAT_WIDTH}px`}} onMouseDown={(e) => handleGridMouseDown(e, track.id, clip.id)}>
                            
                            {isPlaying && currentTime >= clip.start && currentTime <= clip.start + clip.duration && (
                               <div className="absolute top-0 bottom-0 w-[2px] bg-white z-40 pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.8)]" style={{ left: `${(currentTime - clip.start) * BEAT_WIDTH}px` }} />
                            )}

                            {pitches.map((p, i) => {
                               const isBlack = [1, 3, 6, 8, 10].includes(p % 12);
                               return <div key={p} className={`absolute left-0 right-0 border-b pointer-events-none ${isBlack ? 'bg-neutral-900/40 border-neutral-800/50' : 'bg-transparent border-neutral-800/20'}`} style={{top: `${i * PITCH_HEIGHT}px`, height: `${PITCH_HEIGHT}px`}} />
                            })}
                            
                            {/* Dynamic Grid Lines based on Snap - FIXED to border-l for exact alignment */}
                            {Array.from({length: Math.ceil(pianoRollDuration / (snapGrid || 0.25))}).map((_, i) => {
                               const snap = snapGrid || 0.25;
                               const isBar = (i * snap) % 4 === 0;
                               const isBeat = (i * snap) % 1 === 0;
                               return (
                                 <div key={i} className={`absolute top-0 bottom-0 border-l pointer-events-none ${isBar ? 'border-neutral-600/80 z-10' : isBeat ? 'border-neutral-700/50 z-0' : 'border-neutral-800/30 z-0'}`} style={{left: `${i * snap * BEAT_WIDTH}px`, width: `${snap * BEAT_WIDTH}px`}} />
                               )
                            })}
                            
                            {/* Note Rendering - Enhanced with gradients and shadows */}
                            {clip.notes?.map(note => {
                               const isSelected = selectedNotes && selectedNotes.includes(note.id);
                               const velocity = note.velocity ?? 100;
                               const opacity = Math.max(0.15, velocity / 127);
                               
                               return (
                               <div key={note.id} onMouseDown={(e) => handleNoteMouseDown(e, track.id, clip.id, note)}
                                 onContextMenu={(e) => handleContextMenu(e, 'note', { trackId: track.id, clipId: clip.id, noteId: note.id })}
                                 className={`absolute rounded-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.5)] border ${isSelected ? 'border-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]' : 'border-black/50'} bg-gradient-to-b from-white to-neutral-300 hover:brightness-125 transition-all ${draggingNote?.noteId === note.id ? 'z-50' : 'z-20'}`}
                                 style={{ 
                                   left: `${note.start * BEAT_WIDTH}px`, 
                                   top: `${(PITCH_MAX - note.pitch) * PITCH_HEIGHT}px`, 
                                   width: `${note.duration * BEAT_WIDTH}px`, 
                                   height: `${PITCH_HEIGHT - 1}px`, 
                                   opacity: isSelected ? 1 : opacity, 
                                   transition: draggingNote?.noteId === note.id ? 'none' : 'left 0.1s, top 0.1s' 
                                 }}
                               >
                                 <div data-edge="right" className="absolute right-0 top-0 bottom-0 w-1.5 cursor-e-resize hover:bg-black/20 z-30 rounded-r-[3px]" />
                               </div>
                            )})}
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <footer className="h-6 bg-blue-600 flex items-center justify-between px-4 text-[10px] text-white font-medium tracking-wide shrink-0 z-40">
        <div className="flex gap-4">
          <span>SAMPLE RATE: 44.1kHz</span>
          <span>BUFFER: 256smp</span>
        </div>
        <div className="flex items-center gap-2"><span className="flex items-center gap-1"><Maximize2 size={10} /> Sync: Connected to 'Studio-A'</span></div>
      </footer>

      {/* --- Unified Plugin GUI Modal --- */}
      {openPluginUI && (() => {
        const track = tracks.find(t => t.id === openPluginUI.trackId);
        if (!track) return null;
        
        let pluginName = '';
        let isNative = false;
        let pData = null;
        let activeWamInstance = null;
        let activeWamError = null;

        if (openPluginUI.isEffect) {
          pData = track.effects.find(e => e.id === openPluginUI.fxId);
          isNative = INTERNAL_PLUGINS.some(p => p.type === pData.type);
          if (isNative) {
             pluginName = INTERNAL_PLUGINS.find(p => p.type === pData.type).name;
          } else {
             pluginName = pData.name || pData.type;
             const nodeData = synthsRef.current[track.id]?.fxNodes[openPluginUI.fxId];
             activeWamInstance = nodeData?.instance;
             activeWamError = nodeData?.error;
          }
        } else {
          isNative = track.instrument.startsWith('inst-');
          if (isNative) {
             pluginName = INTERNAL_PLUGINS.find(p => p.id === track.instrument)?.name || 'Core Synth';
             pData = { params: track.instrumentParams };
          } else {
             pluginName = vstLibrary.find(v => v.id === track.instrument)?.name || 'WAM Synth';
             activeWamInstance = synthsRef.current[track.id]?.wamInstance;
             activeWamError = synthsRef.current[track.id]?.wamError;
          }
        }
        
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-800 border border-neutral-600 rounded-2xl w-[700px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              
              <div className="h-10 bg-neutral-900 border-b border-neutral-700 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]" title="Plugin Active" />
                  <span className="text-sm font-bold text-neutral-200 tracking-wide uppercase">{pluginName}</span>
                  <span className="bg-neutral-800 px-1.5 py-0.5 rounded text-[9px] text-neutral-400 border border-neutral-700 ml-1">
                    {isNative ? (openPluginUI.isEffect ? 'CORE EFFECT' : 'CORE SYNTH') : (openPluginUI.isEffect ? 'WAM EFFECT' : 'WAM SYNTH')}
                  </span>
                </div>
                <button onClick={() => setOpenPluginUI(null)} className="text-neutral-400 hover:text-white transition-colors"><X size={16} /></button>
              </div>
              
              <div className="flex flex-col min-h-[400px] h-full bg-neutral-950">
                {openPluginUI.loading ? (
                   <div className="flex-1 flex flex-col items-center justify-center">
                     <Cpu size={32} className="text-blue-500 animate-pulse mb-4" />
                     <span className="text-sm font-mono text-neutral-300">Initializing Audio Engine...</span>
                     <span className="text-[10px] font-mono text-neutral-500 mt-2">Compiling modules</span>
                   </div>
                ) : !isNative ? (
                   <WamHostWrapper pluginName={pluginName} wamInstance={activeWamInstance} wamError={activeWamError} />
                ) : openPluginUI.isEffect ? (
                  <div className="flex-1 bg-neutral-950/50 p-6 flex flex-col">
                    <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-8 text-center">{pluginName} Parameters</h4>
                    <div className="grid grid-cols-3 gap-8 flex-1 content-start">
                       {Object.keys(pData.params).map(key => {
                           let min = 0, max = 1, step = 0.01;
                           if (key === 'freq') { min = 20; max = 20000; step = 1; }
                           else if (key === 'time') { max = 2; }
                           else if (key === 'amount') { max = 100; step = 1; }
                           else if (key === 'res') { max = 10; }
                           else if (key === 'decay') { max = 10; }
                           else if (key === 'rate') { max = pData.type === 'autopan' ? 20 : 10; }
                           else if (key === 'depth') { max = pData.type === 'autopan' ? 1 : 0.02; step = pData.type === 'autopan' ? 0.01 : 0.001; }
                           else if (key === 'threshold') { min = -60; max = 0; step = 1; }
                           else if (key === 'ratio') { min = 1; max = 20; step = 0.1; }
                           else if (key === 'bitDepth') { min = 2; max = 16; step = 1; }
                           else if (key === 'low' || key === 'mid' || key === 'high') { min = -24; max = 24; step = 0.5; }
                           
                           return (
                             <div key={key} className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-4 rounded-xl shadow-inner">
                               <span className="text-[11px] text-white uppercase mb-4 font-mono tracking-wider">{key}</span>
                               <input 
                                 type="range" min={min} max={max} step={step} value={pData.params[key] || 0} 
                                 onChange={(e) => handleEffectParamChange(track.id, openPluginUI.fxId, key, e.target.value)}
                                 className="w-full h-2 bg-neutral-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-white cursor-pointer transition-all"
                               />
                               <span className="text-[10px] text-blue-400 font-mono mt-3 font-bold bg-black/50 px-2 py-1 rounded w-full text-center">{pData.params[key]}</span>
                             </div>
                           )
                       })}
                    </div>
                  </div>
                ) : track.instrument === 'inst-subtractive' ? (
                  <div className="flex gap-6 h-full p-6 bg-gradient-to-b from-neutral-800 to-neutral-900">
                    <div className="flex-1 bg-neutral-950/50 rounded-xl border border-neutral-700/50 p-4 flex flex-col items-center shadow-inner">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4">VCO Oscillator</h4>
                       <select 
                         value={track.instrumentParams?.oscType || 'sawtooth'} 
                         onChange={(e) => handleInstrumentParamChange(track.id, 'oscType', e.target.value)}
                         className="bg-neutral-800 border border-neutral-600 text-white text-sm rounded-lg px-3 py-2 outline-none cursor-pointer w-full mb-4"
                       >
                         <option value="sawtooth">Sawtooth</option>
                         <option value="square">Square Wave</option>
                         <option value="sine">Sine Wave</option>
                         <option value="triangle">Triangle</option>
                       </select>
                       <div className="mt-auto w-full h-16 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center justify-center overflow-hidden">
                         <svg className="w-full h-8 text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" viewBox="0 0 100 20" preserveAspectRatio="none">
                           {track.instrumentParams?.oscType === 'sawtooth' && <polyline fill="none" stroke="currentColor" strokeWidth="2" points="0,20 50,0 50,20 100,0" />}
                           {(!track.instrumentParams?.oscType || track.instrumentParams?.oscType === 'square') && <polyline fill="none" stroke="currentColor" strokeWidth="2" points="0,0 50,0 50,20 100,20" />}
                           {track.instrumentParams?.oscType === 'sine' && <path fill="none" stroke="currentColor" strokeWidth="2" d="M0,10 Q25,-10 50,10 T100,10" />}
                           {track.instrumentParams?.oscType === 'triangle' && <polyline fill="none" stroke="currentColor" strokeWidth="2" points="0,10 25,0 75,20 100,10" />}
                         </svg>
                       </div>
                    </div>
                    
                    <div className="flex-1 bg-neutral-950/50 rounded-xl border border-neutral-700/50 p-4 flex flex-col items-center justify-between shadow-inner">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4">VCF Filter</h4>
                       <div className="w-full flex flex-col gap-6">
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-3 rounded-lg">
                           <span className="text-[9px] text-neutral-400 mb-2">CUTOFF ({track.instrumentParams?.cutoff || 2000}Hz)</span>
                           <input type="range" min="100" max="8000" value={track.instrumentParams?.cutoff || 2000} onChange={(e) => handleInstrumentParamChange(track.id, 'cutoff', Number(e.target.value))} className="w-full h-1.5 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                         </div>
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-3 rounded-lg">
                           <span className="text-[9px] text-neutral-400 mb-2">RESONANCE</span>
                           <input type="range" min="0.1" max="10" step="0.1" value={track.instrumentParams?.res || 1.5} onChange={(e) => handleInstrumentParamChange(track.id, 'res', Number(e.target.value))} className="w-full h-1.5 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                         </div>
                       </div>
                    </div>

                    <div className="flex-1 bg-neutral-950/50 rounded-xl border border-neutral-700/50 p-4 flex flex-col items-center justify-between shadow-inner">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4">Envelope</h4>
                       <div className="w-full flex flex-col gap-6">
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-3 rounded-lg">
                           <span className="text-[9px] text-neutral-400 mb-2">ATTACK</span>
                           <input type="range" min="0.001" max="2" step="0.01" value={track.instrumentParams?.attack || 0.01} onChange={(e) => handleInstrumentParamChange(track.id, 'attack', Number(e.target.value))} className="w-full h-1.5 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                         </div>
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-3 rounded-lg">
                           <span className="text-[9px] text-neutral-400 mb-2">RELEASE</span>
                           <input type="range" min="0.01" max="5" step="0.01" value={track.instrumentParams?.release || 0.2} onChange={(e) => handleInstrumentParamChange(track.id, 'release', Number(e.target.value))} className="w-full h-1.5 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                         </div>
                       </div>
                    </div>
                  </div>
                ) : track.instrument === 'inst-fm' ? (
                  <div className="flex gap-6 h-full p-6 bg-gradient-to-b from-neutral-800 to-neutral-900">
                    <div className="flex-1 bg-neutral-950/50 rounded-xl border border-neutral-700/50 p-4 flex flex-col items-center justify-between shadow-inner">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4">Operator Engine</h4>
                       <div className="w-full flex flex-col gap-6">
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-4 rounded-lg text-center">
                           <span className="text-[11px] text-white mb-2">FM RATIO</span>
                           <input type="range" min="0.5" max="10" step="0.01" value={track.instrumentParams?.ratio || 2} onChange={(e) => handleInstrumentParamChange(track.id, 'ratio', Number(e.target.value))} className="w-full h-2 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-teal-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                           <span className="text-[10px] font-mono mt-2 text-teal-400">{track.instrumentParams?.ratio || 2} : 1</span>
                         </div>
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-4 rounded-lg text-center">
                           <span className="text-[11px] text-white mb-2">MOD INDEX (DEPTH)</span>
                           <input type="range" min="0" max="20" step="0.1" value={track.instrumentParams?.modIndex || 5} onChange={(e) => handleInstrumentParamChange(track.id, 'modIndex', Number(e.target.value))} className="w-full h-2 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-teal-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                           <span className="text-[10px] font-mono mt-2 text-teal-400">{track.instrumentParams?.modIndex || 5}</span>
                         </div>
                       </div>
                    </div>
                    <div className="flex-1 bg-neutral-950/50 rounded-xl border border-neutral-700/50 p-4 flex flex-col items-center justify-between shadow-inner">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4">Amplifier Envelope</h4>
                       <div className="w-full flex flex-col gap-6">
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-3 rounded-lg">
                           <span className="text-[9px] text-neutral-400 mb-2">ATTACK</span>
                           <input type="range" min="0.001" max="2" step="0.01" value={track.instrumentParams?.attack || 0.01} onChange={(e) => handleInstrumentParamChange(track.id, 'attack', Number(e.target.value))} className="w-full h-1.5 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-teal-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                         </div>
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-3 rounded-lg">
                           <span className="text-[9px] text-neutral-400 mb-2">RELEASE</span>
                           <input type="range" min="0.01" max="5" step="0.01" value={track.instrumentParams?.release || 0.2} onChange={(e) => handleInstrumentParamChange(track.id, 'release', Number(e.target.value))} className="w-full h-1.5 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-teal-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                         </div>
                       </div>
                    </div>
                  </div>
                ) : track.instrument === 'inst-supersaw' ? (
                  <div className="flex gap-6 h-full p-6 bg-gradient-to-b from-neutral-800 to-neutral-900">
                    <div className="flex-1 bg-neutral-950/50 rounded-xl border border-neutral-700/50 p-4 flex flex-col items-center justify-between shadow-inner">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4">Supersaw Engine</h4>
                       <div className="w-full flex flex-col gap-6">
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-4 rounded-lg text-center">
                           <span className="text-[11px] text-white mb-2">DETUNE SPREAD (cents)</span>
                           <input type="range" min="0" max="100" step="1" value={track.instrumentParams?.detune || 25} onChange={(e) => handleInstrumentParamChange(track.id, 'detune', Number(e.target.value))} className="w-full h-2 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                           <span className="text-[10px] font-mono mt-2 text-blue-400">{track.instrumentParams?.detune || 25}</span>
                         </div>
                       </div>
                    </div>
                    <div className="flex-1 bg-neutral-950/50 rounded-xl border border-neutral-700/50 p-4 flex flex-col items-center justify-between shadow-inner">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4">Amplifier Envelope</h4>
                       <div className="w-full flex flex-col gap-6">
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-3 rounded-lg">
                           <span className="text-[9px] text-neutral-400 mb-2">ATTACK (s)</span>
                           <input type="range" min="0.001" max="2" step="0.01" value={track.instrumentParams?.attack || 0.05} onChange={(e) => handleInstrumentParamChange(track.id, 'attack', Number(e.target.value))} className="w-full h-1.5 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                         </div>
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-3 rounded-lg">
                           <span className="text-[9px] text-neutral-400 mb-2">RELEASE (s)</span>
                           <input type="range" min="0.01" max="5" step="0.01" value={track.instrumentParams?.release || 0.5} onChange={(e) => handleInstrumentParamChange(track.id, 'release', Number(e.target.value))} className="w-full h-1.5 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                         </div>
                       </div>
                    </div>
                  </div>
                ) : track.instrument === 'inst-pluck' ? (
                  <div className="flex gap-6 h-full p-6 bg-gradient-to-b from-neutral-800 to-neutral-900">
                    <div className="flex-1 bg-neutral-950/50 rounded-xl border border-neutral-700/50 p-4 flex flex-col items-center justify-between shadow-inner">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4">Physical Modeling (Karplus-Strong)</h4>
                       <div className="w-full flex flex-col gap-6">
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-4 rounded-lg text-center">
                           <span className="text-[11px] text-white mb-2">DAMPING (Hz)</span>
                           <input type="range" min="500" max="10000" step="10" value={track.instrumentParams?.damping || 4000} onChange={(e) => handleInstrumentParamChange(track.id, 'damping', Number(e.target.value))} className="w-full h-2 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-orange-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                           <span className="text-[10px] font-mono mt-2 text-orange-400">{track.instrumentParams?.damping || 4000}</span>
                         </div>
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-4 rounded-lg text-center">
                           <span className="text-[11px] text-white mb-2">DECAY (Feedback Ring)</span>
                           <input type="range" min="0.8" max="0.99" step="0.01" value={track.instrumentParams?.decay || 0.95} onChange={(e) => handleInstrumentParamChange(track.id, 'decay', Number(e.target.value))} className="w-full h-2 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-orange-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                           <span className="text-[10px] font-mono mt-2 text-orange-400">{track.instrumentParams?.decay || 0.95}</span>
                         </div>
                       </div>
                    </div>
                  </div>
                ) : track.instrument === 'inst-acid' ? (
                  <div className="flex gap-6 h-full p-6 bg-gradient-to-b from-neutral-800 to-neutral-900">
                    <div className="w-48 bg-neutral-950/50 rounded-xl border border-neutral-700/50 p-4 flex flex-col items-center shadow-inner">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4">Oscillator</h4>
                       <select 
                         value={track.instrumentParams?.oscType || 'square'} 
                         onChange={(e) => handleInstrumentParamChange(track.id, 'oscType', e.target.value)}
                         className="bg-neutral-800 border border-green-900 text-green-400 font-bold text-sm rounded-lg px-3 py-2 outline-none cursor-pointer w-full mb-4"
                       >
                         <option value="sawtooth">Sawtooth</option>
                         <option value="square">Square</option>
                       </select>
                    </div>
                    <div className="flex-1 bg-neutral-950/50 rounded-xl border border-neutral-700/50 p-4 flex flex-col items-center justify-between shadow-inner">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4 text-green-400">303 Squelch Filter</h4>
                       <div className="w-full flex gap-4 h-32">
                         <div className="flex-1 flex flex-col items-center bg-neutral-900 border border-neutral-800 p-2 rounded-lg">
                           <span className="text-[9px] text-neutral-400 mb-2">CUTOFF</span>
                           <input type="range" min="50" max="1000" orient="vertical" value={track.instrumentParams?.cutoff || 150} onChange={(e) => handleInstrumentParamChange(track.id, 'cutoff', Number(e.target.value))} className="w-full h-full bg-black rounded-full appearance-none cursor-pointer transition-all" style={{ WebkitAppearance: 'slider-vertical' }} />
                         </div>
                         <div className="flex-1 flex flex-col items-center bg-neutral-900 border border-neutral-800 p-2 rounded-lg">
                           <span className="text-[9px] text-neutral-400 mb-2">RES</span>
                           <input type="range" min="1" max="20" step="0.1" orient="vertical" value={track.instrumentParams?.res || 5} onChange={(e) => handleInstrumentParamChange(track.id, 'res', Number(e.target.value))} className="w-full h-full bg-black rounded-full appearance-none cursor-pointer transition-all" style={{ WebkitAppearance: 'slider-vertical' }} />
                         </div>
                         <div className="flex-1 flex flex-col items-center bg-neutral-900 border border-neutral-800 p-2 rounded-lg">
                           <span className="text-[9px] text-neutral-400 mb-2">ENV MOD</span>
                           <input type="range" min="0" max="5000" step="10" orient="vertical" value={track.instrumentParams?.envMod || 2500} onChange={(e) => handleInstrumentParamChange(track.id, 'envMod', Number(e.target.value))} className="w-full h-full bg-black rounded-full appearance-none cursor-pointer transition-all" style={{ WebkitAppearance: 'slider-vertical' }} />
                         </div>
                         <div className="flex-1 flex flex-col items-center bg-neutral-900 border border-neutral-800 p-2 rounded-lg">
                           <span className="text-[9px] text-neutral-400 mb-2">DECAY</span>
                           <input type="range" min="0.05" max="1.5" step="0.01" orient="vertical" value={track.instrumentParams?.decay || 0.3} onChange={(e) => handleInstrumentParamChange(track.id, 'decay', Number(e.target.value))} className="w-full h-full bg-black rounded-full appearance-none cursor-pointer transition-all" style={{ WebkitAppearance: 'slider-vertical' }} />
                         </div>
                       </div>
                    </div>
                  </div>
                ) : track.instrument === 'inst-organ' ? (
                  <div className="flex gap-6 h-full p-6 bg-gradient-to-b from-neutral-800 to-neutral-900">
                    <div className="flex-1 bg-neutral-950/50 rounded-xl border border-neutral-700/50 p-4 flex flex-col items-center justify-between shadow-inner">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4">Tonewheel Drawbars</h4>
                       <div className="w-full flex justify-center gap-6 h-32">
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-2 rounded-lg w-16">
                           <span className="text-[9px] text-neutral-400 mb-2 font-bold">16' (SUB)</span>
                           <input type="range" min="0" max="1" step="0.01" orient="vertical" value={track.instrumentParams?.sub || 0.8} onChange={(e) => handleInstrumentParamChange(track.id, 'sub', Number(e.target.value))} className="w-full h-full bg-black rounded-sm appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:rounded-none transition-all" style={{ WebkitAppearance: 'slider-vertical' }} />
                         </div>
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-2 rounded-lg w-16">
                           <span className="text-[9px] text-neutral-400 mb-2 font-bold">8' (FUND)</span>
                           <input type="range" min="0" max="1" step="0.01" orient="vertical" value={track.instrumentParams?.fund || 1.0} onChange={(e) => handleInstrumentParamChange(track.id, 'fund', Number(e.target.value))} className="w-full h-full bg-black rounded-sm appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-none transition-all" style={{ WebkitAppearance: 'slider-vertical' }} />
                         </div>
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-2 rounded-lg w-16">
                           <span className="text-[9px] text-neutral-400 mb-2 font-bold">5 1/3' (5th)</span>
                           <input type="range" min="0" max="1" step="0.01" orient="vertical" value={track.instrumentParams?.fifth || 0.6} onChange={(e) => handleInstrumentParamChange(track.id, 'fifth', Number(e.target.value))} className="w-full h-full bg-black rounded-sm appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:rounded-none transition-all" style={{ WebkitAppearance: 'slider-vertical' }} />
                         </div>
                         <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-2 rounded-lg w-16">
                           <span className="text-[9px] text-neutral-400 mb-2 font-bold">4' (OCT)</span>
                           <input type="range" min="0" max="1" step="0.01" orient="vertical" value={track.instrumentParams?.oct || 0.4} onChange={(e) => handleInstrumentParamChange(track.id, 'oct', Number(e.target.value))} className="w-full h-full bg-black rounded-sm appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-none transition-all" style={{ WebkitAppearance: 'slider-vertical' }} />
                         </div>
                       </div>
                    </div>
                  </div>
                ) : track.instrument === 'inst-sampler' ? (
                  <div className="flex gap-6 h-full p-6 bg-gradient-to-b from-neutral-800 to-neutral-900">
                     <div className="flex-1 bg-neutral-950/50 rounded-xl border border-neutral-700/50 p-4 flex flex-col justify-between shadow-inner">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4 text-center">Digital Sampler</h4>
                       
                       <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-neutral-700 rounded-xl bg-neutral-900 mx-4 mb-4 relative group overflow-hidden">
                           {track.instrumentParams?.sampleId && globalAudioBufferCache.has(track.instrumentParams.sampleId) ? (
                              <div className="absolute inset-0 flex items-center justify-center p-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <svg preserveAspectRatio="none" viewBox="0 0 100 100" className="w-full h-full text-blue-500 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]">
                                      {globalAudioBufferCache.get(track.instrumentParams.sampleId).peaks.map((p, i) => (
                                          <line key={i} x1={i} y1={50 - (p[1]*40)} x2={i} y2={50 - (p[0]*40)} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                      ))}
                                  </svg>
                              </div>
                           ) : (
                              <Activity size={48} className="text-neutral-700 absolute opacity-30 group-hover:opacity-50 transition-opacity" />
                           )}
                           
                           <label className="z-10 cursor-pointer bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider border border-neutral-600 shadow-lg transition-colors">
                              {track.instrumentParams?.sampleId ? 'Replace Sample' : 'Upload Audio File'}
                              <input type="file" accept="audio/*" hidden onChange={(e) => handleSampleUpload(e, track.id, 'sampleId')} />
                           </label>
                       </div>

                       {track.instrumentParams?.sampleId && globalAudioBufferCache.has(track.instrumentParams.sampleId) && (
                         <div className="px-4 mb-4 flex gap-4">
                            <div className="flex-1 flex flex-col items-center bg-neutral-900 border border-neutral-800 p-3 rounded-lg text-center">
                              <span className="text-[9px] text-white mb-2">TRIM START (s)</span>
                              <input type="range" min="0" max={globalAudioBufferCache.get(track.instrumentParams.sampleId).duration} step="0.01" value={track.instrumentParams?.sampleStart || 0} onChange={(e) => handleInstrumentParamChange(track.id, 'sampleStart', Number(e.target.value))} className="w-full h-1.5 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                            </div>
                            <div className="flex-1 flex flex-col items-center bg-neutral-900 border border-neutral-800 p-3 rounded-lg text-center">
                              <span className="text-[9px] text-white mb-2">TRIM END (s)</span>
                              <input type="range" min="0" max={globalAudioBufferCache.get(track.instrumentParams.sampleId).duration} step="0.01" value={track.instrumentParams?.sampleEnd || globalAudioBufferCache.get(track.instrumentParams.sampleId).duration} onChange={(e) => handleInstrumentParamChange(track.id, 'sampleEnd', Number(e.target.value))} className="w-full h-1.5 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                            </div>
                         </div>
                       )}

                       <div className="flex flex-col items-center bg-neutral-900 border border-neutral-800 p-4 rounded-lg text-center mx-4">
                           <span className="text-[11px] text-white mb-2">GLOBAL PITCH SHIFT</span>
                           <input type="range" min="0.1" max="4" step="0.01" value={track.instrumentParams?.pitchShift || 1} onChange={(e) => handleInstrumentParamChange(track.id, 'pitchShift', Number(e.target.value))} className="w-full h-2 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all" />
                           <span className="text-[10px] font-mono mt-2 text-purple-400">x{track.instrumentParams?.pitchShift || 1}</span>
                       </div>
                     </div>
                  </div>
                ) : (
                  <div className="flex gap-6 h-full p-6 bg-gradient-to-b from-neutral-800 to-neutral-900">
                     <div className="flex-1 bg-neutral-950/50 rounded-xl border border-neutral-700/50 p-4 flex flex-col min-w-0 shadow-inner">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4 text-center shrink-0">Drum Machine / Custom Sampler</h4>
                       <div className="flex gap-4 overflow-x-auto pb-4 w-full custom-scrollbar items-end h-full">
                         
                         {Object.entries(track.instrumentParams?.drumMap || DEFAULT_DRUM_MAP).map(([pitchStr, pad]) => {
                             const pitch = Number(pitchStr);
                             return (
                             <div key={pitch} className="flex flex-col items-center gap-3 w-28 shrink-0 relative group">
                               <button onClick={() => handleRemoveDrumPad(track.id, pitch)} className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-400 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"><X size={10} /></button>
                               <div className="text-[11px] font-bold text-white bg-neutral-800 px-2 py-1 rounded w-full text-center truncate shadow-sm">{pad.name}</div>
                               {!pad.sampleId ? (
                                   <div className="flex flex-col w-full h-24 items-center justify-end pb-2 bg-neutral-900/50 rounded-lg">
                                     <span className="text-[9px] text-neutral-500 font-mono mb-1">TUNE/DECAY</span>
                                     <input type="range" min="50" max="1000" orient="vertical" value={pad.tune || (pad.decay ? pad.decay * 1000 : 150)} onChange={(e) => handleDrumParamChange(track.id, pitch, pad.tune !== undefined ? 'tune' : 'decay', pad.tune !== undefined ? Number(e.target.value) : Number(e.target.value)/1000)} className="h-16 w-full appearance-none bg-transparent cursor-pointer relative z-10 transition-all" style={{ WebkitAppearance: 'slider-vertical' }} />
                                     <span className="text-[10px] text-orange-400 font-mono mt-1 font-bold">{pitch}</span>
                                   </div>
                               ) : (
                                   <div className="h-24 w-full flex flex-col justify-center items-center opacity-60 relative group bg-neutral-900/50 rounded-lg">
                                       <Activity size={24} className="text-blue-400" />
                                       <span className="text-[8px] mt-2 font-mono text-center">CUSTOM</span>
                                       <span className="text-[10px] font-mono mt-1 font-bold text-orange-400">{pitch}</span>
                                       <button onClick={() => handleDrumParamChange(track.id, pitch, 'sampleId', null)} className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-500 rounded opacity-0 group-hover:opacity-100 transition-colors"><X size={10} className="text-white"/></button>
                                   </div>
                               )}
                               <div className="flex gap-1 w-full justify-center">
                                   <div className="w-10 h-10 rounded-full bg-orange-500/20 border-2 border-orange-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.2)] mt-2 shrink-0 cursor-pointer hover:bg-orange-500/30 transition-colors" onMouseDown={() => { if(audioCtxRef.current) triggerDrum(audioCtxRef.current, synthsRef.current[track.id].inputBus, pitch, audioCtxRef.current.currentTime, 1, track.instrumentParams); }}><Radio size={16} className="text-orange-500"/></div>
                                   <label className="w-6 h-10 mt-2 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 rounded cursor-pointer border border-neutral-600 transition-colors" title="Upload Custom Audio">
                                      <span className="text-[8px] rotate-[-90deg] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">File</span>
                                      <input type="file" accept="audio/*" hidden onChange={(e) => handleDrumSampleUpload(e, track.id, pitch)} />
                                   </label>
                               </div>
                             </div>
                             );
                         })}

                         {/* Add Custom Pad Form */}
                         <div className="flex flex-col items-center gap-2 w-32 shrink-0 bg-neutral-900/50 p-3 rounded-xl border border-dashed border-neutral-700 justify-center h-48 ml-4">
                             <span className="text-[10px] font-bold text-neutral-400 text-center uppercase tracking-wider mb-2">Add Drum Pad</span>
                             <div className="w-full flex flex-col gap-1">
                               <label className="text-[8px] text-neutral-500">MIDI NOTE</label>
                               <select value={newPadPitch} onChange={e => setNewPadPitch(Number(e.target.value))} className="w-full bg-neutral-950 text-xs text-white p-1.5 rounded border border-neutral-800 outline-none hover:border-neutral-600 transition-colors">
                                  {Array.from({length: PITCH_MAX - PITCH_MIN + 1}).map((_, i) => {
                                     const p = PITCH_MIN + i;
                                     return <option key={p} value={p}>{p} - {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][p%12]}{Math.floor(p/12)-2}</option>
                                  })}
                               </select>
                             </div>
                             <div className="w-full flex flex-col gap-1 mt-1">
                               <label className="text-[8px] text-neutral-500">PAD NAME</label>
                               <input type="text" value={newPadName} onChange={e => setNewPadName(e.target.value)} className="w-full bg-neutral-950 text-xs text-white p-1.5 rounded border border-neutral-800 outline-none placeholder:text-neutral-700 focus:border-blue-500 transition-colors" placeholder="e.g. Laser Zap" />
                             </div>
                             <button onClick={() => { handleAddDrumPad(track.id); setNewPadName(''); }} className="w-full bg-neutral-800 hover:bg-neutral-700 text-[10px] text-white py-2 font-bold uppercase tracking-wider rounded mt-auto transition-colors border border-neutral-700">Add Pad</button>
                         </div>
                       </div>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- Context Menu --- */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div 
            className="fixed z-50 bg-neutral-800/95 backdrop-blur-md border border-neutral-700 rounded-xl shadow-2xl py-1 min-w-[160px] text-sm font-medium text-neutral-200 animate-in fade-in zoom-in-95 duration-100"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 160), top: Math.min(contextMenu.y, window.innerHeight - 200) }}
          >
            {contextMenu.type === 'clip' && (
               <>
                 <button onClick={(e) => { e.stopPropagation(); duplicateClip(contextMenu.payload.trackId, contextMenu.payload.clipId); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2"><Repeat size={14} /> Duplicate Clip</button>
                 <button onClick={(e) => { e.stopPropagation(); handleDeleteClip(e, contextMenu.payload.trackId, contextMenu.payload.clipId); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-2"><Trash2 size={14} /> Delete Clip</button>
               </>
            )}
            {contextMenu.type === 'note' && (
               <>
                 <button onClick={(e) => { e.stopPropagation(); deleteNote(contextMenu.payload.trackId, contextMenu.payload.clipId, contextMenu.payload.noteId); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-2"><Trash2 size={14} /> Delete Note</button>
               </>
            )}
            {contextMenu.type === 'effect' && (
               <>
                 <button onClick={(e) => { e.stopPropagation(); handleRemoveEffect(contextMenu.payload.trackId, contextMenu.payload.fxId); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-2"><Trash2 size={14} /> Remove Effect</button>
               </>
            )}
            {contextMenu.type === 'track' && (
               <>
                 <button onClick={(e) => { e.stopPropagation(); duplicateClip(contextMenu.payload.trackId, Date.now()); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2"><Repeat size={14} /> Duplicate Track</button>
                 <button onClick={(e) => { e.stopPropagation(); handleDeleteTrack(contextMenu.payload.trackId); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-2 text-red-400"><Trash2 size={14} /> Delete Track</button>
               </>
            )}
          </div>
        </>
      )}

      {/* --- Global Settings Modal --- */}
      {showIOSettings && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
           <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80 backdrop-blur-md">
               <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Settings2 size={18} className="text-neutral-400" /> Project & Settings</h2>
               <button onClick={() => setShowIOSettings(false)} className="text-neutral-500 hover:text-white transition-colors"><X size={18} /></button>
             </div>
             <div className="p-6 flex flex-col gap-8">
                {/* Project Actions */}
                <div className="flex flex-col gap-3">
                   <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-800 pb-1.5">Project Actions</label>
                   <div className="flex gap-3">
                      <button onClick={() => { saveProjectToLocal(); setShowIOSettings(false); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-bold rounded-xl transition-all border border-neutral-700 shadow-sm active:scale-95">
                         <Save size={16} /> Local Save
                      </button>
                      <button onClick={() => { exportProjectToFile(); setShowIOSettings(false); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-bold rounded-xl transition-all shadow-[0_0_10px_rgba(37,99,235,0.3)] active:scale-95">
                         <Download size={16} /> Export .webdaw
                      </button>
                   </div>
                </div>

                {/* Audio & MIDI I/O */}
                <div className="flex flex-col gap-4">
                   <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-800 pb-1.5">Audio & MIDI Setup</label>
                   <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-neutral-400">Audio Input Device</label>
                      <select 
                        value={selectedAudioInput} 
                        onChange={e => setSelectedAudioInput(e.target.value)}
                        className="bg-neutral-950 border border-neutral-800 text-sm text-white rounded-lg px-3 py-2.5 outline-none hover:border-neutral-600 transition-colors shadow-inner"
                      >
                        <option value="">Default System Microphone</option>
                        {audioInputs.map(input => (
                          <option key={input.deviceId} value={input.deviceId}>{input.label || `Microphone (${input.deviceId.slice(0,5)}...)`}</option>
                        ))}
                      </select>
                   </div>
                   <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-neutral-400">MIDI Input Device</label>
                      <select 
                        value={selectedMidiInput} 
                        onChange={e => setSelectedMidiInput(e.target.value)}
                        className="bg-neutral-950 border border-neutral-800 text-sm text-white rounded-lg px-3 py-2.5 outline-none hover:border-neutral-600 transition-colors shadow-inner"
                      >
                        <option value="">All MIDI Inputs</option>
                        {midiInputs.map(input => (
                          <option key={input.id} value={input.id}>{input.name || input.id}</option>
                        ))}
                      </select>
                   </div>
                </div>
             </div>
           </div>
         </div>
      )}

      {/* Global Processing Loader */}
      {isProcessingFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-white animate-in fade-in duration-200">
          <Activity size={48} className="animate-spin text-blue-500 mb-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
          <h2 className="text-xl font-bold tracking-wider uppercase">Processing Project Archive</h2>
          <p className="text-neutral-400 mt-2 text-sm font-mono text-center max-w-sm">Packaging/Extracting assets and audio fragments. This may take a moment for large projects.</p>
        </div>
      )}
      
      {/* Custom Global Toast Notifications Container */}
      <div className="fixed bottom-4 right-4 z-[110] flex flex-col gap-2 pointer-events-none">
         {toasts.map(toast => (
           <div key={toast.id} className="animate-in slide-in-from-right-4 fade-in duration-300">
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border ${
                  toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                  toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                  'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}>
                 {toast.type === 'success' ? <CheckCircle2 size={16} /> :
                  toast.type === 'error' ? <AlertTriangle size={16} /> :
                  <Info size={16} />}
                 <span className="text-sm font-medium">{toast.message}</span>
              </div>
           </div>
         ))}
      </div>
    </div>
  );
}