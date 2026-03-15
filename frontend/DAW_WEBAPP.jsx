import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import { 
  Play, Pause, Square, Circle, SkipBack, SkipForward,
  Volume2, Mic, Music, Radio, 
  Settings, Users, Plus, Maximize2, 
  Folder, Sliders, Piano,
  MousePointer2, Pencil, Eraser, X, Grid, Trash2, Activity,
  Settings2, Plug, Power, LogOut, FileAudio, FileCode, Cpu,
  Repeat, Home, Save, Download, Upload, FileJson, Info, AlertTriangle, CheckCircle2, Network, Video, VideoOff, MicOff, Lock, Copy, MoreHorizontal, Scissors, Mail, Globe, Instagram, Twitter, Bell
} from 'lucide-react';
import { io } from 'socket.io-client';

const API_BASE_URL = 'https://api.sprig.cc';

// ==========================================
// OFFLINE-FIRST INDEXED DB WRAPPER
// ==========================================
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FreeDaw_DB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('samples')) db.createObjectStore('samples', { keyPath: 'id' });
    };
  });
};

const idb = {
  get: async (storeName, key) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  set: async (storeName, value) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  getAll: async (storeName) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  delete: async (storeName, key) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
};

const globalAudioBufferCache = new Map();

// --- Time Formatter ---
const formatTime = (currentTime, bpm) => {
    const timeInSeconds = currentTime * (60/bpm);
    const mins = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    const ms = Math.floor((timeInSeconds % 1) * 100).toString().padStart(2, '0');
    return `${mins}:${secs}.${ms}`;
};

// --- Dynamic Library Loader ---
const loadJSZip = () => {
    return new Promise((resolve, reject) => {
        if (window.JSZip) return resolve(window.JSZip);
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

// --- Zero-Dependency Native MIDI Writer ---
const writeMidiFile = (clips, trackName = 'MIDI Track', bpm = 120) => {
    let events = [];
    clips.forEach(clip => {
        if(!clip.notes) return;
        clip.notes.forEach(n => {
            const absStart = clip.start + n.start;
            const absEnd = absStart + n.duration;
            const pitch = Math.min(127, Math.max(0, Math.round(n.pitch)));
            const vel = Math.min(127, Math.max(1, Math.round(n.velocity || 100)));
            events.push({ time: absStart, type: 'on', pitch, vel });
            events.push({ time: absEnd, type: 'off', pitch, vel: 0 });
        });
    });
    if (events.length === 0) return new Uint8Array();
    
    events.sort((a, b) => {
        if (a.time === b.time) return a.type === 'off' ? -1 : 1;
        return a.time - b.time;
    });
    
    const ppq = 96; 
    let bytes = [];
    const write8 = (v) => bytes.push(v & 0xFF);
    const write16 = (v) => { write8(v >> 8); write8(v); };
    const write32 = (v) => { write8(v >> 24); write8(v >> 16); write8(v >> 8); write8(v); };
    const writeStr = (s) => { for(let i=0; i<s.length; i++) write8(s.charCodeAt(i)); };
    
    // MThd
    writeStr('MThd');
    write32(6);
    write16(1); // Format 1
    write16(2); // 2 Tracks
    write16(ppq);
    
    const createTrack = (builderFunc) => {
        let trackBytes = [];
        const t8 = (v) => trackBytes.push(v & 0xFF);
        const tStr = (s) => { for(let i=0; i<s.length; i++) t8(s.charCodeAt(i)); };
        const tVar = (v) => {
            let buf = [v & 0x7F];
            while ((v >>= 7)) buf.push((v & 0x7F) | 0x80);
            while (buf.length) t8(buf.pop()); // Pops in reverse order cleanly
        };
        builderFunc(t8, tStr, tVar);
        
        writeStr('MTrk');
        write32(trackBytes.length);
        trackBytes.forEach(b => write8(b));
    };

    // Track 0: Tempo Map
    createTrack((t8, tStr, tVar) => {
        tVar(0); t8(0xFF); t8(0x58); t8(0x04); t8(0x04); t8(0x02); t8(0x18); t8(0x08);
        const microSecs = Math.round(60000000 / (bpm || 120));
        tVar(0); t8(0xFF); t8(0x51); t8(0x03); 
        t8(microSecs >> 16); t8(microSecs >> 8); t8(microSecs);
        const sName = 'FreeDaw Project';
        tVar(0); t8(0xFF); t8(0x03); tVar(sName.length); tStr(sName);
        tVar(0); t8(0xFF); t8(0x2F); t8(0x00);
    });

    // Track 1: Notes
    createTrack((t8, tStr, tVar) => {
        const safeName = (trackName || 'MIDI Track').substring(0, 32);
        tVar(0); t8(0xFF); t8(0x03); tVar(safeName.length); tStr(safeName);
        tVar(0); t8(0xC0); t8(0x00); // Program Change
        
        let lastTick = 0;
        events.forEach(ev => {
            const tick = Math.max(lastTick, Math.round(ev.time * ppq));
            const delta = tick - lastTick;
            lastTick = tick;
            tVar(delta);
            t8(ev.type === 'on' ? 0x90 : 0x80);
            t8(ev.pitch);
            t8(ev.type === 'on' ? ev.vel : 0); // Strict 0 velocity for standard Note-Off
        });
        tVar(0); t8(0xFF); t8(0x2F); t8(0x00);
    });

    return new Uint8Array(bytes);
};
// --- WAV Audio Encoder ---
const audioBufferToWav = (buffer) => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    let result;
    if (numChannels === 2) {
        const channelData0 = buffer.getChannelData(0);
        const channelData1 = buffer.getChannelData(1);
        const length = channelData0.length * 2;
        result = new Int16Array(length);
        for (let i = 0, j = 0; i < channelData0.length; i++) {
            result[j++] = Math.max(-32768, Math.min(32767, channelData0[i] * 32768));
            result[j++] = Math.max(-32768, Math.min(32767, channelData1[i] * 32768));
        }
    } else {
        const channelData = buffer.getChannelData(0);
        result = new Int16Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
            result[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32768));
        }
    }

    const bufferLength = result.length * 2;
    const arrayBuffer = new ArrayBuffer(44 + bufferLength);
    const view = new DataView(arrayBuffer);

    const writeString = (view, offset, string) => {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + bufferLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, bufferLength, true);

    const dataView = new Int16Array(arrayBuffer, 44);
    dataView.set(result);

    return new Blob([arrayBuffer], { type: 'audio/wav' });
};

// --- Zero-Dependency Native MIDI Parser ---
const parseMidiFile = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    let offset = 0;
    
    const readString = (len) => { let s=''; for(let i=0;i<len && offset<data.length;i++) s+=String.fromCharCode(data[offset++]); return s; };
    const read32 = () => (data[offset++]<<24)|(data[offset++]<<16)|(data[offset++]<<8)|data[offset++];
    const read16 = () => (data[offset++]<<8)|data[offset++];
    const readVar = () => { let v=0, b; do { if(offset>=data.length) break; b=data[offset++]; v=(v<<7)|(b&0x7f); } while(b&0x80); return v; };

    if(readString(4) !== 'MThd') throw new Error("Invalid MIDI Header");
    read32(); const fmt = read16(), trks = read16(), ppq = read16() || 96;
    let allNotes = [];

    for(let t=0; t<trks; t++) {
        if(offset >= data.length) break;
        const type = readString(4);
        const len = read32();
        if(type !== 'MTrk') { offset += len; continue; }
        
        const end = offset + len;
        let ticks = 0, lastStatus = 0, active = {};
        
        while(offset < end) {
            ticks += readVar();
            if (offset >= end) break;
            
            let status = data[offset];
            if (status >= 0x80) { 
                status = data[offset++]; 
                // CRITICAL FIX: Only channel messages (0x80-0xEF) set running status. 
                // Meta (0xFF) and Sysex (0xF0) reset/ignore it.
                if (status < 0xf0) lastStatus = status; 
            }
            else if (lastStatus) { status = lastStatus; }
            else { offset++; continue; } // Skip malformed bytes without crashing

            if (status === 0xff) { // Meta Event
                offset++; // Skip type
                offset += readVar(); // Skip data
            } else if (status === 0xf0 || status === 0xf7) { // Sysex
                offset += readVar();
            } else {
                const cmd = status >> 4;
                const channel = status & 0x0f;
                
                if (cmd === 8 || cmd === 9) {
                    const note = data[offset++]; 
                    const vel = data[offset++];
                    const b = ticks / ppq;
                    const key = `${channel}_${note}`;
                    
                    if (cmd === 9 && vel > 0) {
                        if (active[key]) { // Note already on, close it
                            allNotes.push({ id: `m_${Date.now()}_${Math.random()}`, pitch: note, start: active[key].s, duration: Math.max(0.125, b - active[key].s), velocity: active[key].v });
                        }
                        active[key] = { s: b, v: vel };
                    } else if (active[key]) {
                        allNotes.push({ id: `m_${Date.now()}_${Math.random()}`, pitch: note, start: active[key].s, duration: Math.max(0.125, b - active[key].s), velocity: active[key].v });
                        delete active[key];
                    }
                } else if (cmd === 10 || cmd === 11 || cmd === 14) {
                    offset += 2;
                } else if (cmd === 12 || cmd === 13) {
                    offset += 1;
                } else {
                    // Unknown or system message, skip byte to avoid infinite loops
                    offset++; 
                }
            }
        }
        
        // Close dangling notes
        const endBeat = ticks / ppq;
        for (const key in active) {
            const note = parseInt(key.split('_')[1], 10);
            allNotes.push({ id: `m_${Date.now()}_${Math.random()}`, pitch: note, start: active[key].s, duration: Math.max(0.125, endBeat - active[key].s), velocity: active[key].v });
        }
    }
    
    return allNotes;
};

// --- Dynamic Grid Styling Engine ---
const getGridStyle = (snap, beatWidth, isPianoRoll = false) => {
    const measureW = beatWidth * 4;
    const beatW = beatWidth;
    const snapW = snap > 0 ? beatWidth * snap : 0;
    const baseH = isPianoRoll ? '16px' : '100%';
    
    const layers = [];
    const sizes = [];

    // Horizontal Pitch Lines (Piano Roll only)
    if (isPianoRoll) {
        layers.push(`linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)`);
        sizes.push(`100% 16px`);
    }
    
    // Measure Lines (Strongest)
    layers.push(`linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px)`);
    sizes.push(`${measureW}px ${baseH}`);
    
    // Beat Lines (Medium)
    layers.push(`linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px)`);
    sizes.push(`${beatW}px ${baseH}`);
    
    // Snap Sub-divisions (Blue Tinted)
    if (snapW > 0 && snap !== 1 && snap !== 4) {
        layers.push(`linear-gradient(to right, rgba(59,130,246,0.15) 1px, transparent 1px)`);
        sizes.push(`${snapW}px ${baseH}`);
    }

    return {
        backgroundImage: layers.join(', '),
        backgroundSize: sizes.join(', '),
        backgroundPosition: '0 0'
    };
};

const getInterpolatedValue = (points, time) => {
    if (!points || points.length === 0) return null;
    if (points.length === 1) return points[0].value;
    const sorted = [...points].sort((a,b) => a.time - b.time);
    if (time <= sorted[0].time) return sorted[0].value;
    if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
    for (let i = 0; i < sorted.length - 1; i++) {
        if (time >= sorted[i].time && time < sorted[i+1].time) {
            const p1 = sorted[i]; const p2 = sorted[i+1];
            const t = (time - p1.time) / (p2.time - p1.time);
            return p1.value + t * (p2.value - p1.value);
        }
    }
    return sorted[sorted.length - 1].value;
};

const getParamConstraints = (param) => {
    const p = param.toLowerCase();
    if (p.includes('freq') || p === 'cutoff' || p === 'damping') return { min: 20, max: 20000, step: 1, isLog: true };
    if (p.includes('gain') || p === 'low' || p === 'mid' || p === 'high') return { min: -24, max: 24, step: 0.1 };
    if (p.includes('q') || p === 'res') return { min: 0.1, max: 20, step: 0.1 };
    if (p === 'amount') return { min: 0, max: 100, step: 1 };
    if (p === 'threshold') return { min: -60, max: 0, step: 1 };
    if (p === 'ratio') return { min: 0.1, max: 20, step: 0.1 };
    if (p === 'bitdepth') return { min: 1, max: 16, step: 1 };
    if (p === 'sprayrate') return { min: 1, max: 50, step: 0.1 };
    if (p === 'delaytime') return { min: 0.001, max: 0.02, step: 0.001 };
    if (p === 'time' || p === 'decay' || p === 'attack' || p === 'release') return { min: 0.001, max: 10, step: 0.01, isLog: true };
    if (p === 'rate') return { min: 0.1, max: 20, step: 0.1, isLog: true };
    if (p === 'modindex') return { min: 0, max: 100, step: 1 };
    if (p === 'detune') return { min: 0, max: 100, step: 1 };
    if (p === 'envmod') return { min: 0, max: 10000, step: 10 };
    return { min: 0, max: 1, step: 0.01 }; 
};

const getAutomationConstraints = (paramKey) => {
    if (paramKey === 'volume') return { min: 0, max: 100 };
    if (paramKey === 'pan') return { min: -50, max: 50 };
    if (paramKey.startsWith('fx_param_')) {
        const pName = paramKey.split('_').slice(3).join('_');
        return getParamConstraints(pName);
    }
    if (paramKey.startsWith('inst_param_')) {
        const pName = paramKey.split('_').slice(2).join('_');
        return getParamConstraints(pName);
    }
    return { min: 0, max: 100 };
};

// --- Full Internal Engine Definitions ---
const INTERNAL_PLUGINS = [
  { id: 'fx-delay', name: 'Digital Delay', category: 'effect', type: 'delay', vendor: 'FreeDaw-Collab', params: { time: 0.3, feedback: 0.4, mix: 0.5 } },
  { id: 'fx-pareq', name: 'Parametric EQ', category: 'effect', type: 'parametric-eq', vendor: 'FreeDaw-Collab', params: { lowFreq: 100, lowGain: 0, mid1Freq: 500, mid1Q: 1.0, mid1Gain: 0, mid2Freq: 2000, mid2Q: 1.0, mid2Gain: 0, highFreq: 5000, highGain: 0 } },
  { id: 'fx-reverb', name: 'Room Reverb', category: 'effect', type: 'reverb', vendor: 'FreeDaw-Collab', params: { decay: 2.0, mix: 0.4 } },
  { id: 'fx-distortion', name: 'Tube Distortion', category: 'effect', type: 'distortion', vendor: 'FreeDaw-Collab', params: { amount: 50, mix: 1.0 } },
  { id: 'fx-chorus', name: 'Stereo Chorus', category: 'effect', type: 'chorus', vendor: 'FreeDaw-Collab', params: { rate: 1.5, depth: 0.003, mix: 0.5 } },
  { id: 'fx-phaser', name: 'Phaser', category: 'effect', type: 'phaser', vendor: 'FreeDaw-Collab', params: { rate: 0.5, depth: 800, feedback: 0.5, mix: 0.5 } },
  { id: 'fx-flanger', name: 'Flanger', category: 'effect', type: 'flanger', vendor: 'FreeDaw-Collab', params: { rate: 0.25, delayTime: 0.005, depth: 0.002, feedback: 0.5, mix: 0.5 } },
  { id: 'fx-graindelay', name: 'Grain Delay', category: 'effect', type: 'grain-delay', vendor: 'FreeDaw-Collab', params: { time: 0.2, feedback: 0.4, sprayRate: 15.0, mix: 0.5 } },
  { id: 'fx-filter', name: 'Pro-Q Filter', category: 'effect', type: 'filter', vendor: 'FreeDaw-Collab', params: { freq: 1200, res: 1.5 } },
  { id: 'fx-compressor', name: 'Bus Compressor', category: 'effect', type: 'compressor', vendor: 'FreeDaw-Collab', params: { threshold: -24, ratio: 4 } },
  { id: 'fx-bitcrusher', name: 'Lo-Fi Bitcrusher', category: 'effect', type: 'bitcrusher', vendor: 'FreeDaw-Collab', params: { bitDepth: 4, mix: 1.0 } },
  { id: 'fx-autopan', name: 'Auto-Pan LFO', category: 'effect', type: 'autopan', vendor: 'FreeDaw-Collab', params: { rate: 2.0, depth: 1.0 } },
  { id: 'fx-tremolo', name: 'Tremolo', category: 'effect', type: 'tremolo', vendor: 'FreeDaw-Collab', params: { rate: 5.0, depth: 0.8 } },
  { id: 'fx-ringmod', name: 'Ring Modulator', category: 'effect', type: 'ringmod', vendor: 'FreeDaw-Collab', params: { freq: 400, mix: 0.5 } },
  { id: 'fx-eq3', name: '3-Band EQ', category: 'effect', type: 'eq3', vendor: 'FreeDaw-Collab', params: { low: 0, mid: 0, high: 0 } },
  
  { id: 'inst-subtractive', name: 'Analog Subtractive', category: 'instrument', type: 'subtractive', vendor: 'FreeDaw-Collab' },
  { id: 'inst-fm', name: 'Operator FM Synth', category: 'instrument', type: 'fm', vendor: 'FreeDaw-Collab' },
  { id: 'inst-supersaw', name: 'Supersaw Pad', category: 'instrument', type: 'supersaw', vendor: 'FreeDaw-Collab' },
  { id: 'inst-pluck', name: 'Karplus Pluck', category: 'instrument', type: 'pluck', vendor: 'FreeDaw-Collab' },
  { id: 'inst-acid', name: 'Acid Bassline', category: 'instrument', type: 'acid', vendor: 'FreeDaw-Collab' },
  { id: 'inst-organ', name: 'Tonewheel Organ', category: 'instrument', type: 'organ', vendor: 'FreeDaw-Collab' },
  { id: 'inst-drum', name: 'Drum Machine', category: 'instrument', type: 'drum', vendor: 'FreeDaw-Collab' }
];

const INITIAL_TRACKS = [
  { id: 1, name: 'Drum Kit', type: 'midi', instrument: 'inst-drum', color: 'bg-orange-500', volume: 90, pan: 0, muted: false, solo: false, armed: false, automation: {}, activeAutomationParam: 'volume', effects: [], clips: [
    { id: 101, start: 0, duration: 4, notes: [
      { id: 'n1', pitch: 36, start: 0, duration: 0.25, velocity: 120 }, { id: 'n2', pitch: 42, start: 0.5, duration: 0.25, velocity: 80 },
      { id: 'n3', pitch: 38, start: 1, duration: 0.25, velocity: 110 }, { id: 'n4', pitch: 42, start: 1.5, duration: 0.25, velocity: 80 }
    ]}
  ]},
  { id: 2, name: 'Lead Synth', type: 'midi', instrument: 'inst-subtractive', instrumentParams: { cutoff: 800, res: 2, attack: 0.05, release: 0.2 }, color: 'bg-purple-500', volume: 75, pan: 0, muted: false, solo: false, armed: false, automation: {}, activeAutomationParam: 'volume', effects: [{ id: 'fx-dist-1', type: 'distortion', name: 'Tube Distortion', params: { amount: 40, mix: 0.6 } }], clips: [
    { id: 201, start: 0, duration: 4, notes: [
      { id: 'n5', pitch: 36, start: 0, duration: 0.5, velocity: 100 }, { id: 'n6', pitch: 36, start: 0.75, duration: 0.25, velocity: 90 },
      { id: 'n7', pitch: 48, start: 1.5, duration: 0.5, velocity: 110 }
    ]}
  ]},
  { id: 3, name: 'Vocals', type: 'audio', audioInputId: '', color: 'bg-emerald-500', volume: 80, pan: 0, muted: false, solo: false, armed: false, automation: {}, activeAutomationParam: 'volume', effects: [], clips: [] }
];

const formatAutoName = (track, paramKey) => {
    if (paramKey === 'volume') return 'Volume';
    if (paramKey === 'pan') return 'Pan';
    if (paramKey.startsWith('fx_param_')) {
        const parts = paramKey.split('_');
        const fxId = parts[2];
        const pName = parts.slice(3).join('_');
        const fx = track.effects?.find(f => f.id === fxId);
        return `${fx ? fx.name : 'FX'} - ${pName.replace(/([A-Z])/g, ' $1').trim()}`;
    }
    if (paramKey.startsWith('inst_param_')) {
        const pName = paramKey.split('_').slice(2).join('_');
        const inst = INTERNAL_PLUGINS.find(p => p.id === track.instrument);
        return `${inst ? inst.name : 'Inst'} - ${pName.replace(/([A-Z])/g, ' $1').trim()}`;
    }
    return paramKey;
};

// ==========================================
// FULL DSP & WEB AUDIO ENGINE
// ==========================================
const createReverbIR = (ctx, duration) => {
  const sampleRate = ctx.sampleRate; const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let i = 0; i < length; i++) {
    const decay = Math.exp(-i / (sampleRate * (duration / 4)));
    impulse.getChannelData(0)[i] = (Math.random() * 2 - 1) * decay;
    impulse.getChannelData(1)[i] = (Math.random() * 2 - 1) * decay;
  }
  return impulse;
};

const getBitcrusherCurve = (bitDepth) => {
  const steps = Math.pow(2, bitDepth); const curve = new Float32Array(44100);
  for (let i = 0; i < 44100; i++) { const x = (i * 2) / 44100 - 1; curve[i] = Math.round(x * steps) / steps; }
  return curve;
};

// --- Reusable DAW Radial Knob Component ---
const Knob = ({ param, value, min, max, step, isLog, onChange, onContextMenu }) => {
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef(0);
    const startValue = useRef(0);
    const onChangeRef = useRef(onChange);

    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    const handlePointerDown = (e) => {
        if (e.button === 2) return; 
        e.preventDefault();
        e.target.setPointerCapture(e.pointerId); 
        setIsDragging(true);
        dragStartY.current = e.clientY;
        startValue.current = Number(value);
    };

    useEffect(() => {
        if (!isDragging) return;
        const handlePointerMove = (e) => {
            const deltaY = dragStartY.current - e.clientY;
            const dragFactor = deltaY / 150; 
            let nextValue;

            if (isLog) {
                const minLog = Math.log(Math.max(0.001, min));
                const maxLog = Math.log(max);
                const startLog = Math.log(Math.max(0.001, startValue.current));
                const rangeLog = maxLog - minLog;
                
                let nextLog = startLog + dragFactor * rangeLog;
                nextLog = Math.max(minLog, Math.min(maxLog, nextLog));
                nextValue = Math.exp(nextLog);
            } else {
                const range = max - min;
                nextValue = startValue.current + dragFactor * range;
            }

            nextValue = Math.max(min, Math.min(max, nextValue));
            if (step && !isLog) nextValue = Math.round(nextValue / step) * step;
            onChangeRef.current(param, nextValue);
        };
        
        const handlePointerUp = () => setIsDragging(false);

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, min, max, step, param, isLog]);

    const handleWheel = (e) => {
        e.stopPropagation();
        const isUp = e.deltaY < 0;
        let nextValue;
        if (isLog) {
            const minLog = Math.log(Math.max(0.001, min));
            const maxLog = Math.log(max);
            const currentLog = Math.log(Math.max(0.001, Number(value)));
            const stepLog = (maxLog - minLog) / 50; 
            let nextLog = currentLog + (isUp ? stepLog : -stepLog);
            nextLog = Math.max(minLog, Math.min(maxLog, nextLog));
            nextValue = Math.exp(nextLog);
        } else {
            const range = max - min;
            const stepAmount = step || (range / 50);
            nextValue = Number(value) + (isUp ? stepAmount : -stepAmount);
        }
        nextValue = Math.max(min, Math.min(max, nextValue));
        if (step && !isLog) nextValue = Math.round(nextValue / step) * step;
        onChangeRef.current(param, nextValue);
    };

    const percent = isLog 
        ? (Math.log(Math.max(0.001, Number(value))) - Math.log(Math.max(0.001, min))) / (Math.log(max) - Math.log(Math.max(0.001, min)))
        : (Number(value) - min) / (max - min);
    
    const angle = -135 + (percent || 0) * 270;
    const displayName = param.replace(/([A-Z0-9])/g, ' $1').trim();

    return (
        <div className="flex flex-col items-center gap-2 w-16 shrink-0" onContextMenu={onContextMenu}>
            <div 
                className="w-10 h-10 rounded-full bg-neutral-800 border-2 border-neutral-700 relative cursor-ns-resize shadow-[0_4px_8px_rgba(0,0,0,0.6)] group"
                onPointerDown={handlePointerDown}
                onWheel={handleWheel}
            >
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-neutral-600/20 to-transparent pointer-events-none" />
                <div className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
                    <div className="mx-auto mt-1 w-1 h-3 bg-blue-400 rounded-full shadow-[0_0_6px_rgba(96,165,250,0.8)] group-hover:bg-blue-300 transition-colors pointer-events-none" />
                </div>
            </div>
            <div className="flex flex-col items-center w-full">
                <span className="text-[10px] text-neutral-300 font-bold uppercase tracking-wider text-center truncate w-full" title={displayName}>{displayName}</span>
                <span className="text-[10px] text-blue-400 font-mono bg-neutral-950 px-1.5 py-0.5 rounded mt-0.5 border border-neutral-800 shadow-inner select-none">
                    {Number(value) >= 1000 ? (Number(value) / 1000).toFixed(1) + 'k' : Number(value).toFixed(step < 1 ? 2 : 0)}
                </span>
            </div>
        </div>
    );
};

// --- Dedicated EQ Node Component for Bulletproof Dragging ---
const EQNode = ({ id, freq = 1000, gain = 0, color, onParamChange }) => {
    const [isDragging, setIsDragging] = useState(false);
    const onChangeRef = useRef(onParamChange);
    const nodeRef = useRef(null);

    useEffect(() => { onChangeRef.current = onParamChange; }, [onParamChange]);

    const freqToX = (f) => (Math.log10(Math.max(20, f) / 20) / Math.log10(20000 / 20)) * 100;
    const xToFreq = (xPercent) => 20 * Math.pow(20000 / 20, xPercent / 100);
    const gainToY = (g) => 50 - (g / 24) * 50;
    const yToGain = (yPercent) => ((50 - yPercent) / 50) * 24;

    const handlePointerDown = (e) => {
        if (e.button === 2) return;
        e.preventDefault();
        e.target.setPointerCapture(e.pointerId);
        setIsDragging(true);
    };

    useEffect(() => {
        if (!isDragging) return;
        const handlePointerMove = (e) => {
            const parent = nodeRef.current?.parentElement;
            if (!parent) return;
            const rect = parent.getBoundingClientRect();
            
            // CRITICAL FIX: Prevent Division by Zero if element is squished
            const width = Math.max(1, rect.width);
            const height = Math.max(1, rect.height);
            
            const xPercent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / width) * 100));
            const yPercent = Math.max(0, Math.min(100, ((e.clientY - rect.top) / height) * 100));
            
            const newFreq = xToFreq(xPercent);
            const newGain = Math.max(-24, Math.min(24, yToGain(yPercent)));
            
            if (!isNaN(newFreq)) onChangeRef.current(`${id}Freq`, newFreq);
            if (!isNaN(newGain)) onChangeRef.current(`${id}Gain`, newGain);
        };
        const handlePointerUp = () => setIsDragging(false);

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, id]);

    return (
        <div 
            ref={nodeRef}
            className="absolute w-4 h-4 rounded-full cursor-grab active:cursor-grabbing shadow-[0_0_8px_rgba(0,0,0,0.8)] z-10 -translate-x-1/2 -translate-y-1/2 touch-none"
            style={{ left: `${freqToX(freq)}%`, top: `${gainToY(gain)}%`, backgroundColor: color, border: '2px solid white' }}
            onPointerDown={handlePointerDown}
            title={`${id.toUpperCase()} Band`}
        />
    );
};

const createFXNode = (ctx, fx) => {
  const input = ctx.createGain(), output = ctx.createGain(), wet = ctx.createGain(), dry = ctx.createGain();
  input.connect(dry); dry.connect(output);
  wet.gain.value = fx.params?.mix ?? 0.5; dry.gain.value = 1 - wet.gain.value;

  if (fx.type === 'delay') {
    const delay = ctx.createDelay(5.0); delay.delayTime.value = fx.params?.time || 0.3;
    const fb = ctx.createGain(); fb.gain.value = fx.params?.feedback || 0.3;
    input.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(output);
    return { input, output, delay, feedback: fb, wet, dry, fxType: 'delay' };
  } else if (fx.type === 'reverb') {
    const conv = ctx.createConvolver(); conv.buffer = createReverbIR(ctx, fx.params?.decay || 2.0);
    input.connect(conv); conv.connect(wet); wet.connect(output);
    return { input, output, conv, wet, dry, fxType: 'reverb' };
  } else if (fx.type === 'filter') {
    const node = ctx.createBiquadFilter(); node.type = 'lowpass'; node.frequency.value = fx.params?.freq || 1200; node.Q.value = fx.params?.res || 1.5;
    input.connect(node); node.connect(output);
    return { input, output, node, fxType: 'filter' };
  } else if (fx.type === 'distortion') {
    const node = ctx.createWaveShaper(); const amount = fx.params?.amount || 50; const curve = new Float32Array(44100); const deg = Math.PI / 180;
    for (let i = 0; i < 44100; ++i) { const x = (i * 2) / 44100 - 1; curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x)); }
    node.curve = curve; node.oversample = '4x';
    input.connect(node); node.connect(wet); wet.connect(output);
    return { input, output, node, wet, dry, fxType: 'distortion' };
  } else if (fx.type === 'chorus') {
    const delay = ctx.createDelay(); delay.delayTime.value = 0.03;
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = fx.params?.rate || 1.5;
    const modGain = ctx.createGain(); modGain.gain.value = fx.params?.depth || 0.003;
    osc.connect(modGain); modGain.connect(delay.delayTime); osc.start();
    input.connect(delay); delay.connect(wet); wet.connect(output);
    return { input, output, delay, lfo: osc, lfoGain: modGain, wet, dry, fxType: 'chorus' };
  } else if (fx.type === 'phaser') {
    const ap1 = ctx.createBiquadFilter(); ap1.type = 'allpass'; ap1.frequency.value = 1000;
    const ap2 = ctx.createBiquadFilter(); ap2.type = 'allpass'; ap2.frequency.value = 1000;
    const ap3 = ctx.createBiquadFilter(); ap3.type = 'allpass'; ap3.frequency.value = 1000;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = fx.params?.rate || 0.5;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = fx.params?.depth || 800;
    lfo.connect(lfoGain); lfoGain.connect(ap1.frequency); lfoGain.connect(ap2.frequency); lfoGain.connect(ap3.frequency);
    lfo.start();
    input.connect(ap1); ap1.connect(ap2); ap2.connect(ap3); ap3.connect(wet); wet.connect(output);
    const fb = ctx.createGain(); fb.gain.value = fx.params?.feedback || 0.5;
    ap3.connect(fb); fb.connect(ap1);
    return { input, output, ap1, ap2, ap3, lfo, lfoGain, fb, wet, dry, fxType: 'phaser' };
  } else if (fx.type === 'flanger') {
    const delay = ctx.createDelay(1.0); delay.delayTime.value = fx.params?.delayTime || 0.005;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = fx.params?.rate || 0.25;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = fx.params?.depth || 0.002;
    lfo.connect(lfoGain); lfoGain.connect(delay.delayTime); lfo.start();
    const fb = ctx.createGain(); fb.gain.value = fx.params?.feedback || 0.5;
    input.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(output);
    return { input, output, delay, lfo, lfoGain, fb, wet, dry, fxType: 'flanger' };
  } else if (fx.type === 'grain-delay') {
    const delay = ctx.createDelay(5.0); delay.delayTime.value = fx.params?.time || 0.2;
    const fb = ctx.createGain(); fb.gain.value = fx.params?.feedback || 0.4;
    const tremoloNode = ctx.createGain();
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = fx.params?.sprayRate || 15.0;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 1.0;
    lfo.connect(lfoGain); lfoGain.connect(tremoloNode.gain); lfo.start();
    input.connect(delay); delay.connect(fb); fb.connect(delay);
    delay.connect(tremoloNode); tremoloNode.connect(wet); wet.connect(output);
    return { input, output, delay, feedback: fb, tremoloGain: tremoloNode, lfo, lfoGain, wet, dry, fxType: 'grain-delay' };
  } else if (fx.type === 'compressor') {
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = fx.params?.threshold || -24; comp.ratio.value = fx.params?.ratio || 4;
    input.connect(comp); comp.connect(output);
    return { input, output, comp, fxType: 'compressor' };
  } else if (fx.type === 'bitcrusher') {
    const node = ctx.createWaveShaper(); node.curve = getBitcrusherCurve(fx.params?.bitDepth || 4);
    input.connect(node); node.connect(wet); wet.connect(output);
    return { input, output, node, wet, dry, fxType: 'bitcrusher' };
  } else if (fx.type === 'autopan') {
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createPanner();
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = fx.params?.rate || 2.0;
    const depthGain = ctx.createGain(); depthGain.gain.value = fx.params?.depth || 1.0;
    osc.connect(depthGain); if (panner.pan) depthGain.connect(panner.pan); osc.start();
    input.connect(panner); panner.connect(output);
    return { input, output, panner, lfo: osc, lfoGain: depthGain, fxType: 'autopan' };
  } else if (fx.type === 'tremolo') {
    const amp = ctx.createGain(); const depth = fx.params?.depth !== undefined ? fx.params.depth : 0.8;
    amp.gain.value = 1.0 - (depth / 2);
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = fx.params?.rate || 5.0;
    const depthGain = ctx.createGain(); depthGain.gain.value = depth / 2;
    osc.connect(depthGain); depthGain.connect(amp.gain); osc.start();
    input.connect(amp); amp.connect(output);
    return { input, output, amp, lfo: osc, lfoGain: depthGain, fxType: 'tremolo' };
  } else if (fx.type === 'ringmod') {
    const multiplier = ctx.createGain(); multiplier.gain.value = 0;
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = fx.params?.freq || 400; osc.start();
    osc.connect(multiplier.gain);
    input.connect(multiplier); multiplier.connect(wet); wet.connect(output);
    return { input, output, osc, wet, dry, fxType: 'ringmod' };
  } else if (fx.type === 'eq3') {
    const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 250; low.gain.value = fx.params?.low || 0;
    const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 1.0; mid.gain.value = fx.params?.mid || 0;
    const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 4000; high.gain.value = fx.params?.high || 0;
    input.connect(low); low.connect(mid); mid.connect(high); high.connect(output);
    return { input, output, low, mid, high, fxType: 'eq3' };
  } else if (fx.type === 'parametric-eq') {
    const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = fx.params?.lowFreq || 100; low.gain.value = fx.params?.lowGain || 0;
    const mid1 = ctx.createBiquadFilter(); mid1.type = 'peaking'; mid1.frequency.value = fx.params?.mid1Freq || 500; mid1.Q.value = fx.params?.mid1Q || 1.0; mid1.gain.value = fx.params?.mid1Gain || 0;
    const mid2 = ctx.createBiquadFilter(); mid2.type = 'peaking'; mid2.frequency.value = fx.params?.mid2Freq || 2000; mid2.Q.value = fx.params?.mid2Q || 1.0; mid2.gain.value = fx.params?.mid2Gain || 0;
    const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = fx.params?.highFreq || 5000; high.gain.value = fx.params?.highGain || 0;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.8;
    input.connect(low); low.connect(mid1); mid1.connect(mid2); mid2.connect(high); high.connect(analyser); analyser.connect(wet); wet.connect(output);
    return { input, output, low, mid1, mid2, high, analyser, wet, dry, fxType: 'parametric-eq' };
  }
  
  const passthrough = ctx.createGain(); input.connect(passthrough); passthrough.connect(wet); wet.connect(output);
  return { input, output, wet, dry, fxType: 'passthrough' };
};

// --- Custom Canvas EQ Node Visualizer ---
const ParametricEqVisualizer = ({ trackId, fxId, params, onParamChange, synthsRef, audioCtxRef }) => {
    const canvasRef = useRef(null);
    const eqCurveRef = useRef(new Float32Array(300)); 

    useEffect(() => {
        try {
            // CRITICAL FIX: Reuse the global audio context to prevent OfflineAudioContext hardware exhaustion
            const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
            const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = params?.lowFreq || 100; low.gain.value = params?.lowGain || 0;
            const mid1 = ctx.createBiquadFilter(); mid1.type = 'peaking'; mid1.frequency.value = params?.mid1Freq || 500; mid1.Q.value = params?.mid1Q || 1.0; mid1.gain.value = params?.mid1Gain || 0;
            const mid2 = ctx.createBiquadFilter(); mid2.type = 'peaking'; mid2.frequency.value = params?.mid2Freq || 2000; mid2.Q.value = params?.mid2Q || 1.0; mid2.gain.value = params?.mid2Gain || 0;
            const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = params?.highFreq || 5000; high.gain.value = params?.highGain || 0;

            const freqs = new Float32Array(300);
            for (let i=0; i<300; i++) freqs[i] = 20 * Math.pow(20000 / 20, i / 300);

            const magLow = new Float32Array(300); const phaseLow = new Float32Array(300);
            const magMid1 = new Float32Array(300); const phaseMid1 = new Float32Array(300);
            const magMid2 = new Float32Array(300); const phaseMid2 = new Float32Array(300);
            const magHigh = new Float32Array(300); const phaseHigh = new Float32Array(300);

            low.getFrequencyResponse(freqs, magLow, phaseLow);
            mid1.getFrequencyResponse(freqs, magMid1, phaseMid1);
            mid2.getFrequencyResponse(freqs, magMid2, phaseMid2);
            high.getFrequencyResponse(freqs, magHigh, phaseHigh);

            for (let i=0; i<300; i++) {
                const totalMag = magLow[i] * magMid1[i] * magMid2[i] * magHigh[i];
                eqCurveRef.current[i] = 20 * Math.log10(totalMag);
            }
        } catch(e) {}
    }, [params]);

    useEffect(() => {
        let reqId;
        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;

            const synth = synthsRef.current[trackId];
            const fxNode = synth?.fxNodes[fxId];
            
            ctx.clearRect(0, 0, width, height);
            
            const minFreq = 20;
            const maxFreq = audioCtxRef.current ? audioCtxRef.current.sampleRate / 2 : 22050;

            if (fxNode && fxNode.analyser) {
                const analyser = fxNode.analyser;
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                analyser.getByteFrequencyData(dataArray);
                
                ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
                ctx.beginPath();
                ctx.moveTo(0, height);
                for (let i = 0; i < bufferLength; i++) {
                    const freq = i * maxFreq / bufferLength;
                    if (freq < minFreq) continue;
                    const x = (Math.log10(freq / minFreq) / Math.log10(maxFreq / minFreq)) * width;
                    const y = height - (dataArray[i] / 255) * height;
                    ctx.lineTo(x, y);
                }
                ctx.lineTo(width, height);
                ctx.fill();
            }

            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i=0; i<300; i++) {
                const totalDb = eqCurveRef.current[i] || 0;
                let y = height / 2 - (totalDb / 24) * (height / 2);
                y = Math.max(0, Math.min(height, y));
                const x = (i / 300) * width;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            [100, 1000, 10000].forEach(f => {
                const x = (Math.log10(f / minFreq) / Math.log10(maxFreq / minFreq)) * width;
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.font = '9px sans-serif';
                ctx.fillText(f >= 1000 ? f/1000+'k' : f, x + 2, 10);
            });

            reqId = requestAnimationFrame(draw);
        };
        draw();
        return () => cancelAnimationFrame(reqId);
    }, [trackId, fxId, synthsRef, audioCtxRef, params]);

    return (
        <div className="relative w-full h-[120px] mb-4 shrink-0 mt-2">
            <canvas 
                ref={canvasRef} 
                width={300} height={120} 
                className="absolute inset-0 w-full h-full bg-black/50 rounded-lg border border-neutral-800 shadow-inner pointer-events-none" 
            />
            <EQNode id="low" freq={params?.lowFreq} gain={params?.lowGain} color="#ef4444" onParamChange={onParamChange} />
            <EQNode id="mid1" freq={params?.mid1Freq} gain={params?.mid1Gain} color="#eab308" onParamChange={onParamChange} />
            <EQNode id="mid2" freq={params?.mid2Freq} gain={params?.mid2Gain} color="#3b82f6" onParamChange={onParamChange} />
            <EQNode id="high" freq={params?.highFreq} gain={params?.highGain} color="#a855f7" onParamChange={onParamChange} />
        </div>
    );
};

// --- Synth Triggers ---
const triggerSubtractive = (ctx, bus, pitch, time, vol, dur, p={}, vel=100, pbNode) => {
  const osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), env = ctx.createGain();
  const realVol = vol * (vel / 127);
  osc.type = p.oscType || 'sawtooth'; osc.frequency.setValueAtTime(440 * Math.pow(2, (pitch - 69) / 12), time);
  if (pbNode) pbNode.connect(osc.detune);
  filter.type = 'lowpass'; filter.frequency.setValueAtTime(p.cutoff || 2000, time); filter.Q.value = p.res || 1.5;
  filter.frequency.exponentialRampToValueAtTime(100, time + dur);
  env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(realVol, time + (p.attack||0.01));
  env.gain.setValueAtTime(realVol, time + dur); env.gain.exponentialRampToValueAtTime(0.001, time + dur + (p.release||0.1));
  osc.connect(filter); filter.connect(env); env.connect(bus);
  osc.start(time); osc.stop(time + dur + (p.release||0.1));
};

const triggerSupersaw = (ctx, bus, pitch, time, vol, dur, p={}, vel=100, pbNode) => {
  const env = ctx.createGain(); const safeVol = vol * 0.3 * (vel / 127);
  env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(safeVol, time + (p.attack||0.05));
  env.gain.setValueAtTime(safeVol, time + dur); env.gain.exponentialRampToValueAtTime(0.001, time + dur + (p.release||0.5));
  const count = 5; const baseFreq = 440 * Math.pow(2, (pitch - 69) / 12);
  for(let i=0; i<count; i++) {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq, time); osc.detune.setValueAtTime((p.detune||25) * ((i/(count-1))*2-1), time);
      if (pbNode) pbNode.connect(osc.detune);
      osc.connect(env); osc.start(time); osc.stop(time + dur + (p.release||0.5));
  }
  env.connect(bus);
};

const triggerFMSynth = (ctx, bus, pitch, time, vol, dur, p={}, vel=100, pbNode) => {
  const carrier = ctx.createOscillator(), mod = ctx.createOscillator(), modGain = ctx.createGain(), env = ctx.createGain();
  const freq = 440 * Math.pow(2, (pitch - 69) / 12); const realVol = vol * (vel / 127);
  carrier.type = 'sine'; carrier.frequency.setValueAtTime(freq, time);
  mod.type = 'sine'; mod.frequency.setValueAtTime(freq * (p.ratio||2), time);
  if (pbNode) { pbNode.connect(carrier.detune); pbNode.connect(mod.detune); }
  modGain.gain.setValueAtTime(freq * (p.modIndex||5) * (vel/100), time);
  env.gain.setValueAtTime(0, time); env.gain.linearRampToValueAtTime(realVol, time + (p.attack||0.01));
  env.gain.setValueAtTime(realVol, time + dur); env.gain.exponentialRampToValueAtTime(0.001, time + dur + (p.release||0.2));
  mod.connect(modGain); modGain.connect(carrier.frequency); carrier.connect(env); env.connect(bus);
  carrier.start(time); mod.start(time); carrier.stop(time + dur + 0.5); mod.stop(time + dur + 0.5);
};

const triggerPluck = (ctx, bus, pitch, time, vol, dur, p={}, vel=100, pbNode) => {
  const freq = 440 * Math.pow(2, (pitch - 69) / 12); const realVol = vol * (vel / 127);
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
  for(let i=0; i < noiseBuf.getChannelData(0).length; i++) noiseBuf.getChannelData(0)[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource(); noise.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = (p.damping || 4000) * (vel / 100);
  const delay = ctx.createDelay(1.0); delay.delayTime.value = 1 / freq;
  const fb = ctx.createGain(); fb.gain.value = p.decay || 0.95; 
  const out = ctx.createGain(); out.gain.setValueAtTime(realVol, time); out.gain.setTargetAtTime(0, time + dur + 1.0, 0.1); 
  noise.connect(filter); filter.connect(delay); filter.connect(out); 
  delay.connect(fb); fb.connect(delay); delay.connect(out); out.connect(bus); noise.start(time);
};

const triggerAcid = (ctx, bus, pitch, time, vol, dur, p={}, vel=100, pbNode) => {
  const osc = ctx.createOscillator(); const realVol = vol * (vel / 127);
  osc.type = p.oscType || 'square'; osc.frequency.setValueAtTime(440 * Math.pow(2, (pitch - 69) / 12), time);
  if (pbNode) pbNode.connect(osc.detune);
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = p.res || 5; 
  const baseCut = p.cutoff || 150; const envMod = (p.envMod || 2500) * (vel / 100);
  filter.frequency.setValueAtTime(baseCut + envMod, time); filter.frequency.setTargetAtTime(baseCut, time, (p.decay||0.3) / 3); 
  const amp = ctx.createGain(); amp.gain.setValueAtTime(realVol, time); amp.gain.setTargetAtTime(0, time + dur, 0.05);
  osc.connect(filter); filter.connect(amp); amp.connect(bus); osc.start(time); osc.stop(time + dur + 0.5);
};

const triggerMetronome = (ctx, bus, isDownbeat, time) => {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(isDownbeat ? 1500 : 1000, time);
  osc.frequency.exponentialRampToValueAtTime(isDownbeat ? 800 : 500, time + 0.02);
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(0.5, time + 0.001);
  env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.connect(env);
  env.connect(bus);
  osc.start(time);
  osc.stop(time + 0.06);
};

const triggerOrgan = (ctx, bus, pitch, time, vol, dur, p={}, vel=100, pbNode) => {
  const freq = 440 * Math.pow(2, (pitch - 69) / 12); const amp = ctx.createGain(); const realVol = vol * (vel / 127);
  amp.gain.setValueAtTime(0, time); amp.gain.linearRampToValueAtTime(realVol, time + 0.02);
  amp.gain.setValueAtTime(realVol, time + dur); amp.gain.linearRampToValueAtTime(0, time + dur + 0.1);
  const ratios = [0.5, 1, 1.5, 2]; const levels = [p.sub||0.8, p.fund||1.0, p.fifth||0.5, p.oct||0.5];
  ratios.forEach((ratio, i) => {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq * ratio;
      if (pbNode) pbNode.connect(osc.detune);
      const g = ctx.createGain(); g.gain.value = levels[i] / ratios.length;
      osc.connect(g); g.connect(amp); osc.start(time); osc.stop(time + dur + 0.2);
  });
  amp.connect(bus);
};

const triggerDrum = (ctx, bus, pitch, time, vol, p={}, vel=100) => {
  const realVol = vol * (vel / 127);
  if (pitch === 36) { // Kick
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.frequency.setValueAtTime(150, time); osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.5);
    env.gain.setValueAtTime(realVol, time); env.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
    osc.connect(env); env.connect(bus); osc.start(time); osc.stop(time + 0.5);
  } else if (pitch === 38 || pitch === 39) { // Snare/Clap
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = pitch === 39 ? 'square' : 'triangle'; osc.frequency.setValueAtTime(250, time);
    env.gain.setValueAtTime(realVol*0.5, time); env.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    osc.connect(env); env.connect(bus); osc.start(time); osc.stop(time + 0.2);
    
    const bufSize = ctx.sampleRate * 0.2, buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i=0; i<bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), nEnv = ctx.createGain();
    noise.buffer = buffer; filter.type = pitch === 39 ? 'bandpass' : 'highpass'; filter.frequency.value = 1000;
    nEnv.gain.setValueAtTime(realVol*0.8, time); nEnv.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    noise.connect(filter); filter.connect(nEnv); nEnv.connect(bus); noise.start(time);
  } else { // Hats/Cymbals
    const bufSize = ctx.sampleRate * 0.1, buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i=0; i<bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), nEnv = ctx.createGain();
    noise.buffer = buffer; filter.type = 'highpass'; filter.frequency.value = 7000;
    nEnv.gain.setValueAtTime(realVol*0.5, time); nEnv.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    noise.connect(filter); filter.connect(nEnv); nEnv.connect(bus); noise.start(time);
  }
};

const initTrackRouting = async (track, ctx, masterGain) => {
  const inputBus = ctx.createGain(), faderGain = ctx.createGain(), panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createPanner();
  if (panner.pan) panner.pan.value = (track.pan || 0) / 50; 
  faderGain.gain.value = track.volume / 100;
  
  const pitchBendNode = ctx.createConstantSource();
  pitchBendNode.offset.value = 0;
  pitchBendNode.start();
  
  let currentOutput = inputBus;
  const fxNodes = {};
  if (track.effects) {
    track.effects.forEach(fx => {
      const nodeObj = createFXNode(ctx, fx);
      if (nodeObj) { currentOutput.connect(nodeObj.input); currentOutput = nodeObj.output; fxNodes[fx.id] = nodeObj; }
    });
  }
  currentOutput.connect(panner); panner.connect(faderGain); faderGain.connect(masterGain);
  
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  faderGain.connect(analyser);

  return { inputBus, faderGain, panner, fxNodes, activeNoteIds: new Set(), activeSource: null, analyser, pitchBendNode };
};

// --- VU Meter Component ---
const VuMeter = ({ trackId, synthsRef, isMaster, masterAnalyserRef, isVertical = true }) => {
    const curtainRef = useRef(null);
    const clipRef = useRef(null);
    const dotRef = useRef(null);
    const peakRef = useRef(0);
    const peakHoldRef = useRef(0);
    const clipTimeoutRef = useRef(0);

    useEffect(() => {
        let reqId;
        const update = () => {
            let analyser = null;
            if (isMaster) analyser = masterAnalyserRef?.current;
            else analyser = synthsRef?.current[trackId]?.analyser;

            if (analyser && curtainRef.current) {
                const dataArray = new Float32Array(analyser.fftSize);
                analyser.getFloatTimeDomainData(dataArray);
                let currentPeak = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const abs = Math.abs(dataArray[i]);
                    if (abs > currentPeak) currentPeak = abs;
                }
                
                // Fast attack, smooth decay for the main meter
                if (currentPeak > peakRef.current) peakRef.current = currentPeak; 
                else peakRef.current *= 0.85; 

                // Peak Hold Dot logic (Slow decay)
                if (currentPeak > peakHoldRef.current) peakHoldRef.current = currentPeak;
                else peakHoldRef.current *= 0.98;
                
                let levelPercent = Math.min(100, peakRef.current * 140); 
                let dotPercent = Math.min(100, peakHoldRef.current * 140);
                
                // Audio Clipping LED
                if (currentPeak >= 0.95 && clipRef.current) {
                    clipRef.current.style.backgroundColor = '#ef4444';
                    clipRef.current.style.boxShadow = '0 0 6px #ef4444';
                    clearTimeout(clipTimeoutRef.current);
                    clipTimeoutRef.current = setTimeout(() => {
                        if (clipRef.current) {
                            clipRef.current.style.backgroundColor = '#262626';
                            clipRef.current.style.boxShadow = 'none';
                        }
                    }, 1000);
                }
                
                if (isVertical) {
                    curtainRef.current.style.height = `${100 - levelPercent}%`;
                    if (dotRef.current) dotRef.current.style.bottom = `${dotPercent}%`;
                } else {
                    curtainRef.current.style.width = `${100 - levelPercent}%`;
                    if (dotRef.current) dotRef.current.style.left = `${dotPercent}%`;
                }
            } else if (curtainRef.current) {
                peakRef.current *= 0.85;
                peakHoldRef.current *= 0.98;
                let levelPercent = Math.min(100, peakRef.current * 140);
                let dotPercent = Math.min(100, peakHoldRef.current * 140);
                if (isVertical) {
                    curtainRef.current.style.height = `${100 - levelPercent}%`;
                    if (dotRef.current) dotRef.current.style.bottom = `${dotPercent}%`;
                } else {
                    curtainRef.current.style.width = `${100 - levelPercent}%`;
                    if (dotRef.current) dotRef.current.style.left = `${dotPercent}%`;
                }
            }
            reqId = requestAnimationFrame(update);
        };
        reqId = requestAnimationFrame(update);
        return () => { cancelAnimationFrame(reqId); clearTimeout(clipTimeoutRef.current); };
    }, [trackId, synthsRef, isMaster, masterAnalyserRef, isVertical]);

    return (
        <div className={`flex ${isVertical ? 'flex-col h-full w-2' : 'flex-row w-full h-1.5'} items-center gap-[2px]`}>
            <div ref={clipRef} className={`bg-neutral-800 rounded-sm transition-colors duration-75 shrink-0 ${isVertical ? 'w-full h-1.5' : 'h-full w-1.5'}`} />
            <div className={`relative overflow-hidden rounded-sm border border-neutral-900 shadow-inner ${isVertical ? 'w-full flex-1 bg-gradient-to-t' : 'h-full flex-1 bg-gradient-to-r'} from-green-500 via-yellow-400 to-red-500`}>
                <div ref={curtainRef} className={`absolute bg-neutral-950/95 backdrop-blur-sm ${isVertical ? 'top-0 left-0 w-full' : 'top-0 right-0 h-full'}`} style={{ [isVertical ? 'height' : 'width']: '100%' }} />
                
                {/* Peak Hold Dot */}
                <div ref={dotRef} className={`absolute bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)] z-10 ${isVertical ? 'left-0 w-full h-[2px]' : 'top-0 h-full w-[2px]'}`} style={{ [isVertical ? 'bottom' : 'left']: '0%' }} />

                <div className={`absolute inset-0 pointer-events-none ${isVertical ? 'bg-[linear-gradient(to_bottom,transparent_1px,rgba(0,0,0,0.6)_1px)] bg-[length:100%_3px]' : 'bg-[linear-gradient(to_right,transparent_1px,rgba(0,0,0,0.6)_1px)] bg-[length:3px_100%]'}`} />
            </div>
        </div>
    );
};
// --- Profile Picture Cropper Component ---
const ImageCropper = ({ src, onComplete, onCancel }) => {
    const CROP_SIZE = 200;
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
    const imgRef = useRef(null);
    const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialOffsetX: 0, initialOffsetY: 0 });

    const handleImageLoad = (e) => setImgDims({ w: e.target.naturalWidth, h: e.target.naturalHeight });

    const minScale = imgDims.w ? Math.max(CROP_SIZE / imgDims.w, CROP_SIZE / imgDims.h) : 1;
    const currentScale = minScale * zoom;
    const scaledW = imgDims.w * currentScale;
    const scaledH = imgDims.h * currentScale;
    
    // Calculate strict bounding limits so the image can't be dragged outside the crop circle
    const maxX = Math.max(0, (scaledW - CROP_SIZE) / 2);
    const maxY = Math.max(0, (scaledH - CROP_SIZE) / 2);

    const clampedX = Math.min(Math.max(offset.x, -maxX), maxX);
    const clampedY = Math.min(Math.max(offset.y, -maxY), maxY);

    // Auto-recenter if zooming out pulls the image out of bounds
    useEffect(() => {
        if (offset.x !== clampedX || offset.y !== clampedY) setOffset({ x: clampedX, y: clampedY });
    }, [zoom, maxX, maxY, clampedX, clampedY, offset.x, offset.y]);

    const handlePointerDown = (e) => {
        dragRef.current = { isDragging: true, startX: e.clientX, startY: e.clientY, initialOffsetX: clampedX, initialOffsetY: clampedY };
        e.target.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (!dragRef.current.isDragging) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        let newX = dragRef.current.initialOffsetX + dx;
        let newY = dragRef.current.initialOffsetY + dy;
        
        newX = Math.min(Math.max(newX, -maxX), maxX);
        newY = Math.min(Math.max(newY, -maxY), maxY);
        setOffset({ x: newX, y: newY });
    };

    const handlePointerUp = (e) => {
        dragRef.current.isDragging = false;
        e.target.releasePointerCapture(e.pointerId);
    };

    const handleWheel = (e) => {
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        setZoom(z => Math.max(1, Math.min(4, z + delta)));
    };

    const handleSave = () => {
        const canvas = document.createElement('canvas');
        canvas.width = CROP_SIZE; canvas.height = CROP_SIZE;
        const ctx = canvas.getContext('2d');
        
        // Draw the transformed image offset onto the final canvas bounds
        const drawX = (CROP_SIZE / 2) + clampedX - (scaledW / 2);
        const drawY = (CROP_SIZE / 2) + clampedY - (scaledH / 2);
        
        ctx.drawImage(imgRef.current, drawX, drawY, scaledW, scaledH);
        onComplete(canvas.toDataURL('image/jpeg', 0.9));
    };

    return (
        <div className="flex flex-col items-center gap-6 w-full py-4">
            <img ref={imgRef} src={src} onLoad={handleImageLoad} className="hidden" alt="source-hidden" />
            
            <div 
                className="relative overflow-hidden rounded-full border-[3px] border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] bg-neutral-950 touch-none cursor-move group"
                style={{ width: CROP_SIZE, height: CROP_SIZE }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onWheel={handleWheel}
            >
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10" />
                {imgDims.w > 0 && (
                    <div 
                        className="absolute pointer-events-none transition-transform duration-75"
                        style={{
                            width: scaledW, height: scaledH,
                            left: (CROP_SIZE - scaledW) / 2 + clampedX,
                            top: (CROP_SIZE - scaledH) / 2 + clampedY,
                            backgroundImage: `url(${src})`,
                            backgroundSize: '100% 100%',
                            backgroundRepeat: 'no-repeat'
                        }}
                    />
                )}
            </div>

            <div className="flex items-center gap-4 w-full max-w-[240px] bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Zoom</span>
                <input 
                    type="range" min="1" max="4" step="0.05" 
                    value={zoom} onChange={e => setZoom(Number(e.target.value))} 
                    className="flex-1 h-1.5 bg-neutral-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer hover:[&::-webkit-slider-thumb]:bg-blue-300"
                />
            </div>

            <div className="flex justify-between w-full mt-2 gap-4">
                <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-bold text-neutral-400 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleSave} className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2"><CheckCircle2 size={16}/> Apply Crop</button>
            </div>
        </div>
    );
};

// --- Custom Audio Waveform Preview Component ---
const WaveformDisplay = ({ buffer, bpm, beatWidth, sampleOffset = 0 }) => {
    const canvasRef = useRef(null);
    const widthPx = buffer.duration * (bpm / 60) * beatWidth;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !buffer) return;
        const ctx = canvas.getContext('2d');
        
        // Dynamically scale internal canvas resolution to actual render width
        // Maxed at 16000px to prevent browser memory crashes on extreme zooms
        const renderWidth = Math.max(1000, Math.min(16000, Math.ceil(widthPx))); 
        const height = 100;
        
        canvas.width = renderWidth;
        canvas.height = height;

        const data = buffer.getChannelData(0);
        const step = Math.max(1, Math.ceil(data.length / renderWidth));
        const amp = height / 2;

        ctx.clearRect(0, 0, renderWidth, height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        
        ctx.beginPath();
        for (let i = 0; i < renderWidth; i++) {
            let min = 0;
            let max = 0;
            for (let j = 0; j < step; j++) {
                const idx = (i * step) + j;
                if (idx < data.length) {
                    const val = data[idx];
                    if (val < min) min = val;
                    if (val > max) max = val;
                }
            }
            const y = (1 - max) * amp;
            const h = Math.max(1, (max - min) * amp);
            ctx.rect(i, y, 1, h);
        }
        ctx.fill();
    }, [buffer, widthPx]); // Added widthPx to redraw in high-res when zoomed

    return (
        <div className="absolute inset-y-0 overflow-hidden pointer-events-none mix-blend-overlay opacity-60" style={{ width: `${widthPx}px`, left: `-${sampleOffset * beatWidth}px`, top: '16px' }}>
            <canvas ref={canvasRef} className="w-full h-full object-fill" />
        </div>
    );
};
export default class App extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  
  componentDidCatch(error, errorInfo) { 
      console.error("FreeDaw-Collab Crashed:", error, errorInfo); 
      // Forward the crash to the Node API so it shows up in Docker logs
      fetch(`${API_BASE_URL}/api/logs/frontend-error`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              type: 'React Crash', 
              error: error.toString(), 
              stack: errorInfo.componentStack,
              url: window.location.href,
              userAgent: navigator.userAgent
          })
      }).catch(e => console.warn("Could not send crash log to server", e));
  }

  componentDidMount() {
      // Catch unhandled global JS errors outside of React
      window.onerror = (message, source, lineno, colno, err) => {
          fetch(`${API_BASE_URL}/api/logs/frontend-error`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  type: 'Global Runtime Error', 
                  message, source, lineno, colno, 
                  error: err?.toString() 
              })
          }).catch(() => {});
      };
  }

  render() {
    if (this.state.hasError) return (
      <div className="flex flex-col h-screen bg-neutral-950 items-center justify-center text-white p-8">
        <AlertTriangle size={64} className="text-red-500 mb-6" />
        <h1 className="text-3xl font-bold mb-2">Workspace Crashed</h1>
        <p className="text-sm text-neutral-400 font-mono text-center max-w-md mb-6">{this.state.error?.toString()}</p>
        <button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-500 px-6 py-3 rounded-xl font-bold transition-colors">RELOAD WORKSPACE</button>
      </div>
    );
    return <DAWStudio />;
  }
}

function DAWStudio() {
  const [appView, setAppView] = useState('auth'); 
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState('New Project');
  const [projectOwnerId, setProjectOwnerId] = useState(null);
  const [projectOwnerName, setProjectOwnerName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [currentTime, setCurrentTime] = useState(0); 
  const [masterVolume, setMasterVolume] = useState(80);
  const [tracks, setTracks] = useState([]);
  const [activeView, setActiveView] = useState('arrangement'); 
  const [bottomDock, setBottomDock] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [toasts, setToasts] = useState([]);
  
  const [loopRegion, setLoopRegion] = useState({ start: 0, end: 8, enabled: false });
  const [draggingLoop, setDraggingLoop] = useState(null);
  
  const [snapGrid, setSnapGrid] = useState(0.25);
  const BEAT_WIDTH = 64 * zoom;
  
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [authName, setAuthName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [sharedWith, setSharedWith] = useState([]);
  const [viewProfileUser, setViewProfileUser] = useState(null);
  
  const socketRef = useRef(null);
  const [peers, setPeers] = useState({});

  const [localProjects, setLocalProjects] = useState([]);
  const [serverProjects, setServerProjects] = useState([]); 

  const [contextMenu, setContextMenu] = useState(null);
  const [editingTrackId, setEditingTrackId] = useState(null);
  const [draggingClip, setDraggingClip] = useState(null);
  const [dragHover, setDragHover] = useState(null); // Real-time file drag states
  const [draggingEdge, setDraggingEdge] = useState(null);
  const [draggingNote, setDraggingNote] = useState(null);
  const [draggingNoteEdge, setDraggingNoteEdge] = useState(null);
  const [draggingAutoPoint, setDraggingAutoPoint] = useState(null);
  const [isAutomationMode, setIsAutomationMode] = useState(false);
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const [dockHeight, setDockHeight] = useState(260);
  const [draggingDockHeight, setDraggingDockHeight] = useState(false);
  const [draggedFxIndex, setDraggedFxIndex] = useState(null);
  const [dragOverFxIndex, setDragOverFxIndex] = useState(null);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [selectedClipIds, setSelectedClipIds] = useState([]);
  const [dragHoverHome, setDragHoverHome] = useState(false);

  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const masterAnalyserRef = useRef(null);
  const synthsRef = useRef({});
  const lastTimeRef = useRef(0);
  
  const recordingStartTimeRef = useRef(0);
  const activeLiveMidiNotesRef = useRef({});
  const pendingMidiClipsRef = useRef({});
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  
  const [audioInputsList, setAudioInputsList] = useState([]);
  const [midiInputsList, setMidiInputsList] = useState([]);
  const [midiConfig, setMidiConfig] = useState({ keyboard: '', pad: '', mixer: '' });
  const [midiMappings, setMidiMappings] = useState({});
  const [midiLearnTarget, setMidiLearnTarget] = useState(null);
  
  const currentProjectIdRef = useRef(projectId);
  const authTokenRef = useRef(authToken);
  const stateRefs = useRef({ currentTime: 0, isPlaying: false, isRecording: false, bpm: 120 });
  const isMetronomeEnabledRef = useRef(isMetronomeEnabled);
  const lastMetronomeBeatRef = useRef(-1);
  const tracksRef = useRef(tracks);
  const timelineRef = useRef(null);
  const loopRegionRef = useRef(loopRegion);
  const midiConfigRef = useRef(midiConfig);
  const midiMappingsRef = useRef(midiMappings);
  const midiLearnTargetRef = useRef(midiLearnTarget);
  const snapGridRef = useRef(snapGrid);
  const pianoRollContainerRef = useRef(null);
  const hoveredNoteRef = useRef(null);
  const dragValuesRef = useRef({});
  const isInitialMount = useRef(true);
  const lastEmitRef = useRef(0);
  const lastAutoUiUpdateRef = useRef(0);
  
  // Missing Refs for Hotkeys, State, and Undo/Redo Engine
  const projectNameRef = useRef(projectName);
  const selectedTrackIdRef = useRef(selectedTrackId);
  const selectedClipIdsRef = useRef(selectedClipIds);
  const clipboardRef = useRef(null);
  const historyRef = useRef([]);
  const historyPtrRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const transportActionsRef = useRef({});

  // NEW: A throttled network emitter for butter-smooth visual dragging across clients
  const broadcastLivePreview = useCallback((action) => {
      const now = Date.now();
      if (now - lastEmitRef.current > 40) {  // Sync at roughly ~25fps to save network traffic
          if (socketRef.current) socketRef.current.emit('daw-action', { ...action, projectId: currentProjectIdRef.current });
          lastEmitRef.current = now;
      }
  }, []);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { projectNameRef.current = projectName; }, [projectName]);
  useEffect(() => { selectedTrackIdRef.current = selectedTrackId; }, [selectedTrackId]);
  useEffect(() => { selectedClipIdsRef.current = selectedClipIds; }, [selectedClipIds]);

  // Global Undo/Redo History Tracker
  useEffect(() => {
      if (isUndoRedoRef.current) {
          isUndoRedoRef.current = false;
          return;
      }
      const hist = historyRef.current;
      hist.splice(historyPtrRef.current + 1);
      hist.push(JSON.parse(JSON.stringify(tracks)));
      if (hist.length > 50) hist.shift(); // Limit history to last 50 actions to save memory
      historyPtrRef.current = hist.length - 1;
  }, [tracks]);

  // Auto-fetch missing audio clips on project load/sync
  useEffect(() => {
      tracks.forEach(t => {
          if (t.type === 'audio') {
              t.clips.forEach(c => {
                  if (c.sampleId && !globalAudioBufferCache.has(c.sampleId) && !globalAudioBufferCache.has(`loading_${c.sampleId}`)) {
                      globalAudioBufferCache.set(`loading_${c.sampleId}`, true);
                      fetch(`${API_BASE_URL}/api/samples/${c.sampleId}.wav`)
                          .then(res => {
                              if (!res.ok) throw new Error("Audio missing on server");
                              return res.arrayBuffer();
                          })
                          .then(ab => {
                              const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
                              return ctx.decodeAudioData(ab);
                          })
                          .then(buffer => {
                              globalAudioBufferCache.set(c.sampleId, { buffer, duration: buffer.duration });
                              globalAudioBufferCache.delete(`loading_${c.sampleId}`);
                              setTracks(prev => [...prev]); // Trigger re-render to show waveform
                          })
                          .catch(err => {
                              console.error("Missing or failed audio sample", c.sampleId);
                              globalAudioBufferCache.delete(`loading_${c.sampleId}`);
                          });
                  }
              });
          }
      });
  }, [tracks]);

  useEffect(() => { currentProjectIdRef.current = projectId; }, [projectId]);
  useEffect(() => { authTokenRef.current = authToken; }, [authToken]);
  useEffect(() => { loopRegionRef.current = loopRegion; }, [loopRegion]);
  useEffect(() => { midiConfigRef.current = midiConfig; }, [midiConfig]);
  useEffect(() => { midiMappingsRef.current = midiMappings; }, [midiMappings]);
  useEffect(() => { midiLearnTargetRef.current = midiLearnTarget; }, [midiLearnTarget]);
  useEffect(() => { snapGridRef.current = snapGrid; }, [snapGrid]);
  useEffect(() => { isMetronomeEnabledRef.current = isMetronomeEnabled; }, [isMetronomeEnabled]);
  useEffect(() => { 
    stateRefs.current.isPlaying = isPlaying; 
    stateRefs.current.isRecording = isRecording;
    stateRefs.current.bpm = bpm; 
  }, [isPlaying, isRecording, bpm]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape' && midiLearnTarget) setMidiLearnTarget(null); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [midiLearnTarget]);

  useEffect(() => {
    const el = pianoRollContainerRef.current;
    if (!el) return;
    const handleWheel = (e) => {
        if (hoveredNoteRef.current) {
            e.preventDefault(); 
        }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [bottomDock?.type]);

  // Graceful Autosave
  useEffect(() => {
      if (isInitialMount.current) {
          isInitialMount.current = false;
          return;
      }
      if (projectId && tracks.length > 0) {
          const timer = setTimeout(() => {
              saveProject(sharedWith, isPublic, true);
          }, 3000); 
          return () => clearTimeout(timer);
      }
  }, [tracks, bpm, projectName, sharedWith, isPublic]);

  // Fetch users when the share modal opens
  useEffect(() => {
      if (showShareModal && authToken) {
          fetch(`${API_BASE_URL}/api/users`, { headers: { 'Authorization': `Bearer ${authToken}` } })
          .then(res => res.json())
          .then(data => setRegisteredUsers(data))
          .catch(e => console.error(e));
      }
  }, [showShareModal, authToken]);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #4b5563 transparent; }
      .custom-scrollbar::-webkit-scrollbar { width: 14px; height: 14px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.15); border-radius: 8px; border: 4px solid transparent; background-clip: padding-box; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 8px; border: 4px solid transparent; background-clip: padding-box; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6b7280; border: 4px solid transparent; background-clip: padding-box; }
      .custom-scrollbar::-webkit-scrollbar-corner { background: transparent; }
    `;
    document.head.appendChild(style);
    return () => { if (document.head.contains(style)) document.head.removeChild(style); };
  }, []);

  const handleContextMenu = (e, type, payload) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, payload });
  };

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const previewNote = useCallback((trackId, pitch, velocity = 100) => {
      if (!audioCtxRef.current) return;
      const track = tracksRef.current.find(t => t.id === trackId);
      const synth = synthsRef.current[trackId];
      if (!track || !synth || track.muted) return;
      
      const now = audioCtxRef.current.currentTime;
      const dur = 0.2; 
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

      const pbNode = synth.pitchBendNode;
      if (track.instrument === 'inst-drum') triggerDrum(audioCtxRef.current, synth.inputBus, pitch, now, 1, track.instrumentParams, velocity);
      else if (track.instrument === 'inst-fm') triggerFMSynth(audioCtxRef.current, synth.inputBus, pitch, now, 1, dur, track.instrumentParams, velocity, pbNode);
      else if (track.instrument === 'inst-supersaw') triggerSupersaw(audioCtxRef.current, synth.inputBus, pitch, now, 1, dur, track.instrumentParams, velocity, pbNode);
      else if (track.instrument === 'inst-pluck') triggerPluck(audioCtxRef.current, synth.inputBus, pitch, now, 1, dur, track.instrumentParams, velocity, pbNode);
      else if (track.instrument === 'inst-acid') triggerAcid(audioCtxRef.current, synth.inputBus, pitch, now, 1, dur, track.instrumentParams, velocity, pbNode);
      else if (track.instrument === 'inst-organ') triggerOrgan(audioCtxRef.current, synth.inputBus, pitch, now, 1, dur, track.instrumentParams, velocity, pbNode);
      else triggerSubtractive(audioCtxRef.current, synth.inputBus, pitch, now, 1, dur, track.instrumentParams, velocity, pbNode);
  }, []);

  const handleAvatarUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setCropImageSrc(reader.result);
              setShowProfileMenu(false);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleCropComplete = async (croppedDataUrl) => {
      const next = { ...currentUser, avatar: croppedDataUrl };
      setCurrentUser(next);
      localStorage.setItem('freedaw_user', JSON.stringify(next));
      if (socketRef.current) socketRef.current.emit('presence-update', { 
          username: next.username, avatar: croppedDataUrl, color: next.color, 
          bio: next.bio, email: next.email, website: next.website, instagram: next.instagram, twitter: next.twitter 
      });
      setCropImageSrc(null);
      showToast("Profile picture updated", "success");
      
      if (authTokenRef.current) {
          try {
              await fetch(`${API_BASE_URL}/api/users/profile`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authTokenRef.current}` },
                  body: JSON.stringify({ avatar: croppedDataUrl })
              });
          } catch(e) {}
      }
  };

  const handleProfileUpdate = async (field, value) => {
      if (currentUser?.[field] === value) return;
      const next = { ...currentUser, [field]: value };
      setCurrentUser(next);
      localStorage.setItem('freedaw_user', JSON.stringify(next));
      if (socketRef.current) socketRef.current.emit('presence-update', { 
          username: next.username, avatar: next.avatar, color: next.color, 
          bio: next.bio, email: next.email, website: next.website, instagram: next.instagram, twitter: next.twitter 
      });
      showToast(`${field.charAt(0).toUpperCase() + field.slice(1)} updated`, "success");
      
      if (authTokenRef.current) {
          try {
              await fetch(`${API_BASE_URL}/api/users/profile`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authTokenRef.current}` },
                  body: JSON.stringify({ [field]: value })
              });
          } catch(e) {}
      }
  };

  const handleUndo = useCallback(() => {
      if (historyPtrRef.current > 0) {
          isUndoRedoRef.current = true;
          historyPtrRef.current -= 1;
          const prev = historyRef.current[historyPtrRef.current];
          setTracks(prev);
          broadcastLivePreview({ type: 'SYNC_STATE', payload: { tracks: prev, bpm: stateRefs.current.bpm } });
          showToast("Undo", "info");
      }
  }, [broadcastLivePreview, showToast]);

  const handleRedo = useCallback(() => {
      if (historyPtrRef.current < historyRef.current.length - 1) {
          isUndoRedoRef.current = true;
          historyPtrRef.current += 1;
          const next = historyRef.current[historyPtrRef.current];
          setTracks(next);
          broadcastLivePreview({ type: 'SYNC_STATE', payload: { tracks: next, bpm: stateRefs.current.bpm } });
          showToast("Redo", "info");
      }
  }, [broadcastLivePreview, showToast]);

  const handleShareProject = async () => {
      if (!shareUsername.trim() || sharedWith.includes(shareUsername.trim())) return;
      const nextShared = [...sharedWith, shareUsername.trim()];
      setSharedWith(nextShared);
      setShareUsername('');
      showToast(`Shared with ${shareUsername.trim()}`, 'success');
      await saveProject(nextShared); 
      if (socketRef.current) {
          socketRef.current.emit('daw-action', { type: 'PROJECT_SHARED' });
      }
  };

  const saveProject = useCallback(async (currentShared = sharedWith, currentPublic = isPublic, isAuto = false, overrideId = null, overrideName = null) => {
      const finalId = overrideId || currentProjectIdRef.current || `proj_${Date.now()}`;
      const finalName = overrideName || projectNameRef.current;
      const p = { 
          id: finalId, 
          name: finalName, 
          tracks: tracksRef.current, 
          bpm: stateRefs.current.bpm, 
          lastModified: Date.now(),
          ownerId: projectOwnerId || currentUser?.id,
          ownerName: projectOwnerName || currentUser?.username,
          sharedWith: currentShared,
          isPublic: currentPublic
      };
      await idb.set('projects', p); 
      if (!isAuto) showToast("Saved locally.", "info");
      if (authTokenRef.current) {
          try { 
              await fetch(`${API_BASE_URL}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authTokenRef.current}` }, body: JSON.stringify(p) }); 
              if (!isAuto) showToast("Synced to Server.", "success"); 
          } catch(e) {}
      }
  }, [sharedWith, isPublic, projectOwnerId, projectOwnerName, currentUser, showToast]);

  const loadProjectToDaw = (p) => {
      setProjectId(p.id); setProjectName(p.name); setProjectOwnerId(p.ownerId || null); setProjectOwnerName(p.ownerName || ''); setTracks(p.tracks || []); setBpm(p.bpm || 120); setSharedWith(p.sharedWith || []); setIsPublic(p.isPublic || false); setAppView('daw');
      setTimeout(() => {
          dispatchDawAction({ type: 'REQUEST_SYNC' });
      }, 500);
  };

  const initAudioEngine = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      masterGainRef.current = audioCtxRef.current.createGain();
      masterGainRef.current.gain.value = masterVolume / 100;
      masterGainRef.current.connect(audioCtxRef.current.destination);

      // CRITICAL FIX: Initialize and connect the Master Analyser for the VU Meters
      const masterAnalyser = audioCtxRef.current.createAnalyser();
      masterAnalyser.fftSize = 256;
      masterGainRef.current.connect(masterAnalyser);
      masterAnalyserRef.current = masterAnalyser;
    }
    if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
    
    for (const track of tracksRef.current) {
      if (!synthsRef.current[track.id]) synthsRef.current[track.id] = await initTrackRouting(track, audioCtxRef.current, masterGainRef.current);
    }
  };

  const startAudioRecording = async (track) => {
      if (track.type !== 'audio') return;
      try {
          const constraints = track.audioInputId ? { deviceId: { exact: track.audioInputId } } : true;
          const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
          const mr = new MediaRecorder(stream);
          mediaRecorderRef.current = mr;
          recordedChunksRef.current = [];
          
          mr.ondataavailable = (e) => {
              if (e.data.size > 0) recordedChunksRef.current.push(e.data);
          };
          
          mr.onstop = async () => {
              stream.getTracks().forEach(t => t.stop());
              const blob = new Blob(recordedChunksRef.current, { type: 'audio/wav' });
              const sampleId = `rec_${Date.now()}`;
              
              const formData = new FormData();
              formData.append('audio', blob);
              
              try {
                  await fetch(`${API_BASE_URL}/api/samples/upload/${sampleId}`, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${authTokenRef.current}` },
                      body: formData
                  });
              } catch(e) {
                  showToast("Failed to upload recording.", "error");
              }

              const arrayBuffer = await blob.arrayBuffer();
              if (!audioCtxRef.current) return;
              const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
              
              globalAudioBufferCache.set(sampleId, { buffer: audioBuffer, duration: audioBuffer.duration });
              
              const startBeat = recordingStartTimeRef.current;
              const durBeats = audioBuffer.duration * (stateRefs.current.bpm / 60);
              const newClip = { id: Date.now(), start: startBeat, duration: Math.max(1, durBeats), sampleId };
              dispatchDawAction({ type: 'ADD_CLIP', payload: { trackId: track.id, clip: newClip } });
          };
          
          mr.start();
      } catch (err) {
          showToast("Audio input denied or unavailable.", "error");
          setIsRecording(false);
      }
  };

  const finalizeRecording = () => {
      const startBeat = recordingStartTimeRef.current;
      const durBeats = stateRefs.current.currentTime - startBeat;
      const armedTrack = tracksRef.current.find(t => t.armed);
      
      if (armedTrack?.type === 'midi') {
          const notes = pendingMidiClipsRef.current[armedTrack.id] || [];
          if (notes.length > 0) {
              const newClip = { id: Date.now(), start: startBeat, duration: Math.max(1, durBeats), notes };
              dispatchDawAction({ type: 'ADD_CLIP', payload: { trackId: armedTrack.id, clip: newClip } });
          }
      } else if (armedTrack?.type === 'audio') {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
          }
      }
      pendingMidiClipsRef.current = {};
  };

  const handleExportMultitrack = async () => {
      setIsExporting(true);
      showToast("Generating Multitrack ZIP Stems...", "info");
      try {
          const JSZip = await loadJSZip();
          const zip = new JSZip();

          let maxBeat = 0;
          tracksRef.current.forEach(t => t.clips.forEach(c => {
              if (c.start + c.duration > maxBeat) maxBeat = c.start + c.duration;
          }));
          if (maxBeat === 0) maxBeat = 4;

          let trackIndex = 1;
          for (const track of tracksRef.current) {
              const safeName = `track_${String(trackIndex).padStart(2, '0')}_${track.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
              
              if (track.type === 'midi') {
                  const midiBytes = writeMidiFile(track.clips, track.name, stateRefs.current.bpm);
                  // JSZip perfectly handles Uint8Array internally, {binary: true} can incorrectly invoke string parsers
                  if (midiBytes.length > 0) zip.file(`${safeName}.mid`, midiBytes);
              } else if (track.type === 'audio' && track.clips.length > 0) {
                  const durationSec = (maxBeat * (60 / stateRefs.current.bpm)) + 4.0;
                  const sampleRate = 44100;
                  const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, sampleRate * durationSec, sampleRate);
                  const trackGain = offlineCtx.createGain();
                  trackGain.gain.value = 1.0; 
                  trackGain.connect(offlineCtx.destination);

                  const synth = await initTrackRouting(track, offlineCtx, trackGain);

                  track.clips.forEach(clip => {
                      const startTimeSec = clip.start * (60 / stateRefs.current.bpm);
                      if (clip.sampleId && globalAudioBufferCache.has(clip.sampleId)) {
                          const sampleData = globalAudioBufferCache.get(clip.sampleId);
                          const source = offlineCtx.createBufferSource();
                          source.buffer = sampleData.buffer;
                          source.connect(synth.inputBus);
                          const secOffset = (clip.sampleOffset || 0) * (60 / stateRefs.current.bpm);
                          const secDuration = clip.duration * (60 / stateRefs.current.bpm);
                          source.start(startTimeSec, Math.max(0, secOffset), Math.max(0, secDuration));
                      }
                  });

                  const renderedBuffer = await offlineCtx.startRendering();
                  const wavBlob = audioBufferToWav(renderedBuffer);
                  zip.file(`${safeName}.wav`, wavBlob);
              }
              trackIndex++;
          }

          const content = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(content);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projectNameRef.current.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_stems.zip`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          showToast("Multitrack ZIP Exported!", "success");

      } catch (err) {
          console.error(err);
          showToast("ZIP Export failed: " + err.message, "error");
      } finally {
          setIsExporting(false);
      }
  };

  const handleHomeDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragHoverHome(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'));
      if (!zipFile) {
          showToast("Please drop a valid .zip multitrack file.", "error");
          return;
      }

      showToast("Parsing Multitrack ZIP...", "info");
      try {
          const JSZip = await loadJSZip();
          const zip = await JSZip.loadAsync(zipFile);
          
          const newTracks = [];
          if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();

          for (const [filename, zipEntry] of Object.entries(zip.files)) {
              if (zipEntry.dir) continue;
              const ext = filename.split('.').pop().toLowerCase();
              const nameWithoutExt = filename.split('/').pop().replace(`.${ext}`, '');
              
              if (['mid', 'midi'].includes(ext)) {
                  const arrayBuffer = await zipEntry.async("arraybuffer");
                  const fileObj = new File([arrayBuffer], filename, { type: 'audio/midi' });
                  const notes = await parseMidiFile(fileObj);
                  
                  if (notes && notes.length > 0) {
                      let maxBeat = 0; notes.forEach(n => { if (n.start + n.duration > maxBeat) maxBeat = n.start + n.duration; });
                      newTracks.push({
                          id: Date.now() + Math.floor(Math.random() * 10000),
                          name: nameWithoutExt.substring(0, 16),
                          type: 'midi',
                          instrument: 'inst-subtractive',
                          instrumentParams: {cutoff:2000, res:1},
                          color: 'bg-pink-500',
                          volume: 80, pan: 0, muted: false, solo: false, armed: false, effects: [],
                          clips: [{ id: Date.now() + Math.random(), start: 0, duration: Math.max(4, maxBeat), notes }]
                      });
                  }
              } else if (['wav', 'mp3', 'ogg', 'flac'].includes(ext)) {
                  const blob = await zipEntry.async("blob");
                  const sampleId = `import_${Date.now()}_${Math.floor(Math.random()*1000)}`;
                  const formData = new FormData(); 
                  formData.append('audio', new File([blob], filename));
                  
                  if (authTokenRef.current) {
                      fetch(`${API_BASE_URL}/api/samples/upload/${sampleId}`, { 
                          method: 'POST', headers: { 'Authorization': `Bearer ${authTokenRef.current}` }, body: formData 
                      }).catch(() => {});
                  }

                  const arrayBuffer = await blob.arrayBuffer();
                  const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
                  globalAudioBufferCache.set(sampleId, { buffer: audioBuffer, duration: audioBuffer.duration });
                  
                  const durBeats = audioBuffer.duration * (120 / 60); 
                  
                  newTracks.push({
                      id: Date.now() + Math.floor(Math.random() * 10000),
                      name: nameWithoutExt.substring(0, 16),
                      type: 'audio',
                      audioInputId: '',
                      color: 'bg-emerald-500',
                      volume: 80, pan: 0, muted: false, solo: false, armed: false, effects: [],
                      clips: [{ id: Date.now() + Math.random(), start: 0, duration: Math.max(1, durBeats), sampleId, sampleOffset: 0 }]
                  });
              }
          }

          if (newTracks.length > 0) {
              const newProject = {
                  id: `proj_${Date.now()}`,
                  name: zipFile.name.replace('.zip', '').substring(0, 30),
                  tracks: newTracks,
                  bpm: 120,
                  lastModified: Date.now(),
                  ownerId: currentUser?.id,
                  ownerName: currentUser?.username,
                  sharedWith: [],
                  isPublic: false
              };
              
              await idb.set('projects', newProject); 
              loadProjectToDaw(newProject);
              showToast(`Imported ${newTracks.length} tracks successfully!`, "success");
          } else {
              showToast("No readable audio/MIDI files found in ZIP.", "error");
          }
      } catch (error) {
          console.error(error);
          showToast("Failed to import ZIP: " + error.message, "error");
      }
  };

  const handleExportBounce = async () => {
      setIsExporting(true);
      showToast("Rendering Mixdown (WAV)...", "info");

      try {
          let maxBeat = 0;
          tracksRef.current.forEach(t => {
              t.clips.forEach(c => {
                  if (c.start + c.duration > maxBeat) maxBeat = c.start + c.duration;
              });
          });

          if (maxBeat === 0) {
              showToast("Project is empty.", "error");
              setIsExporting(false);
              return;
          }

          // Convert beats to seconds, and add 4 seconds to let reverb/delay tails decay
          const durationSec = (maxBeat * (60 / stateRefs.current.bpm)) + 4.0;
          const sampleRate = 44100;
          const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, sampleRate * durationSec, sampleRate);
          
          const masterOfflineGain = offlineCtx.createGain();
          masterOfflineGain.gain.value = masterVolume / 100;
          masterOfflineGain.connect(offlineCtx.destination);

          const anySolo = tracksRef.current.some(t => t.solo);
          
          for (const track of tracksRef.current) {
              const isMuted = track.muted || (anySolo && !track.solo);
              if (isMuted) continue;

              const synth = await initTrackRouting(track, offlineCtx, masterOfflineGain);

              track.clips.forEach(clip => {
                  const startTimeSec = clip.start * (60 / stateRefs.current.bpm);
                  
                  if (track.type === 'midi' && clip.notes) {
                      clip.notes.forEach(note => {
                          const noteStartSec = startTimeSec + (note.start * (60 / stateRefs.current.bpm));
                          const noteDurSec = note.duration * (60 / stateRefs.current.bpm);
                          const vel = note.velocity || 100;
                          
                          const pbNode = synth.pitchBendNode;
                          if (track.instrument === 'inst-drum') triggerDrum(offlineCtx, synth.inputBus, note.pitch, noteStartSec, 1, track.instrumentParams, vel);
                          else if (track.instrument === 'inst-fm') triggerFMSynth(offlineCtx, synth.inputBus, note.pitch, noteStartSec, 1, noteDurSec, track.instrumentParams, vel, pbNode);
                          else if (track.instrument === 'inst-supersaw') triggerSupersaw(offlineCtx, synth.inputBus, note.pitch, noteStartSec, 1, noteDurSec, track.instrumentParams, vel, pbNode);
                          else if (track.instrument === 'inst-pluck') triggerPluck(offlineCtx, synth.inputBus, note.pitch, noteStartSec, 1, noteDurSec, track.instrumentParams, vel, pbNode);
                          else if (track.instrument === 'inst-acid') triggerAcid(offlineCtx, synth.inputBus, note.pitch, noteStartSec, 1, noteDurSec, track.instrumentParams, vel, pbNode);
                          else if (track.instrument === 'inst-organ') triggerOrgan(offlineCtx, synth.inputBus, note.pitch, noteStartSec, 1, noteDurSec, track.instrumentParams, vel, pbNode);
                          else triggerSubtractive(offlineCtx, synth.inputBus, note.pitch, noteStartSec, 1, noteDurSec, track.instrumentParams, vel, pbNode);
                      });
                  } else if (track.type === 'audio' && clip.sampleId && globalAudioBufferCache.has(clip.sampleId)) {
                      const sampleData = globalAudioBufferCache.get(clip.sampleId);
                      const source = offlineCtx.createBufferSource();
                      source.buffer = sampleData.buffer;
                      source.connect(synth.inputBus);
                      const secOffset = (clip.sampleOffset || 0) * (60 / stateRefs.current.bpm);
                      const secDuration = clip.duration * (60 / stateRefs.current.bpm);
                      source.start(startTimeSec, Math.max(0, secOffset), Math.max(0, secDuration));
                  }
              });
          }

          const renderedBuffer = await offlineCtx.startRendering();
          const wavBlob = audioBufferToWav(renderedBuffer);
          const url = URL.createObjectURL(wavBlob);
          
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_mixdown.wav`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          showToast("Export complete!", "success");

      } catch (error) {
          console.error(error);
          showToast("Export failed: " + error.message, "error");
      } finally {
          setIsExporting(false);
      }
  };

  const stopAudio = () => {
    Object.values(synthsRef.current).forEach(synth => { 
        if (synth.activeNoteIds) synth.activeNoteIds.clear(); 
        if (synth.activeSource) {
            try { synth.activeSource.stop(); } catch(e){}
            synth.activeSource = null;
        }
    });
  };

  const togglePlay = async () => {
    if (!isPlaying) { 
        await initAudioEngine(); 
        setIsPlaying(true); 
        lastMetronomeBeatRef.current = Math.floor(stateRefs.current.currentTime) - 1;
        if (isRecording) {
            recordingStartTimeRef.current = stateRefs.current.currentTime;
            activeLiveMidiNotesRef.current = {};
            pendingMidiClipsRef.current = {};
            const armedTrack = tracksRef.current.find(t => t.armed);
            if (armedTrack?.type === 'audio') startAudioRecording(armedTrack);
        }
    } else { 
        setIsPlaying(false); 
        stopAudio(); 
        if (isRecording) finalizeRecording();
    }
  };

  const stopPlayback = () => { 
      setIsPlaying(false); 
      setCurrentTime(0); 
      stateRefs.current.currentTime = 0; 
      stopAudio(); 
      if (isRecording) { setIsRecording(false); finalizeRecording(); }
  };
  
  const toggleRecord = () => {
      if (isRecording) {
          setIsRecording(false);
          if (isPlaying) finalizeRecording();
          return;
      }
      const armedTrack = tracksRef.current.find(t => t.armed);
      if (!armedTrack) {
          showToast("Please arm a track first to record.", "error");
          return;
      }
      setIsRecording(true);
      if (isPlaying) {
          recordingStartTimeRef.current = stateRefs.current.currentTime;
          activeLiveMidiNotesRef.current = {};
          pendingMidiClipsRef.current = {};
          if (armedTrack.type === 'audio') startAudioRecording(armedTrack);
      }
  };

  useEffect(() => {
    if (!isPlaying) return;
    let reqId;
    const update = () => {
      if (!audioCtxRef.current) { reqId = requestAnimationFrame(update); return; }
      const now = audioCtxRef.current.currentTime;
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;

      const prevTime = stateRefs.current.currentTime;
      let newTime = prevTime + (dt * (bpm / 60));
      
      // Loop Logic
      const loop = loopRegionRef.current;
      let wrapped = false;
      if (loop.enabled && prevTime < loop.end && newTime >= loop.end) {
          newTime = loop.start + (newTime - loop.end);
          wrapped = true;
      } else if (loop.enabled && newTime >= loop.end) {
          newTime = loop.start;
          wrapped = true;
      }

      if (wrapped) {
          Object.values(synthsRef.current).forEach(synth => { if (synth.activeNoteIds) synth.activeNoteIds.clear(); });
          lastMetronomeBeatRef.current = Math.floor(newTime) - 1;
      }

      if (isMetronomeEnabledRef.current && Math.floor(newTime) > lastMetronomeBeatRef.current) {
          const beatToPlay = Math.floor(newTime);
          lastMetronomeBeatRef.current = beatToPlay;
          triggerMetronome(audioCtxRef.current, masterGainRef.current, beatToPlay % 4 === 0, now);
      }

      setCurrentTime(newTime);
      stateRefs.current.currentTime = newTime;

          const currentTracks = tracksRef.current;
          const anySolo = currentTracks.some(t => t.solo);

          const automatedUpdates = [];

          currentTracks.forEach(track => {
            if (track.automation) {
                Object.entries(track.automation).forEach(([paramKey, points]) => {
                    if (points.length > 0) {
                        const val = getInterpolatedValue(points, newTime);
                        if (val !== null) {
                            const synth = synthsRef.current[track.id];
                            if (paramKey === 'volume' && synth) {
                                if (Math.abs(synth.faderGain.gain.value - val/100) > 0.01) synth.faderGain.gain.setTargetAtTime(val/100, now, 0.05);
                                automatedUpdates.push({ type: 'UPDATE_TRACK_VOL', payload: { id: track.id, volume: val } });
                            } else if (paramKey === 'pan' && synth?.panner?.pan) {
                                synth.panner.pan.setTargetAtTime(val/50, now, 0.05);
                                automatedUpdates.push({ type: 'UPDATE_TRACK_PAN', payload: { id: track.id, pan: val } });
                            } else if (paramKey.startsWith('fx_param_')) {
                                const parts = paramKey.split('_');
                                const fxId = parts[2];
                                const pName = parts.slice(3).join('_');
                                applyAudioEffectParam(track.id, fxId, pName, val, now);
                                automatedUpdates.push({ type: 'UPDATE_EFFECT_PARAM', payload: { trackId: track.id, fxId, param: pName, value: val } });
                            } else if (paramKey.startsWith('inst_param_')) {
                                const pName = paramKey.split('_').slice(2).join('_');
                                automatedUpdates.push({ type: 'UPDATE_INSTRUMENT_PARAM', payload: { trackId: track.id, param: pName, value: val } });
                            }
                        }
                    }
                });
            }

            const synth = synthsRef.current[track.id];

        if (!synth) return;

        const activeClip = track.clips.find(c => newTime >= c.start && newTime < c.start + c.duration);
        const shouldPlayTrack = activeClip && !track.muted && (!anySolo || track.solo);

        const targetVolume = (!track.muted && (!anySolo || track.solo)) ? track.volume / 100 : 0;
        if (Math.abs(synth.faderGain.gain.value - targetVolume) > 0.01) {
          synth.faderGain.gain.setTargetAtTime(targetVolume, now, 0.05);
        }

        if (track.type === 'midi' && shouldPlayTrack) {
          const clipTime = newTime - activeClip.start;
          const activeNotes = activeClip.notes?.filter(n => clipTime >= n.start && clipTime < n.start + n.duration) || [];
          activeNotes.forEach(note => {
            if (!synth.activeNoteIds.has(note.id)) {
              synth.activeNoteIds.add(note.id);
              const durSeconds = note.duration * (60/bpm);
              const pbNode = synth.pitchBendNode;
              if (track.instrument === 'inst-drum') triggerDrum(audioCtxRef.current, synth.inputBus, note.pitch, now, 1, track.instrumentParams, note.velocity);
              else if (track.instrument === 'inst-fm') triggerFMSynth(audioCtxRef.current, synth.inputBus, note.pitch, now, 1, durSeconds, track.instrumentParams, note.velocity, pbNode);
              else if (track.instrument === 'inst-supersaw') triggerSupersaw(audioCtxRef.current, synth.inputBus, note.pitch, now, 1, durSeconds, track.instrumentParams, note.velocity, pbNode);
              else if (track.instrument === 'inst-pluck') triggerPluck(audioCtxRef.current, synth.inputBus, note.pitch, now, 1, durSeconds, track.instrumentParams, note.velocity, pbNode);
              else if (track.instrument === 'inst-acid') triggerAcid(audioCtxRef.current, synth.inputBus, note.pitch, now, 1, durSeconds, track.instrumentParams, note.velocity, pbNode);
              else if (track.instrument === 'inst-organ') triggerOrgan(audioCtxRef.current, synth.inputBus, note.pitch, now, 1, durSeconds, track.instrumentParams, note.velocity, pbNode);
              else triggerSubtractive(audioCtxRef.current, synth.inputBus, note.pitch, now, 1, durSeconds, track.instrumentParams, note.velocity, pbNode);
            }
          });
          const activeIds = activeNotes.map(n => n.id);
          for (const id of synth.activeNoteIds) { if (!activeIds.includes(id)) synth.activeNoteIds.delete(id); }
        } else if (track.type === 'audio' && shouldPlayTrack) {
            if (!synth.activeNoteIds.has(activeClip.id)) {
                synth.activeNoteIds.add(activeClip.id);
                  if (activeClip.sampleId && globalAudioBufferCache.has(activeClip.sampleId)) {
                      const sampleData = globalAudioBufferCache.get(activeClip.sampleId);
                      const source = audioCtxRef.current.createBufferSource();
                      source.buffer = sampleData.buffer;
                      const beatOffset = (newTime - activeClip.start) + (activeClip.sampleOffset || 0);
                      const secOffset = beatOffset / (bpm / 60);
                      
                      // Calculate how long this clip should play to prevent trailing audio
                      const beatsRemaining = activeClip.duration - (newTime - activeClip.start);
                      const secDuration = beatsRemaining / (bpm / 60);
                      
                      source.connect(synth.inputBus);
                      source.start(now, Math.max(0, secOffset), Math.max(0, secDuration));
                      synth.activeSource = source; 
                  }
              }
        } else { 
            synth.activeNoteIds.clear(); 
            if (track.type === 'audio' && synth.activeSource) {
                try { synth.activeSource.stop(now); } catch(e){}
                synth.activeSource = null;
            }
        }
      });

      if (automatedUpdates.length > 0 && performance.now() - lastAutoUiUpdateRef.current > 100) {
          automatedUpdates.forEach(act => dispatchDawAction(act));
          lastAutoUiUpdateRef.current = performance.now();
      }

      reqId = requestAnimationFrame(update);
    };
    lastTimeRef.current = audioCtxRef.current?.currentTime || 0;
    reqId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(reqId);
  }, [isPlaying, bpm]);

  // --- AUDIO DISPATCH & AUDIO NODE UPDATER ---
  const applyAudioTrackVol = (trackId, vol) => {
    const synth = synthsRef.current[trackId];
    if (synth && audioCtxRef.current) synth.faderGain.gain.setTargetAtTime(vol / 100, audioCtxRef.current.currentTime, 0.05);
  };

  const applyAudioTrackPan = (trackId, pan) => {
    const synth = synthsRef.current[trackId];
    if (synth?.panner?.pan && audioCtxRef.current) synth.panner.pan.setTargetAtTime(pan / 50, audioCtxRef.current.currentTime, 0.05);
  };

  const handleMasterVolumeChange = (val) => {
    dispatchDawAction({ type: 'UPDATE_MASTER_VOL', payload: { volume: Number(val) } });
  };

  const handleEffectParamChange = (trackId, fxId, param, val) => {
    dispatchDawAction({ type: 'UPDATE_EFFECT_PARAM', payload: { trackId, fxId, param, value: Number(val) } });
  };

  const handleInstrumentParamChange = (trackId, param, val) => {
      if (param !== 'oscType' && isNaN(Number(val))) return; // Protect against NaN crashes
      const finalVal = param === 'oscType' ? String(val) : Number(val);
      dispatchDawAction({ type: 'UPDATE_INSTRUMENT_PARAM', payload: { trackId, param, value: finalVal } });
  };

  const applyAudioEffectParam = (trackId, fxId, param, val, time = null) => {
      const numVal = Number(val);
      if (isNaN(numVal)) return; // Protect against NaN crashes mapping to Web Audio
      const synth = synthsRef.current[trackId];
      if (!synth || !synth.fxNodes[fxId]) return;
      const nodeObj = synth.fxNodes[fxId];
      const now = time !== null ? time : (audioCtxRef.current?.currentTime || 0);

      if (nodeObj.fxType === 'delay') {
          if (param === 'time') nodeObj.delay.delayTime.setTargetAtTime(numVal, now, 0.05);
          if (param === 'feedback') nodeObj.feedback.gain.setTargetAtTime(numVal, now, 0.05);
          if (param === 'mix') { nodeObj.wet.gain.setTargetAtTime(numVal, now, 0.05); nodeObj.dry.gain.setTargetAtTime(1-numVal, now, 0.05); }
      } else if (nodeObj.fxType === 'reverb' || nodeObj.fxType === 'distortion' || nodeObj.fxType === 'bitcrusher') {
          if (param === 'mix') { nodeObj.wet.gain.setTargetAtTime(numVal, now, 0.05); nodeObj.dry.gain.setTargetAtTime(1-numVal, now, 0.05); }
          if (nodeObj.fxType === 'bitcrusher' && param === 'bitDepth') nodeObj.node.curve = getBitcrusherCurve(numVal);
      } else if (nodeObj.fxType === 'filter') {
          if (param === 'freq') nodeObj.node.frequency.setTargetAtTime(numVal, now, 0.05);
          if (param === 'res') nodeObj.node.Q.setTargetAtTime(numVal, now, 0.05);
      } else if (nodeObj.fxType === 'chorus' || nodeObj.fxType === 'autopan') {
          if (param === 'rate') nodeObj.lfo.frequency.setTargetAtTime(numVal, now, 0.05);
          if (param === 'depth') nodeObj.lfoGain.gain.setTargetAtTime(numVal, now, 0.05);
          if (nodeObj.fxType === 'chorus' && param === 'mix') { nodeObj.wet.gain.setTargetAtTime(numVal, now, 0.05); nodeObj.dry.gain.setTargetAtTime(1-numVal, now, 0.05); }
      } else if (nodeObj.fxType === 'phaser') {
          if (param === 'rate') nodeObj.lfo.frequency.setTargetAtTime(numVal, now, 0.05);
          if (param === 'depth') nodeObj.lfoGain.gain.setTargetAtTime(numVal, now, 0.05);
          if (param === 'feedback') nodeObj.fb.gain.setTargetAtTime(numVal, now, 0.05);
          if (param === 'mix') { nodeObj.wet.gain.setTargetAtTime(numVal, now, 0.05); nodeObj.dry.gain.setTargetAtTime(1-numVal, now, 0.05); }
      } else if (nodeObj.fxType === 'flanger') {
          if (param === 'rate') nodeObj.lfo.frequency.setTargetAtTime(numVal, now, 0.05);
          if (param === 'delayTime') nodeObj.delay.delayTime.setTargetAtTime(numVal, now, 0.05);
          if (param === 'depth') nodeObj.lfoGain.gain.setTargetAtTime(numVal, now, 0.05);
          if (param === 'feedback') nodeObj.fb.gain.setTargetAtTime(numVal, now, 0.05);
          if (param === 'mix') { nodeObj.wet.gain.setTargetAtTime(numVal, now, 0.05); nodeObj.dry.gain.setTargetAtTime(1-numVal, now, 0.05); }
      } else if (nodeObj.fxType === 'grain-delay') {
          if (param === 'time') nodeObj.delay.delayTime.setTargetAtTime(numVal, now, 0.05);
          if (param === 'feedback') nodeObj.feedback.gain.setTargetAtTime(numVal, now, 0.05);
          if (param === 'sprayRate') nodeObj.lfo.frequency.setTargetAtTime(numVal, now, 0.05);
          if (param === 'mix') { nodeObj.wet.gain.setTargetAtTime(numVal, now, 0.05); nodeObj.dry.gain.setTargetAtTime(1-numVal, now, 0.05); }
      } else if (nodeObj.fxType === 'compressor') {
          if (param === 'threshold') nodeObj.comp.threshold.setTargetAtTime(numVal, now, 0.05);
          if (param === 'ratio') nodeObj.comp.ratio.setTargetAtTime(numVal, now, 0.05);
      } else if (nodeObj.fxType === 'tremolo') {
          if (param === 'rate') nodeObj.lfo.frequency.setTargetAtTime(numVal, now, 0.05);
          if (param === 'depth') { nodeObj.amp.gain.setTargetAtTime(1.0 - numVal / 2, now, 0.05); nodeObj.lfoGain.gain.setTargetAtTime(numVal / 2, now, 0.05); }
      } else if (nodeObj.fxType === 'ringmod') {
          if (param === 'freq') nodeObj.osc.frequency.setTargetAtTime(numVal, now, 0.05);
          if (param === 'mix') { nodeObj.wet.gain.setTargetAtTime(numVal, now, 0.05); nodeObj.dry.gain.setTargetAtTime(1-numVal, now, 0.05); }
      } else if (nodeObj.fxType === 'eq3') {
          if (param === 'low') nodeObj.low.gain.setTargetAtTime(numVal, now, 0.05);
          if (param === 'mid') nodeObj.mid.gain.setTargetAtTime(numVal, now, 0.05);
          if (param === 'high') nodeObj.high.gain.setTargetAtTime(numVal, now, 0.05);
      } else if (nodeObj.fxType === 'parametric-eq') {
          if (param === 'lowFreq') nodeObj.low.frequency.setTargetAtTime(numVal, now, 0.05);
          if (param === 'lowGain') nodeObj.low.gain.setTargetAtTime(numVal, now, 0.05);
          if (param === 'mid1Freq') nodeObj.mid1.frequency.setTargetAtTime(numVal, now, 0.05);
          if (param === 'mid1Q') nodeObj.mid1.Q.setTargetAtTime(numVal, now, 0.05);
          if (param === 'mid1Gain') nodeObj.mid1.gain.setTargetAtTime(numVal, now, 0.05);
          if (param === 'mid2Freq') nodeObj.mid2.frequency.setTargetAtTime(numVal, now, 0.05);
          if (param === 'mid2Q') nodeObj.mid2.Q.setTargetAtTime(numVal, now, 0.05);
          if (param === 'mid2Gain') nodeObj.mid2.gain.setTargetAtTime(numVal, now, 0.05);
          if (param === 'highFreq') nodeObj.high.frequency.setTargetAtTime(numVal, now, 0.05);
          if (param === 'highGain') nodeObj.high.gain.setTargetAtTime(numVal, now, 0.05);
      }
  };

  const addEffect = async (trackId, fxDef) => {
    const newFx = { id: `fx-${Date.now()}`, type: fxDef.type, name: fxDef.name, params: fxDef.params ? { ...fxDef.params } : {} };
    dispatchDawAction({ type: 'ADD_EFFECT', payload: { trackId, effect: newFx } });
    const updatedTrack = { ...tracksRef.current.find(t => t.id === trackId) };
    if (updatedTrack) {
        updatedTrack.effects = [...(updatedTrack.effects || []), newFx];
        if (audioCtxRef.current) synthsRef.current[trackId] = await initTrackRouting(updatedTrack, audioCtxRef.current, masterGainRef.current);
    }
  };

  const deleteEffect = async (trackId, fxId) => {
    dispatchDawAction({ type: 'DELETE_EFFECT', payload: { trackId, fxId } });
    const updatedTrack = { ...tracksRef.current.find(t => t.id === trackId) };
    if (updatedTrack) {
        updatedTrack.effects = updatedTrack.effects.filter(fx => fx.id !== fxId);
        if (audioCtxRef.current) synthsRef.current[trackId] = await initTrackRouting(updatedTrack, audioCtxRef.current, masterGainRef.current);
    }
  };

  const reorderEffects = async (trackId, startIndex, endIndex) => {
    if (startIndex === endIndex) return;
    dispatchDawAction({ type: 'REORDER_EFFECTS', payload: { trackId, startIndex, endIndex } });
    const updatedTrack = { ...tracksRef.current.find(t => t.id === trackId) };
    if (updatedTrack && updatedTrack.effects) {
        const effects = [...updatedTrack.effects];
        const [moved] = effects.splice(startIndex, 1);
        effects.splice(endIndex, 0, moved);
        updatedTrack.effects = effects;
        if (audioCtxRef.current) {
            synthsRef.current[trackId] = await initTrackRouting(updatedTrack, audioCtxRef.current, masterGainRef.current);
        }
    }
  };

  const refreshDevices = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputsList(devices.filter(d => d.kind === 'audioinput'));
        stream.getTracks().forEach(t => t.stop()); 
    } catch (e) {
        console.warn("Audio input enumeration failed", e);
    }
    if (navigator.requestMIDIAccess) {
        try {
            const access = await navigator.requestMIDIAccess();
            setMidiInputsList(Array.from(access.inputs.values()));
        } catch(e) {}
    }
  };

  useEffect(() => { refreshDevices(); }, []);

  useEffect(() => {
      if (!navigator.requestMIDIAccess) return;
      let currentAccess = null;

      const onMidiMessage = (msg) => {
          const inputId = msg.currentTarget.id; 
          const [command, noteOrCC, velocityOrVal] = msg.data;
          const type = command & 0xF0;
          const channel = command & 0x0F;

          const isNoteOn = type === 0x90 && velocityOrVal > 0;
          const isNoteOff = type === 0x80 || (type === 0x90 && velocityOrVal === 0);
          const isCC = type === 0xB0;
          const isPitchBend = type === 0xE0;
          const isSysex = command === 0xF0;

          if (isPitchBend) {
              const lsb = noteOrCC;
              const msb = velocityOrVal;
              const pbValue = (msb << 7) | lsb;
              const normalizedPb = (pbValue - 8192) / 8192;
              const pbCents = normalizedPb * 200; 

              const armedTrack = tracksRef.current.find(t => t.armed);
              if (armedTrack && armedTrack.type === 'midi') {
                  const synth = synthsRef.current[armedTrack.id];
                  if (synth && synth.pitchBendNode && audioCtxRef.current) {
                      synth.pitchBendNode.offset.setTargetAtTime(pbCents, audioCtxRef.current.currentTime, 0.01);
                  }
              }
              return;
          }

          let transportCmd = null;
          
          // Mackie Control Universal (MCU) Notes
          if (isNoteOn) {
              if (noteOrCC === 91) transportCmd = 'rewind';
              if (noteOrCC === 92) transportCmd = 'forward';
              if (noteOrCC === 93) transportCmd = 'stop';
              if (noteOrCC === 94) transportCmd = 'play';
              if (noteOrCC === 95) transportCmd = 'record';
          } 
          // Generic MIDI Transport CCs (114-119)
          else if (isCC && velocityOrVal > 0) {
              if (noteOrCC === 114) transportCmd = 'rewind';
              if (noteOrCC === 115) transportCmd = 'forward';
              if (noteOrCC === 116) transportCmd = 'stop';
              if (noteOrCC === 117) transportCmd = 'play';
              if (noteOrCC === 118) transportCmd = 'record';
              if (noteOrCC === 119) transportCmd = 'loop';
          } 
          // MIDI Machine Control (MMC) SysEx
          else if (isSysex) {
              if (msg.data.length >= 6 && msg.data[1] === 0x7F && msg.data[3] === 0x06) {
                  const mmcCmd = msg.data[4];
                  if (mmcCmd === 0x01) transportCmd = 'stop';
                  if (mmcCmd === 0x02) transportCmd = 'play';
                  if (mmcCmd === 0x04) transportCmd = 'forward';
                  if (mmcCmd === 0x05) transportCmd = 'rewind';
                  if (mmcCmd === 0x06) transportCmd = 'record';
                  if (mmcCmd === 0x09) transportCmd = 'pause';
              }
          }

          if (transportCmd) {
              const actions = transportActionsRef.current;
              if (transportCmd === 'play' || transportCmd === 'pause') actions.togglePlay?.();
              if (transportCmd === 'stop') actions.stopPlayback?.();
              if (transportCmd === 'record') actions.toggleRecord?.();
              if (transportCmd === 'forward') actions.forward?.();
              if (transportCmd === 'rewind') actions.rewind?.();
              if (transportCmd === 'loop') actions.loop?.();
              return; 
          }

          if (isCC || isNoteOn) {
              const mappingKey = `${inputId}-${noteOrCC}`;

              if (midiLearnTargetRef.current) {
                  const newMapping = { ...midiLearnTargetRef.current, id: `map_${Date.now()}_${Math.random()}`, rangeMin: 0, rangeMax: 1, reverse: false };
                  setMidiMappings(prev => {
                      const existing = prev[mappingKey];
                      const existingArray = Array.isArray(existing) ? existing : (existing ? [existing] : []);
                      
                      // Check for exact duplicates to prevent doubling up
                      if (existingArray.some(m => m.type === newMapping.type && m.trackId === newMapping.trackId && m.param === newMapping.param && m.fxId === newMapping.fxId)) {
                          return prev;
                      }
                      return { ...prev, [mappingKey]: [...existingArray, newMapping] };
                  });
                  showToast(`Mapped MIDI CC/Note ${noteOrCC} to ${newMapping.param || newMapping.type.replace('_', ' ')}`, 'success');
                  setMidiLearnTarget(null);
                  return;
              }

              const rawMappings = midiMappingsRef.current[mappingKey];
              if (rawMappings) {
                  const mappings = Array.isArray(rawMappings) ? rawMappings : [rawMappings];
                  mappings.forEach(mapping => {
                      let normalizedVal = velocityOrVal / 127;
                      if (mapping.reverse) normalizedVal = 1 - normalizedVal;
                      
                      const rMin = mapping.rangeMin !== undefined ? mapping.rangeMin : 0;
                      const rMax = mapping.rangeMax !== undefined ? mapping.rangeMax : 1;
                      normalizedVal = rMin + (normalizedVal * (rMax - rMin));
                      normalizedVal = Math.max(0, Math.min(1, normalizedVal));

                      if (mapping.type === 'mixer_vol') {
                          dispatchDawAction({ type: 'UPDATE_TRACK_VOL', payload: { id: mapping.trackId, volume: Math.round(normalizedVal * 100) } });
                      } else if (mapping.type === 'mixer_pan') {
                          dispatchDawAction({ type: 'UPDATE_TRACK_PAN', payload: { id: mapping.trackId, pan: Math.round(normalizedVal * 100 - 50) } });
                      } else if (mapping.type === 'master_vol') {
                          handleMasterVolumeChange(Math.round(normalizedVal * 100));
                      } else if (mapping.type.startsWith('transport_')) {
                          if (velocityOrVal > 0) { // Only trigger on button press
                              const actions = transportActionsRef.current;
                              if (mapping.type === 'transport_play') actions.togglePlay?.();
                              if (mapping.type === 'transport_stop') actions.stopPlayback?.();
                              if (mapping.type === 'transport_record') actions.toggleRecord?.();
                              if (mapping.type === 'transport_rewind') actions.rewind?.();
                              if (mapping.type === 'transport_forward') actions.forward?.();
                              if (mapping.type === 'transport_loop') actions.loop?.();
                          }
                      } else if (mapping.type === 'fx_param' || mapping.type === 'inst_param') {
                          const constraints = getParamConstraints(mapping.param);
                          let mappedVal;
                          if (constraints.isLog) {
                              const minLog = Math.log(Math.max(0.001, constraints.min));
                              const maxLog = Math.log(constraints.max);
                              mappedVal = Math.exp(minLog + normalizedVal * (maxLog - minLog));
                          } else {
                              mappedVal = constraints.min + normalizedVal * (constraints.max - constraints.min);
                          }
                          if (constraints.step && !constraints.isLog) {
                              mappedVal = Math.round(mappedVal / constraints.step) * constraints.step;
                          }
                          
                          if (mapping.type === 'fx_param') {
                              handleEffectParamChange(mapping.trackId, mapping.fxId, mapping.param, mappedVal);
                          } else if (mapping.type === 'inst_param') {
                              handleInstrumentParamChange(mapping.trackId, mapping.param, mappedVal);
                          }
                      }
                  });
                  return; 
              }
              
              // Default CC 1 (Mod Wheel) to Cutoff if no custom mapping exists
              if (noteOrCC === 1) {
                  const armedTrack = tracksRef.current.find(t => t.armed);
                  if (armedTrack && armedTrack.type === 'midi' && armedTrack.instrumentParams && armedTrack.instrumentParams.cutoff !== undefined) {
                      const normalizedVal = velocityOrVal / 127;
                      const constraints = getParamConstraints('cutoff');
                      const minLog = Math.log(Math.max(0.001, constraints.min));
                      const maxLog = Math.log(constraints.max);
                      const mappedVal = Math.exp(minLog + normalizedVal * (maxLog - minLog));
                      handleInstrumentParamChange(armedTrack.id, 'cutoff', mappedVal);
                  }
              }
          }

          const state = stateRefs.current;
          
          if (isCC && (midiConfigRef.current.mixer === inputId || midiConfigRef.current.mixer === '')) {
              if (channel < tracksRef.current.length) {
                  const targetTrack = tracksRef.current[channel];
                  if (noteOrCC === 7) { 
                     dispatchDawAction({ type: 'UPDATE_TRACK_VOL', payload: { id: targetTrack.id, volume: Math.round((velocityOrVal/127)*100) }});
                  } else if (noteOrCC === 10) { 
                     dispatchDawAction({ type: 'UPDATE_TRACK_PAN', payload: { id: targetTrack.id, pan: Math.round((velocityOrVal/127)*100 - 50) }});
                  }
              }
          }

          if (isNoteOn || isNoteOff) {
              const armedTrack = tracksRef.current.find(t => t.armed);
              if (!armedTrack || armedTrack.type !== 'midi') return;
              
              const isDrum = armedTrack.instrument === 'inst-drum';
              const allowedDevice = isDrum ? midiConfigRef.current.pad : midiConfigRef.current.keyboard;
              if (allowedDevice !== '' && inputId !== allowedDevice) return; 

              const synth = synthsRef.current[armedTrack.id];
              if (!synth || !audioCtxRef.current) return;

              const now = audioCtxRef.current.currentTime;

              if (isNoteOn) {
                  const pbNode = synth.pitchBendNode;
                  if (isDrum) triggerDrum(audioCtxRef.current, synth.inputBus, noteOrCC, now, 1, armedTrack.instrumentParams, velocityOrVal);
                  else if (armedTrack.instrument === 'inst-fm') triggerFMSynth(audioCtxRef.current, synth.inputBus, noteOrCC, now, 1, 0.25, armedTrack.instrumentParams, velocityOrVal, pbNode);
                  else if (armedTrack.instrument === 'inst-supersaw') triggerSupersaw(audioCtxRef.current, synth.inputBus, noteOrCC, now, 1, 0.25, armedTrack.instrumentParams, velocityOrVal, pbNode);
                  else if (armedTrack.instrument === 'inst-pluck') triggerPluck(audioCtxRef.current, synth.inputBus, noteOrCC, now, 1, 0.25, armedTrack.instrumentParams, velocityOrVal, pbNode);
                  else if (armedTrack.instrument === 'inst-acid') triggerAcid(audioCtxRef.current, synth.inputBus, noteOrCC, now, 1, 0.25, armedTrack.instrumentParams, velocityOrVal, pbNode);
                  else if (armedTrack.instrument === 'inst-organ') triggerOrgan(audioCtxRef.current, synth.inputBus, noteOrCC, now, 1, 0.25, armedTrack.instrumentParams, velocityOrVal, pbNode);
                  else triggerSubtractive(audioCtxRef.current, synth.inputBus, noteOrCC, now, 1, 0.25, armedTrack.instrumentParams, velocityOrVal, pbNode);

                  if (state.isRecording && state.isPlaying) {
                      activeLiveMidiNotesRef.current[noteOrCC] = { start: state.currentTime, velocity: velocityOrVal };
                  }
              } else if (isNoteOff) {
                if (state.isRecording && state.isPlaying && activeLiveMidiNotesRef.current[noteOrCC]) {
                    const startBeat = activeLiveMidiNotesRef.current[noteOrCC].start;
                    const recordedVelocity = activeLiveMidiNotesRef.current[noteOrCC].velocity;
                    const durBeat = state.currentTime - startBeat;
                    
                    if (!pendingMidiClipsRef.current[armedTrack.id]) pendingMidiClipsRef.current[armedTrack.id] = [];
                    pendingMidiClipsRef.current[armedTrack.id].push({
                       id: `n_${Date.now()}_${noteOrCC}`,
                       pitch: noteOrCC,
                       start: startBeat - recordingStartTimeRef.current, 
                       duration: Math.max(0.1, durBeat),
                       velocity: recordedVelocity
                    });
                    delete activeLiveMidiNotesRef.current[noteOrCC];
                }
            }
        }
    };

    const initMidi = async () => {
        let access;
        try {
            // Request SysEx access for MIDI Machine Control (MMC) first
            access = await navigator.requestMIDIAccess({ sysex: true });
        } catch (e) {
            try {
                // Fallback to generic access if SysEx is denied by the browser
                access = await navigator.requestMIDIAccess();
            } catch (err) {
                console.warn("MIDI Access Denied.");
                return;
            }
        }
        currentAccess = access;
        access.inputs.forEach(input => { input.onmidimessage = onMidiMessage; });
        
        // Handle hot-plugging of new MIDI controllers seamlessly
        access.onstatechange = (e) => {
            if (e.port.state === 'connected' && e.port.type === 'input') {
                e.port.onmidimessage = onMidiMessage;
            }
        };
    };

    initMidi();

    return () => {
        if (currentAccess) {
            currentAccess.inputs.forEach(input => input.onmidimessage = null);
            currentAccess.onstatechange = null;
        }
    };
}, []);

  const toggleLocalMedia = (type) => {
    if (!localStreamRef.current) return;
    if (type === 'video') {
        const enabled = !isVideoEnabled;
        localStreamRef.current.getVideoTracks().forEach(t => t.enabled = enabled);
        setIsVideoEnabled(enabled);
    } else {
        const enabled = !isAudioEnabled;
        localStreamRef.current.getAudioTracks().forEach(t => t.enabled = enabled);
        setIsAudioEnabled(enabled);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if we are inside an actual text field (ignore sliders/checkboxes)
      const isTextInput = ['TEXTAREA', 'SELECT'].includes(e.target.tagName) || (e.target.tagName === 'INPUT' && ['text', 'number', 'password'].includes(e.target.type));
      
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmd = isMac ? e.metaKey : e.ctrlKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();
      const code = e.code;
      
      // 1. GLOBAL OVERRIDE: Always prevent default browser actions for these keys (Save, Undo, Select All, Duplicate, etc.)
      if (cmd && ['s', 'z', 'y', 'd', 'e', 'l', 'a', '=', '-', '+'].includes(key)) {
          e.preventDefault();
      }

      // 2. TEXT FIELD EXCEPTION: If typing, allow space, arrows, delete, and copy/paste to work normally
      if (isTextInput) {
          if (code === 'Enter' || code === 'Space' || code === 'ArrowLeft' || code === 'ArrowRight' || code === 'Backspace' || code === 'Delete' || (!cmd && key.length === 1) || (cmd && ['c', 'v', 'x'].includes(key))) {
              return; 
          }
      } else {
          // 3. DAW FOCUS: Prevent space and arrows from scrolling the page
          if (code === 'Space' || code === 'ArrowLeft' || code === 'ArrowRight' || code === 'Backspace' || code === 'Delete') {
              e.preventDefault();
          }
          // Prevent default for cut/copy/paste so it targets our DAW engine, not the browser text clipboard
          if (cmd && ['c', 'v', 'x'].includes(key)) {
              e.preventDefault();
          }
      }

      if (code === 'Space') { 
          togglePlay();
          return;
      } 

      // Return to beginning
      if (code === 'Enter') {
          transportActionsRef.current.rewind?.();
          return;
      }

      // Save / Save As
      if (cmd && key === 's') {
          if (shift) {
              const newName = prompt("Save Project As:", projectNameRef.current + " Copy");
              if (newName) {
                  setProjectName(newName);
                  const newId = `proj_${Date.now()}`;
                  setProjectId(newId);
                  saveProject(sharedWith, isPublic, false, newId, newName);
              }
          } else {
              saveProject();
          }
          return;
      }

      // Undo / Redo
      if (cmd && shift && key === 'z') { handleRedo(); return; }
      if (cmd && key === 'y') { handleRedo(); return; } // Standard windows Redo fallback
      if (cmd && key === 'z') { handleUndo(); return; }

      // Copy
      if (cmd && key === 'c') {
          if (selectedClipIdsRef.current.length > 0) {
              const copied = [];
              tracksRef.current.forEach(t => t.clips.forEach(c => {
                  if (selectedClipIdsRef.current.includes(c.id)) copied.push({ ...c, originalTrackId: t.id });
              }));
              clipboardRef.current = { type: 'clips', data: JSON.parse(JSON.stringify(copied)) };
              showToast(`Copied ${copied.length} clip(s)`, 'info');
          }
          return;
      }

      // Paste
      if (cmd && key === 'v') {
          if (clipboardRef.current?.type === 'clips') {
              const clips = clipboardRef.current.data;
              let targetTrackId = selectedTrackIdRef.current || clips[0].originalTrackId;
              const newIds = [];
              const earliestStart = Math.min(...clips.map(c => c.start));
              
              clips.forEach(c => {
                  const newClip = { ...c, id: Date.now() + Math.random() };
                  newClip.start = stateRefs.current.currentTime + (c.start - earliestStart);
                  delete newClip.originalTrackId;
                  newIds.push(newClip.id);
                  dispatchDawAction({ type: 'ADD_CLIP', payload: { trackId: targetTrackId, clip: newClip } });
              });
              setSelectedClipIds(newIds);
              showToast(`Pasted ${clips.length} clip(s)`, 'success');
          }
          return;
      }

      // Duplicate
      if (cmd && key === 'd') {
          if (selectedClipIdsRef.current.length > 0) {
              const newIds = [];
              tracksRef.current.forEach(t => t.clips.forEach(c => {
                  if (selectedClipIdsRef.current.includes(c.id)) {
                      const newClip = JSON.parse(JSON.stringify(c));
                      newClip.id = Date.now() + Math.random();
                      newClip.start = c.start + c.duration;
                      newIds.push(newClip.id);
                      dispatchDawAction({ type: 'ADD_CLIP', payload: { trackId: t.id, clip: newClip } });
                  }
              }));
              setSelectedClipIds(newIds);
              showToast(`Duplicated clip(s)`, 'success');
          }
          return;
      }

      // Cut
      if (cmd && key === 'x') {
          if (selectedClipIdsRef.current.length > 0) {
              const copied = [];
              tracksRef.current.forEach(t => t.clips.forEach(c => {
                  if (selectedClipIdsRef.current.includes(c.id)) {
                      copied.push({ ...c, originalTrackId: t.id });
                      dispatchDawAction({ type: 'DELETE_CLIP', payload: { trackId: t.id, clipId: c.id } });
                  }
              }));
              clipboardRef.current = { type: 'clips', data: JSON.parse(JSON.stringify(copied)) };
              setSelectedClipIds([]);
              showToast(`Cut ${copied.length} clip(s)`, 'info');
          }
          return;
      }

      // Delete
      if (code === 'Delete' || code === 'Backspace') {
          if (selectedClipIdsRef.current.length > 0) {
              tracksRef.current.forEach(t => t.clips.forEach(c => {
                  if (selectedClipIdsRef.current.includes(c.id)) {
                      dispatchDawAction({ type: 'DELETE_CLIP', payload: { trackId: t.id, clipId: c.id } });
                  }
              }));
              setSelectedClipIds([]);
          }
          return;
      }

      // Select All (Ctrl/Cmd + A)
      if (cmd && key === 'a' && !shift) {
          const allIds = [];
          tracksRef.current.forEach(t => {
              if (!selectedTrackIdRef.current || t.id === selectedTrackIdRef.current) {
                  t.clips.forEach(c => allIds.push(c.id));
              }
          });
          setSelectedClipIds(allIds);
          return;
      }

      // Toggle Automation View (Ctrl/Cmd + Shift + A)
      if (cmd && shift && key === 'a') {
          // (Make sure to delete your old "coming soon" hotkey if it's still there!)
          setIsAutomationMode(prev => {
              const next = !prev;
              showToast(next ? "Automation Mode ON" : "Automation Mode OFF", "info");
              return next;
          });
          return;
      }

      // Zoom
      if (cmd && (key === '=' || key === '+' || key === '-')) {
          setZoom(prev => Math.min(Math.max(0.1, prev * (key === '-' ? 0.85 : 1.15)), 8));
          return;
      }

      // Playhead Nav
      if (code === 'ArrowLeft' || code === 'ArrowRight') {
          const sg = shift ? (snapGridRef.current || 1) : 4; // Shift = Beat/Snap, Normal = 1 Bar
          let newTime = stateRefs.current.currentTime + (code === 'ArrowRight' ? sg : -sg);
          newTime = Math.max(0, Math.round(newTime / sg) * sg);
          setCurrentTime(newTime);
          stateRefs.current.currentTime = newTime;
          lastMetronomeBeatRef.current = Math.floor(newTime);
          broadcastLivePreview({ type: 'UPDATE_TIME', payload: { currentTime: newTime } });
          return;
      }

      // Mute / Solo
      if (!cmd && !shift && key === 'm') {
          if (selectedTrackIdRef.current) {
              dispatchDawAction({ type: 'TOGGLE_MUTE', payload: { trackId: selectedTrackIdRef.current } });
          }
          return;
      }

      if (!cmd && !shift && key === 's') {
          if (selectedTrackIdRef.current) {
              dispatchDawAction({ type: 'TOGGLE_SOLO', payload: { trackId: selectedTrackIdRef.current } });
          }
          return;
      }

      // Slice at Playhead
      if ((cmd && key === 'e') || (cmd && key === 't')) {
          let sliced = 0;
          tracksRef.current.forEach(t => {
              t.clips.forEach(c => {
                  const isSelected = selectedClipIdsRef.current.includes(c.id);
                  const intersects = stateRefs.current.currentTime > c.start && stateRefs.current.currentTime < c.start + c.duration;
                  if (intersects && (isSelected || (!selectedClipIdsRef.current.length && t.id === selectedTrackIdRef.current))) {
                      dispatchDawAction({ type: 'SPLIT_CLIP', payload: { trackId: t.id, clipId: c.id, sliceBeat: stateRefs.current.currentTime } });
                      sliced++;
                  }
              });
          });
          if (sliced > 0) {
              showToast(`Sliced ${sliced} clip(s)`, 'success');
              setSelectedClipIds([]); 
          }
          return;
      }

      // Loop Selection
      if (cmd && key === 'l') {
          let minStart = Infinity, maxEnd = -Infinity;
          tracksRef.current.forEach(t => {
              t.clips.forEach(c => {
                  if (selectedClipIdsRef.current.includes(c.id)) {
                      if (c.start < minStart) minStart = c.start;
                      if (c.start + c.duration > maxEnd) maxEnd = c.start + c.duration;
                  }
              });
          });

          if (minStart !== Infinity) {
              const newLoop = { start: minStart, end: maxEnd, enabled: true };
              setLoopRegion(newLoop);
              dispatchDawAction({ type: 'UPDATE_LOOP_REGION', payload: newLoop });
              showToast("Looped selection", "success");
          } else {
              const nextEnabled = !loopRegionRef.current.enabled;
              setLoopRegion(prev => ({...prev, enabled: nextEnabled}));
              dispatchDawAction({ type: 'UPDATE_LOOP_REGION', payload: { ...loopRegionRef.current, enabled: nextEnabled } });
          }
          return;
      }

    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isRecording, togglePlay, handleUndo, handleRedo, saveProject, showToast, broadcastLivePreview, sharedWith, isPublic]);

  useEffect(() => {
    const handleWheel = (e) => {
      // Intercept Ctrl/Cmd + Scroll anywhere in the window
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(prev => {
          // Use a multiplier for smoother, more natural zoom scaling
          const factor = e.deltaY > 0 ? 0.85 : 1.15; 
          return Math.min(Math.max(0.1, prev * factor), 8);
        });
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
      const token = localStorage.getItem('freedaw_token');
      const userStr = localStorage.getItem('freedaw_user');
      if (token && userStr) {
          const user = JSON.parse(userStr);
          setAuthToken(token);
          setCurrentUser(user);
          setAppView('home');
          loadProjects(token);
          connectSocket(token, user);
      }
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!authName.trim()) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: authName.trim() })
        });
        const data = await res.json();
        if (data.token) {
            const userObj = { ...data.user, activeTrack: null, color: 'bg-emerald-500' };
            setAuthToken(data.token); 
            setCurrentUser(userObj); 
            setAppView('home');
            localStorage.setItem('freedaw_token', data.token);
            localStorage.setItem('freedaw_user', JSON.stringify(userObj));
            loadProjects(data.token); 
            connectSocket(data.token, userObj);
            showToast("Authenticated successfully.", "success");
        }
    } catch (err) {
        showToast("Server unreachable. Starting Offline.", "error");
        const userObj = { id: `u_${Date.now()}`, username: authName.trim(), offline: true, color: 'bg-purple-500' };
        setCurrentUser(userObj);
        setAppView('home'); 
        loadProjects(null);
    }
  };

  const handleSignOut = () => {
      localStorage.removeItem('freedaw_token');
      localStorage.removeItem('freedaw_user');
      setAuthToken(null);
      setCurrentUser(null);
      setAppView('auth');
      if (socketRef.current) socketRef.current.disconnect();
      socketRef.current = null;
      showToast("Signed out successfully.");
  };

  const loadProjects = async (token) => {
      const offlineProjs = await idb.getAll('projects');
      setLocalProjects(offlineProjs || []);
      if (token) {
          try {
              const res = await fetch(`${API_BASE_URL}/api/projects`, { headers: { 'Authorization': `Bearer ${token}` } });
              const data = await res.json();
              if (Array.isArray(data)) setServerProjects(data);
          } catch (e) { console.warn("Could not fetch server projects"); }
      }
  };

  const handleDeleteProject = async (e, projectId) => {
      e.stopPropagation();
      
      // 1. Delete from local offline database
      await idb.delete('projects', projectId);
      
      // 2. Delete from remote cloud database
      if (authTokenRef.current) {
          try {
              await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${authTokenRef.current}` }
              });
          } catch (err) {
              console.warn("Could not delete from server", err);
          }
      }
      
      // 3. Refresh the UI
      loadProjects(authTokenRef.current);
      showToast("Project deleted.", "info");
  };

  const connectSocket = async (token, user) => {
      if (socketRef.current) return;
      try {
          const loadSocketIo = () => {
              return new Promise((resolve, reject) => {
                  if (window.io) return resolve(window.io);
                  const script = document.createElement('script');
                  script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
                  script.onload = () => resolve(window.io);
                  script.onerror = () => reject(new Error('Failed to load Socket.io'));
                  document.head.appendChild(script);
              });
          };

          const ioClient = await loadSocketIo();
          const socket = ioClient(API_BASE_URL); 
          socketRef.current = socket;

          const joinCurrentRoom = () => socket.emit('join-room', 'global-studio', user);
          if (socket.connected) joinCurrentRoom();
          socket.on('connect', joinCurrentRoom);

          socket.on('user-connected', async (peerId, peerProfile) => {
              showToast(`${peerProfile.username} joined`, 'info');
              setPeers(prev => ({ ...prev, [peerId]: { ...peerProfile } }));
              
              // CRITICAL FIX: Broadcast my profile back so the new user knows I'm online!
              socket.emit('presence-update', { 
                  username: user.username, avatar: user.avatar, color: user.color, 
                  bio: user.bio, email: user.email, website: user.website, 
                  instagram: user.instagram, twitter: user.twitter 
              });
          });
          
          socket.on('user-disconnected', (peerId) => {
              setPeers(prev => { const next = { ...prev }; delete next[peerId]; return next; });
          });
          socket.on('presence-update', (peerId, presence) => {
              setPeers(prev => ({ ...prev, [peerId]: { ...prev[peerId], ...presence } }));
          });
          socket.on('daw-action', (action) => applyDawAction(action, false));
      } catch (err) {
          console.error("Failed to connect live sync networking:", err);
          showToast("Live sync network unavailable. Operating locally.", "error");
      }
  };

  const dispatchPresence = (trackId) => {
      if (currentUser) {
          const next = { ...currentUser, activeTrack: trackId };
          setCurrentUser(next);
          if (socketRef.current) socketRef.current.emit('presence-update', { activeTrack: trackId, color: next.color });
      }
  };

  const applyDawAction = useCallback((action, isLocal) => {
      if (action.type === 'PROJECT_SHARED') {
          if (!isLocal) loadProjects(authTokenRef.current);
          return;
      }
      if (!isLocal && action.projectId && action.projectId !== currentProjectIdRef.current) return;

      switch (action.type) {
          case 'REQUEST_SYNC':
              if (!isLocal && socketRef.current && currentProjectIdRef.current) {
                  socketRef.current.emit('daw-action', {
                      type: 'SYNC_STATE',
                      projectId: currentProjectIdRef.current,
                      payload: { tracks: tracksRef.current, bpm: stateRefs.current.bpm }
                  });
              }
              break;
          case 'SYNC_STATE': 
              if(!isLocal) { 
                  setTracks(action.payload.tracks); 
                  setBpm(action.payload.bpm); 
                  if (audioCtxRef.current) {
                      action.payload.tracks.forEach(t => {
                          initTrackRouting(t, audioCtxRef.current, masterGainRef.current).then(synth => { synthsRef.current[t.id] = synth; });
                      });
                  }
              } 
              break;
          case 'ADD_TRACK': setTracks(prev => [...prev, { ...action.payload, automation: {}, activeAutomationParam: 'volume' }]); break;
          case 'SET_AUTOMATION_PARAM':
              setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { ...t, activeAutomationParam: action.payload.paramKey } : t));
              break;
          case 'ADD_AUTOMATION_POINT':
              setTracks(prev => prev.map(t => {
                  if (t.id !== action.payload.trackId) return t;
                  const auto = t.automation || {};
                  const pts = auto[action.payload.paramKey] || [];
                  return { ...t, automation: { ...auto, [action.payload.paramKey]: [...pts, action.payload.point] } };
              }));
              break;
          case 'UPDATE_AUTOMATION_POINT':
              setTracks(prev => prev.map(t => {
                  if (t.id !== action.payload.trackId) return t;
                  const auto = t.automation || {};
                  const pts = (auto[action.payload.paramKey] || []).map(p => p.id === action.payload.pointId ? { ...p, time: action.payload.time, value: action.payload.value } : p);
                  return { ...t, automation: { ...auto, [action.payload.paramKey]: pts } };
              }));
              break;
          case 'DELETE_AUTOMATION_POINT':
              setTracks(prev => prev.map(t => {
                  if (t.id !== action.payload.trackId) return t;
                  const auto = t.automation || {};
                  const pts = (auto[action.payload.paramKey] || []).filter(p => p.id !== action.payload.pointId);
                  return { ...t, automation: { ...auto, [action.payload.paramKey]: pts } };
              }));
              break;
          case 'DELETE_TRACK': setTracks(prev => prev.filter(t => t.id !== action.payload.id)); break;
          case 'RENAME_TRACK': setTracks(prev => prev.map(t => t.id === action.payload.id ? { ...t, name: action.payload.name } : t)); break;
          case 'UPDATE_TRACK_VOL': 
              setTracks(prev => prev.map(t => t.id === action.payload.id ? { ...t, volume: action.payload.volume } : t)); 
              applyAudioTrackVol(action.payload.id, action.payload.volume);
              break;
          case 'UPDATE_TRACK_PAN': 
              setTracks(prev => prev.map(t => t.id === action.payload.id ? { ...t, pan: action.payload.pan } : t)); 
              applyAudioTrackPan(action.payload.id, action.payload.pan);
              break;
          case 'UPDATE_TRACK_INPUT': setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { ...t, audioInputId: action.payload.audioInputId } : t)); break;
          case 'TOGGLE_MUTE': setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { ...t, muted: !t.muted } : t)); break;
          case 'TOGGLE_SOLO': setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { ...t, solo: !t.solo } : t)); break;
          case 'TOGGLE_ARM': setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { ...t, armed: !t.armed } : { ...t, armed: false })); break;
          case 'UPDATE_MASTER_VOL':
              setMasterVolume(action.payload.volume);
              if (masterGainRef.current && audioCtxRef.current) masterGainRef.current.gain.setTargetAtTime(action.payload.volume / 100, audioCtxRef.current.currentTime, 0.05);
              break;
          case 'UPDATE_LOOP_REGION': setLoopRegion(action.payload); break;
          case 'UPDATE_TIME': 
              setCurrentTime(action.payload.currentTime); 
              stateRefs.current.currentTime = action.payload.currentTime; 
              lastMetronomeBeatRef.current = Math.floor(action.payload.currentTime);
              break;
          case 'SET_PLAYBACK':
              if (action.payload.isPlaying && !stateRefs.current.isPlaying) {
                  initAudioEngine().then(() => setIsPlaying(true));
                  lastMetronomeBeatRef.current = Math.floor(action.payload.currentTime) - 1;
              } else if (!action.payload.isPlaying && stateRefs.current.isPlaying) {
                  setIsPlaying(false); stopAudio();
              }
              setCurrentTime(action.payload.currentTime);
              stateRefs.current.currentTime = action.payload.currentTime;
              lastMetronomeBeatRef.current = Math.floor(action.payload.currentTime);
              break;
          case 'ADD_CLIP': {
              const clipToAdd = action.payload.clip;
              if (clipToAdd.sampleId && !globalAudioBufferCache.has(clipToAdd.sampleId)) {
                  fetch(`${API_BASE_URL}/api/samples/${clipToAdd.sampleId}.wav`)
                      .then(res => res.arrayBuffer())
                      .then(ab => audioCtxRef.current.decodeAudioData(ab))
                      .then(buffer => {
                          globalAudioBufferCache.set(clipToAdd.sampleId, { buffer, duration: buffer.duration });
                          setTracks(prev => [...prev]); 
                      })
                      .catch(err => console.error("Error fetching synced audio asset:", err));
              }
              setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { ...t, clips: [...t.clips, clipToAdd] } : t)); 
              break;
          }
          case 'DELETE_CLIP': setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { ...t, clips: t.clips.filter(c => c.id !== action.payload.clipId) } : t)); break;
          case 'UPDATE_CLIP_BOUNDS': 
              setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { 
                  ...t, clips: t.clips.map(c => c.id === action.payload.clipId ? { 
                      ...c, 
                      start: action.payload.start, 
                      duration: action.payload.duration,
                      ...(action.payload.sampleOffset !== undefined ? { sampleOffset: action.payload.sampleOffset } : {})
                  } : c) 
              } : t)); 
              break;
          case 'SPLIT_CLIP': {
              const { trackId, clipId, sliceBeat } = action.payload;
              setTracks(prev => prev.map(t => {
                  if (t.id !== trackId) return t;
                  const clip = t.clips.find(c => c.id === clipId);
                  if (!clip || sliceBeat <= clip.start || sliceBeat >= clip.start + clip.duration) return t;
                  
                  const splitOffset = sliceBeat - clip.start;
                  
                  if (t.type === 'audio') {
                      const c1 = { ...clip, duration: splitOffset };
                      const c2 = { 
                          ...clip, 
                          id: Date.now() + Math.random(), 
                          start: sliceBeat, 
                          duration: clip.duration - splitOffset,
                          sampleOffset: (clip.sampleOffset || 0) + splitOffset 
                      };
                      return { ...t, clips: [...t.clips.filter(c => c.id !== clipId), c1, c2] };
                  } else if (t.type === 'midi') {
                      const c1Notes = [];
                      const c2Notes = [];
                      (clip.notes || []).forEach(n => {
                          if (n.start < splitOffset) {
                              c1Notes.push({ ...n, duration: Math.min(n.duration, splitOffset - n.start) });
                          }
                          if (n.start + n.duration > splitOffset) {
                              const newStart = Math.max(0, n.start - splitOffset);
                              const finalDur = n.start < splitOffset ? (n.start + n.duration) - splitOffset : n.duration;
                              c2Notes.push({ ...n, id: `n_${Date.now()}_${Math.random()}`, start: newStart, duration: finalDur });
                          }
                      });
                      const c1 = { ...clip, duration: splitOffset, notes: c1Notes };
                      const c2 = { ...clip, id: Date.now() + Math.random(), start: sliceBeat, duration: clip.duration - splitOffset, notes: c2Notes };
                      return { ...t, clips: [...t.clips.filter(c => c.id !== clipId), c1, c2] };
                  }
                  return t;
              }));
              break;
          }
          case 'MOVE_CLIP': {
              setTracks(prev => {
                 let newTracks = [...prev];
                 const currentSrcTrackIdx = newTracks.findIndex(t => t.clips.some(c => c.id === action.payload.clipId));
                 const tgtIdx = newTracks.findIndex(t => t.id === action.payload.targetTrackId);
                 if (currentSrcTrackIdx === -1 || tgtIdx === -1) return prev;
                 const clipToMove = newTracks[currentSrcTrackIdx].clips.find(c => c.id === action.payload.clipId);
                 const updClip = { ...clipToMove, start: action.payload.start };
                 if (currentSrcTrackIdx !== tgtIdx && !isLocal) {
                    newTracks[currentSrcTrackIdx] = { ...newTracks[currentSrcTrackIdx], clips: newTracks[currentSrcTrackIdx].clips.filter(c => c.id !== action.payload.clipId) };
                    newTracks[tgtIdx] = { ...newTracks[tgtIdx], clips: [...newTracks[tgtIdx].clips, updClip] };
                 } else {
                    newTracks[currentSrcTrackIdx] = { ...newTracks[currentSrcTrackIdx], clips: newTracks[currentSrcTrackIdx].clips.map(c => c.id === action.payload.clipId ? updClip : c) };
                 }
                 return newTracks;
              });
              break;
          }
          case 'ADD_EFFECT': 
              setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { ...t, effects: [...t.effects, action.payload.effect] } : t)); 
              if (!isLocal && audioCtxRef.current) {
                  const updatedTrack = { ...tracksRef.current.find(t => t.id === action.payload.trackId), effects: [...tracksRef.current.find(t => t.id === action.payload.trackId).effects, action.payload.effect] };
                  initTrackRouting(updatedTrack, audioCtxRef.current, masterGainRef.current).then(synth => { synthsRef.current[action.payload.trackId] = synth; });
              }
              break;
          case 'DELETE_EFFECT': 
              setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { ...t, effects: t.effects.filter(fx => fx.id !== action.payload.fxId) } : t)); 
              if (!isLocal && audioCtxRef.current) {
                  const updatedTrack = { ...tracksRef.current.find(t => t.id === action.payload.trackId) };
                  updatedTrack.effects = updatedTrack.effects.filter(fx => fx.id !== action.payload.fxId);
                  initTrackRouting(updatedTrack, audioCtxRef.current, masterGainRef.current).then(synth => { synthsRef.current[action.payload.trackId] = synth; });
              }
              break;
          case 'UPDATE_EFFECT_PARAM': 
              setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { ...t, effects: t.effects.map(fx => fx.id === action.payload.fxId ? { ...fx, params: { ...fx.params, [action.payload.param]: action.payload.value } } : fx) } : t)); 
              applyAudioEffectParam(action.payload.trackId, action.payload.fxId, action.payload.param, action.payload.value);
              break;
          case 'REORDER_EFFECTS': {
              const { trackId, startIndex, endIndex } = action.payload;
              setTracks(prev => prev.map(t => {
                  if (t.id !== trackId) return t;
                  const newEffects = [...t.effects];
                  const temp = newEffects[startIndex];
                  newEffects[startIndex] = newEffects[endIndex];
                  newEffects[endIndex] = temp;
                  return { ...t, effects: newEffects };
              }));
              if (!isLocal && audioCtxRef.current) {
                  const updatedTrack = { ...tracksRef.current.find(t => t.id === trackId) };
                  if (updatedTrack && updatedTrack.effects) {
                      const newEffects = [...updatedTrack.effects];
                      const temp = newEffects[startIndex];
                      newEffects[startIndex] = newEffects[endIndex];
                      newEffects[endIndex] = temp;
                      updatedTrack.effects = newEffects;
                      initTrackRouting(updatedTrack, audioCtxRef.current, masterGainRef.current).then(synth => { synthsRef.current[trackId] = synth; });
                  }
              }
              break;
          }
          case 'CHANGE_INSTRUMENT': 
              setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { ...t, instrument: action.payload.instrumentId, instrumentParams: action.payload.instrumentParams } : t)); 
              break;
          case 'UPDATE_INSTRUMENT_PARAM': 
              setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { ...t, instrumentParams: { ...t.instrumentParams, [action.payload.param]: action.payload.value } } : t)); 
              break;
          case 'UPDATE_NOTES': setTracks(prev => prev.map(t => t.id === action.payload.trackId ? { ...t, clips: t.clips.map(c => c.id === action.payload.clipId ? { ...c, notes: action.payload.notes } : c) } : t)); break;
          default: break;
      }
  }, []);

  const dispatchDawAction = useCallback((action) => {
      applyDawAction(action, true);
      if (socketRef.current) socketRef.current.emit('daw-action', { ...action, projectId: currentProjectIdRef.current });
  }, [applyDawAction]);

  useEffect(() => {
      transportActionsRef.current = {
          togglePlay,
          stopPlayback,
          toggleRecord,
          forward: () => {
              const sg = snapGridRef.current || 4;
              let newTime = stateRefs.current.currentTime + sg;
              newTime = Math.max(0, Math.round(newTime / sg) * sg);
              setCurrentTime(newTime);
              stateRefs.current.currentTime = newTime;
              lastMetronomeBeatRef.current = Math.floor(newTime);
              broadcastLivePreview({ type: 'UPDATE_TIME', payload: { currentTime: newTime } });
          },
          rewind: () => {
              const sg = snapGridRef.current || 4;
              let newTime = stateRefs.current.currentTime - sg;
              newTime = Math.max(0, Math.round(newTime / sg) * sg);
              setCurrentTime(newTime);
              stateRefs.current.currentTime = newTime;
              lastMetronomeBeatRef.current = Math.floor(newTime);
              broadcastLivePreview({ type: 'UPDATE_TIME', payload: { currentTime: newTime } });
          },
          loop: () => {
              const nextEnabled = !loopRegionRef.current.enabled;
              setLoopRegion(prev => ({...prev, enabled: nextEnabled}));
              dispatchDawAction({ type: 'UPDATE_LOOP_REGION', payload: { ...loopRegionRef.current, enabled: nextEnabled } });
          }
      };
  }, [togglePlay, stopPlayback, toggleRecord, setCurrentTime, broadcastLivePreview, dispatchDawAction]);

  const handleMouseMove = useCallback((e) => {
      const sg = snapGridRef.current;
      const snap = (val) => sg === 0 ? val : Math.round(val / sg) * sg;

      if (draggingClip) {
          const deltaX = e.clientX - draggingClip.startX;
          const deltaBeats = snap(deltaX / BEAT_WIDTH); 
          let newStart = Math.max(0, draggingClip.initialStart + deltaBeats);

          let currentTargetTrackId = draggingClip.trackId;
          if (timelineRef.current) {
              const rect = timelineRef.current.getBoundingClientRect();
              const y = e.clientY - rect.top + timelineRef.current.scrollTop;
              if (y >= 0) {
                  const trackIndex = Math.floor(y / 96); 
                  if (trackIndex >= 0 && trackIndex < tracksRef.current.length) {
                      const targetTrack = tracksRef.current[trackIndex];
                      const sourceTrack = tracksRef.current.find(t => t.id === draggingClip.trackId);
                      if (targetTrack && sourceTrack && targetTrack.type === sourceTrack.type) {
                          currentTargetTrackId = targetTrack.id;
                      }
                  }
              }
          }

          dragValuesRef.current = { start: newStart, targetTrackId: currentTargetTrackId };

          setTracks(prev => {
              let newTracks = [...prev];
              const clipSrcTrackIdx = newTracks.findIndex(t => t.clips.some(c => c.id === draggingClip.clipId));
              const tgtIdx = newTracks.findIndex(t => t.id === currentTargetTrackId);
              
              if (clipSrcTrackIdx === -1 || tgtIdx === -1) return prev;
              const clip = newTracks[clipSrcTrackIdx].clips.find(c => c.id === draggingClip.clipId);
              if (!clip) return prev;

              const updClip = { ...clip, start: newStart };
              
              return newTracks.map(t => {
                 if (t.id === newTracks[clipSrcTrackIdx].id && t.id !== newTracks[tgtIdx].id) {
                     return { ...t, clips: t.clips.filter(c => c.id !== clip.id) };
                 }
                 if (t.id === newTracks[tgtIdx].id && t.id !== newTracks[clipSrcTrackIdx].id) {
                     return { ...t, clips: [...t.clips, updClip] };
                 }
                 if (t.id === newTracks[tgtIdx].id && t.id === newTracks[clipSrcTrackIdx].id) {
                     return { ...t, clips: t.clips.map(c => c.id === clip.id ? updClip : c) };
                 }
                 return t;
              });
          });

          if (currentTargetTrackId !== draggingClip.trackId) {
              setDraggingClip(prev => ({ ...prev, trackId: currentTargetTrackId }));
              if(bottomDock?.clipId === draggingClip.clipId) setBottomDock(prev => ({...prev, trackId: currentTargetTrackId}));
          }

          // Trigger Live Collaborative Preview
          broadcastLivePreview({
              type: 'MOVE_CLIP',
              payload: {
                  sourceTrackId: draggingClip.initialTrackId,
                  targetTrackId: currentTargetTrackId,
                  clipId: draggingClip.clipId,
                  start: newStart
              }
          });

          } else if (draggingEdge) {
              const deltaX = e.clientX - draggingEdge.startX;
              const deltaBeats = snap(deltaX / BEAT_WIDTH);
              
              let newStart = draggingEdge.initialStart;
              let newDuration = draggingEdge.initialDuration;
              let newSampleOffset = draggingEdge.initialSampleOffset || 0;
              
              if (draggingEdge.edge === 'right') {
                  newDuration = Math.max(0.25, draggingEdge.initialDuration + deltaBeats);
              } else {
                  const maxLeftPull = -(draggingEdge.initialSampleOffset || 0);
                  const constrainedDelta = Math.max(maxLeftPull, deltaBeats);
                  
                  newStart = Math.min(draggingEdge.initialStart + draggingEdge.initialDuration - 0.25, draggingEdge.initialStart + constrainedDelta);
                  newDuration = draggingEdge.initialStart + draggingEdge.initialDuration - newStart;
                  newSampleOffset = (draggingEdge.initialSampleOffset || 0) + (newStart - draggingEdge.initialStart);
              }
              dragValuesRef.current = { start: newStart, duration: newDuration, sampleOffset: newSampleOffset };
              
              setTracks(prev => prev.map(t => t.id === draggingEdge.trackId ? {
                  ...t, clips: t.clips.map(c => {
                      if (c.id !== draggingEdge.clipId) return c;
                      return { ...c, start: newStart, duration: newDuration, sampleOffset: newSampleOffset };
                  })
              } : t));

              // Trigger Live Collaborative Preview
              broadcastLivePreview({
                  type: 'UPDATE_CLIP_BOUNDS',
                  payload: { trackId: draggingEdge.trackId, clipId: draggingEdge.clipId, start: newStart, duration: newDuration, sampleOffset: newSampleOffset }
              });

          } else if (draggingNote) {

          const deltaX = e.clientX - draggingNote.startX;
          const deltaY = e.clientY - draggingNote.startY;
          const deltaBeats = snap(deltaX / BEAT_WIDTH);
          const deltaPitch = Math.round(deltaY / 16); 
          
          let newStart = Math.max(0, draggingNote.initialStart + deltaBeats);
          let newPitch = Math.min(108, Math.max(24, draggingNote.initialPitch - deltaPitch));
          
          const track = tracksRef.current.find(t => t.id === draggingNote.trackId);
          const clip = track?.clips.find(c => c.id === draggingNote.clipId);
          
          if (clip) {
              const newNotes = clip.notes.map(n => n.id === draggingNote.noteId ? { ...n, start: newStart, pitch: newPitch } : n);
              dragValuesRef.current = { notes: newNotes };
              
              setTracks(prev => prev.map(t => t.id === draggingNote.trackId ? {
                  ...t, clips: t.clips.map(c => c.id === draggingNote.clipId ? { ...c, notes: newNotes } : c)
              } : t));

              // Trigger Live Collaborative Preview
              broadcastLivePreview({
                  type: 'UPDATE_NOTES',
                  payload: { trackId: draggingNote.trackId, clipId: draggingNote.clipId, notes: newNotes }
              });
          }

      } else if (draggingNoteEdge) {
          const deltaX = e.clientX - draggingNoteEdge.startX;
          const deltaBeats = snap(deltaX / BEAT_WIDTH);
          
          const track = tracksRef.current.find(t => t.id === draggingNoteEdge.trackId);
          const clip = track?.clips.find(c => c.id === draggingNoteEdge.clipId);

          if (clip) {
              const newNotes = clip.notes.map(n => {
                  if (n.id !== draggingNoteEdge.noteId) return n;
                  if (draggingNoteEdge.edge === 'right') {
                      return { ...n, duration: Math.max(0.125, draggingNoteEdge.initialDuration + deltaBeats) };
                  } else {
                      const ns = Math.min(draggingNoteEdge.initialStart + draggingNoteEdge.initialDuration - 0.125, Math.max(0, draggingNoteEdge.initialStart + deltaBeats));
                      return { ...n, start: ns, duration: draggingNoteEdge.initialStart + draggingNoteEdge.initialDuration - ns };
                  }
              });

              dragValuesRef.current = { notes: newNotes };
              
              setTracks(prev => prev.map(t => t.id === draggingNoteEdge.trackId ? {
                  ...t, clips: t.clips.map(c => c.id === draggingNoteEdge.clipId ? { ...c, notes: newNotes } : c)
              } : t));

              // Trigger Live Collaborative Preview
              broadcastLivePreview({
                  type: 'UPDATE_NOTES',
                  payload: { trackId: draggingNoteEdge.trackId, clipId: draggingNoteEdge.clipId, notes: newNotes }
              });
          }

      } else if (draggingLoop) {
          const deltaX = e.clientX - draggingLoop.startX;
          const deltaBeats = snap(deltaX / BEAT_WIDTH);
          setLoopRegion(prev => {
              let newStart = prev.start; let newEnd = prev.end;
              if (draggingLoop.edge === 'start') {
                  newStart = Math.max(0, Math.min(draggingLoop.initialStart + deltaBeats, prev.end - 1));
              } else if (draggingLoop.edge === 'end') {
                  newEnd = Math.max(prev.start + 1, draggingLoop.initialEnd + deltaBeats);
              } else if (draggingLoop.edge === 'body') {
                  const width = draggingLoop.initialEnd - draggingLoop.initialStart;
                  newStart = Math.max(0, draggingLoop.initialStart + deltaBeats);
                  newEnd = newStart + width;
              }
              const newLoop = { ...prev, start: newStart, end: newEnd };
              broadcastLivePreview({ type: 'UPDATE_LOOP_REGION', payload: newLoop });
              return newLoop;
          });
        } else if (draggingAutoPoint) {
            const { trackId, paramKey, pointId, startX, startY, initialTime, initialValue } = draggingAutoPoint;
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const deltaBeats = snap(deltaX / BEAT_WIDTH);
            
            const minMax = getAutomationConstraints(paramKey);
            const valueRange = minMax.max - minMax.min;
            const laneHeight = draggingAutoPoint.laneHeight || 96;
            const deltaValue = -(deltaY / laneHeight) * valueRange;
            
            const newTime = Math.max(0, initialTime + deltaBeats);
            const newValue = Math.max(minMax.min, Math.min(minMax.max, initialValue + deltaValue));
            
            dispatchDawAction({ type: 'UPDATE_AUTOMATION_POINT', payload: { trackId, paramKey, pointId, time: newTime, value: newValue } });
        } else if (draggingPlayhead) {
            if (timelineRef.current) {
                const rect = timelineRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
                const newTime = Math.max(0, snap(x / BEAT_WIDTH));
                setCurrentTime(newTime);
                stateRefs.current.currentTime = newTime;
                lastMetronomeBeatRef.current = Math.floor(newTime);
                broadcastLivePreview({ type: 'UPDATE_TIME', payload: { currentTime: newTime } });
            }
        } else if (draggingDockHeight) {
          // Keep a minimum readable bound on the bottom rack (260px) to prevent squished crash behaviors
          setDockHeight(Math.max(260, Math.min(800, window.innerHeight - e.clientY)));
      }
  }, [draggingClip, draggingEdge, draggingNote, draggingNoteEdge, draggingLoop, draggingPlayhead, draggingDockHeight, BEAT_WIDTH]);
  
  const handleMouseUp = useCallback(() => {
      if (draggingClip) {
          const finalStart = dragValuesRef.current.start ?? draggingClip.initialStart;
          const finalTrackId = dragValuesRef.current.targetTrackId ?? draggingClip.initialTrackId;
          dispatchDawAction({ type: 'MOVE_CLIP', payload: { sourceTrackId: draggingClip.initialTrackId, targetTrackId: finalTrackId, clipId: draggingClip.clipId, start: finalStart } });
          setDraggingClip(null);
      }
      if (draggingEdge) {
          const finalStart = dragValuesRef.current.start ?? draggingEdge.initialStart;
          const finalDuration = dragValuesRef.current.duration ?? draggingEdge.initialDuration;
          const finalSampleOffset = dragValuesRef.current.sampleOffset ?? draggingEdge.initialSampleOffset;
          dispatchDawAction({ type: 'UPDATE_CLIP_BOUNDS', payload: { trackId: draggingEdge.trackId, clipId: draggingEdge.clipId, start: finalStart, duration: finalDuration, sampleOffset: finalSampleOffset } });
          setDraggingEdge(null);
      }
      if (draggingNote) {
          if (dragValuesRef.current.notes) {
              dispatchDawAction({ type: 'UPDATE_NOTES', payload: { trackId: draggingNote.trackId, clipId: draggingNote.clipId, notes: dragValuesRef.current.notes }});
          }
          setDraggingNote(null);
      }
      if (draggingNoteEdge) {
          if (dragValuesRef.current.notes) {
              dispatchDawAction({ type: 'UPDATE_NOTES', payload: { trackId: draggingNoteEdge.trackId, clipId: draggingNoteEdge.clipId, notes: dragValuesRef.current.notes }});
          }
          setDraggingNoteEdge(null);
      }
      dragValuesRef.current = {};
      if (draggingAutoPoint) setDraggingAutoPoint(null);
      if (draggingLoop) setDraggingLoop(null);
      if (draggingPlayhead) setDraggingPlayhead(false);
      if (draggingDockHeight) setDraggingDockHeight(false);
  }, [draggingClip, draggingEdge, draggingNote, draggingNoteEdge, draggingLoop, draggingPlayhead, draggingDockHeight]);

  useEffect(() => {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [handleMouseMove, handleMouseUp]);

  const handleTimelineMouseDown = (e) => {
      if (e.target.closest('.clip-element') || draggingClip || draggingNote || draggingNoteEdge || draggingLoop) return;
      setSelectedClipIds([]); // Deselect all clips when clicking empty space
      setDraggingPlayhead(true);
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollLeft = e.currentTarget.scrollLeft || 0;
      const x = e.clientX - rect.left + scrollLeft;
      const sg = snapGridRef.current;
      const snap = (val) => sg === 0 ? val : Math.round(val / sg) * sg;
      const newTime = Math.max(0, snap(x / BEAT_WIDTH));
      setCurrentTime(newTime);
      stateRefs.current.currentTime = newTime;
      lastMetronomeBeatRef.current = Math.floor(newTime);
      stopAudio();
  };

  const handleDragOver = useCallback((e) => {
      e.preventDefault(); e.stopPropagation();
      let fileType = 'audio';
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
          const item = e.dataTransfer.items[0];
          if (item.type.includes('midi') || item.type === '' || item.type.includes('octet-stream')) fileType = 'midi'; 
      }
      if (timelineRef.current) {
          const rect = timelineRef.current.getBoundingClientRect();
          const y = e.clientY - rect.top + timelineRef.current.scrollTop;
          const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
          const sg = snapGridRef.current; const snap = (val) => sg === 0 ? val : Math.round(val / sg) * sg;
          const beat = Math.max(0, snap(x / BEAT_WIDTH));
          const trackIndex = Math.max(0, Math.floor(y / 96));
          setDragHover({ active: true, beat, trackIndex, fileType });
      }
  }, [BEAT_WIDTH]);

  const handleDragLeave = useCallback((e) => {
      e.preventDefault(); e.stopPropagation();
      if (timelineRef.current && !timelineRef.current.contains(e.relatedTarget)) setDragHover(null);
  }, []);

  const handleDrop = useCallback(async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!dragHover) return;
      const { beat, trackIndex } = dragHover; setDragHover(null);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      const file = files[0];

      const isMidi = file.name.toLowerCase().endsWith('.mid') || file.name.toLowerCase().endsWith('.midi');
      const isAudio = file.type.startsWith('audio/') || file.name.toLowerCase().match(/\.(wav|mp3|ogg|flac|m4a)$/);

      if (!isMidi && !isAudio) { showToast("Unsupported file format.", "error"); return; }

      const fileType = isMidi ? 'midi' : 'audio';
      let targetTrack = tracksRef.current[trackIndex];
      let finalTrackId = targetTrack?.id;
      let needsNewTrack = !targetTrack || targetTrack.type !== fileType;

      if (needsNewTrack) {
          finalTrackId = Date.now() + Math.floor(Math.random() * 1000);
          const newTrack = {
              id: finalTrackId,
              name: file.name.split('.')[0].substring(0, 16),
              type: fileType,
              color: fileType === 'midi' ? 'bg-pink-500' : 'bg-emerald-500',
              volume: 80, pan: 0, muted: false, solo: false, armed: false, clips: [], effects: [],
              ...(fileType === 'midi' ? { instrument: 'inst-subtractive', instrumentParams: {cutoff:2000, res:1} } : { audioInputId: '' })
          };
          dispatchDawAction({ type: 'ADD_TRACK', payload: newTrack });
      }

      if (isMidi) {
          try {
              const notes = await parseMidiFile(file);
              if (notes.length === 0) throw new Error("No valid notes found in file");
              let maxBeat = 0; notes.forEach(n => { if (n.start + n.duration > maxBeat) maxBeat = n.start + n.duration; });
              const newClip = { id: Date.now(), start: beat, duration: Math.max(4, maxBeat), notes };
              dispatchDawAction({ type: 'ADD_CLIP', payload: { trackId: finalTrackId, clip: newClip } });
              showToast(`Imported MIDI: ${notes.length} notes`, 'success');
          } catch(err) { 
              console.error("MIDI Parse Error:", err);
              showToast("Failed to parse MIDI: " + err.message, "error"); 
          }
      } else {
          try {
              const sampleId = `import_${Date.now()}`;
              const formData = new FormData(); formData.append('audio', file);
              await fetch(`${API_BASE_URL}/api/samples/upload/${sampleId}`, { method: 'POST', headers: { 'Authorization': `Bearer ${authTokenRef.current}` }, body: formData });
              const arrayBuffer = await file.arrayBuffer();
              if (!audioCtxRef.current) await initAudioEngine();
              const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
              globalAudioBufferCache.set(sampleId, { buffer: audioBuffer, duration: audioBuffer.duration });
              const durBeats = audioBuffer.duration * (stateRefs.current.bpm / 60);
              const newClip = { id: Date.now(), start: beat, duration: Math.max(1, durBeats), sampleId };
              dispatchDawAction({ type: 'ADD_CLIP', payload: { trackId: finalTrackId, clip: newClip } });
              showToast(`Imported Audio: ${file.name}`, 'success');
          } catch (err) { showToast("Failed to process audio file.", "error"); }
      }
  }, [dragHover, BEAT_WIDTH, initAudioEngine]);

  const handleTrackDoubleClick = (e, trackId) => {
    if (e.target !== e.currentTarget) return; 
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = timelineRef.current ? timelineRef.current.scrollLeft : 0;
    const x = e.clientX - rect.left + scrollLeft;
    const sg = snapGridRef.current;
    const snap = (val) => sg === 0 ? val : Math.round(val / sg) * sg;
    const startBeat = Math.max(0, snap(x / BEAT_WIDTH));
    const newClip = { id: Date.now(), start: startBeat, duration: 4, notes: [] };
    dispatchDawAction({ type: 'ADD_CLIP', payload: { trackId, clip: newClip } });
  };

  const handlePianoGridDoubleClick = (e, trackId, clipId) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const sg = snapGridRef.current;
      const snap = (val) => sg === 0 ? val : Math.round(val / sg) * sg;
      const startBeat = Math.max(0, snap(x / BEAT_WIDTH));
      const pitchIndex = Math.floor(y / 16);
      const pitch = 108 - pitchIndex;
      
      const newNote = { id: `n_${Date.now()}`, pitch, start: startBeat, duration: sg || 0.25, velocity: 100 };
      
      const track = tracks.find(t => t.id === trackId);
      const clip = track?.clips.find(c => c.id === clipId);
      if (clip) {
          const newNotes = [...(clip.notes || []), newNote];
          dispatchDawAction({ type: 'UPDATE_NOTES', payload: { trackId, clipId, notes: newNotes } });
          previewNote(trackId, pitch, 100);
      }
  };

  // --- RENDER: AUTH ---
  if (appView === 'auth') {
    return (
      <div className="flex flex-col h-screen bg-neutral-950 items-center justify-center text-neutral-300 font-sans select-none">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
          <div className="flex flex-col items-center gap-3 mb-6">
             <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white"><Lock size={24} /></div>
             <h2 className="text-xl font-bold text-white">FreeDaw-Collab <span className="text-sm text-blue-400">Secure</span></h2>
          </div>
          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
            <input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} required className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 transition-colors" placeholder="Username" />
            <input type="password" required className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 transition-colors" placeholder="Password" />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg mt-2 shadow-lg flex items-center justify-center gap-2 transition-colors"><Network size={16} /> Connect</button>
          </form>
        </div>
        {toasts.map(t => <div key={t.id} className="fixed bottom-4 right-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl z-50 shadow-lg">{t.message}</div>)}
      </div>
    );
  }

  // --- RENDER: HOME ---
  if (appView === 'home') {
      const allProjects = Array.from(new Map([...localProjects, ...serverProjects].map(p => [p.id, p])).values());
      const personalProjects = allProjects.filter(p => !p.ownerId || p.ownerId === currentUser?.id);
      const sharedProjects = allProjects.filter(p => 
          p.ownerId && 
          p.ownerId !== currentUser?.id && 
          (p.isPublic || (p.sharedWith && p.sharedWith.includes(currentUser?.username)))
      );

      return (
        <div className="flex flex-col h-screen bg-neutral-950 text-neutral-300 p-8 overflow-y-auto custom-scrollbar select-none">
            <header className="flex justify-between items-center mb-12 border-b border-neutral-800 pb-6">
                <h1 className="text-3xl font-bold text-white">Project Library</h1>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 mr-4">
                        {currentUser?.avatar ? (
                            <img src={currentUser.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-neutral-700" />
                        ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${currentUser?.color || 'bg-emerald-500'}`}>
                                {currentUser?.username?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="text-sm">Signed in as <b className="text-white">{currentUser?.username}</b></span>
                    </div>
                    <button onClick={handleSignOut} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white p-2 rounded-lg transition-colors" title="Sign Out">
                        <LogOut size={16} />
                    </button>
                    <button onClick={() => { setAppView('daw'); setTracks(INITIAL_TRACKS); setProjectId(`proj_${Date.now()}`); setSharedWith([]); setProjectOwnerId(currentUser?.id); setProjectOwnerName(currentUser?.username); setIsPublic(false); }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"><Plus size={16}/> New Project</button>
                </div>

            </header>
            
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Folder size={18} className="text-blue-400"/> My Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                {personalProjects.length === 0 && <p className="text-neutral-500 text-sm">No personal projects found.</p>}
                {personalProjects.map(proj => (
                    <div key={proj.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 group hover:border-neutral-600 shadow-lg transition-colors">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-neutral-800 rounded flex items-center justify-center text-blue-400"><FileJson size={20}/></div>
                            <button onClick={(e) => handleDeleteProject(e, proj.id)} className="text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1 cursor-pointer hover:text-blue-400 transition-colors" onClick={() => loadProjectToDaw(proj)}>{proj.name}</h3>
                        <p className="text-xs text-neutral-500">{new Date(proj.lastModified).toLocaleString()}</p>
                    </div>
                ))}
            </div>

            {sharedProjects.length > 0 && (
                <>
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Users size={18} className="text-purple-400"/> Community & Shared Projects</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                        {sharedProjects.map(proj => (
                            <div key={proj.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 group hover:border-neutral-600 shadow-lg transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 bg-neutral-800 rounded flex items-center justify-center text-purple-400"><Users size={20}/></div>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1 cursor-pointer hover:text-purple-400 transition-colors" onClick={() => loadProjectToDaw(proj)}>{proj.name}</h3>
                                <p className="text-xs text-neutral-500">Shared by: <span className="text-white">{proj.ownerName || 'Unknown'}</span></p>
                                <p className="text-xs text-neutral-500 mt-1">{new Date(proj.lastModified).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
            {toasts.map(t => <div key={t.id} className="fixed bottom-4 right-4 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-3 rounded-xl z-50 shadow-lg">{t.message}</div>)}
        </div>
      );
  }

  // Calculate dynamic timeline length based on furthest clip
  let maxBeat = 0;
  tracks.forEach(t => t.clips.forEach(c => {
      if (c.start + c.duration > maxBeat) maxBeat = c.start + c.duration;
  }));
  // At least 64 bars (256 beats), plus a padding of 16 bars (64 beats) past the last clip
  const dynamicTotalBeats = Math.max(256, Math.ceil(maxBeat / 4) * 4 + 64);

  // --- RENDER: DAW STUDIO ---
  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-neutral-300 font-sans select-none">
      
      {/* MIDI Learn Global Indicator */}
      {midiLearnTarget && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[250] bg-blue-600 text-white px-6 py-3 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.8)] font-bold text-sm animate-pulse flex items-center gap-3">
            <Radio size={18} className="animate-spin-slow" />
            MIDI LEARN ACTIVE: Turn a knob/fader on your controller... (Press Esc to cancel)
        </div>
      )}

      <header className="h-14 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0 z-40 relative">
        <div className="flex items-center gap-4 w-1/3">
            <button onClick={() => setAppView('home')} className="text-neutral-400 hover:text-white transition-colors" title="Back to Library"><Home size={18} /></button>
            <div className="flex flex-col justify-center">
                <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="bg-transparent text-white font-bold text-sm outline-none w-[180px] focus:border-b focus:border-blue-500 transition-colors" />
                {(projectOwnerName || currentUser?.username) && <span className="text-[9px] text-neutral-500 font-medium tracking-wide">by {projectOwnerName || currentUser?.username}</span>}
            </div>
            <button onClick={() => saveProject()} className="text-neutral-400 hover:text-blue-400 transition-colors" title="Save Project"><Save size={16}/></button>
            <button onClick={() => setShowShareModal(true)} className="text-neutral-400 hover:text-purple-400 ml-2 transition-colors" title="Share Project"><Users size={16}/></button>
            <button onClick={handleExportBounce} disabled={isExporting} className={`ml-2 transition-colors ${isExporting ? 'text-green-400 animate-pulse' : 'text-neutral-400 hover:text-green-400'}`} title="Export Mixdown to WAV"><Download size={16}/></button>
            <button onClick={handleExportMultitrack} disabled={isExporting} className={`ml-2 transition-colors ${isExporting ? 'text-blue-400 animate-pulse' : 'text-neutral-400 hover:text-blue-400'}`} title="Export Multitrack ZIP (Stems)"><Folder size={16}/></button>
        </div>

        
        <div className="flex items-center justify-center gap-1.5 bg-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-800 shrink-0 shadow-inner">
            <button onClick={() => transportActionsRef.current.rewind?.()} onContextMenu={(e) => handleContextMenu(e, 'midi-learn', { type: 'transport_rewind' })} className="p-1.5 text-neutral-400 hover:text-white transition-colors" title="Return to Start"><SkipBack size={16} /></button>
            <button onClick={togglePlay} onContextMenu={(e) => handleContextMenu(e, 'midi-learn', { type: 'transport_play' })} className={`p-2 rounded-full transition-all ${isPlaying ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.5)]' : 'bg-neutral-800 text-white hover:bg-neutral-700'}`} title="Play/Pause">{isPlaying ? <Pause size={16}/> : <Play size={16}/>}</button>
            <button onClick={stopPlayback} onContextMenu={(e) => handleContextMenu(e, 'midi-learn', { type: 'transport_stop' })} className="p-1.5 text-neutral-400 hover:text-white transition-colors" title="Stop"><Square size={16}/></button>
            <button onClick={() => transportActionsRef.current.forward?.()} onContextMenu={(e) => handleContextMenu(e, 'midi-learn', { type: 'transport_forward' })} className="p-1.5 text-neutral-400 hover:text-white transition-colors" title="Forward"><SkipForward size={16} /></button>
            <button onClick={toggleRecord} onContextMenu={(e) => handleContextMenu(e, 'midi-learn', { type: 'transport_record' })} className={`p-1.5 rounded-lg transition-colors ml-1 ${isRecording ? 'text-red-500 bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'text-neutral-400 hover:text-red-400 hover:bg-neutral-800'}`} title="Record (Keyboard/Mic)"><Circle size={16} fill="currentColor"/></button>
            <div className="w-px h-5 bg-neutral-800 mx-2" />
            <button onClick={() => {
                const nextEnabled = !loopRegion.enabled;
                setLoopRegion(prev => ({...prev, enabled: nextEnabled}));
            dispatchDawAction({ type: 'UPDATE_LOOP_REGION', payload: { ...loopRegion, enabled: nextEnabled } });
        }} onContextMenu={(e) => handleContextMenu(e, 'midi-learn', { type: 'transport_loop' })} className={`p-1.5 rounded-lg transition-colors ${loopRegion.enabled ? 'text-blue-400 bg-blue-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Toggle Loop"><Repeat size={16}/></button>
        <button onClick={() => setIsMetronomeEnabled(!isMetronomeEnabled)} className={`p-1.5 rounded-lg transition-colors ml-1 ${isMetronomeEnabled ? 'text-blue-400 bg-blue-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Toggle Metronome"><Bell size={16}/></button>
    </div>


        <div className="flex items-center justify-end gap-3 w-1/3">
            <div className="hidden lg:flex items-center gap-4 bg-neutral-900/80 px-4 py-1.5 rounded-xl border border-neutral-800 font-mono text-[11px] shadow-inner mr-2">
               <div className="flex items-center gap-1 text-neutral-400">
                    <span className="uppercase text-[9px] font-bold text-neutral-600">GRID</span>
                    <select value={snapGrid} onChange={e => setSnapGrid(Number(e.target.value))} className="bg-transparent w-12 text-blue-400 font-bold focus:outline-none text-[10px] cursor-pointer">
                        <option value={4} className="bg-neutral-900 text-neutral-300">1 Bar</option>
                        <option value={1} className="bg-neutral-900 text-neutral-300">1/4</option>
                        <option value={0.5} className="bg-neutral-900 text-neutral-300">1/8</option>
                        <option value={0.25} className="bg-neutral-900 text-neutral-300">1/16</option>
                        <option value={0.125} className="bg-neutral-900 text-neutral-300">1/32</option>
                        <option value={0} className="bg-neutral-900 text-neutral-300">Off</option>
                    </select>
               </div>
               <div className="flex items-center gap-1.5 text-neutral-400 border-l border-neutral-700 pl-4"><span className="uppercase text-[9px] font-bold text-neutral-600">Time</span> <span className="text-white w-14">{formatTime(currentTime, bpm)}</span></div>
               <div className="flex items-center gap-1.5 text-neutral-400"><span className="uppercase text-[9px] font-bold text-neutral-600">Pos</span> <span className="text-white">{Math.floor(currentTime / 4) + 1}.{Math.floor(currentTime % 4) + 1}.1</span></div>
               <div className="flex items-center gap-1 text-neutral-400"><span className="uppercase text-[9px] font-bold text-neutral-600">BPM</span> <input type="number" value={bpm} onChange={(e) => dispatchDawAction({ type: 'SYNC_STATE', payload: { tracks, bpm: Number(e.target.value) } })} className="bg-transparent w-8 text-white focus:outline-none" min="40" max="300" /></div>
               
               {/* Global Master Volume & VU Meter in the Header */}
               <div className="flex items-center gap-2 border-l border-neutral-700 pl-4 ml-1">
                   <Volume2 size={12} className="text-neutral-500" />
                   <div className="flex flex-col gap-1 w-20">
                       <input type="range" min="0" max="100" value={masterVolume} onChange={(e) => handleMasterVolumeChange(e.target.value)} onWheel={(e) => { e.stopPropagation(); handleMasterVolumeChange(Math.min(100, Math.max(0, masterVolume + (e.deltaY < 0 ? 5 : -5)))); }} className="w-full h-1 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white cursor-pointer" />
                       <div className="h-1.5 w-full">
                           <VuMeter isMaster={true} masterAnalyserRef={masterAnalyserRef} isVertical={false} />
                       </div>
                   </div>
               </div>
            </div>

            <div className="flex -space-x-2 mr-2">
                <div className="relative z-50">
                    <div onClick={() => setShowProfileMenu(p => !p)} className="w-8 h-8 bg-neutral-800 rounded-full border-2 border-neutral-900 overflow-hidden relative group cursor-pointer shadow-sm">
                        {currentUser?.avatar ? (
                            <img src={currentUser.avatar} alt="Me" className="w-full h-full object-cover" />
                        ) : (
                            <div className={`w-full h-full flex items-center justify-center text-xs font-bold text-white ${currentUser?.color || 'bg-emerald-500'}`}>
                                {currentUser?.username?.charAt(0).toUpperCase() || '?'}
                            </div>
                        )}
                    </div>
                    {showProfileMenu && (
                        <div className="absolute top-10 right-0 w-72 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-4 flex flex-col gap-4 z-[150] max-h-[80vh] overflow-y-auto custom-scrollbar">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Profile Picture</label>
                                <label className="bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors border border-neutral-700 text-center">
                                    Upload Image
                                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                                </label>
                            </div>
                            <div className="mt-1">
                                <label className="text-[10px] text-neutral-400 font-bold mb-2 block uppercase tracking-wider">User Bio</label>
                                <textarea 
                                    defaultValue={currentUser?.bio || ''} 
                                    onBlur={(e) => handleProfileUpdate('bio', e.target.value)}
                                    placeholder="Tell collaborators about your style..." 
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 custom-scrollbar resize-none"
                                    rows="3"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider">Contact & Socials</label>
                                <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 focus-within:border-blue-500 transition-colors">
                                    <Mail size={14} className="text-neutral-500 mr-2 shrink-0" />
                                    <input type="email" placeholder="Email Address" defaultValue={currentUser?.email || ''} onBlur={(e) => handleProfileUpdate('email', e.target.value)} className="bg-transparent text-sm text-white w-full outline-none" />
                                </div>
                                <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 focus-within:border-blue-500 transition-colors">
                                    <Globe size={14} className="text-neutral-500 mr-2 shrink-0" />
                                    <input type="url" placeholder="Website" defaultValue={currentUser?.website || ''} onBlur={(e) => handleProfileUpdate('website', e.target.value)} className="bg-transparent text-sm text-white w-full outline-none" />
                                </div>
                                <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 focus-within:border-blue-500 transition-colors">
                                    <Instagram size={14} className="text-neutral-500 mr-2 shrink-0" />
                                    <input type="text" placeholder="Instagram Handle" defaultValue={currentUser?.instagram || ''} onBlur={(e) => handleProfileUpdate('instagram', e.target.value)} className="bg-transparent text-sm text-white w-full outline-none" />
                                </div>
                                <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 focus-within:border-blue-500 transition-colors">
                                    <Twitter size={14} className="text-neutral-500 mr-2 shrink-0" />
                                    <input type="text" placeholder="X/Twitter Handle" defaultValue={currentUser?.twitter || ''} onBlur={(e) => handleProfileUpdate('twitter', e.target.value)} className="bg-transparent text-sm text-white w-full outline-none" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {Object.values(peers).map((peer, idx) => (
                    <div key={idx} onClick={() => setViewProfileUser(peer)} className={`w-8 h-8 ${peer.avatar ? '' : (peer.color || 'bg-blue-600')} rounded-full border-2 border-neutral-900 overflow-hidden flex items-center justify-center text-xs font-bold text-white relative group shadow-sm cursor-pointer hover:ring-2 hover:ring-neutral-700 transition-all`} title={peer.username}>
                        {peer.avatar ? (
                            <img src={peer.avatar} alt={peer.username} className="w-full h-full object-cover" />
                        ) : (
                            peer.username?.charAt(0).toUpperCase()
                        )}
                    </div>
                ))}
            </div>
            <button onClick={() => setShowSettings(true)} className="text-neutral-400 hover:text-white transition-colors" title="Studio Settings"><Settings2 size={18}/></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Toolbar */}
        <div className="w-12 bg-neutral-950 border-r border-neutral-800 flex flex-col items-center py-4 gap-4 z-20 shadow-[4px_0_15px_rgba(0,0,0,0.3)]">
          <button onClick={() => setActiveView('arrangement')} className={`p-2 rounded-lg transition-all ${activeView==='arrangement'?'bg-blue-500/20 text-blue-400':'text-neutral-500 hover:text-white'}`} title="Arrangement View"><Grid size={20}/></button>
          <button onClick={() => setActiveView('mixer')} className={`p-2 rounded-lg transition-all ${activeView==='mixer'?'bg-blue-500/20 text-blue-400':'text-neutral-500 hover:text-white'}`} title="Mixer Console"><Sliders size={20}/></button>
          <button onClick={() => setActiveView('browser')} className={`p-2 rounded-lg transition-all mt-auto ${activeView==='browser'?'bg-blue-500/20 text-blue-400':'text-neutral-500 hover:text-white'}`} title="Plugin Browser"><Folder size={20}/></button>
        </div>

        {/* Main Content Area */}
        {activeView === 'browser' ? (
          <div className="flex-1 flex overflow-hidden bg-neutral-900 z-10">
            <div className="w-72 bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0">
              <div className="p-4 border-b border-neutral-800"><h3 className="text-white font-semibold flex items-center gap-2"><Folder size={18} className="text-blue-400"/> Browser</h3></div>
              <div className="flex-1 overflow-y-auto p-2 pr-3 custom-scrollbar">
                <div className="text-[10px] font-bold text-neutral-500 mb-2 mt-2 uppercase tracking-wider px-2">Engines & Effects</div>
                {INTERNAL_PLUGINS.map(vst => (
                  <div key={vst.id} className="flex items-center gap-3 p-2 hover:bg-neutral-800/50 rounded-lg text-sm text-neutral-300 border border-transparent hover:border-neutral-700 transition-colors cursor-pointer">
                    <div className={`w-8 h-8 rounded bg-neutral-800 flex items-center justify-center shadow-sm ${vst.category === 'instrument' ? 'text-purple-400' : 'text-blue-400'}`}>
                      {vst.category === 'instrument' ? <Piano size={14} /> : <Plug size={14} />}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-white text-xs">{vst.name}</span>
                      <span className="text-[9px] text-neutral-500">{vst.vendor} &bull; {vst.category?.toUpperCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 opacity-30">
                <Plug size={64} className="mb-4" />
                <p className="max-w-xs text-center text-sm font-medium">Browse internal effects and generative synth engines. WebAudio Module (WAM) drag-and-drop loading is running via remote API.</p>
            </div>
          </div>
        ) : activeView === 'mixer' ? (
          <div className="flex-1 bg-neutral-900 flex p-4 gap-2 overflow-x-auto relative custom-scrollbar pb-6">
             {tracks.map(t => (
               <div key={t.id} className="w-32 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col items-center py-4 shrink-0 relative group shadow-lg transition-colors">
                  <button onClick={(e) => handleContextMenu(e, 'track', { trackId: t.id })} className="absolute top-2 right-2 text-neutral-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal size={14}/></button>
                  <div 
                      className={`w-3 h-3 rounded-full mb-2 shadow-sm ${t.color} cursor-pointer hover:scale-110 transition-transform`} 
                      title="Click to cycle color"
                      onClick={(e) => { e.stopPropagation(); const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-cyan-500']; dispatchDawAction({ type: 'UPDATE_TRACK_COLOR', payload: { trackId: t.id, color: colors[(colors.indexOf(t.color) + 1) % colors.length] }}); }}
                  />
                  <span className="text-xs font-bold text-white truncate w-full text-center px-2">{t.name}</span>
                  
                  <div className="w-full px-4 mt-2 flex flex-col items-center" onContextMenu={(e) => handleContextMenu(e, 'midi-learn', { type: 'mixer_pan', trackId: t.id })}>
                     <span className="text-[9px] text-neutral-500 mb-1 font-mono">PAN</span>
                     <input type="range" min="-50" max="50" value={t.pan} onDoubleClick={() => dispatchDawAction({ type: 'UPDATE_TRACK_PAN', payload: { id: t.id, pan: 0 } })} onChange={(e) => dispatchDawAction({ type: 'UPDATE_TRACK_PAN', payload: { id: t.id, pan: Number(e.target.value) } })} onWheel={(e) => { e.stopPropagation(); dispatchDawAction({ type: 'UPDATE_TRACK_PAN', payload: { id: t.id, pan: Math.min(50, Math.max(-50, t.pan + (e.deltaY < 0 ? 5 : -5))) } }); }} className="w-full h-1 bg-neutral-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-neutral-400 cursor-pointer" />
                  </div>

                  <div className="flex gap-1.5 mt-4">
                    <button onClick={() => dispatchDawAction({ type: 'TOGGLE_MUTE', payload: { trackId: t.id } })} className={`w-6 h-6 rounded text-[10px] font-bold transition-colors border ${t.muted ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'bg-neutral-800 text-neutral-500 border-transparent hover:bg-neutral-700'}`}>M</button>
                    <button onClick={() => dispatchDawAction({ type: 'TOGGLE_SOLO', payload: { trackId: t.id } })} className={`w-6 h-6 rounded text-[10px] font-bold transition-colors border ${t.solo ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'bg-neutral-800 text-neutral-500 border-transparent hover:bg-neutral-700'}`}>S</button>
                  </div>

                  <div className="flex-1 w-full flex justify-center py-4 relative mt-2 min-h-[200px]" onContextMenu={(e) => handleContextMenu(e, 'midi-learn', { type: 'mixer_vol', trackId: t.id })}>
                     <div className="flex justify-center gap-2 h-full w-full pointer-events-none">
                         <div className="w-2 bg-black rounded-full h-full relative border border-neutral-800">
                            <div className={`absolute bottom-0 w-full rounded-full opacity-60 ${t.color}`} style={{ height: `${t.volume}%` }} />
                         </div>
                         <VuMeter trackId={t.id} synthsRef={synthsRef} isVertical={true} />
                     </div>
                     <input type="range" orient="vertical" min="0" max="100" value={t.volume} onChange={(e) => dispatchDawAction({ type: 'UPDATE_TRACK_VOL', payload: { id: t.id, volume: Number(e.target.value) } })} onWheel={(e) => { e.stopPropagation(); dispatchDawAction({ type: 'UPDATE_TRACK_VOL', payload: { id: t.id, volume: Math.min(100, Math.max(0, t.volume + (e.deltaY < 0 ? 5 : -5))) } }); }} className="absolute inset-0 opacity-0 cursor-pointer h-full w-full" style={{ WebkitAppearance: 'slider-vertical' }} />
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">{t.volume}</span>
               </div>
             ))}

             {/* Master Fader */}
             <div className="w-32 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col items-center py-4 shrink-0 relative shadow-lg ml-auto">
                  <div className="w-3 h-3 rounded-full mb-2 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  <span className="text-xs font-bold text-white truncate w-full text-center px-2">MASTER</span>
                  <div className="flex-1 w-full flex justify-center py-4 relative mt-2 min-h-[200px]" onContextMenu={(e) => handleContextMenu(e, 'midi-learn', { type: 'master_vol' })}>
                     <div className="flex justify-center gap-2 h-full w-full pointer-events-none">
                         <div className="w-2 bg-black rounded-full h-full relative border border-neutral-800">
                            <div className="absolute bottom-0 w-full rounded-full bg-red-500 opacity-70 shadow-[0_0_10px_rgba(239,68,68,0.4)]" style={{ height: `${masterVolume}%` }} />
                         </div>
                         <VuMeter isMaster={true} masterAnalyserRef={masterAnalyserRef} isVertical={true} />
                     </div>
                     <input type="range" orient="vertical" min="0" max="100" value={masterVolume} onChange={(e) => handleMasterVolumeChange(e.target.value)} onDoubleClick={() => handleMasterVolumeChange(80)} onWheel={(e) => { e.stopPropagation(); handleMasterVolumeChange(Math.min(100, Math.max(0, masterVolume + (e.deltaY < 0 ? 5 : -5)))); }} className="absolute inset-0 opacity-0 cursor-pointer h-full w-full" title="Double-click to reset" style={{ WebkitAppearance: 'slider-vertical' }} />
                  </div>
                  <span className="text-[10px] font-mono text-red-400">{masterVolume}</span>
             </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 flex overflow-hidden">
                {/* Track Headers */}
                <div className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
                    <div className="h-8 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-2 shrink-0">
                        <span className="text-[10px] font-bold text-neutral-500">TRACKS</span>
                        <div className="flex gap-1">
                            {/* Auto Tracks Toggle Button */}
                            <button onClick={() => setIsAutomationMode(!isAutomationMode)} className={`text-[9px] uppercase font-bold flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${isAutomationMode ? 'bg-blue-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'}`} title="Toggle Automation Lanes (Ctrl+Shift+A)"><Activity size={10}/> Auto Tracks</button>
                            <button onClick={() => dispatchDawAction({ type: 'ADD_TRACK', payload: { id: Date.now(), name: 'New MIDI', type: 'midi', instrument: 'inst-subtractive', instrumentParams: {cutoff:2000, res:1}, color: 'bg-pink-500', volume: 80, pan: 0, automation: {}, activeAutomationParam: 'volume', clips: [], effects: [] }})} className="text-[9px] uppercase text-neutral-400 hover:text-white font-bold flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 rounded transition-colors"><Plus size={10}/> MIDI</button>
                            <button onClick={() => dispatchDawAction({ type: 'ADD_TRACK', payload: { id: Date.now(), name: 'New Audio', type: 'audio', color: 'bg-emerald-500', volume: 80, pan: 0, automation: {}, activeAutomationParam: 'volume', clips: [], effects: [] }})} className="text-[9px] uppercase text-neutral-400 hover:text-white font-bold flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 rounded transition-colors"><Plus size={10}/> Audio</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
                        {tracks.map(t => {
                            const isPeered = Object.values(peers).find(p => p.activeTrack === t.id);
                            const autoKeys = isAutomationMode ? Array.from(new Set([...Object.keys(t.automation || {}).filter(k => t.automation[k]?.length > 0), t.activeAutomationParam].filter(Boolean))) : [];
                            return (
                            <div key={t.id} className="flex flex-col w-full">
                            <div onClick={() => dispatchPresence(t.id)} onContextMenu={(e) => handleContextMenu(e, 'track', { trackId: t.id })} className={`h-24 border-b border-neutral-800 p-2 flex flex-col justify-between hover:bg-neutral-800/50 relative transition-colors ${bottomDock?.trackId === t.id && bottomDock?.type === 'devices' ? 'bg-neutral-800/40 border-l-2 border-l-blue-500' : ''}`}>
                                {isPeered && <div className={`absolute left-0 top-0 bottom-0 w-1 shadow-[0_0_8px_rgba(255,255,255,0.3)] ${isPeered.color || 'bg-blue-500'}`} title={`${isPeered.username} is active`} />}
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 pl-1">
                                        <div 
                                          className={`w-3 h-3 rounded-full shadow-sm ${t.color} shrink-0 cursor-pointer hover:scale-110 transition-transform`} 
                                          title="Click to cycle color"
                                          onClick={(e) => { e.stopPropagation(); const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-cyan-500']; dispatchDawAction({ type: 'UPDATE_TRACK_COLOR', payload: { trackId: t.id, color: colors[(colors.indexOf(t.color) + 1) % colors.length] }}); }}
                                        />
                                        {editingTrackId === t.id ? (
                                            <input autoFocus onBlur={() => setEditingTrackId(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingTrackId(null)} value={t.name} onChange={(e) => dispatchDawAction({ type: 'RENAME_TRACK', payload: { id: t.id, name: e.target.value } })} className="bg-neutral-950 text-xs font-bold text-white outline-none border border-neutral-700 rounded px-1 w-24" />
                                        ) : (
                                            <span onDoubleClick={() => setEditingTrackId(t.id)} className="text-xs font-bold text-white truncate w-24 cursor-text">{t.name}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); dispatchDawAction({ type: 'TOGGLE_ARM', payload: { trackId: t.id } }); }} className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${t.armed ? 'text-red-500 bg-red-500/20' : 'text-neutral-500 hover:bg-neutral-700 hover:text-red-400'}`}><Circle size={10} fill={t.armed ? "currentColor" : "none"}/></button>
                                        <button onClick={(e) => { e.stopPropagation(); dispatchDawAction({ type: 'TOGGLE_MUTE', payload: { trackId: t.id } }); }} className={`w-5 h-5 rounded text-[9px] font-bold transition-colors ${t.muted ? 'bg-orange-500/20 text-orange-400' : 'text-neutral-500 hover:bg-neutral-700'}`}>M</button>
                                        <button onClick={(e) => { e.stopPropagation(); dispatchDawAction({ type: 'TOGGLE_SOLO', payload: { trackId: t.id } }); }} className={`w-5 h-5 rounded text-[9px] font-bold transition-colors ${t.solo ? 'bg-yellow-500/20 text-yellow-400' : 'text-neutral-500 hover:bg-neutral-700'}`}>S</button>
                                        <button onClick={(e) => { e.stopPropagation(); setBottomDock(bottomDock?.trackId === t.id && bottomDock?.type === 'devices' ? null : { type: 'devices', trackId: t.id }); }} className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${bottomDock?.trackId === t.id && bottomDock?.type === 'devices' ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-500 hover:bg-neutral-700 hover:text-white'}`}><Plug size={12}/></button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 px-1">
                                    <div className="flex gap-2 items-center">
                                        <Volume2 size={10} className="text-neutral-500 shrink-0"/>
                                        <input type="range" min="0" max="100" value={t.volume} onChange={(e) => dispatchDawAction({ type: 'UPDATE_TRACK_VOL', payload: { id: t.id, volume: Number(e.target.value) } })} onWheel={(e) => { e.stopPropagation(); dispatchDawAction({ type: 'UPDATE_TRACK_VOL', payload: { id: t.id, volume: Math.min(100, Math.max(0, t.volume + (e.deltaY < 0 ? 5 : -5))) } }); }} className="w-full h-1 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white cursor-pointer" />
                                    </div>
                                    <div className="flex gap-2 items-center mb-1 pr-2">
                                        <Activity size={10} className="text-neutral-600 shrink-0"/>
                                        <VuMeter trackId={t.id} synthsRef={synthsRef} isVertical={false} />
                                    </div>
                                </div>
                            </div>
                            {/* Automation Lane Header Labels */}
                            {autoKeys.map(paramKey => (
                                <div key={paramKey} className="h-16 border-b border-neutral-800/50 bg-neutral-900/60 pl-6 pr-2 py-2 flex items-center shadow-inner relative border-l-2 border-l-blue-500/50">
                                     <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider truncate w-full" title={formatAutoName(t, paramKey)}>
                                          <Activity size={10} className="inline mr-1.5 mb-0.5 text-blue-400" />
                                          {formatAutoName(t, paramKey)}
                                     </span>
                                </div>
                            ))}
                            </div>
                        )})}
                    </div>
                </div>
                
                {/* Timeline */}
                <div className="flex-1 bg-neutral-950 flex flex-col overflow-hidden">
                    <div className="h-8 border-b border-neutral-800 bg-neutral-900 relative shrink-0 overflow-hidden cursor-pointer" onMouseDown={handleTimelineMouseDown}>
                       <div className="absolute top-0 bottom-0 pointer-events-none text-[10px] text-neutral-600 font-mono" style={{ width: `${dynamicTotalBeats * BEAT_WIDTH}px`, left: timelineRef.current ? -timelineRef.current.scrollLeft : 0 }}>
                          {Array.from({length: dynamicTotalBeats/4}).map((_, i) => <div key={i} className="absolute border-l border-neutral-700 pl-1 h-full" style={{ left: `${i * 4 * BEAT_WIDTH}px` }}>{i + 1}</div>)}
                          
                          {/* Loop Region Brace */}
                          {loopRegion.enabled && (
                             <div 
                               className="absolute top-0 bottom-0 border-x-[3px] border-t-[3px] z-20 transition-colors rounded-t-sm border-blue-500 bg-blue-500/10 pointer-events-auto"
                               style={{ left: `${loopRegion.start * BEAT_WIDTH}px`, width: `${(loopRegion.end - loopRegion.start) * BEAT_WIDTH}px`, cursor: 'grab' }}
                               onMouseDown={(e) => { e.stopPropagation(); setDraggingLoop({ edge: 'body', startX: e.clientX, initialStart: loopRegion.start, initialEnd: loopRegion.end }); }}
                             >
                               <div className="absolute left-0 top-0 bottom-0 w-3 cursor-w-resize -ml-1.5" onMouseDown={(e) => { e.stopPropagation(); setDraggingLoop({ edge: 'start', startX: e.clientX, initialStart: loopRegion.start, initialEnd: loopRegion.end }); }} />
                               <div className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize -mr-1.5" onMouseDown={(e) => { e.stopPropagation(); setDraggingLoop({ edge: 'end', startX: e.clientX, initialStart: loopRegion.start, initialEnd: loopRegion.end }); }} />
                             </div>
                          )}
                       </div>
                    </div>
                    <div ref={timelineRef} onScroll={(e) => e.currentTarget.previousSibling.firstChild.style.left = `-${e.currentTarget.scrollLeft}px`} className="flex-1 overflow-auto relative custom-scrollbar">
                        <div 
                           className="relative min-h-full" 
                           style={{ width: `${dynamicTotalBeats * BEAT_WIDTH}px` }} 
                           onMouseDown={handleTimelineMouseDown}
                           onDragOver={handleDragOver}
                           onDragLeave={handleDragLeave}
                           onDrop={handleDrop}
                        >
                            {/* Drag-and-Drop Ghost Element */}
                            {dragHover && dragHover.active && (
                                <div 
                                    className={`absolute z-[100] rounded-xl border-2 border-dashed pointer-events-none flex items-center justify-center backdrop-blur-md shadow-2xl transition-all ${
                                        dragHover.fileType === 'midi' ? 'border-pink-400 bg-pink-500/20 text-pink-300' : 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                                    }`}
                                    style={{ left: `${dragHover.beat * BEAT_WIDTH}px`, top: `${dragHover.trackIndex * 96 + 8}px`, width: `${4 * BEAT_WIDTH}px`, height: `80px` }}
                                >
                                    <div className="flex flex-col items-center gap-1 font-bold text-xs uppercase tracking-wider opacity-90">
                                        {dragHover.fileType === 'midi' ? <FileCode size={24} /> : <FileAudio size={24} />}
                                        <span>Drop to Import</span>
                                        {(!tracks[dragHover.trackIndex] || tracks[dragHover.trackIndex].type !== dragHover.fileType) && (
                                            <span className="text-[9px] bg-black/60 px-2 py-0.5 rounded-full mt-1 border border-white/10 text-white shadow-inner">New Track</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            {/* Grid Background */}
                            <div className="absolute inset-0 pointer-events-none" style={getGridStyle(snapGrid, BEAT_WIDTH, false)} />
                            {/* Playhead */}
                            <div className="absolute top-0 bottom-0 w-px bg-blue-500 z-30 shadow-[0_0_10px_rgba(59,130,246,0.8)] pointer-events-none" style={{ left: `${currentTime * BEAT_WIDTH}px` }}><div className="w-3 h-3 bg-blue-500 rotate-45 absolute -top-1.5 -left-1.5"/></div>

                            {/* Tracks Lanes */}
                            {tracks.map(t => {
                                const autoKeys = isAutomationMode ? Array.from(new Set([...Object.keys(t.automation || {}).filter(k => t.automation[k]?.length > 0), t.activeAutomationParam].filter(Boolean))) : [];
                                return (
                                <div key={t.id} className="flex flex-col w-full">
                                <div className={`h-24 border-b border-neutral-800/50 w-full relative transition-all ${t.muted ? 'opacity-40 grayscale' : ''} ${t.armed && isRecording ? 'bg-red-500/5' : ''}`} onDoubleClick={(e) => handleTrackDoubleClick(e, t.id)}>
                                    {t.clips.map(c => (
                                        <div 
                                          key={c.id} 
                                          onMouseDown={(e) => { 
                                              if(!e.target.dataset.edge) { 
                                                  e.stopPropagation(); 
                                                  dispatchPresence(t.id); 
                                                  setSelectedTrackId(t.id);
                                                  if (e.shiftKey) {
                                                      setSelectedClipIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]);
                                                  } else {
                                                      if (!selectedClipIds.includes(c.id)) setSelectedClipIds([c.id]);
                                                  }
                                                  setDraggingClip({ trackId: t.id, initialTrackId: t.id, clipId: c.id, startX: e.clientX, initialStart: c.start }); 
                                              } 
                                          }}
                                          onDoubleClick={(e) => { e.stopPropagation(); setBottomDock({ type: t.type === 'audio' ? 'audio-editor' : 'piano-roll', trackId: t.id, clipId: c.id }); }}
                                          onContextMenu={(e) => {
                                              const rect = timelineRef.current.getBoundingClientRect();
                                              const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
                                              const sg = snapGridRef.current;
                                              const snap = (val) => sg === 0 ? val : Math.round(val / sg) * sg;
                                              const sliceBeat = snap(x / BEAT_WIDTH);
                                              handleContextMenu(e, 'clip', { trackId: t.id, clipId: c.id, sliceBeat });
                                          }}
                                          className={`clip-element absolute top-2 bottom-2 rounded border overflow-hidden cursor-grab active:cursor-grabbing bg-gradient-to-br ${t.color.replace('bg-','from-')}/80 ${t.color.replace('bg-','to-')}/40 shadow-lg transition-all ${selectedClipIds.includes(c.id) ? 'border-white ring-2 ring-white/60 brightness-125 z-40' : 'border-white/20 hover:brightness-110 z-10'}`} 
                                          style={{ left: `${c.start * BEAT_WIDTH}px`, width: `${c.duration * BEAT_WIDTH}px`, zIndex: draggingClip?.clipId === c.id || selectedClipIds.includes(c.id) ? 50 : 10 }}
                                        >
                                            {/* Resize Handles */}
                                            <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 z-10" onMouseDown={(e) => { e.stopPropagation(); setDraggingEdge({ trackId: t.id, clipId: c.id, edge: 'left', startX: e.clientX, initialStart: c.start, initialDuration: c.duration, initialSampleOffset: c.sampleOffset || 0 }); }} data-edge="left" />
                                            <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 z-10" onMouseDown={(e) => { e.stopPropagation(); setDraggingEdge({ trackId: t.id, clipId: c.id, edge: 'right', startX: e.clientX, initialStart: c.start, initialDuration: c.duration, initialSampleOffset: c.sampleOffset || 0 }); }} data-edge="right" />

                                            <div className="px-2 pt-1 text-[9px] font-bold text-white/90 truncate pointer-events-none select-none relative z-10">{t.type === 'midi' ? 'MIDI Clip' : 'Audio Clip'}</div>
                                            {t.type === 'midi' && c.notes && (
                                              <div className="absolute inset-x-0 bottom-0 top-4 opacity-50 pointer-events-none">
                                                {c.notes.map(n => <div key={n.id} className="absolute bg-white rounded-sm h-[2px]" style={{ left: `${(n.start / c.duration) * 100}%`, width: `${(n.duration / c.duration) * 100}%`, top: `${100 - ((n.pitch - 24) / (108 - 24) * 100)}%` }} />)}
                                              </div>
                                            )}
                                            {t.type === 'audio' && c.sampleId && globalAudioBufferCache.has(c.sampleId) && (
                                                <WaveformDisplay 
                                                    buffer={globalAudioBufferCache.get(c.sampleId).buffer} 
                                                    bpm={bpm} 
                                                    beatWidth={BEAT_WIDTH}
                                                    sampleOffset={c.sampleOffset || 0}
                                                />
                                            )}
                                        </div>
                                    ))}
                                    {/* Live Recording Block Preview */}
                                    {t.armed && isRecording && isPlaying && (
                                       <div className="absolute top-2 bottom-2 rounded bg-red-500/50 border border-red-400 pointer-events-none" style={{ left: `${recordingStartTimeRef.current * BEAT_WIDTH}px`, width: `${Math.max(1, (currentTime - recordingStartTimeRef.current) * BEAT_WIDTH)}px` }}>
                                           <div className="px-2 pt-1 text-[9px] font-bold text-white">RECORDING...</div>
                                       </div>
                                    )}
                                </div>
                                {/* Automation Lane Timeline Backgrounds */}
                                {autoKeys.map(paramKey => (
                                    <div key={paramKey} className="h-16 border-b border-neutral-800/50 bg-neutral-900/30 relative pointer-events-auto cursor-crosshair overflow-hidden" onMouseDown={(e) => {
                                        e.stopPropagation();
                                        if (e.button === 2) return;
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
                                        const y = e.clientY - rect.top;
                                        const sg = snapGridRef.current;
                                        const snapVal = (val) => sg === 0 ? val : Math.round(val / sg) * sg;
                                        const time = Math.max(0, snapVal(x / BEAT_WIDTH));
                                        const minMax = getAutomationConstraints(paramKey);
                                        const value = minMax.min + ((64 - y) / 64) * (minMax.max - minMax.min);
                                        dispatchDawAction({ type: 'ADD_AUTOMATION_POINT', payload: { trackId: t.id, paramKey, point: { id: `pt_${Date.now()}`, time, value } }});
                                    }}>
                                        <svg width="100%" height="100%" className="pointer-events-none absolute inset-0">
                                            {(() => {
                                                const pts = [...(t.automation?.[paramKey] || [])].sort((a,b) => a.time - b.time);
                                                if (pts.length === 0) return null;
                                                let d = "";
                                                const minMax = getAutomationConstraints(paramKey);
                                                const getY = (val) => 64 - ((val - minMax.min) / (minMax.max - minMax.min)) * 64;
                                                pts.forEach((p, i) => {
                                                    const x = p.time * BEAT_WIDTH;
                                                    const y = getY(p.value);
                                                    d += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
                                                });
                                                return <path d={d} stroke="#3b82f6" strokeWidth="2" fill="none" opacity="0.8" />
                                            })()}
                                        </svg>
                                        {(t.automation?.[paramKey] || []).map(p => {
                                            const minMax = getAutomationConstraints(paramKey);
                                            const y = 64 - ((p.value - minMax.min) / (minMax.max - minMax.min)) * 64;
                                            return (
                                                <div 
                                                    key={p.id}
                                                    className="absolute w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-full -ml-[5px] -mt-[5px] cursor-pointer pointer-events-auto shadow-md hover:scale-150 transition-transform"
                                                    style={{ left: `${p.time * BEAT_WIDTH}px`, top: `${y}px` }}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        if (e.button === 2) {
                                                            dispatchDawAction({ type: 'DELETE_AUTOMATION_POINT', payload: { trackId: t.id, paramKey, pointId: p.id } });
                                                        } else {
                                                            setDraggingAutoPoint({ trackId: t.id, paramKey, pointId: p.id, startX: e.clientX, startY: e.clientY, initialTime: p.time, initialValue: p.value, laneHeight: 64 });
                                                        }
                                                    }}
                                                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                                </div>
                            )})}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Bottom Dock (Piano Roll) */}
            {bottomDock?.type === 'piano-roll' && (() => {
                const activeTrack = tracks.find(t => t.id === bottomDock.trackId);
                const activeClip = activeTrack?.clips.find(c => c.id === bottomDock.clipId);
                const activeClipDuration = activeClip?.duration || 16;
                const rollWidthPx = activeClipDuration * BEAT_WIDTH;
                
                return (
                <div style={{ height: dockHeight }} className="bg-neutral-950 border-t border-neutral-800 flex flex-col shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.3)] z-30 relative">
                    <div className="absolute top-0 left-0 right-0 h-1.5 -translate-y-1/2 cursor-ns-resize hover:bg-blue-500 z-50 transition-colors" onMouseDown={() => setDraggingDockHeight(true)} />
                    <div className="h-8 bg-neutral-900 flex justify-between items-center px-4 border-b border-neutral-800 shrink-0">
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-2">
                               <Piano size={14} className="text-purple-400" />
                               <span className="text-xs font-bold text-neutral-300">Piano Roll Editor</span>
                           </div>
                           <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-4">
                               <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Snap:</span>
                               <select value={snapGrid} onChange={e => setSnapGrid(Number(e.target.value))} className="bg-transparent w-20 text-blue-400 font-bold focus:outline-none text-xs cursor-pointer">
                                    <option value={4} className="bg-neutral-900 text-neutral-300">1 Bar</option>
                                    <option value={1} className="bg-neutral-900 text-neutral-300">1/4 Beat</option>
                                    <option value={0.5} className="bg-neutral-900 text-neutral-300">1/8 Beat</option>
                                    <option value={0.25} className="bg-neutral-900 text-neutral-300">1/16 Beat</option>
                                    <option value={0.125} className="bg-neutral-900 text-neutral-300">1/32 Beat</option>
                                    <option value={0} className="bg-neutral-900 text-neutral-300">Off</option>
                                </select>
                           </div>
                        </div>
                        <button onClick={() => setBottomDock(null)} className="text-neutral-500 hover:text-white transition-colors"><X size={14}/></button>
                    </div>
                    <div ref={pianoRollContainerRef} className="flex-1 flex overflow-auto relative custom-scrollbar pb-2">
                        <div className="w-12 bg-neutral-900 border-r border-neutral-800 sticky left-0 z-20 shrink-0">
                            {Array.from({length: 84}).map((_, i) => {
                                const pitch = 108 - i;
                                const isBlack = [1,3,6,8,10].includes(pitch % 12);
                                return <div key={pitch} className={`h-4 border-b border-neutral-800 text-[8px] flex items-center justify-end pr-1 ${isBlack ? 'bg-neutral-900 text-neutral-600' : 'bg-neutral-200 text-black font-bold'}`}>{pitch % 12 === 0 ? `C${Math.floor(pitch/12)-1}` : ''}</div>
                            })}
                        </div>
                        <div className="bg-neutral-900 relative shrink-0 shadow-[4px_0_15px_rgba(0,0,0,0.5)]" style={{ width: `${rollWidthPx}px`, height: `${84 * 16}px` }} onDoubleClick={(e) => handlePianoGridDoubleClick(e, bottomDock.trackId, bottomDock.clipId)}>
                            <div className="absolute inset-0 pointer-events-none" style={getGridStyle(snapGrid, BEAT_WIDTH, true)} />
                            
                            {activeClip?.notes?.map(n => (
                                <div 
                                  key={n.id} 
                                  onMouseEnter={() => { hoveredNoteRef.current = n.id; }}
                                  onMouseLeave={() => { if(hoveredNoteRef.current === n.id) hoveredNoteRef.current = null; }}
                                  onMouseDown={(e) => { e.stopPropagation(); setDraggingNote({ trackId: bottomDock.trackId, clipId: bottomDock.clipId, noteId: n.id, startX: e.clientX, startY: e.clientY, initialStart: n.start, initialPitch: n.pitch }); previewNote(bottomDock.trackId, n.pitch, n.velocity); }}
                                  onContextMenu={(e) => {
                                      e.preventDefault(); e.stopPropagation();
                                      dispatchDawAction({ type: 'UPDATE_NOTES', payload: { trackId: activeTrack.id, clipId: activeClip.id, notes: activeClip.notes.filter(note => note.id !== n.id) } });
                                  }}
                                  onWheel={(e) => {
                                      e.stopPropagation();
                                      const delta = e.deltaY > 0 ? -5 : 5;
                                      const newVel = Math.max(1, Math.min(127, (n.velocity || 100) + delta));
                                      previewNote(bottomDock.trackId, n.pitch, newVel);
                                      const newNotes = activeClip.notes.map(note => note.id === n.id ? { ...note, velocity: newVel } : note);
                                      dispatchDawAction({ type: 'UPDATE_NOTES', payload: { trackId: activeTrack.id, clipId: activeClip.id, notes: newNotes } });
                                  }}
                                  className="absolute bg-blue-500 border border-white/50 rounded-sm cursor-pointer hover:brightness-125 shadow-sm group flex flex-col justify-end overflow-hidden" 
                                  style={{ left: `${n.start * BEAT_WIDTH}px`, width: `${n.duration * BEAT_WIDTH}px`, top: `${(108 - n.pitch) * 16}px`, height: '16px', opacity: Math.max(0.4, (n.velocity || 100) / 127) }} 
                                >
                                    <div className="bg-white/40 w-full pointer-events-none" style={{ height: `${((n.velocity || 100) / 127) * 100}%` }} />
                                    {/* Note Edge Resize Handles */}
                                    <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50" onMouseDown={(e) => { e.stopPropagation(); setDraggingNoteEdge({ trackId: bottomDock.trackId, clipId: bottomDock.clipId, noteId: n.id, edge: 'left', startX: e.clientX, initialStart: n.start, initialDuration: n.duration }); }} />
                                    <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/50" onMouseDown={(e) => { e.stopPropagation(); setDraggingNoteEdge({ trackId: bottomDock.trackId, clipId: bottomDock.clipId, noteId: n.id, edge: 'right', startX: e.clientX, initialStart: n.start, initialDuration: n.duration }); }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                );
            })()}
            
            {/* Device Rack (Effects Dock) */}
            {bottomDock?.type === 'devices' && (() => {
                const track = tracks.find(t => t.id === bottomDock.trackId);
                if (!track) return null;
                return (
                <div style={{ height: dockHeight }} className="bg-neutral-900 border-t border-neutral-800 flex flex-col shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.3)] z-30 relative">
                    <div className="absolute top-0 left-0 right-0 h-1.5 -translate-y-1/2 cursor-ns-resize hover:bg-blue-500 z-50 transition-colors" onMouseDown={() => setDraggingDockHeight(true)} />
                    <div className="h-8 bg-neutral-950 flex justify-between items-center px-4 border-b border-neutral-800 shrink-0">
                        <div className="flex items-center gap-2">
                           <Plug size={14} className="text-blue-400" />
                           <span className="text-xs font-bold text-neutral-300">{track.name} - Device Rack</span>
                        </div>
                        <button onClick={() => setBottomDock(null)} className="text-neutral-500 hover:text-white transition-colors"><X size={14}/></button>
                    </div>
                    <div className="flex-1 flex overflow-x-auto p-4 gap-4 items-center bg-neutral-900/50 custom-scrollbar pb-6">
                        
                        {/* Audio Track specific Input block */}
                        {track.type === 'audio' && (
                            <div className="min-w-[14rem] h-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col shrink-0 relative shadow-lg">
                                <div className="flex items-center gap-2 mb-4 border-b border-neutral-800 pb-2">
                                    <Mic size={14} className="text-emerald-400" />
                                    <span className="text-[11px] font-bold text-white uppercase tracking-wider">Audio Input</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <select 
                                        value={track.audioInputId || ''} 
                                        onChange={(e) => dispatchDawAction({ type: 'UPDATE_TRACK_INPUT', payload: { trackId: track.id, audioInputId: e.target.value } })}
                                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-xs text-white outline-none focus:border-emerald-500 cursor-pointer"
                                    >
                                        <option value="">Default Input (System)</option>
                                        {audioInputsList.map(a => (
                                            <option key={a.deviceId} value={a.deviceId}>{a.label || 'Unknown Audio Input'}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Instrument Selector & Controls for MIDI Tracks */}
                        {track.type === 'midi' && (
                            <div className="min-w-[16rem] max-w-md w-max h-full bg-neutral-950 border border-neutral-800 rounded-xl p-5 flex flex-col shrink-0 relative shadow-lg">
                                <div className="flex items-center gap-2 mb-4 border-b border-neutral-800 pb-3 shrink-0">
                                    <Piano size={14} className="text-purple-400" />
                                    <span className="text-xs font-bold text-white uppercase tracking-wider">Instrument</span>
                                </div>
                                <div className="flex flex-col gap-2 shrink-0 mb-4">
                                    <select 
                                        value={track.instrument || ''} 
                                        onChange={(e) => {
                                            const newInstId = e.target.value;
                                            let newParams = {};
                                            if (newInstId === 'inst-subtractive') newParams = { cutoff: 2000, res: 1.5, attack: 0.01, release: 0.2 };
                                            else if (newInstId === 'inst-fm') newParams = { ratio: 2, modIndex: 5, attack: 0.01, release: 0.2 };
                                            else if (newInstId === 'inst-supersaw') newParams = { detune: 25, attack: 0.05, release: 0.5 };
                                            else if (newInstId === 'inst-pluck') newParams = { damping: 4000, decay: 0.95 };
                                            else if (newInstId === 'inst-acid') newParams = { oscType: 'square', cutoff: 150, envMod: 2500, decay: 0.3, res: 5 };
                                            else if (newInstId === 'inst-organ') newParams = { sub: 0.8, fund: 1.0, fifth: 0.5, oct: 0.5 };
                                            dispatchDawAction({ type: 'CHANGE_INSTRUMENT', payload: { trackId: track.id, instrumentId: newInstId, instrumentParams: newParams } });
                                        }}
                                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-xs text-white outline-none focus:border-purple-500 cursor-pointer"
                                    >
                                        {INTERNAL_PLUGINS.filter(p => p.category === 'instrument').map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {track.instrumentParams && Object.keys(track.instrumentParams).length > 0 && (
                                    <div className="flex-1 flex flex-wrap gap-x-6 gap-y-4 overflow-y-auto custom-scrollbar pr-2 content-start border-t border-neutral-800/50 pt-4">
                                        {Object.keys(track.instrumentParams).map(param => {
                                            if (param === 'oscType') {
                                                return (
                                                    <div key={param} className="flex flex-col items-center gap-1 w-16 shrink-0 mt-1">
                                                        <span className="text-[10px] text-neutral-300 font-bold uppercase tracking-wider text-center w-full truncate" title="Oscillator Type">OSC TYPE</span>
                                                        <select value={track.instrumentParams[param]} onChange={e => handleInstrumentParamChange(track.id, param, e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 text-[10px] font-bold text-blue-400 p-1.5 rounded outline-none cursor-pointer mt-1 text-center appearance-none">
                                                            <option value="sawtooth">Saw</option>
                                                            <option value="square">Square</option>
                                                            <option value="sine">Sine</option>
                                                            <option value="triangle">Tri</option>
                                                        </select>
                                                    </div>
                                                );
                                            }
                                            const constraints = getParamConstraints(param);
                                            return (
                                                <Knob 
                                                    key={param} 
                                                    param={param} 
                                                    value={track.instrumentParams[param]} 
                                                    min={constraints.min} 
                                                    max={constraints.max} 
                                                    step={constraints.step} 
                                                    isLog={constraints.isLog}
                                                    onChange={(p, v) => handleInstrumentParamChange(track.id, p, v)} 
                                                    onContextMenu={(e) => handleContextMenu(e, 'midi-learn', { type: 'inst_param', trackId: track.id, param: param })}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {track.effects.map((fx, index) => (
                            <div 
                                key={fx.id} 
                                draggable
                                onDragStart={(e) => { 
                                    e.dataTransfer.effectAllowed = 'move'; 
                                    e.dataTransfer.setData('text/plain', index.toString());
                                    // Using the safely initialized dragValuesRef to prevent ReferenceErrors
                                    dragValuesRef.current.draggedFxIndex = index;
                                    setDraggedFxIndex(index); 
                                }}
                                onDragEnter={(e) => { e.preventDefault(); setDragOverFxIndex(index); }}
                                onDragOver={(e) => { 
                                    e.preventDefault(); 
                                    e.stopPropagation(); 
                                    // Continuously assert over-index to defeat dragLeave bubbling issues
                                    if (dragOverFxIndex !== index) setDragOverFxIndex(index); 
                                }}
                                onDragLeave={(e) => { e.preventDefault(); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    const srcIdx = dragValuesRef.current.draggedFxIndex;
                                    if (srcIdx !== undefined && srcIdx !== null && srcIdx !== index) {
                                        reorderEffects(track.id, srcIdx, index);
                                    }
                                    
                                    dragValuesRef.current.draggedFxIndex = null;
                                    setDraggedFxIndex(null);
                                    setDragOverFxIndex(null);
                                }}
                                onDragEnd={() => { 
                                    dragValuesRef.current.draggedFxIndex = null;
                                    setDraggedFxIndex(null); 
                                    setDragOverFxIndex(null); 
                                }}
                                onContextMenu={(e) => handleContextMenu(e, 'effect', { trackId: track.id, fxId: fx.id })} 
                                // Added [&_*]:pointer-events-none to prevent child knobs from stealing drag events!
                                className={`min-w-[16rem] max-w-lg w-max h-full bg-neutral-950 border rounded-xl p-5 flex flex-col shrink-0 relative group shadow-lg transition-all duration-200 cursor-grab active:cursor-grabbing ${draggedFxIndex === index ? 'opacity-40 scale-95 border-neutral-700' : dragOverFxIndex === index && draggedFxIndex !== null ? 'border-blue-500 scale-[1.02] bg-neutral-900 z-10' : 'border-neutral-800'} ${draggedFxIndex !== null ? '[&_*]:pointer-events-none' : ''}`}
                            >
                                <div className="flex justify-between items-center mb-2 border-b border-neutral-800 pb-3 shrink-0">
                                   <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]" />
                                      <span className="text-xs font-bold text-white whitespace-nowrap uppercase tracking-wider">{fx.name}</span>
                                   </div>
                                   <button onClick={() => deleteEffect(track.id, fx.id)} className="text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-4"><X size={14}/></button>
                                </div>
                                {fx.type === 'parametric-eq' && <ParametricEqVisualizer trackId={track.id} fxId={fx.id} params={fx.params} onParamChange={(p, v) => handleEffectParamChange(track.id, fx.id, p, v)} synthsRef={synthsRef} audioCtxRef={audioCtxRef} />}
                                <div className="flex-1 flex flex-wrap gap-x-6 gap-y-4 overflow-y-auto custom-scrollbar pt-2 pr-2 content-start">
                                   {Object.keys(fx.params || {}).map(param => {
                                     const constraints = getParamConstraints(param);
                                     return (
                                        <Knob 
                                            key={param} 
                                            param={param} 
                                            value={fx.params[param]} 
                                            min={constraints.min} 
                                            max={constraints.max} 
                                            step={constraints.step} 
                                            isLog={constraints.isLog}
                                            onChange={(p, v) => handleEffectParamChange(track.id, fx.id, p, v)} 
                                            onContextMenu={(e) => handleContextMenu(e, 'midi-learn', { type: 'fx_param', trackId: track.id, fxId: fx.id, param: param })}
                                        />
                                     );
                                   })}
                                </div>
                            </div>
                        ))}
                        
                        {/* Add Effect Button Container */}
                        <div className="w-48 min-w-[12rem] h-full border-2 border-dashed border-neutral-800 hover:border-neutral-700 rounded-xl flex flex-col items-center justify-center shrink-0 relative group transition-colors cursor-pointer">
                            <Plus size={24} className="text-neutral-600 group-hover:text-blue-400 mb-2 transition-colors" />
                            <span className="text-[10px] text-neutral-500 group-hover:text-blue-400 font-bold uppercase tracking-wider">Add Effect</span>
                            <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-md rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1.5 pointer-events-none group-hover:pointer-events-auto p-2 overflow-y-auto custom-scrollbar pr-3">
                               <div className="text-[9px] font-bold text-neutral-500 mb-1 uppercase tracking-wider px-1 mt-1">Engines</div>
                               {INTERNAL_PLUGINS.filter(p => p.category === 'effect').map(p => (
                                  <button key={p.id} onClick={() => addEffect(track.id, p)} className="w-full text-[10px] font-bold text-neutral-300 hover:text-white bg-neutral-900 hover:bg-blue-600 px-2 py-1.5 rounded transition-colors text-left truncate">{p.name}</button>
                               ))}
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}
            
            {/* Global Context Menus */}
            {contextMenu && (
              <div className="fixed z-[100] bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in duration-100" style={{ left: contextMenu.x, top: contextMenu.y }}>
                {contextMenu.type === 'track' && (
                  <>
                    <button onClick={() => { setEditingTrackId(contextMenu.payload.trackId); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white flex items-center gap-2"><Pencil size={14}/> Rename Track</button>
                    <button onClick={() => { setBottomDock({ type: 'devices', trackId: contextMenu.payload.trackId }); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white flex items-center gap-2"><Plug size={14}/> Device Rack</button>
                    <div className="h-px bg-neutral-800 my-1"/>
                    <button onClick={() => { dispatchDawAction({ type: 'DELETE_TRACK', payload: { id: contextMenu.payload.trackId }}); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-neutral-800 hover:text-red-300 flex items-center gap-2"><Trash2 size={14}/> Delete Track</button>
                  </>
                )}
                {contextMenu.type === 'clip' && (
                  <>
                    <button onClick={() => {
                        const { trackId, clipId, sliceBeat } = contextMenu.payload;
                        const track = tracks.find(t => t.id === trackId);
                        const clipToSplit = track?.clips.find(c => c.id === clipId);
                        if (clipToSplit && sliceBeat > clipToSplit.start && sliceBeat < clipToSplit.start + clipToSplit.duration) {
                             dispatchDawAction({ type: 'SPLIT_CLIP', payload: { trackId, clipId, sliceBeat } });
                        } else {
                             showToast("Cannot slice at the very edge of the clip.", "error");
                        }
                        setContextMenu(null);
                    }} className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white flex items-center gap-2">
                        <Scissors size={14}/> Slice Here
                    </button>
                    <div className="h-px bg-neutral-800 my-1"/>
                    <button onClick={() => { 
                        const track = tracks.find(t => t.id === contextMenu.payload.trackId);
                        const clipToDuplicate = track?.clips.find(c => c.id === contextMenu.payload.clipId);
                        if (clipToDuplicate) {
                           const newClip = { ...clipToDuplicate, id: Date.now(), start: clipToDuplicate.start + clipToDuplicate.duration };
                           dispatchDawAction({ type: 'ADD_CLIP', payload: { trackId: track.id, clip: newClip } });
                        }
                        setContextMenu(null); 
                    }} className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white flex items-center gap-2"><Copy size={14}/> Duplicate Clip</button>
                    <div className="h-px bg-neutral-800 my-1"/>
                    <button onClick={() => { dispatchDawAction({ type: 'DELETE_CLIP', payload: { trackId: contextMenu.payload.trackId, clipId: contextMenu.payload.clipId }}); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-neutral-800 hover:text-red-300 flex items-center gap-2"><Trash2 size={14}/> Delete Clip</button>
                  </>
                )}
                {contextMenu.type === 'effect' && (
                  <>
                    <button onClick={() => { deleteEffect(contextMenu.payload.trackId, contextMenu.payload.fxId); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-neutral-800 hover:text-red-300 flex items-center gap-2"><Trash2 size={14}/> Remove Effect</button>
                  </>
                )}
                {contextMenu.type === 'midi-learn' && (
                  <>
                    <div className="px-4 py-2 text-[10px] text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-800">Control & Automation</div>
                    {(() => {
                        const autoKey = 
                          contextMenu.payload.type === 'mixer_vol' ? 'volume' :
                          contextMenu.payload.type === 'mixer_pan' ? 'pan' :
                          contextMenu.payload.type === 'fx_param' ? `fx_param_${contextMenu.payload.fxId}_${contextMenu.payload.param}` :
                          contextMenu.payload.type === 'inst_param' ? `inst_param_${contextMenu.payload.param}` : null;
                        
                        if (autoKey) {
                            return (
                                <button onClick={() => { 
                                    dispatchDawAction({ type: 'SET_AUTOMATION_PARAM', payload: { trackId: contextMenu.payload.trackId, paramKey: autoKey }});
                                    setIsAutomationMode(true);
                                    setContextMenu(null);
                                    showToast(`Automation active for ${autoKey.replace(/_/g, ' ')}`, 'success');
                                }} className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-blue-400 flex items-center gap-2">
                                    <Activity size={14}/> Automate Parameter
                                </button>
                            );
                        }
                        return null;
                    })()}
                    <button onClick={() => { setMidiLearnTarget(contextMenu.payload); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-blue-400 flex items-center gap-2">
                        <Radio size={14} /> Assign to MIDI Controller
                    </button>
                    {(() => {
                        const activeMappings = [];
                        Object.entries(midiMappings).forEach(([ccKey, maps]) => {
                            const arr = Array.isArray(maps) ? maps : [maps];
                            arr.forEach(m => {
                                if (m.type === contextMenu.payload.type && m.trackId === contextMenu.payload.trackId && m.param === contextMenu.payload.param && m.fxId === contextMenu.payload.fxId) {
                                    activeMappings.push({ ccKey, id: m.id || 'legacy' });
                                }
                            });
                        });
                        if (activeMappings.length > 0) {
                            return (
                                <>
                                    <div className="h-px bg-neutral-800 my-1"/>
                                    {activeMappings.map(m => (
                                         <button key={`${m.ccKey}_${m.id}`} onClick={() => {
                                             setMidiMappings(prev => {
                                                 const arr = Array.isArray(prev[m.ccKey]) ? prev[m.ccKey] : [prev[m.ccKey]];
                                                 const nextMaps = arr.filter(x => (x.id || 'legacy') !== m.id);
                                                 if (nextMaps.length === 0) {
                                                     const nextPrev = {...prev}; delete nextPrev[m.ccKey]; return nextPrev;
                                                 }
                                                 return {...prev, [m.ccKey]: nextMaps};
                                             });
                                             setContextMenu(null);
                                             showToast(`Mapping removed from ${m.ccKey}`, "info");
                                         }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-neutral-800 hover:text-red-300 flex items-center gap-2">
                                             <X size={14}/> Unmap Controller ({m.ccKey.split('-').pop()})
                                         </button>
                                    ))}
                                </>
                            );
                        }
                    })()}
                  </>
                )}
              </div>
            )}
            
            {/* Global Toasts (Overlaying main content) */}
            <div className="absolute bottom-4 right-4 z-[110] flex flex-col gap-2 pointer-events-none">
               {toasts.map(toast => (
                 <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={16} /> : toast.type === 'error' ? <AlertTriangle size={16} /> : <Info size={16} />}
                    <span className="text-sm font-medium">{toast.message}</span>
                 </div>
               ))}
            </div>

            {/* Cropper Modal */}
            {cropImageSrc && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Users size={18}/> Adjust Profile Picture
                            </h2>
                            <button onClick={() => setCropImageSrc(null)} className="text-neutral-500 hover:text-white transition-colors"><X size={18}/></button>
                        </div>
                        <ImageCropper 
                            src={cropImageSrc} 
                            onComplete={handleCropComplete} 
                            onCancel={() => setCropImageSrc(null)} 
                        />
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Settings size={18}/> Studio Settings
                            </h2>
                            <button onClick={() => setShowSettings(false)} className="text-neutral-500 hover:text-white transition-colors"><X size={18}/></button>
                        </div>
                        
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-[10px] text-neutral-400 font-bold mb-1 flex items-center gap-1.5 uppercase tracking-wider"><Piano size={12}/> Keyboard Controller</label>
                                <select value={midiConfig.keyboard} onChange={e => setMidiConfig(p => ({...p, keyboard: e.target.value}))} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                                        <option value="">All Web MIDI Inputs (Default)</option>
                                        {midiInputsList.map(m => <option key={m.id} value={m.id}>{m.name || 'Unknown Device'}</option>)}
                                    </select>
                                    <p className="text-[9px] text-neutral-500 mt-1">Routes specifically to Synths and Instruments.</p>
                                </div>
                                
                                <div>
                                    <label className="text-[10px] text-neutral-400 font-bold mb-1 flex items-center gap-1.5 uppercase tracking-wider"><Radio size={12}/> Pad Controller</label>
                                    <select value={midiConfig.pad} onChange={e => setMidiConfig(p => ({...p, pad: e.target.value}))} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                                        <option value="">All Web MIDI Inputs (Default)</option>
                                        {midiInputsList.map(m => <option key={m.id} value={m.id}>{m.name || 'Unknown Device'}</option>)}
                                    </select>
                                    <p className="text-[9px] text-neutral-500 mt-1">Routes to Drum Machines and Samplers exclusively.</p>
                                </div>
                                
                                <div>
                                    <label className="text-[10px] text-neutral-400 font-bold mb-1 flex items-center gap-1.5 uppercase tracking-wider"><Sliders size={12}/> Mixer Controller</label>
                                    <select value={midiConfig.mixer} onChange={e => setMidiConfig(p => ({...p, mixer: e.target.value}))} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                                        <option value="">None Selected</option>
                                        {midiInputsList.map(m => <option key={m.id} value={m.id}>{m.name || 'Unknown Device'}</option>)}
                                    </select>
                                    <p className="text-[9px] text-neutral-500 mt-1">Auto-assigns faders using CC7 (Volume) and CC10 (Pan) across MIDI channels.</p>
                                </div>

                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mt-2">
                                    <h3 className="text-xs font-bold text-blue-400 mb-1 flex items-center gap-1.5"><Network size={12}/> Network Status</h3>
                                    <p className="text-[10px] text-neutral-300 font-mono">WebRTC State: {Object.keys(peers).length} Peer(s) connected.</p>
                                    <p className="text-[10px] text-neutral-300 font-mono">Signaling API: {socketRef.current?.connected ? 'Connected' : 'Disconnected'}</p>
                                </div>

                                <div className="mt-4 border-t border-neutral-800 pt-4 pb-2">
                                    <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5"><Sliders size={12}/> Custom MIDI Mappings</h3>
                                    {Object.keys(midiMappings).length === 0 ? (
                                        <p className="text-[10px] text-neutral-500 italic bg-neutral-950 p-3 rounded-lg border border-neutral-800">No custom mappings yet. Right click a knob to assign your controller.</p>
                                    ) : (
                                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                            {Object.entries(midiMappings).flatMap(([ccKey, maps]) => {
                                                const arr = Array.isArray(maps) ? maps : [maps];
                                                return arr.map((m, idx) => (
                                                <div key={m.id || `${ccKey}_${idx}`} className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col gap-2 shadow-inner">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] font-bold text-blue-400 flex items-center gap-1"><Radio size={10} className="text-neutral-500"/> CC {ccKey.split('-')[1]} &rarr; {m.param || m.type.replace('_',' ')}</span>
                                                        <button onClick={() => setMidiMappings(prev => {
                                                            const pArr = Array.isArray(prev[ccKey]) ? prev[ccKey] : [prev[ccKey]];
                                                            const nextMaps = pArr.filter(x => (x.id || 'legacy') !== (m.id || 'legacy'));
                                                            if (nextMaps.length === 0) {
                                                                const nextPrev = {...prev}; delete nextPrev[ccKey]; return nextPrev;
                                                            }
                                                            return {...prev, [ccKey]: nextMaps};
                                                        })} className="text-neutral-500 hover:text-red-400 transition-colors" title="Remove Mapping"><Trash2 size={12}/></button>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[9px] text-neutral-400 mt-1 gap-2 bg-neutral-900 p-2 rounded border border-neutral-800/50">
                                                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                                                            <input type="checkbox" checked={m.reverse || false} onChange={e => {
                                                                const val = e.target.checked;
                                                                setMidiMappings(prev => ({
                                                                    ...prev, [ccKey]: (Array.isArray(prev[ccKey]) ? prev[ccKey] : [prev[ccKey]]).map(x => (x.id||'legacy') === (m.id||'legacy') ? {...x, reverse: val} : x)
                                                                }));
                                                            }} className="accent-blue-500 cursor-pointer" /> Reverse Input
                                                        </label>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center gap-1.5" title="Start Limit">
                                                                <span>Min:</span>
                                                                <input type="range" min="0" max="100" value={Math.round((m.rangeMin !== undefined ? m.rangeMin : 0)*100)} onChange={e => {
                                                                    const val = Number(e.target.value)/100;
                                                                    setMidiMappings(prev => ({
                                                                        ...prev, [ccKey]: (Array.isArray(prev[ccKey]) ? prev[ccKey] : [prev[ccKey]]).map(x => (x.id||'legacy') === (m.id||'legacy') ? {...x, rangeMin: val} : x)
                                                                    }));
                                                                }} className="w-12 h-1 bg-neutral-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
                                                            </div>
                                                            <div className="flex items-center gap-1.5" title="End Limit">
                                                                <span>Max:</span>
                                                                <input type="range" min="0" max="100" value={Math.round((m.rangeMax !== undefined ? m.rangeMax : 1)*100)} onChange={e => {
                                                                    const val = Number(e.target.value)/100;
                                                                    setMidiMappings(prev => ({
                                                                        ...prev, [ccKey]: (Array.isArray(prev[ccKey]) ? prev[ccKey] : [prev[ccKey]]).map(x => (x.id||'legacy') === (m.id||'legacy') ? {...x, rangeMax: val} : x)
                                                                    }));
                                                                }} className="w-12 h-1 bg-neutral-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))})}
                                        </div>
                                    )}
                                </div>
                            </div>
                    </div>
                </div>
            )}

            {/* User Profile Modal */}
            {viewProfileUser && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-16 h-16 rounded-full border-4 border-neutral-800 overflow-hidden flex items-center justify-center text-2xl font-bold text-white shadow-lg shrink-0 ${viewProfileUser.color || 'bg-blue-600'}`}>
                                    {viewProfileUser.avatar ? (
                                        <img src={viewProfileUser.avatar} alt={viewProfileUser.username} className="w-full h-full object-cover" />
                                    ) : (
                                        viewProfileUser.username?.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white break-all">{viewProfileUser.username}</h2>
                                    <span className="text-xs text-green-400 flex items-center gap-1.5 mt-1 font-medium">
                                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></div> Online
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setViewProfileUser(null)} className="text-neutral-500 hover:text-white transition-colors mt-1 shrink-0"><X size={18}/></button>
                        </div>
                        
                        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 mt-6 shadow-inner">
                            <h3 className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-2">User Bio</h3>
                            <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
                                {viewProfileUser.bio ? viewProfileUser.bio : <span className="text-neutral-600 italic">No bio provided.</span>}
                            </p>
                            
                            {(viewProfileUser.email || viewProfileUser.website || viewProfileUser.instagram || viewProfileUser.twitter) && (
                                <>
                                    <div className="h-px bg-neutral-800 my-4" />
                                    <h3 className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-3">Contact & Links</h3>
                                    <div className="flex flex-col gap-2.5">
                                        {viewProfileUser.email && (
                                            <a href={`mailto:${viewProfileUser.email}`} className="flex items-center gap-2.5 text-sm text-neutral-400 hover:text-blue-400 transition-colors w-fit">
                                                <Mail size={14} /> {viewProfileUser.email}
                                            </a>
                                        )}
                                        {viewProfileUser.website && (
                                            <a href={viewProfileUser.website.startsWith('http') ? viewProfileUser.website : `https://${viewProfileUser.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-sm text-neutral-400 hover:text-blue-400 transition-colors w-fit">
                                                <Globe size={14} /> {viewProfileUser.website.replace(/^https?:\/\//, '')}
                                            </a>
                                        )}
                                        {viewProfileUser.instagram && (
                                            <a href={`https://instagram.com/${viewProfileUser.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-sm text-neutral-400 hover:text-pink-400 transition-colors w-fit">
                                                <Instagram size={14} /> {viewProfileUser.instagram}
                                            </a>
                                        )}
                                        {viewProfileUser.twitter && (
                                            <a href={`https://twitter.com/${viewProfileUser.twitter.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-sm text-neutral-400 hover:text-sky-400 transition-colors w-fit">
                                                <Twitter size={14} /> {viewProfileUser.twitter}
                                            </a>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Share Project Modal */}
            {showShareModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Users size={18}/> Share Project
                            </h2>
                            <button onClick={() => setShowShareModal(false)} className="text-neutral-500 hover:text-white transition-colors"><X size={18}/></button>
                        </div>
                        
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 p-4 rounded-xl">
                                <div>
                                    <h3 className="text-sm font-bold text-white">Public Project</h3>
                                    <p className="text-[10px] text-neutral-500">Anyone can view and collaborate.</p>
                                </div>
                                <button 
                                    onClick={async () => {
                                        const nextPublic = !isPublic;
                                        setIsPublic(nextPublic);
                                        await saveProject(sharedWith, nextPublic);
                                        showToast(nextPublic ? "Project is now public" : "Project is private", "success");
                                        if (socketRef.current) socketRef.current.emit('daw-action', { type: 'PROJECT_SHARED' });
                                    }} 
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${isPublic ? 'bg-purple-600' : 'bg-neutral-700'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {!isPublic && (
                                <>
                                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mt-2">Registered Users</h3>
                                    <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                                        {(() => {
                                            const unifiedUsers = new Map();
                                            
                                            registeredUsers.forEach(u => {
                                                if (u.username && u.username !== currentUser?.username) {
                                                    unifiedUsers.set(u.username, { ...u, isOnline: false });
                                                }
                                            });
                                            
                                            Object.values(peers).forEach(p => {
                                                if (p.username && p.username !== currentUser?.username) {
                                                    if (unifiedUsers.has(p.username)) {
                                                        unifiedUsers.get(p.username).isOnline = true;
                                                    } else {
                                                        unifiedUsers.set(p.username, { id: `peer_${p.username}`, username: p.username, isOnline: true });
                                                    }
                                                }
                                            });

                                            const sortedUsers = Array.from(unifiedUsers.values()).sort((a, b) => {
                                                if (a.isOnline && !b.isOnline) return -1;
                                                if (!a.isOnline && b.isOnline) return 1;
                                                return a.username.localeCompare(b.username);
                                            });

                                            if (sortedUsers.length === 0) return <p className="text-xs text-neutral-500 text-center py-4">No other users found.</p>;

                                            return sortedUsers.map(u => {
                                                const isShared = sharedWith.includes(u.username);
                                                return (
                                                    <div key={u.id} className="flex justify-between items-center bg-neutral-950 border border-neutral-800 p-2 rounded-lg group hover:border-neutral-700 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative">
                                                                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-white shadow-inner">{u.username.charAt(0).toUpperCase()}</div>
                                                                {u.isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-neutral-950 shadow-[0_0_5px_#22c55e]" title="Online" />}
                                                            </div>
                                                            <span className="text-sm text-neutral-300 font-medium">{u.username}</span>
                                                        </div>
                                                        <button 
                                                            onClick={async () => {
                                                                const nextShared = isShared ? sharedWith.filter(n => n !== u.username) : [...sharedWith, u.username];
                                                                setSharedWith(nextShared);
                                                                await saveProject(nextShared, isPublic);
                                                                if (socketRef.current) socketRef.current.emit('daw-action', { type: 'PROJECT_SHARED' });
                                                            }} 
                                                            className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold rounded transition-colors ${isShared ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20' : 'bg-neutral-800 text-neutral-400 hover:bg-blue-600 hover:text-white border border-transparent'}`}
                                                        >
                                                            {isShared ? 'Revoke' : 'Share'}
                                                        </button>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}