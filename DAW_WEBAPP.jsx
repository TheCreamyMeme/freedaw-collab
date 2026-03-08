import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Square, Circle, SkipBack, 
  Volume2, VolumeX, Mic, Music, Radio, 
  Settings, Users, Plus, Maximize2, MoreHorizontal,
  Folder, Sliders, History, UserCircle, Piano,
  MousePointer2, Pencil, Eraser, X, Grid, Trash2, Activity,
  Settings2, Plug, Power, LogOut, FileAudio, FileCode, Cpu
} from 'lucide-react';

// --- Mock Data ---
const INITIAL_TRACKS = [
  { id: 1, name: 'Lead Vocals', type: 'audio', color: 'bg-blue-500', volume: 80, pan: 0, muted: false, solo: false, icon: Mic, 
    clips: [{ id: 101, start: 0, duration: 4 }, { id: 102, start: 5, duration: 3 }],
    effects: [
      { id: 'fx-v1', type: 'delay', name: 'Analog Delay', params: { time: 0.35, feedback: 0.4, mix: 0.4 } }
    ]
  },
  { id: 2, name: 'Drum Machine', type: 'midi', instrument: 'drum', instrumentParams: { kickPitch: 150, snareDecay: 0.2 }, color: 'bg-orange-500', volume: 90, pan: 0, muted: false, solo: false, icon: Radio, 
    effects: [],
    clips: [
      { id: 201, start: 0, duration: 8, notes: [
        { id: 'd1', pitch: 36, start: 0, duration: 0.25 }, { id: 'd2', pitch: 42, start: 0.5, duration: 0.25 },
        { id: 'd3', pitch: 38, start: 1, duration: 0.25 }, { id: 'd4', pitch: 42, start: 1.5, duration: 0.25 },
        { id: 'd5', pitch: 36, start: 2, duration: 0.25 }, { id: 'd6', pitch: 36, start: 2.25, duration: 0.25 },
        { id: 'd7', pitch: 38, start: 3, duration: 0.25 }, { id: 'd8', pitch: 46, start: 3.5, duration: 0.25 }
      ]}
    ] 
  },
  { id: 3, name: 'Bass Synth', type: 'midi', instrument: 'wam-obxd', instrumentParams: {}, color: 'bg-purple-500', volume: 75, pan: 0, muted: false, solo: false, icon: Music, 
    effects: [
      { id: 'fx-b2', type: 'filter', name: 'Pro-Q Filter', params: { freq: 1200, res: 1.5 } },
      { id: 'fx-b1', type: 'delay', name: 'Ping Pong Delay', params: { time: 0.5, feedback: 0.8, mix: 0.5 } }
    ],
    clips: [
      { id: 301, start: 0, duration: 4, notes: [
        { id: 'n1', pitch: 48, start: 0, duration: 0.5 }, { id: 'n2', pitch: 48, start: 0.5, duration: 0.5 },
        { id: 'n3', pitch: 60, start: 1, duration: 0.25 }, { id: 'n4', pitch: 58, start: 1.5, duration: 0.5 },
        { id: 'n5', pitch: 55, start: 2.5, duration: 0.5 }, { id: 'n6', pitch: 51, start: 3.5, duration: 0.5 }
      ]}, 
      { id: 302, start: 4, duration: 4, notes: [
        { id: 'n7', pitch: 48, start: 0, duration: 1 }, { id: 'n8', pitch: 43, start: 1, duration: 1 },
        { id: 'n9', pitch: 41, start: 2, duration: 2 }
      ]}
    ] 
  },
  { id: 4, name: 'Backing Vocals', type: 'audio', color: 'bg-teal-500', volume: 60, pan: -20, muted: true, solo: false, icon: Mic, effects: [], clips: [{ id: 401, start: 4, duration: 4 }] },
];

const INITIAL_VST_LIBRARY = [
  { id: 'vst-1', name: 'Analog Delay', category: 'effect', type: 'delay', vendor: 'WebDAW Core' },
  { id: 'vst-2', name: 'Tube Overdrive', category: 'effect', type: 'distortion', vendor: 'WebDAW Core' },
  { id: 'vst-3', name: 'Pro-Q Filter', category: 'effect', type: 'filter', vendor: 'FabFilter (WASM)' },
  { id: `wam-obxd`, name: 'OB-Xd Poly Synth', category: 'instrument', type: 'synth', vendor: 'WAM Community (WASM)', url: 'https://mainline.i3s.unice.fr/wam2/packages/obxd/index.js' },
  { id: `wam-dexed`, name: 'Dexed FM Synth', category: 'instrument', type: 'synth', vendor: 'WebAudioModules.org', url: 'https://mainline.i3s.unice.fr/wam2/packages/dexed/index.js' },
  { id: `wam-pingpong`, name: 'Ping Pong Delay', category: 'effect', type: 'delay', vendor: 'Faust DSP (WASM)', url: 'https://mainline.i3s.unice.fr/wam2/packages/faust-pingpongdelay/index.js' }
];

// --- Real WAM 2.0 Host Integration ---
const WamHostWrapper = ({ pluginId, pluginName, pluginUrl, audioCtx }) => {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [errorStr, setErrorStr] = useState(null);

  // This is how modern Web DAWs instantiate 3rd-party WASM code:
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErrorStr(null);

    const mountGui = async () => {
      if (!audioCtx) {
        if (isMounted) {
           setErrorStr("Audio Engine Sleeping. Please hit PLAY on the main transport bar first to activate Web Audio context.");
           setLoading(false);
        }
        return;
      }

      if (pluginUrl) {
        try {
          // 0. WAM 2.0 Requires the host to initialize the AudioContext first
          if (!window.WamEnvInitialized) {
             try {
                 const { default: initializeWamHost } = await import('https://mainline.i3s.unice.fr/wam2/packages/sdk/src/initializeWamHost.js');
                 await initializeWamHost(audioCtx);
                 window.WamEnvInitialized = true;
             } catch (initErr) {
                 console.warn("WAM Host Init bypass (might already be initialized by plugin):", initErr);
             }
          }

          // 1. Dynamically load the WAM using JavaScript's native dynamic import()
          const wamModule = await import(pluginUrl);
          const WamPlugin = wamModule.default;
          
          // 2. Initialize the WAM instance (compiles the WebAssembly and Worklets)
          // The correct WAM 2.0 API signature is .createInstance(audioCtx, [initialState])
          const wamInstance = await WamPlugin.createInstance(audioCtx);
          
          // 3. Request the plugin to render its native WebComponent GUI
          const guiElement = await wamInstance.createGui();
          
          if (!isMounted) return;
          if (containerRef.current) {
             containerRef.current.innerHTML = ''; 
             containerRef.current.appendChild(guiElement); 
          }
          setLoading(false);
        } catch (err) {
          console.error(`Failed to load real WAM from ${pluginUrl}:`, err);
          if (isMounted) {
            setErrorStr(`Failed to load WAM Interface: ${err.message}. Note: Some WAMs require specific cross-origin headers or break in iframe sandboxes.`);
            setLoading(false);
          }
        }
      } else {
        if (isMounted) {
           setErrorStr(`No WAM URL provided for ${pluginName}.`);
           setLoading(false);
        }
      }
    };

    mountGui();

    return () => { isMounted = false; };
  }, [pluginId, pluginName, pluginUrl, audioCtx]);

  return (
    <div className="flex-1 relative flex flex-col border-t border-neutral-800 rounded-b-lg overflow-hidden bg-neutral-950">
      {loading && (
         <div className="absolute inset-0 z-10 bg-neutral-950 flex flex-col items-center justify-center">
            <Cpu size={32} className="text-blue-500 animate-pulse mb-4" />
            <span className="text-xs font-mono text-neutral-400">Fetching {pluginName} WASM...</span>
            <span className="text-[9px] font-mono text-neutral-600 mt-2 text-center max-w-xs truncate">Importing from: {pluginUrl}</span>
         </div>
      )}
      {errorStr && (
         <div className="absolute inset-0 z-10 bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
           <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded text-xs font-mono max-w-md leading-relaxed">
             {errorStr}
           </div>
         </div>
      )}
      {/* This empty div is the standard WAM DOM mount point where the plugin injects its interface */}
      <div ref={containerRef} className="w-full h-full flex flex-col overflow-auto custom-scrollbar items-center justify-center bg-neutral-900" />
    </div>
  );
};

// --- Web Audio API Engine Helpers ---
const createFXNode = (ctx, fx) => {
  if (fx.type === 'filter') {
    const node = ctx.createBiquadFilter();
    node.type = 'lowpass';
    node.frequency.value = fx.params.freq || 2000;
    node.Q.value = fx.params.res || 1;
    return { input: node, output: node, node, fxType: 'filter' };
  } else if (fx.type === 'delay') {
    const delay = ctx.createDelay(5.0);
    delay.delayTime.value = fx.params.time || 0.3;
    const feedback = ctx.createGain();
    feedback.gain.value = fx.params.feedback || 0.3;
    const wet = ctx.createGain();
    wet.gain.value = fx.params.mix || 0.5;
    const dry = ctx.createGain();
    dry.gain.value = 1 - (fx.params.mix || 0.5);
    
    const input = ctx.createGain();
    const output = ctx.createGain();
    
    input.connect(dry);
    dry.connect(output);
    
    input.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(output);
    
    return { input, output, delay, feedback, wet, dry, fxType: 'delay' };
  } else if (fx.type === 'distortion') {
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
      return { input: node, output: node, node, fxType: 'distortion' };
  }
  return null;
};

const triggerDrum = (ctx, trackBus, pitch, time, vol, params = {}) => {
  if (pitch === 36) { // Kick
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(trackBus);
    const startPitch = params.kickPitch || 150;
    osc.frequency.setValueAtTime(startPitch, time);
    osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.5);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
    osc.start(time);
    osc.stop(time + 0.5);
  } else if (pitch === 38) { // Snare
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const snareDecay = params.snareDecay || 0.2;
    osc.type = 'triangle';
    osc.connect(oscGain);
    oscGain.connect(trackBus);
    osc.frequency.setValueAtTime(250, time);
    oscGain.gain.setValueAtTime(vol * 0.5, time);
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
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;
    const noiseGain = ctx.createGain();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(trackBus);
    noiseGain.gain.setValueAtTime(vol * 0.8, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + snareDecay);
    noise.start(time);
  } else { // Hihat
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 5000;
    const noiseGain = ctx.createGain();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(trackBus);
    noiseGain.gain.setValueAtTime(vol * 0.4, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    noise.start(time);
  }
};

const triggerBass = (ctx, trackBus, pitch, time, vol, dur, params = {}) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  
  osc.type = params.oscType || 'sawtooth';
  const freq = 440 * Math.pow(2, (pitch - 69) / 12);
  osc.frequency.setValueAtTime(freq, time);
  
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(params.filterCutoff || 2000, time);
  filter.Q.value = params.filterRes || 1.5;
  filter.frequency.exponentialRampToValueAtTime(100, time + dur * 0.5);
  
  gain.gain.setValueAtTime(vol, time);
  gain.gain.setTargetAtTime(0, time + dur * 0.8, 0.1);
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(trackBus);
  
  osc.start(time);
  osc.stop(time + dur + 0.1);
};

const initTrackRouting = (track, ctx, masterGain) => {
  const inputBus = ctx.createGain();
  const faderGain = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64; 
  
  faderGain.gain.value = track.volume / 100;
  faderGain.connect(analyser);
  analyser.connect(masterGain);
  
  let currentOutput = inputBus;
  const fxNodes = {};

  if (track.effects) {
    track.effects.forEach(fx => {
      const nodeObj = createFXNode(ctx, fx);
      if (nodeObj) {
        currentOutput.connect(nodeObj.input);
        currentOutput = nodeObj.output;
        fxNodes[fx.id] = nodeObj;
      }
    });
  }

  currentOutput.connect(faderGain);
  
  let instrument = { inputBus, faderGain, analyser, fxNodes, currentNoteId: null, type: track.type };

  if (track.type === 'audio') {
    const gateGain = ctx.createGain();
    gateGain.gain.value = 0;
    instrument.gateGain = gateGain;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc2.type = 'square';
    osc1.detune.value = 15;
    osc2.detune.value = -15;

    const baseFreq = track.id === 1 ? 261.63 : (track.id === 4 ? 130.81 : (130 + Math.random() * 200)); 
    osc1.frequency.value = baseFreq;
    osc2.frequency.value = baseFreq / 2;

    filter.type = 'lowpass';
    filter.frequency.value = 800;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gateGain);
    gateGain.connect(inputBus); 

    osc1.start();
    osc2.start();
    
    instrument.osc1 = osc1;
    instrument.osc2 = osc2;
    instrument.lfo = lfo;
  }
  return instrument;
};

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [currentTime, setCurrentTime] = useState(0); 
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
  const [showAddFxMenu, setShowAddFxMenu] = useState(null); 
  const [isFetchingWAMs, setIsFetchingWAMs] = useState(false); 
  
  // Unifies both Instruments and Effects in one modal
  const [openPluginUI, setOpenPluginUI] = useState(null); // { trackId, isEffect: boolean, fxId?: string }
  
  // Auth & Collaboration State
  const [usersDb, setUsersDb] = useState([]); 
  const [activeSessionUsers, setActiveSessionUsers] = useState([]); 
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); 
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  // Refs for Web Audio API
  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const masterAnalyserRef = useRef(null);
  const synthsRef = useRef({});
  const lastTimeRef = useRef(0);
  const tracksRef = useRef(tracks); 

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // --- Web Audio API Engine Logic ---
  const playClick = (time, isAccent) => {
    if (!audioCtxRef.current || !masterGainRef.current) return;
    const osc = audioCtxRef.current.createOscillator();
    const gainNode = audioCtxRef.current.createGain();
    osc.connect(gainNode);
    gainNode.connect(masterGainRef.current);
    osc.frequency.value = isAccent ? 1200 : 800;
    gainNode.gain.setValueAtTime(1, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.start(time);
    osc.stop(time + 0.1);
  };

  const stopAudio = () => {
    Object.values(synthsRef.current).forEach(synth => {
      try {
        if (synth.gateGain) synth.gateGain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
        synth.currentNoteId = null;
      } catch(e) {}
    });
  };

  // Unified Game Loop
  useEffect(() => {
    if (!isPlaying) return;

    let reqId;
    const update = () => {
      if (!audioCtxRef.current) return;
      const now = audioCtxRef.current.currentTime;
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;

      setCurrentTime(prevTime => {
        const newTime = prevTime + (dt * (bpm / 60));

        if (metronomeEnabled && Math.floor(newTime) > Math.floor(prevTime)) {
          playClick(now, Math.floor(newTime) % 4 === 0);
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
              const activeNote = activeClip.notes?.find(n => clipTime >= n.start && clipTime < n.start + n.duration);

              if (activeNote) {
                if (synth.currentNoteId !== activeNote.id) {
                  synth.currentNoteId = activeNote.id;
                  const durSeconds = activeNote.duration * (60/bpm);
                  if (track.instrument === 'drum') {
                    triggerDrum(audioCtxRef.current, synth.inputBus, activeNote.pitch, now, 1, track.instrumentParams);
                  } else {
                    triggerBass(audioCtxRef.current, synth.inputBus, activeNote.pitch, now, 1, durSeconds, track.instrumentParams);
                  }
                }
              } else {
                synth.currentNoteId = null;
              }
            } else {
              synth.currentNoteId = null;
            }
          } else {
            if (activeClip && shouldPlayTrack) {
               synth.gateGain.gain.setTargetAtTime(1, now, 0.02);
            } else {
               synth.gateGain.gain.setTargetAtTime(0, now, 0.02);
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

        return newTime;
      });

      reqId = requestAnimationFrame(update);
    };

    lastTimeRef.current = audioCtxRef.current.currentTime;
    reqId = requestAnimationFrame(update);

    return () => cancelAnimationFrame(reqId);
  }, [isPlaying, bpm, metronomeEnabled]); 

  const rebuildTrackRouting = (trackId, latestTracks) => {
    if (isPlaying && audioCtxRef.current) {
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
      synthsRef.current[trackId] = initTrackRouting(updatedTrack, audioCtxRef.current, masterGainRef.current);
    }
  };

  const handleAddEffect = (trackId, vst) => {
    const newFx = {
      id: `fx-${Date.now()}`,
      type: vst.type,
      name: vst.name,
      params: vst.type === 'delay' ? { time: 0.3, feedback: 0.4, mix: 0.5 } :
              vst.type === 'distortion' ? { amount: 50 } :
              vst.type === 'filter' ? { freq: 2000, res: 1 } : {}
    };
    
    setTracks(prev => {
      const newTracks = prev.map(t => t.id === trackId ? { ...t, effects: [...(t.effects||[]), newFx] } : t);
      rebuildTrackRouting(trackId, newTracks);
      return newTracks;
    });
  };

  const handleRemoveEffect = (trackId, fxId) => {
    setTracks(prev => {
      const newTracks = prev.map(t => t.id === trackId ? { ...t, effects: t.effects.filter(fx => fx.id !== fxId) } : t);
      rebuildTrackRouting(trackId, newTracks);
      return newTracks;
    });
  };

  const handleInstrumentChange = (trackId, newInstrument) => {
    setTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      let newParams = {};
      if (newInstrument === 'drum') newParams = { kickPitch: 150, snareDecay: 0.2 };
      else if (newInstrument === 'synth') newParams = { oscType: 'sawtooth', filterCutoff: 2000, filterRes: 1.5 };
      else newParams = { macro1: 50, macro2: 50, macro3: 50 }; 
      
      return { 
        ...t, 
        instrument: newInstrument,
        instrumentParams: newParams,
        icon: newInstrument === 'drum' ? Radio : Music 
      };
    }));
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

  const handleFetchPublicWAMs = () => {
    setIsFetchingWAMs(true);
    setTimeout(() => {
      const publicWAMs = [
        { id: `wam-obxd-${Date.now()}`, name: 'OB-Xd Poly Synth', category: 'instrument', type: 'synth', vendor: 'WAM Community', url: 'https://mainline.i3s.unice.fr/wam2/packages/obxd/index.js' },
        { id: `wam-dexed-${Date.now()}`, name: 'Dexed FM Synth', category: 'instrument', type: 'synth', vendor: 'WebAudioModules.org', url: 'https://mainline.i3s.unice.fr/wam2/packages/dexed/index.js' }, 
        { id: `wam-cloud-${Date.now()}`, name: 'Cloud Reverb', category: 'effect', type: 'delay', vendor: 'Faust DSP', url: 'https://mainline.i3s.unice.fr/wam2/packages/faust-reverb/index.js' },
        { id: `wam-chorus-${Date.now()}`, name: 'Tuna Chorus', category: 'effect', type: 'filter', vendor: 'WebAudio API / WAM2', url: 'https://mainline.i3s.unice.fr/wam2/packages/chorus/index.js' },
        { id: `wam-compressor-${Date.now()}`, name: 'Bus Compressor', category: 'effect', type: 'filter', vendor: 'WAM Community', url: 'https://mainline.i3s.unice.fr/wam2/packages/compressor/index.js' },
        { id: `wam-overdrive-${Date.now()}`, name: 'Tube Overdrive', category: 'effect', type: 'distortion', vendor: 'WebAudioModules.org', url: 'https://mainline.i3s.unice.fr/wam2/packages/overdrive/index.js' },
        { id: `wam-eq-${Date.now()}`, name: 'Parametric EQ 10-Band', category: 'effect', type: 'filter', vendor: 'WAM Community', url: 'https://mainline.i3s.unice.fr/wam2/packages/parametricEQ/index.js' }
      ];
      setVstLibrary(prev => {
        const newLibs = publicWAMs.filter(pw => !prev.some(v => v.name === pw.name));
        return [...prev, ...newLibs];
      });
      setIsFetchingWAMs(false);
    }, 1800); // slightly longer loading time to simulate hitting multiple endpoints
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
    }
  };

  const updateUserPresence = (trackId) => {
    if (currentUser) {
      setActiveSessionUsers(prev => prev.map(c => c.id === currentUser.id ? { ...c, activeTrack: trackId } : c));
    }
  };

  const handleAddTrack = () => {
    const newId = tracks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
    const isMidi = Math.random() > 0.3; 
    const newTrack = {
      id: newId,
      name: `Track ${newId}`,
      type: isMidi ? 'midi' : 'audio',
      instrument: isMidi ? 'synth' : null,
      instrumentParams: isMidi ? { oscType: 'sawtooth', filterCutoff: 2000, filterRes: 1.5 } : null,
      color: ['bg-pink-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-emerald-500'][newId % 4],
      volume: 80, 
      pan: 0, 
      muted: false, 
      solo: false, 
      icon: isMidi ? Music : Mic,
      clips: [],
      effects: []
    };
    
    setTracks(prev => [...prev, newTrack]);
    
    if (isPlaying && audioCtxRef.current) {
      synthsRef.current[newId] = initTrackRouting(newTrack, audioCtxRef.current, masterGainRef.current);
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

  const BEAT_WIDTH = 64; 
  const PITCH_HEIGHT = 16; 
  const PITCH_MAX = 72; 
  const PITCH_MIN = 36; 

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
    if (editorTool === 'erase') {
      setTracks(prev => prev.map(t => t.id === trackId ? {
        ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, notes: c.notes.filter(n => n.id !== note.id) } : c)
      } : t));
      return;
    }
    if (editorTool === 'select') {
      setDraggingNote({ trackId, clipId, noteId: note.id, startX: e.clientX, startY: e.clientY, initialStart: note.start, initialPitch: note.pitch });
    }
  };

  const handleGridMouseDown = (e, trackId, clipId) => {
    if (editorTool !== 'draw' || draggingNote) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const timeBeat = Math.max(0, Math.floor((x / BEAT_WIDTH) * 4) / 4); 
    const pitchIndex = Math.floor(y / PITCH_HEIGHT);
    const pitch = PITCH_MAX - pitchIndex;

    const newNote = { id: `new_${Date.now()}`, pitch: pitch, start: timeBeat, duration: 0.25 };
    setTracks(prev => prev.map(t => t.id === trackId ? {
      ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, notes: [...(c.notes || []), newNote] } : c)
    } : t));
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
      } else if (draggingNote) {
        const deltaX = e.clientX - draggingNote.startX;
        const deltaBeats = Math.round((deltaX / BEAT_WIDTH) * 4) / 4; 
        const deltaY = e.clientY - draggingNote.startY;
        const deltaPitch = Math.round(deltaY / PITCH_HEIGHT); 

        setTracks(prev => prev.map(t => t.id === draggingNote.trackId ? {
          ...t, clips: t.clips.map(c => c.id === draggingNote.clipId ? {
             ...c, notes: c.notes.map(n => n.id === draggingNote.noteId ? {
               ...n,
               start: Math.max(0, draggingNote.initialStart + deltaBeats),
               pitch: Math.min(PITCH_MAX, Math.max(PITCH_MIN, draggingNote.initialPitch - deltaPitch))
             } : n)
          } : c)
        } : t));
      }
    };

    const handleMouseUp = () => {
      setDraggingClip(null);
      setDraggingNote(null);
      setDraggingEdge(null);
    };

    if (draggingClip || draggingNote || draggingEdge) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingClip, draggingNote, draggingEdge]);

  const handleTimelineClick = (e) => {
    if (e.target.closest('.group') || draggingClip || draggingNote) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = e.currentTarget.scrollLeft || 0;
    const x = e.clientX - rect.left + scrollLeft;
    const newTime = Math.max(0, x / BEAT_WIDTH);
    
    setCurrentTime(newTime);
    
    if (audioCtxRef.current) {
      Object.values(synthsRef.current).forEach(synth => {
        if (synth.gateGain) synth.gateGain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.01);
        synth.currentNoteId = null;
      });
      document.querySelectorAll('canvas').forEach(canvas => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }
  };

  const togglePlay = () => {
    if (!isPlaying) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        masterGainRef.current = audioCtxRef.current.createGain();
        masterAnalyserRef.current = audioCtxRef.current.createAnalyser();
        masterAnalyserRef.current.fftSize = 4096; 
        masterAnalyserRef.current.smoothingTimeConstant = 0.85; 
        
        masterGainRef.current.connect(masterAnalyserRef.current);
        masterAnalyserRef.current.connect(audioCtxRef.current.destination);
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      tracks.forEach((track) => {
        if (!synthsRef.current[track.id]) {
          synthsRef.current[track.id] = initTrackRouting(track, audioCtxRef.current, masterGainRef.current);
        }
      });
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      stopAudio();
    }
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    stopAudio();
    document.querySelectorAll('canvas').forEach(canvas => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  };

  const toggleMute = (trackId) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
  };

  const toggleSolo = (trackId) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, solo: !t.solo } : t));
  };

  const handleVolumeChange = (trackId, val) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume: Number(val) } : t));
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setAuthMessage('');
    if (authName.trim() && authPassword.trim()) {
      if (authMode === 'register') {
        const existing = usersDb.find(u => u.name === authName.trim());
        if (existing) {
          setAuthMessage('Name already taken.');
          return;
        }
        
        const isFirstUser = usersDb.length === 0; 
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
          setShowAuthModal(false);
          setAuthName(''); setAuthPassword('');
        } else {
          setAuthMessage('Registered! Waiting for admin approval.');
          setAuthMode('signin');
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
        setShowAuthModal(false);
        setAuthName(''); setAuthPassword('');
      }
    }
  };

  const handleSignOut = () => {
    setActiveSessionUsers(prev => prev.filter(c => c.id !== currentUser.id));
    setCurrentUser(null);
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-neutral-300 font-sans selection:bg-blue-500/30">
      
      {/* Top Navigation / App Bar */}
      <header className="h-14 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">W</div>
          <span className="text-white font-semibold tracking-wide">WebDAW <span className="text-xs font-normal text-neutral-500 ml-2">v0.1.0 Beta</span></span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-full border border-neutral-800">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-neutral-400 font-medium">Live Session</span>
            <div className="flex -space-x-2 ml-2">
              {activeSessionUsers.map(collab => (
                <div key={collab.id} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold ring-2 ring-neutral-900 ${collab.color}`} title={`${collab.name} is editing`}>
                  {collab.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          </div>
          <button className="p-2 text-neutral-400 hover:text-white transition-colors rounded hover:bg-neutral-800"><History size={18} /></button>
          
          {currentUser?.role === 'admin' && (
            <button onClick={() => setShowAdminModal(true)} className="relative p-2 text-neutral-400 hover:text-white transition-colors rounded hover:bg-neutral-800" title="Manage Team Access">
              <Users size={18} />
              {usersDb.filter(u => u.status === 'pending').length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-neutral-950" />
              )}
            </button>
          )}

          <button className="p-2 text-neutral-400 hover:text-white transition-colors rounded hover:bg-neutral-800"><Settings size={18} /></button>
          <div className="w-px h-6 bg-neutral-800 mx-1" />
          
          {currentUser ? (
            <div className="flex items-center gap-3 pl-2">
               <div className="flex items-center gap-2">
                 <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-xs text-white font-bold shadow-sm">
                   {currentUser.name.charAt(0).toUpperCase()}
                 </div>
                 <span className="text-sm font-medium text-white">{currentUser.name}</span>
               </div>
               <button onClick={handleSignOut} className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors rounded hover:bg-neutral-800" title="Sign Out">
                 <LogOut size={16} />
               </button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="flex items-center gap-2 p-1.5 pr-3 text-neutral-400 hover:text-white transition-colors rounded-full hover:bg-neutral-800 border border-neutral-800">
              <UserCircle size={22} />
              <span className="text-xs font-medium">Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Transport Controls */}
      <div className="h-16 bg-neutral-900 border-b border-neutral-800 flex items-center px-4 gap-8 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={stopPlayback} className="p-2 hover:text-white hover:bg-neutral-800 rounded transition-colors"><SkipBack size={20} /></button>
          <button onClick={togglePlay} className={`p-3 rounded-full transition-colors flex items-center justify-center ${isPlaying ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-neutral-800 hover:bg-neutral-700 text-white'}`}>
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
          </button>
          <button onClick={stopPlayback} className="p-2 hover:text-white hover:bg-neutral-800 rounded transition-colors"><Square size={20} /></button>
          <button onClick={() => setIsRecording(!isRecording)} className={`p-2 rounded transition-colors ml-2 ${isRecording ? 'text-red-500 bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'text-red-400 hover:text-red-300 hover:bg-neutral-800'}`}>
            <Circle size={20} fill="currentColor" />
          </button>
        </div>

        <div className="flex items-center gap-6 bg-neutral-950 px-6 py-2 rounded-lg border border-neutral-800 font-mono text-sm">
          <div className="flex flex-col">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Time</span>
            <span className="text-white">00:00:{(currentTime * (60/bpm)).toFixed(2).padStart(5, '0')}</span>
          </div>
          <div className="w-px h-6 bg-neutral-800" />
          <div className="flex flex-col">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Bar.Beat</span>
            <span className="text-white">{Math.floor(currentTime / 4) + 1}.{Math.floor(currentTime % 4) + 1}.1</span>
          </div>
          <div className="w-px h-6 bg-neutral-800" />
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Tempo</span>
              <input type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="bg-transparent w-12 text-white focus:outline-none" min="40" max="300" />
            </div>
          </div>
          <div className="w-px h-6 bg-neutral-800" />
          <button onClick={() => setMetronomeEnabled(!metronomeEnabled)} className={`flex flex-col items-center justify-center p-1 rounded ${metronomeEnabled ? 'text-blue-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <span className="text-[10px] uppercase tracking-wider mb-0.5">Click</span>
            <div className={`w-2 h-2 rounded-full ${metronomeEnabled ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-neutral-600'}`} />
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="w-14 bg-neutral-950 border-r border-neutral-800 flex flex-col items-center py-4 gap-4 z-30 shrink-0">
          <button onClick={() => { setActiveView('arrangement'); setBottomDock(null); }} className={`p-2.5 rounded-xl transition-colors ${activeView === 'arrangement' && !bottomDock ? 'text-blue-400 bg-blue-500/10' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`} title="Arrangement/Mix Window">
            <MoreHorizontal size={22} />
          </button>
          <button onClick={() => setActiveView('mixer')} className={`p-2.5 rounded-xl transition-colors ${activeView === 'mixer' ? 'text-blue-400 bg-blue-500/10' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`} title="Mixer Panel">
            <Sliders size={22} />
          </button>
          <button onClick={() => { setActiveView('arrangement'); if(!bottomDock || bottomDock.type === 'devices') alert('Double-click a MIDI clip in the Arrangement view to open the Editor Suite!'); }} className={`p-2.5 rounded-xl transition-colors ${bottomDock?.type === 'piano-roll' ? 'text-purple-400 bg-purple-500/10' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`} title="MIDI Editor Suite">
            <Piano size={22} />
          </button>
          <div className="w-8 h-px bg-neutral-800 my-2" />
          <button onClick={() => setActiveView('browser')} className={`p-2.5 rounded-xl transition-colors ${activeView === 'browser' ? 'text-blue-400 bg-blue-500/10' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`} title="Project/Session Browser">
            <Folder size={22} />
          </button>
        </div>

        {activeView === 'browser' ? (
          <div className="flex-1 flex overflow-hidden bg-neutral-900 z-10">
            <div className="w-72 bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0">
              <div className="p-4 border-b border-neutral-800">
                <h3 className="text-white font-semibold flex items-center gap-2"><Folder size={18} className="text-blue-400"/> Library</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                <div className="text-[10px] font-bold text-neutral-500 mb-2 mt-2 uppercase tracking-wider px-2">VST Plugins & Effects</div>
                {vstLibrary.map(vst => (
                  <div key={vst.id} className="flex items-center justify-between p-2 hover:bg-neutral-800/50 rounded-lg text-sm text-neutral-300 group cursor-pointer border border-transparent hover:border-neutral-700 transition-colors animate-in fade-in duration-300">
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
                
                <div className="text-[10px] font-bold text-neutral-500 mb-2 mt-6 uppercase tracking-wider px-2">Project Files</div>
                <div className="flex items-center gap-3 p-2 hover:bg-neutral-800/50 rounded-lg text-sm text-neutral-300 cursor-pointer">
                   <div className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center text-emerald-400"><FileAudio size={14} /></div>
                   <div className="flex flex-col"><span className="font-medium text-white text-xs">vocal_take_01.wav</span><span className="text-[9px] text-neutral-500">2.4 MB</span></div>
                </div>
                <div className="flex items-center gap-3 p-2 hover:bg-neutral-800/50 rounded-lg text-sm text-neutral-300 cursor-pointer">
                   <div className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center text-emerald-400"><FileAudio size={14} /></div>
                   <div className="flex flex-col"><span className="font-medium text-white text-xs">bass_drop.wav</span><span className="text-[9px] text-neutral-500">840 KB</span></div>
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
                 Manage your custom WebAssembly plugins and audio files here. Click <strong>Browse Public WAMs</strong> to securely pull from open-source community registries.
               </p>
            </div>
          </div>
        ) : activeView === 'mixer' ? (
          <div className="flex-1 flex flex-col bg-neutral-900 border-l border-neutral-800 relative z-10 overflow-hidden">
            <div className="flex-1 bg-neutral-900 overflow-x-auto flex items-stretch p-4 gap-2 custom-scrollbar">
              {tracks.map(track => {
                return (
                <div key={track.id} className="w-32 bg-neutral-950 border border-neutral-800 rounded-lg flex flex-col items-center py-4 shrink-0 shadow-lg relative">
                  <div className="w-full text-center px-2 mb-4 border-b border-neutral-800 pb-2">
                     <div className={`w-3 h-3 rounded-full mx-auto mb-1 shadow-sm ${track.color}`} />
                     <div className="text-xs font-semibold text-neutral-300 truncate">{track.name}</div>
                  </div>
                  
                  <div className="w-full px-4 mb-4 flex flex-col items-center">
                     <span className="text-[9px] text-neutral-500 mb-1 font-mono">PAN</span>
                     <input type="range" min="-50" max="50" defaultValue={track.pan} className="w-full h-1 bg-neutral-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-neutral-400 hover:[&::-webkit-slider-thumb]:bg-white cursor-pointer" />
                  </div>
                  
                  <div className="flex gap-2 mb-6">
                    <button onClick={() => toggleMute(track.id)} className={`w-8 h-8 rounded text-xs font-bold transition-all ${track.muted ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300 border border-transparent hover:bg-neutral-700'}`}>M</button>
                    <button onClick={() => toggleSolo(track.id)} className={`w-8 h-8 rounded text-xs font-bold transition-all ${track.solo ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300 border border-transparent hover:bg-neutral-700'}`}>S</button>
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
                           onChange={(e) => handleVolumeChange(track.id, e.target.value)}
                           className="h-full w-full appearance-none bg-transparent cursor-pointer z-20 absolute inset-0 opacity-0"
                           style={{ WebkitAppearance: 'slider-vertical' }}
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
              <div className="w-32 bg-neutral-900 border-l border-neutral-800 flex flex-col items-center py-4 shrink-0 ml-auto shadow-[-8px_0_15px_rgba(0,0,0,0.2)]">
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
                         <input type="range" orient="vertical" min="0" max="100" defaultValue="80" className="h-full w-full appearance-none bg-transparent cursor-pointer z-20 absolute inset-0 opacity-0" style={{ WebkitAppearance: 'slider-vertical' }} />
                         <div className="absolute left-1/2 -translate-x-1/2 w-10 h-6 bg-gradient-to-b from-red-500 to-red-600 rounded shadow-[0_4px_6px_rgba(0,0,0,0.5)] border-b-4 border-red-800 pointer-events-none z-10" style={{ bottom: `calc(80% - 12px)` }}>
                           <div className="w-full h-0.5 bg-black/50 absolute top-1/2 -translate-y-1/2 shadow-[0_1px_0_rgba(255,255,255,0.3)]" />
                         </div>
                     </div>
                  </div>
                  
                  <div className="mt-4 text-[10px] font-mono text-red-400 bg-black px-3 py-1.5 rounded border border-neutral-800 shadow-inner w-20 text-center">0.0 dB</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 flex overflow-hidden">
              {/* Track Headers (Left Pane) */}
              <div className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
                <div className="h-8 border-b border-neutral-800 bg-neutral-950 flex justify-end px-2 items-center">
                   <button onClick={handleAddTrack} className="flex items-center gap-1 text-[10px] uppercase font-semibold text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-800 px-2 py-1 rounded transition-colors">
                      <Plus size={12}/> Track
                   </button>
                </div>
                
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  {tracks.map((track) => {
                    const Icon = track.icon;
                    const hasActiveCollab = activeSessionUsers.find(c => c.activeTrack === track.id);
                    const isDeviceRackOpen = bottomDock?.type === 'devices' && bottomDock?.trackId === track.id;
                    
                    return (
                      <div key={track.id} className={`h-24 border-b border-neutral-800 flex flex-col p-2 transition-colors group relative ${isDeviceRackOpen ? 'bg-neutral-800/70' : 'hover:bg-neutral-800/50'}`}>
                        {hasActiveCollab && <div className={`absolute left-0 top-0 bottom-0 w-1 ${hasActiveCollab.color}`} />}

                        <div className="flex items-center justify-between mb-2 pl-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded flex items-center justify-center ${track.color} text-white/90 shadow-sm shrink-0`}><Icon size={12} /></div>
                            {editingTrackId === track.id ? (
                              <input 
                                autoFocus onBlur={() => setEditingTrackId(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingTrackId(null)}
                                onChange={(e) => setTracks(prev => prev.map(t => t.id === track.id ? { ...t, name: e.target.value } : t))}
                                value={track.name}
                                className="text-sm font-medium bg-neutral-950 text-white w-[100px] border border-neutral-700 rounded px-1 outline-none"
                              />
                            ) : (
                              <span onDoubleClick={() => setEditingTrackId(track.id)} className="text-sm text-neutral-200 font-medium truncate w-[100px] cursor-text" title="Double-click to rename">{track.name}</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {track.type === 'midi' && (
                               <button 
                                 onClick={() => setOpenPluginUI({ trackId: track.id, isEffect: false })}
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
                            <button onClick={() => toggleMute(track.id)} className={`w-6 h-6 rounded text-xs font-bold transition-all ${track.muted ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300 border border-transparent'}`}>M</button>
                            <button onClick={() => toggleSolo(track.id)} className={`w-6 h-6 rounded text-xs font-bold transition-all ${track.solo ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300 border border-transparent'}`}>S</button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 px-2 mt-auto pb-1">
                          <Volume2 size={12} className="text-neutral-500" />
                          <input type="range" min="0" max="100" value={track.volume} onChange={(e) => handleVolumeChange(track.id, e.target.value)} className="w-full h-1.5 bg-neutral-950 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-neutral-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-white cursor-pointer" />
                          <div className="w-8 flex justify-end"><span className="text-[10px] text-neutral-500 font-mono">{track.volume}</span></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Arrangement View / Timeline (Right Pane) */}
              <div className="flex-1 bg-neutral-900 relative flex flex-col overflow-hidden">
                <div className="h-8 bg-neutral-950 border-b border-neutral-800 flex relative overflow-hidden shrink-0 cursor-pointer hover:bg-neutral-900 transition-colors" onMouseDown={handleTimelineClick}>
                   {Array.from({ length: 32 }).map((_, i) => (
                     <div key={i} className="absolute h-full flex items-end border-l border-neutral-800/50 pl-1 text-[10px] text-neutral-600 font-mono select-none pointer-events-none" style={{ left: `${i * BEAT_WIDTH}px`, width: `${BEAT_WIDTH}px` }}>{i % 4 === 0 ? (i / 4) + 1 : ''}</div>
                   ))}
                </div>

                <div className="flex-1 overflow-auto relative custom-scrollbar cursor-text" onMouseDown={handleTimelineClick}>
                  <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundSize: `${BEAT_WIDTH}px 100%`, backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px)' }} />
                  <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundSize: `${BEAT_WIDTH * 4}px 100%`, backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px)' }} />

                  <div className="absolute top-0 bottom-0 w-px bg-blue-500 z-30 pointer-events-none flex justify-center shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ left: `${currentTime * BEAT_WIDTH}px`, transition: isPlaying ? 'none' : 'left 0.1s' }}>
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-blue-500 absolute -top-0" />
                  </div>

                  {tracks.map((track) => (
                    <div key={track.id} className="h-24 border-b border-neutral-800/50 relative z-10 w-[2048px]" onDoubleClick={(e) => handleTrackLaneDoubleClick(e, track)}>
                      {track.clips.map(clip => (
                        <div 
                          key={clip.id}
                          onMouseDown={(e) => handleClipMouseDown(e, track.id, clip)}
                          onDoubleClick={(e) => { e.stopPropagation(); setBottomDock({type: track.type === 'audio' ? 'audio-editor' : 'piano-roll', trackId: track.id, clipId: clip.id}); }}
                          className={`absolute top-2 bottom-2 rounded-md border border-white/20 shadow-sm overflow-hidden group cursor-grab active:cursor-grabbing hover:brightness-110 transition-all ${track.color} ${track.muted ? 'opacity-40 grayscale' : 'opacity-90'}`}
                          style={{ left: `${clip.start * BEAT_WIDTH}px`, width: `${clip.duration * BEAT_WIDTH}px`, transition: draggingClip?.clipId === clip.id ? 'none' : 'left 0.1s, width 0.1s' }}
                        >
                          <button onClick={(e) => handleDeleteClip(e, track.id, clip.id)} className="absolute top-1 right-1 p-0.5 bg-black/40 text-white/70 hover:text-white rounded opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all z-20" title="Delete Clip"><X size={10} /></button>

                          <div className="absolute inset-x-0 bottom-1 top-5 opacity-90 flex items-center justify-center px-1 pointer-events-none">
                            {track.type === 'audio' ? (
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
                            ) : (
                              clip.notes ? clip.notes.map(n => (
                                <div key={n.id} className="absolute bg-white/90 rounded-[2px] shadow-sm border border-black/30" style={{ bottom: `${Math.max(5, Math.min(80, ((n.pitch - 36) / 36) * 100))}%`, left: `${(n.start / clip.duration) * 100}%`, width: `${(n.duration / clip.duration) * 100}%`, height: '15%', opacity: track.volume / 100 }} />
                              )) : null
                            )}
                          </div>
                          
                          <div className="absolute top-0 left-0 right-0 h-5 bg-black/20 flex items-center px-2 text-[10px] text-white/90 font-medium truncate pointer-events-none border-b border-black/10">{track.name} Clip</div>
                          <div data-edge="true" onMouseDown={(e) => handleClipEdgeMouseDown(e, track.id, clip, 'left')} className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize z-30 hover:bg-white/30" title="Drag to resize" />
                          <div data-edge="true" onMouseDown={(e) => handleClipEdgeMouseDown(e, track.id, clip, 'right')} className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize z-30 hover:bg-white/30" title="Drag to resize" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* --- BOTTOM DOCK PANELS --- */}
            {bottomDock?.type === 'devices' && (() => {
              const track = tracks.find(t => t.id === bottomDock.trackId);
              if (!track) return null;
              return (
                <div className="h-[35vh] bg-neutral-900 border-t border-neutral-800 flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-40 shrink-0">
                  <div className="h-10 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0">
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
                     <div className="w-56 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col overflow-hidden shrink-0 shadow-sm h-full max-h-48">
                       <div className="h-8 bg-neutral-800/50 border-b border-neutral-800 flex items-center justify-between px-3">
                         <span className="font-semibold text-xs text-white">Source Generator</span>
                       </div>
                       <div className="p-4 flex-1 flex flex-col items-center justify-center text-neutral-500">
                         {track.type === 'midi' ? (
                           track.instrument === 'drum' ? <Radio size={24} className="mb-2 opacity-50"/> : <Music size={24} className="mb-2 opacity-50"/>
                         ) : (
                           <Mic size={24} className="mb-2 opacity-50"/>
                         )}
                         
                         {track.type === 'midi' ? (
                           <>
                             <select 
                               value={track.instrument || 'synth'}
                               onChange={(e) => handleInstrumentChange(track.id, e.target.value)}
                               className="bg-neutral-800 text-xs text-white px-2 py-1.5 rounded border border-neutral-700 outline-none hover:border-neutral-500 cursor-pointer max-w-full"
                             >
                               <optgroup label="Built-in Engines">
                                 <option value="synth">Analog Synth</option>
                                 <option value="drum">Drum Machine</option>
                               </optgroup>
                               <optgroup label="Downloaded VSTs">
                                 {vstLibrary.filter(v => v.category === 'instrument').map(vst => (
                                   <option key={vst.id} value={vst.id}>{vst.name}</option>
                                 ))}
                               </optgroup>
                             </select>
                           </>
                         ) : (
                           <span className="text-xs">Audio Clip Input</span>
                         )}
                         {track.type === 'audio' && <span className="text-[9px] mt-2 text-neutral-600">(Core Engine)</span>}
                       </div>
                     </div>
                     
                     {/* Dynamic VST Effects Chain */}
                     {track.effects?.map((fx, idx) => (
                       <div key={fx.id} className="w-56 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col overflow-hidden shrink-0 shadow-sm h-full max-h-48 relative group">
                         {/* Chain flow indicator */}
                         <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-4 h-0.5 bg-neutral-700" />
                         
                         <div className="h-8 bg-neutral-800/50 border-b border-neutral-800 flex items-center justify-between px-3">
                            <span className="font-semibold text-xs text-white flex items-center gap-1.5 truncate pr-2"><Activity size={10} className="text-blue-400 shrink-0"/> {fx.name || fx.type}</span>
                            <div className="flex items-center gap-1 shrink-0">
                               <button onClick={() => setOpenPluginUI({ trackId: track.id, isEffect: true, fxId: fx.id })} className="text-neutral-400 hover:text-white p-0.5" title="Open Effect GUI"><Maximize2 size={12}/></button>
                               <button className="text-green-400 hover:text-green-300 p-0.5"><Power size={12}/></button>
                               <button onClick={() => handleRemoveEffect(track.id, fx.id)} className="text-neutral-500 hover:text-red-400 p-0.5"><Trash2 size={12}/></button>
                            </div>
                         </div>
                         <div className="p-4 flex-1 grid grid-cols-2 gap-y-4 gap-x-4">
                            {Object.entries(fx.params).map(([key, value]) => (
                               <div key={key} className="flex flex-col items-center">
                                 <span className="text-[9px] text-neutral-400 uppercase mb-2 font-mono tracking-wider">{key}</span>
                                 <input 
                                   type="range" 
                                   min={key === 'freq' ? 20 : 0} 
                                   max={key === 'freq' ? 20000 : (key === 'time' ? 1 : (key === 'amount' ? 100 : (key === 'res' ? 10 : 1)))} 
                                   step={key === 'freq' ? 1 : 0.01}
                                   value={value} 
                                   onChange={(e) => handleEffectParamChange(track.id, fx.id, key, e.target.value)}
                                   className="w-full h-1 bg-neutral-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-white cursor-pointer"
                                 />
                                 <span className="text-[8px] text-neutral-600 font-mono mt-1">{value}</span>
                               </div>
                            ))}
                         </div>
                       </div>
                     ))}
                     
                     {/* Add Effect Interactive Dropdown */}
                     <div className="relative shrink-0 h-full max-h-48 ml-2 flex flex-col">
                        <div onClick={() => setShowAddFxMenu(showAddFxMenu === track.id ? null : track.id)} className="w-32 flex-1 border border-dashed border-neutral-700 rounded-lg flex flex-col items-center justify-center text-neutral-500 hover:text-white hover:border-neutral-500 hover:bg-neutral-800/30 transition-all cursor-pointer">
                           <Plus size={20} className="mb-2" />
                           <span className="text-xs font-medium">Add Effect</span>
                        </div>
                        {showAddFxMenu === track.id && (
                           <>
                             {/* Transparent overlay to capture click outside */}
                             <div className="fixed inset-0 z-40" onClick={() => setShowAddFxMenu(null)} />
                             <div className="absolute bottom-full mb-2 left-0 w-56 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-150">
                               <div className="px-3 py-2 bg-neutral-900 border-b border-neutral-700 text-xs font-semibold text-neutral-400 flex items-center gap-2">
                                  <Folder size={12} /> Select Plugin From Library
                               </div>
                               <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                 {vstLibrary.filter(v => v.category === 'effect').map(vst => (
                                    <button 
                                      key={vst.id} 
                                      onClick={() => { handleAddEffect(track.id, vst); setShowAddFxMenu(null); }} 
                                      className="w-full text-left px-3 py-2.5 text-xs text-white hover:bg-blue-600 transition-colors border-b border-neutral-700/50 last:border-0 flex items-center justify-between"
                                    >
                                       <span className="font-medium">{vst.name}</span>
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
                    <div className="h-10 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0">
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

              return (
                <div className="h-[40vh] bg-neutral-900 border-t border-neutral-800 flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-40 shrink-0">
                  <div className="h-10 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-sm ${track.color}`} />
                        <span className="text-xs font-semibold text-white">{track.name} - Clip Editor</span>
                      </div>
                      <div className="w-px h-4 bg-neutral-800" />
                      <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
                        <button onClick={() => setEditorTool('select')} className={`p-1.5 rounded-md transition-colors ${editorTool === 'select' ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}><MousePointer2 size={14} /></button>
                        <button onClick={() => setEditorTool('draw')} className={`p-1.5 rounded-md transition-colors ${editorTool === 'draw' ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}><Pencil size={14} /></button>
                        <button onClick={() => setEditorTool('erase')} className={`p-1.5 rounded-md transition-colors ${editorTool === 'erase' ? 'bg-red-500/20 text-red-400' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}><Eraser size={14} /></button>
                      </div>
                      <div className="w-px h-4 bg-neutral-800" />
                      <button className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-400 hover:text-white transition-colors rounded hover:bg-neutral-800"><Grid size={12} /><span>1/16 Snap</span></button>
                    </div>
                    <button onClick={() => setBottomDock(null)} className="p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors" title="Close Editor"><X size={16} /></button>
                  </div>

                  <div className="flex-1 flex overflow-hidden relative">
                    <div className="w-16 flex flex-col bg-neutral-950 border-r border-neutral-800 shrink-0 z-20 overflow-y-hidden pt-8">
                       {pitches.map(p => {
                          const isBlack = [1, 3, 6, 8, 10].includes(p % 12);
                          return <div key={p} className={`border-b border-neutral-800 ${isBlack ? 'bg-neutral-900 text-transparent' : 'bg-neutral-200 text-neutral-600'} text-[9px] font-bold flex items-center justify-end pr-1 select-none`} style={{height: `${PITCH_HEIGHT}px`}}>{p % 12 === 0 ? `C${Math.floor(p/12)-1}` : ''}</div>
                       })}
                    </div>
                    
                    <div className="flex-1 flex flex-col overflow-auto relative custom-scrollbar">
                       <div className="h-8 bg-neutral-950 border-b border-neutral-800 sticky top-0 z-30 flex min-w-max">
                         {Array.from({ length: Math.max(clip.duration, 8) }).map((_, i) => (
                           <div key={i} className="h-full flex items-end border-l border-neutral-800/50 pl-1 text-[10px] text-neutral-600 font-mono select-none" style={{ width: `${BEAT_WIDTH}px` }}>{i + 1}</div>
                         ))}
                       </div>
                       
                       <div className={`relative min-w-max ${editorTool === 'draw' ? 'cursor-crosshair' : editorTool === 'erase' ? 'cursor-cell' : 'cursor-text'}`} style={{ height: `${pitches.length * PITCH_HEIGHT}px`, width: `${Math.max(clip.duration, 8) * BEAT_WIDTH}px`}} onMouseDown={(e) => handleGridMouseDown(e, track.id, clip.id)}>
                          {pitches.map((p, i) => <div key={p} className={`absolute left-0 right-0 border-b pointer-events-none ${[1, 3, 6, 8, 10].includes(p % 12) ? 'bg-black/20 border-neutral-800/30' : 'border-neutral-800/60'}`} style={{top: `${i * PITCH_HEIGHT}px`, height: `${PITCH_HEIGHT}px`}} />)}
                          {Array.from({length: Math.max(clip.duration, 8) * 4}).map((_, i) => <div key={i} className={`absolute top-0 bottom-0 border-r pointer-events-none ${i % 4 === 0 ? 'border-neutral-700/50' : 'border-neutral-800/30'}`} style={{left: `${i * (BEAT_WIDTH/4)}px`, width: `${BEAT_WIDTH/4}px`}} />)}
                          {clip.notes?.map(note => (
                             <div key={note.id} onMouseDown={(e) => handleNoteMouseDown(e, track.id, clip.id, note)}
                               className={`absolute rounded-sm border border-white/40 shadow-sm ${track.color} hover:brightness-125 transition-brightness ${draggingNote?.noteId === note.id ? 'opacity-80 z-50' : 'opacity-100 z-10'} ${editorTool === 'select' ? 'cursor-grab active:cursor-grabbing' : editorTool === 'erase' ? 'cursor-cell' : 'cursor-crosshair'}`}
                               style={{ left: `${note.start * BEAT_WIDTH}px`, top: `${(PITCH_MAX - note.pitch) * PITCH_HEIGHT}px`, width: `${note.duration * BEAT_WIDTH}px`, height: `${PITCH_HEIGHT - 1}px`, transition: draggingNote?.noteId === note.id ? 'none' : 'left 0.1s, top 0.1s' }}
                             />
                          ))}
                       </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <footer className="h-6 bg-blue-600 flex items-center justify-between px-4 text-[10px] text-white font-medium tracking-wide shrink-0">
        <div className="flex gap-4">
          <span>SAMPLE RATE: 44.1kHz</span>
          <span>BUFFER: 256smp</span>
        </div>
        <div className="flex items-center gap-2"><span className="flex items-center gap-1"><Maximize2 size={10} /> Sync: Connected to 'Studio-A'</span></div>
      </footer>

      {/* --- Auth Modal --- */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
              <h2 className="text-lg font-semibold text-white">{authMode === 'signin' ? 'Sign In to WebDAW' : 'Create an Account'}</h2>
              <button onClick={() => setShowAuthModal(false)} className="text-neutral-500 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleAuthSubmit} className="p-6 flex flex-col gap-4">
              {authMessage && (
                <div className={`text-xs text-center p-2.5 rounded font-medium ${authMessage.includes('Waiting') || authMessage.includes('pending') ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
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
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" 
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
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" 
                  placeholder="••••••••" 
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg mt-2 transition-colors shadow-lg shadow-blue-500/20">
                {authMode === 'signin' ? 'Sign In' : 'Register'}
              </button>
              <div className="text-center mt-2">
                <button type="button" onClick={() => { setAuthMode(authMode === 'signin' ? 'register' : 'signin'); setAuthMessage(''); }} className="text-xs text-neutral-500 hover:text-blue-400 transition-colors">
                  {authMode === 'signin' ? "Don't have an account? Register" : "Already have an account? Sign In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Admin Management Modal --- */}
      {showAdminModal && currentUser?.role === 'admin' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
              <h2 className="text-lg font-semibold text-white">Manage Team Access</h2>
              <button onClick={() => setShowAdminModal(false)} className="text-neutral-500 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {usersDb.filter(u => u.id !== currentUser.id).length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-4">No other users have registered yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {usersDb.filter(u => u.id !== currentUser.id).map(u => (
                    <div key={u.id} className="flex items-center justify-between bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold ${u.color}`}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">{u.name}</span>
                          <span className={`text-[10px] font-mono uppercase tracking-wider ${u.status === 'pending' ? 'text-yellow-500' : 'text-green-500'}`}>
                            {u.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.status === 'pending' && (
                          <button 
                            onClick={() => setUsersDb(prev => prev.map(user => user.id === u.id ? { ...user, status: 'approved' } : user))}
                            className="text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 px-3 py-1.5 rounded transition-colors font-medium"
                          >
                            Approve
                          </button>
                        )}
                        {u.status === 'approved' && (
                          <button 
                            onClick={() => {
                              setUsersDb(prev => prev.map(user => user.id === u.id ? { ...user, status: 'pending' } : user));
                              setActiveSessionUsers(prev => prev.filter(user => user.id !== u.id));
                            }}
                            className="text-xs bg-neutral-800 text-neutral-400 hover:text-white px-3 py-1.5 rounded transition-colors font-medium"
                          >
                            Revoke
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setUsersDb(prev => prev.filter(user => user.id !== u.id));
                            setActiveSessionUsers(prev => prev.filter(user => user.id !== u.id));
                          }}
                          className="text-neutral-500 hover:text-red-400 p-1.5 transition-colors" title="Delete User"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Unified Plugin GUI Modal --- */}
      {openPluginUI && (() => {
        const track = tracks.find(t => t.id === openPluginUI.trackId);
        if (!track) return null;
        
        let pluginName = '';
        let pluginId = '';
        let pluginUrl = '';
        
        if (openPluginUI.isEffect) {
          const fx = track.effects.find(e => e.id === openPluginUI.fxId);
          if (!fx) return null;
          pluginName = fx.name || fx.type;
          pluginId = fx.type; 
          pluginUrl = vstLibrary.find(v => v.name === fx.name)?.url;
        } else {
          pluginName = vstLibrary.find(v => v.id === track.instrument)?.name || (track.instrument === 'drum' ? 'Drum Machine' : 'Analog Synth');
          pluginId = track.instrument;
          pluginUrl = vstLibrary.find(v => v.id === track.instrument)?.url;
        }
        
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-800 border border-neutral-600 rounded-xl w-[700px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              
              <div className="h-10 bg-neutral-900 border-b border-neutral-700 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]" title="Plugin Active" />
                  <span className="text-sm font-bold text-neutral-200 tracking-wide uppercase">{pluginName}</span>
                  <span className="bg-neutral-800 px-1.5 py-0.5 rounded text-[9px] text-neutral-400 border border-neutral-700 ml-1">
                    {openPluginUI.isEffect ? 'EFFECT VST' : 'INSTRUMENT VSTi'}
                  </span>
                </div>
                <button onClick={() => setOpenPluginUI(null)} className="text-neutral-400 hover:text-white transition-colors"><X size={16} /></button>
              </div>
              
              <div className="flex flex-col min-h-[400px] h-full bg-neutral-950">
                {!openPluginUI.isEffect && track.instrument === 'synth' ? (
                  <div className="flex gap-6 h-full p-6 bg-gradient-to-b from-neutral-800 to-neutral-900">
                    <div className="flex-1 bg-neutral-950/50 rounded-lg border border-neutral-700/50 p-4 flex flex-col items-center">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4">Oscillator</h4>
                       <select 
                         value={track.instrumentParams?.oscType || 'sawtooth'} 
                         onChange={(e) => handleInstrumentParamChange(track.id, 'oscType', e.target.value)}
                         className="bg-neutral-800 border border-neutral-600 text-white text-sm rounded px-3 py-2 outline-none cursor-pointer w-full mb-4"
                       >
                         <option value="sawtooth">Sawtooth</option>
                         <option value="square">Square Wave</option>
                         <option value="sine">Sine Wave</option>
                         <option value="triangle">Triangle</option>
                       </select>
                       <div className="mt-auto w-full h-16 bg-neutral-900 rounded border border-neutral-800 flex items-center justify-center overflow-hidden">
                         <svg className="w-full h-8 text-purple-500" viewBox="0 0 100 20" preserveAspectRatio="none">
                           {track.instrumentParams?.oscType === 'sawtooth' && <polyline fill="none" stroke="currentColor" strokeWidth="2" points="0,20 50,0 50,20 100,0" />}
                           {(!track.instrumentParams?.oscType || track.instrumentParams?.oscType === 'square') && <polyline fill="none" stroke="currentColor" strokeWidth="2" points="0,0 50,0 50,20 100,20" />}
                           {track.instrumentParams?.oscType === 'sine' && <path fill="none" stroke="currentColor" strokeWidth="2" d="M0,10 Q25,-10 50,10 T100,10" />}
                           {track.instrumentParams?.oscType === 'triangle' && <polyline fill="none" stroke="currentColor" strokeWidth="2" points="0,10 25,0 75,20 100,10" />}
                         </svg>
                       </div>
                    </div>
                    <div className="flex-1 bg-neutral-950/50 rounded-lg border border-neutral-700/50 p-4 flex flex-col items-center">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4">Filter (VCF)</h4>
                       <div className="w-full flex flex-col gap-6">
                         <div className="flex flex-col items-center group">
                           <span className="text-[9px] text-neutral-400 mb-1">CUTOFF ({track.instrumentParams?.filterCutoff || 2000}Hz)</span>
                           <input type="range" min="100" max="8000" value={track.instrumentParams?.filterCutoff || 2000} onChange={(e) => handleInstrumentParamChange(track.id, 'filterCutoff', Number(e.target.value))} className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
                         </div>
                         <div className="flex flex-col items-center group">
                           <span className="text-[9px] text-neutral-400 mb-1">RESONANCE</span>
                           <input type="range" min="0.1" max="10" step="0.1" value={track.instrumentParams?.filterRes || 1.5} onChange={(e) => handleInstrumentParamChange(track.id, 'filterRes', Number(e.target.value))} className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
                         </div>
                       </div>
                    </div>
                  </div>
                ) : !openPluginUI.isEffect && track.instrument === 'drum' ? (
                  <div className="flex flex-col h-full bg-gradient-to-b from-neutral-800 to-neutral-900 p-6">
                     <div className="flex-1 bg-neutral-950/50 rounded-lg border border-neutral-700/50 p-4 flex flex-col">
                       <h4 className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold mb-4 text-center">Drum Synthesizer</h4>
                       <div className="flex justify-around flex-1 items-end pb-4">
                         <div className="flex flex-col items-center gap-3 w-20">
                           <div className="text-[10px] font-bold text-white bg-neutral-800 px-2 py-1 rounded w-full text-center">KICK</div>
                           <span className="text-[9px] text-neutral-500 font-mono">TUNE</span>
                           <input type="range" min="50" max="300" orient="vertical" value={track.instrumentParams?.kickPitch || 150} onChange={(e) => handleInstrumentParamChange(track.id, 'kickPitch', Number(e.target.value))} className="h-24 w-full appearance-none bg-transparent cursor-pointer relative z-10" style={{ WebkitAppearance: 'slider-vertical' }} />
                           <div className="w-8 h-8 rounded bg-orange-500/20 border-2 border-orange-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.2)]"><Radio size={14} className="text-orange-500"/></div>
                         </div>
                         <div className="flex flex-col items-center gap-3 w-20">
                           <div className="text-[10px] font-bold text-white bg-neutral-800 px-2 py-1 rounded w-full text-center">SNARE</div>
                           <span className="text-[9px] text-neutral-500 font-mono">DECAY</span>
                           <input type="range" min="0.05" max="0.6" step="0.01" orient="vertical" value={track.instrumentParams?.snareDecay || 0.2} onChange={(e) => handleInstrumentParamChange(track.id, 'snareDecay', Number(e.target.value))} className="h-24 w-full appearance-none bg-transparent cursor-pointer relative z-10" style={{ WebkitAppearance: 'slider-vertical' }} />
                           <div className="w-8 h-8 rounded bg-orange-500/20 border-2 border-orange-500/50 flex items-center justify-center"><Radio size={14} className="text-orange-500"/></div>
                         </div>
                       </div>
                     </div>
                  </div>
                ) : (
                  <WamHostWrapper pluginId={pluginId} pluginName={pluginName} pluginUrl={pluginUrl} audioCtx={audioCtxRef.current} />
                )}
                
              </div>
            </div>
          </div>
        );
      })()}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 12px; height: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #171717; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #404040; border-radius: 6px; border: 3px solid #171717; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #525252; }
      `}} />
    </div>
  );
}