import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  Send,
  Volume2,
  Wrench,
  X,
} from 'lucide-react';
import {
  ARENA_CATALOG,
  ARMOR_CATALOG,
  CHASSIS_CATALOG,
  generateRandomBotName,
  getBotWeapons,
  WEAPON_CATALOG,
  type ArenaId,
  type ArmorId,
  type BotConfig,
  type ChassisId,
  type WeaponId,
} from '../shared/types';

export type StudioLightingPreset = 'arena' | 'cyber_neon' | 'golden_forge' | 'cryo_lab';

export interface LiveVoiceCopilotProps {
  open: boolean;
  onClose: () => void;
  botConfig: BotConfig;
  selectedArena: ArenaId;
  sceneMode: 'workshop' | 'combat';
  onUpdateBotConfig: (next: BotConfig) => void;
  onSelectArena: (arenaId: ArenaId) => void;
  onSetExplodedRatio: (ratio: number) => void;
  onSetLightingPreset: (preset: StudioLightingPreset) => void;
  onStartLocalBattle: (mode: 'practice' | 'duel_1v1' | 'brawl_4bot' | 'survival') => void;
}

type VoicePersona = 'engineer' | 'rex' | 'kira';

interface TranscriptTurn {
  id: string;
  role: 'user' | 'model' | 'tool';
  speakerLabel: string;
  text: string;
}

function float32ToPcm16Base64(float32: Float32Array): string {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function pcm16Base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const byteLen = binary.length - (binary.length % 2);
  const bytes = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768;
  }
  return float32;
}

export const LiveVoiceCopilot: React.FC<LiveVoiceCopilotProps> = ({
  open,
  onClose,
  botConfig,
  selectedArena,
  sceneMode,
  onUpdateBotConfig,
  onSelectArena,
  onSetExplodedRatio,
  onSetLightingPreset,
  onStartLocalBattle,
}) => {
  const [persona, setPersona] = useState<VoicePersona>('engineer');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [micMuted, setMicMuted] = useState(false);
  const [modelSpeaking, setModelSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [textInput, setTextInput] = useState('');

  // Keep latest callbacks & state in refs so audio/WebSocket closures are never stale
  const wsRef = useRef<WebSocket | null>(null);
  const micMutedRef = useRef(micMuted);
  micMutedRef.current = micMuted;

  const botConfigRef = useRef(botConfig);
  botConfigRef.current = botConfig;
  const updateBotRef = useRef(onUpdateBotConfig);
  updateBotRef.current = onUpdateBotConfig;
  const selectArenaRef = useRef(onSelectArena);
  selectArenaRef.current = onSelectArena;
  const setExplodeRef = useRef(onSetExplodedRatio);
  setExplodeRef.current = onSetExplodedRatio;
  const setLightingRef = useRef(onSetLightingPreset);
  setLightingRef.current = onSetLightingPreset;
  const startBattleRef = useRef(onStartLocalBattle);
  startBattleRef.current = onStartLocalBattle;

  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopOutputPlayback = useCallback(() => {
    scheduledSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore already stopped source
      }
    });
    scheduledSourcesRef.current.clear();
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    setModelSpeaking(false);
  }, []);

  const disconnectSession = useCallback(() => {
    stopOutputPlayback();
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch {
        // Ignore
      }
      scriptProcessorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore
      }
      wsRef.current = null;
    }
    setStatus('idle');
    setModelSpeaking(false);
  }, [stopOutputPlayback]);

  useEffect(() => {
    return () => {
      disconnectSession();
    };
  }, [disconnectSession]);

  const schedulePcmPlayback = useCallback((base64Pcm: string) => {
    let outCtx = outputAudioCtxRef.current;
    if (!outCtx) {
      outCtx = new AudioContext({ sampleRate: 24000 });
      outputAudioCtxRef.current = outCtx;
    }
    if (outCtx.state === 'suspended') {
      outCtx.resume().catch(() => {});
    }

    const floatSamples = pcm16Base64ToFloat32(base64Pcm);
    if (floatSamples.length === 0) return;

    const audioBuffer = outCtx.createBuffer(1, floatSamples.length, 24000);
    audioBuffer.getChannelData(0).set(floatSamples);

    const source = outCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outCtx.destination);

    const now = outCtx.currentTime;
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now + 0.02;
    }
    const startAt = nextStartTimeRef.current;
    nextStartTimeRef.current += audioBuffer.duration;

    scheduledSourcesRef.current.add(source);
    setModelSpeaking(true);
    source.onended = () => {
      scheduledSourcesRef.current.delete(source);
      if (scheduledSourcesRef.current.size === 0) {
        setModelSpeaking(false);
      }
    };
    source.start(startAt);
  }, []);

  const appendOrMergeTurn = useCallback(
    (role: 'user' | 'model' | 'tool', speakerLabel: string, chunkText: string) => {
      if (!chunkText) return;
      setTurns((prev) => {
        if (role !== 'tool' && prev.length > 0 && prev[prev.length - 1].role === role) {
          const last = prev[prev.length - 1];
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              text: `${last.text}${chunkText}`,
            },
          ];
        }
        return [
          ...prev.slice(-18),
          {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            role,
            speakerLabel,
            text: chunkText,
          },
        ];
      });
    },
    [],
  );

  const handleVoiceToolCall = useCallback(
    (name: string, args: Record<string, unknown>) => {
      if (name === 'configureBotLoadout') {
        const cur = { ...botConfigRef.current };
        const applied: string[] = [];

        if (typeof args.weapon === 'string' && args.weapon in WEAPON_CATALOG) {
          const wId = args.weapon as WeaponId;
          const existing = getBotWeapons(cur).filter((w) => w !== wId);
          const nextWeapons = [wId, ...existing].slice(0, 3);
          cur.weapon = nextWeapons[0];
          cur.weapons = nextWeapons;
          applied.push(`Equipped ${WEAPON_CATALOG[wId].label}`);
        }
        if (typeof args.chassis === 'string' && args.chassis in CHASSIS_CATALOG) {
          const cId = args.chassis as ChassisId;
          cur.chassis = cId;
          cur.chassisStyles = [cId];
          applied.push(`Chassis → ${CHASSIS_CATALOG[cId].label}`);
        }
        if (typeof args.armor === 'string' && args.armor in ARMOR_CATALOG) {
          const aId = args.armor as ArmorId;
          cur.armor = aId;
          applied.push(`Armor → ${ARMOR_CATALOG[aId].label}`);
        }
        if (args.randomizeName) {
          cur.name = generateRandomBotName();
          applied.push(`Renamed to "${cur.name}"`);
        }

        if (applied.length > 0) {
          updateBotRef.current(cur);
          appendOrMergeTurn('tool', '3D HANGAR LINK', applied.join(' · '));
        }
      } else if (name === 'controlThreeScene') {
        const applied: string[] = [];
        if (typeof args.explodedRatio === 'number') {
          const clamped = Math.max(0, Math.min(1, args.explodedRatio));
          setExplodeRef.current(clamped);
          applied.push(`3D Exploded View → ${Math.round(clamped * 100)}%`);
        }
        if (
          typeof args.lightingPreset === 'string' &&
          ['arena', 'cyber_neon', 'golden_forge', 'cryo_lab'].includes(args.lightingPreset)
        ) {
          setLightingRef.current(args.lightingPreset as StudioLightingPreset);
          applied.push(`Studio Lighting → ${args.lightingPreset}`);
        }
        if (typeof args.arenaId === 'string' && args.arenaId in ARENA_CATALOG) {
          const aId = args.arenaId as ArenaId;
          selectArenaRef.current(aId);
          applied.push(`Arena → ${ARENA_CATALOG[aId].name}`);
        }
        if (
          typeof args.startBattleMode === 'string' &&
          ['practice', 'duel_1v1', 'brawl_4bot', 'survival'].includes(args.startBattleMode)
        ) {
          const m = args.startBattleMode as 'practice' | 'duel_1v1' | 'brawl_4bot' | 'survival';
          applied.push(`Launching ${m.toUpperCase()} Battle`);
          startBattleRef.current(m);
        }
        if (applied.length > 0) {
          appendOrMergeTurn('tool', '3D SCENE ENGINE', applied.join(' · '));
        }
      }
    },
    [appendOrMergeTurn],
  );

  const startLiveSession = useCallback(
    async (selectedPersona: VoicePersona = persona) => {
      disconnectSession();
      setErrorMsg(null);
      setStatus('connecting');

      const weaponsLabel = getBotWeapons(botConfigRef.current)
        .map((w) => WEAPON_CATALOG[w]?.label || w)
        .join(', ');
      const arenaLabel = ARENA_CATALOG[selectedArena]?.name || selectedArena;
      const contextSummary = `Bot "${botConfigRef.current.name}", Chassis: ${botConfigRef.current.chassis}, Armor: ${botConfigRef.current.armor}, Weapons: [${weaponsLabel}], Arena: ${arenaLabel}, Mode: ${sceneMode}`;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;

        const inputCtx = new AudioContext({ sampleRate: 16000 });
        inputAudioCtxRef.current = inputCtx;
        const outputCtx = new AudioContext({ sampleRate: 24000 });
        outputAudioCtxRef.current = outputCtx;
        nextStartTimeRef.current = outputCtx.currentTime;

        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const qs = new URLSearchParams({
          persona: selectedPersona,
          context: contextSummary,
        });
        const ws = new WebSocket(`${proto}//${window.location.host}/live-voice?${qs.toString()}`);
        wsRef.current = ws;

        const speakerTitle =
          selectedPersona === 'rex'
            ? 'REX VANCE (HOST)'
            : selectedPersona === 'kira'
              ? 'KIRA VOLT (ANALYST)'
              : 'CHIEF ENGINEER ORION';

        ws.onopen = () => {
          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (micMutedRef.current) return;
            const socket = wsRef.current;
            if (!socket || socket.readyState !== WebSocket.OPEN) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const base64Audio = float32ToPcm16Base64(inputData);
            socket.send(JSON.stringify({ audio: base64Audio }));
          };

          source.connect(processor);
          processor.connect(inputCtx.destination);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as {
              type: string;
              audio?: string;
              text?: string;
              error?: string;
              name?: string;
              args?: Record<string, unknown>;
            };

            if (msg.type === 'ready') {
              setStatus('connected');
              setTurns([
                {
                  id: `init_${Date.now()}`,
                  role: 'tool',
                  speakerLabel: 'LIVE VOICE LINK ACTIVE',
                  text: `Connected to ${speakerTitle} via Gemini 3.8 Live (16kHz Mic / 24kHz Neural Audio). Speak naturally or ask to customize your 3D bot & scene!`,
                },
              ]);
            } else if (msg.type === 'audio' && msg.audio) {
              schedulePcmPlayback(msg.audio);
            } else if (msg.type === 'interrupted') {
              stopOutputPlayback();
            } else if (msg.type === 'input_transcript' && msg.text) {
              appendOrMergeTurn('user', 'YOU (PILOT)', msg.text);
            } else if (msg.type === 'output_transcript' && msg.text) {
              appendOrMergeTurn('model', speakerTitle, msg.text);
            } else if (msg.type === 'tool_call' && msg.name) {
              handleVoiceToolCall(msg.name, msg.args || {});
            } else if (msg.type === 'error') {
              setErrorMsg(msg.error || 'Live voice session encountered an error.');
              setStatus('error');
            }
          } catch {
            // Ignore malformed message
          }
        };

        ws.onerror = () => {
          setErrorMsg('WebSocket connection error while linking to Gemini Live Voice.');
          setStatus('error');
        };

        ws.onclose = () => {
          setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Microphone permission is required for real-time voice conversation.';
        setErrorMsg(message);
        setStatus('error');
      }
    },
    [
      persona,
      selectedArena,
      sceneMode,
      disconnectSession,
      schedulePcmPlayback,
      stopOutputPlayback,
      appendOrMergeTurn,
      handleVoiceToolCall,
    ],
  );

  const handleSendTextTurn = (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const raw = (overrideText ?? textInput).trim();
    if (!raw) return;
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    appendOrMergeTurn('user', 'YOU (PILOT)', raw);
    socket.send(JSON.stringify({ text: raw }));
    if (!overrideText) setTextInput('');
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Gemini 3.8 Live Real-Time Voice Copilot"
      className="fixed right-4 bottom-20 z-50 w-[min(420px,94vw)] overflow-hidden rounded-2xl border border-sky-500/50 bg-[#0D1118] text-slate-100 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-[#121824] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/40 bg-sky-500/15 text-sky-300">
            <Radio className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-extrabold tracking-tight text-white">
                Real-Time Voice Comms
              </span>
              <span className="rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold text-sky-300">
                gemini-3.8-live
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Low-latency two-way voice conversation & 3D voice commands
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Minimize Live Voice Comms"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Persona Selector */}
      <div className="border-b border-slate-800/90 bg-[#0A0E14] px-3.5 py-2.5">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Select Live Voice Persona
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { id: 'engineer', label: 'Chief Engineer', sub: 'Pit & 3D Tunings' },
              { id: 'rex', label: 'Rex Vance', sub: 'Play-by-Play Host' },
              { id: 'kira', label: 'Kira Volt', sub: 'Combat Analyst' },
            ] as const
          ).map((p) => {
            const active = persona === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPersona(p.id);
                  if (status === 'connected') {
                    startLiveSession(p.id);
                  }
                }}
                className={`rounded-lg border px-2 py-1.5 text-left transition ${
                  active
                    ? 'border-sky-400 bg-sky-500/20 text-white'
                    : 'border-slate-800 bg-[#12161E] text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-[11px] font-extrabold leading-tight">{p.label}</div>
                <div className="text-[9px] text-slate-400 truncate">{p.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transcript & Status Feed */}
      <div className="max-h-56 min-h-[160px] overflow-y-auto px-3.5 py-3 space-y-2 bg-[#0B0E14]">
        {turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
            <Volume2 className="h-6 w-6 mb-1.5 text-sky-400" />
            <p className="text-xs font-semibold text-slate-200">
              Start a Real-Time Voice Conversation
            </p>
            <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
              Talk live with your Pit Engineer or Broadcast Commentators. Ask for tactical advice or say{' '}
              <span className="text-amber-300">&ldquo;Explode the 3D view&rdquo;</span>,{' '}
              <span className="text-amber-300">&ldquo;Equip the Railgun&rdquo;</span>, or{' '}
              <span className="text-amber-300">&ldquo;Start a 1v1 duel&rdquo;</span>.
            </p>
          </div>
        ) : (
          turns.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border px-3 py-2 text-xs ${
                t.role === 'user'
                  ? 'ml-6 border-amber-500/40 bg-amber-500/10 text-amber-100'
                  : t.role === 'tool'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'mr-4 border-sky-500/40 bg-sky-500/10 text-slate-100'
              }`}
            >
              <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {t.role === 'tool' && <Wrench className="h-3 w-3 text-emerald-400" />}
                <span>{t.speakerLabel}</span>
              </div>
              <div className="leading-snug">{t.text}</div>
            </div>
          ))
        )}
      </div>

      {errorMsg && (
        <div className="border-t border-rose-500/40 bg-rose-950/60 px-3.5 py-2 text-[11px] font-semibold text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Quick Voice/Prompt Chips when Connected */}
      {status === 'connected' && (
        <div className="border-t border-slate-800 bg-[#0D1118] px-3.5 py-2">
          <div className="flex flex-wrap gap-1">
            {[
              'Explode the 3D bot view to 85%',
              'Equip Railgun & give me a random name',
              'Switch 3D studio lighting to Cyber Neon',
              'How do I counter spinner bots?',
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleSendTextTurn(undefined, chip)}
                className="rounded-md border border-slate-700/80 bg-[#141A24] px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-sky-400/60 hover:text-sky-200"
              >
                {chip}
              </button>
            ))}
          </div>

          <form onSubmit={handleSendTextTurn} className="mt-2 flex items-center gap-1.5">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Or type to your Live Voice copilot..."
              className="flex-1 rounded-lg border border-slate-700 bg-[#090C10] px-2.5 py-1.5 text-xs text-white focus:border-sky-400 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send message to Live session"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Footer Call Controls */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-800 bg-[#121824] px-3.5 py-2.5">
        {status !== 'connected' ? (
          <button
            type="button"
            disabled={status === 'connecting'}
            onClick={() => startLiveSession(persona)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition"
          >
            <PhoneCall className="h-4 w-4" />
            <span>
              {status === 'connecting'
                ? 'Connecting Gemini 3.8 Live...'
                : 'Start Real-Time Voice Call'}
            </span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMicMuted((m) => !m)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition ${
                micMuted
                  ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
                  : 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
              }`}
            >
              {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              <span>{micMuted ? 'Mic Muted' : modelSpeaking ? 'AI Speaking' : 'Mic Live'}</span>
            </button>

            <button
              type="button"
              onClick={disconnectSession}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/60 bg-rose-500/20 px-3.5 py-2 text-xs font-extrabold text-rose-200 hover:bg-rose-500/30 transition"
            >
              <PhoneOff className="h-4 w-4" />
              <span>End Call</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
