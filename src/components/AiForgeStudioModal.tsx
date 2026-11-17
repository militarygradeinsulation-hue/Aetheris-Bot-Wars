import React, { useRef, useState } from 'react';
import {
  X,
  Music,
  Image as ImageIcon,
  Film,
  Search,
  MapPin,
  Upload,
  Play,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { soundEngine } from '../game/soundEngine';

export type StudioTab = 'music' | 'image' | 'video' | 'search' | 'maps';

export interface MediaHistoryItem {
  id: number;
  kind: string;
  title: string;
  prompt: string;
  modelUsed: string;
  createdAt: string | null;
}

interface AiForgeStudioModalProps {
  open: boolean;
  initialTab?: StudioTab;
  idToken: string | null;
  botName: string;
  mediaHistory: MediaHistoryItem[];
  onClose: () => void;
  onRefreshHistory?: () => void;
}

export const AiForgeStudioModal: React.FC<AiForgeStudioModalProps> = ({
  open,
  initialTab = 'music',
  idToken,
  botName,
  mediaHistory,
  onClose,
  onRefreshHistory,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>(initialTab);

  // 1. Lyria Music State
  const [musicTitle, setMusicTitle] = useState(`${botName} Arena Anthem`);
  const [musicPrompt, setMusicPrompt] = useState(
    'Aggressive industrial metal battle theme at 145 BPM with heavy distorted guitars, double-kick drums, metallic anvil hits, and high-voltage synth bass.',
  );
  const [musicMode, setMusicMode] = useState<'clip' | 'full'>('clip');
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [musicResult, setMusicResult] = useState<{
    audioDataUrl: string;
    lyrics: string;
    model: string;
    title: string;
  } | null>(null);

  // 2. Image Generation & Editing State (gemini-nano-banana-2.1)
  const [imagePrompt, setImagePrompt] = useState(
    `Photorealistic studio render of heavyweight combat robot "${botName}" with brushed titanium wedge armor, glowing molten orange hazards, and flying sparks on a steel BattleBox floor.`,
  );
  const [imageAspectRatio, setImageAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('16:9');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [imageUseSearch, setImageUseSearch] = useState(false);
  const [editSourceBase64, setEditSourceBase64] = useState<string | null>(null);
  const [editSourceMime, setEditSourceMime] = useState<string>('image/png');
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<{
    imageUrl: string;
    text: string;
  } | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // 3. Video Animation State (gemini-omni-1.2-flash)
  const [videoPrompt, setVideoPrompt] = useState(
    'Dynamic slow-motion combat camera orbit as the robot spins its weapon at full RPM, showering hot orange sparks across the steel arena floor.',
  );
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoDuration, setVideoDuration] = useState<'5s' | '10s'>('5s');
  const [videoSourceBase64, setVideoSourceBase64] = useState<string | null>(null);
  const [videoSourceMime, setVideoSourceMime] = useState<string>('image/png');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoResult, setVideoResult] = useState<{
    videoDataUrl: string;
    mimeType: string;
  } | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // 4. Google Search Grounding State (gemini-4-hydrogen)
  const [searchQuery, setSearchQuery] = useState(
    'What is the optimal weapon tip speed and AR500 vs Grade 5 Titanium armor thickness used in heavyweight 250lb BattleBots?',
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<{
    text: string;
    sources: Array<{ uri: string; title: string }>;
  } | null>(null);

  // 5. Google Maps Grounding State (gemini-4-hydrogen)
  const [mapsQuery, setMapsQuery] = useState(
    'Find robotics makerspaces, metal fabrication machine shops, and STEM combat robotics venues in California',
  );
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsResult, setMapsResult] = useState<{
    text: string;
    places: Array<{ uri: string; title: string; reviews: string[] }>;
  } | null>(null);

  if (!open) return null;

  const buildHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }
    return headers;
  };

  const handleFileUpload = (
    file: File | undefined,
    onLoaded: (dataUrl: string, mimeType: string) => void,
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onLoaded(reader.result, file.type || 'image/png');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateMusic = async () => {
    if (!musicPrompt.trim() || musicLoading) return;
    setMusicLoading(true);
    setMusicError(null);
    try {
      const res = await fetch('/api/ai/music', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          prompt: musicPrompt,
          mode: musicMode,
          title: musicTitle || `${botName} Anthem`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMusicError(data.error || 'Music generation failed.');
      } else {
        setMusicResult({
          audioDataUrl: data.audioDataUrl,
          lyrics: data.lyrics || '',
          model: data.model,
          title: musicTitle || `${botName} Anthem`,
        });
        onRefreshHistory?.();
      }
    } catch {
      setMusicError('Network error while contacting Lyria music engine.');
    } finally {
      setMusicLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim() || imageLoading) return;
    setImageLoading(true);
    setImageError(null);
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          prompt: imagePrompt,
          aspectRatio: imageAspectRatio,
          imageSize,
          baseImageBase64: editSourceBase64 || undefined,
          baseImageMimeType: editSourceMime,
          useSearch: imageUseSearch,
          title: `${botName} Concept Art`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImageError(data.error || 'Image generation failed.');
      } else {
        setImageResult({
          imageUrl: data.imageUrl,
          text: data.text || '',
        });
        onRefreshHistory?.();
      }
    } catch {
      setImageError('Network error while generating image.');
    } finally {
      setImageLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!videoSourceBase64 || videoLoading) return;
    setVideoLoading(true);
    setVideoError(null);
    try {
      const res = await fetch('/api/ai/video', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          prompt: videoPrompt,
          imageBase64: videoSourceBase64,
          imageMimeType: videoSourceMime,
          aspectRatio: videoAspectRatio,
          duration: videoDuration,
          title: `${botName} Combat Highlight`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVideoError(data.error || 'Video animation failed.');
      } else {
        setVideoResult({
          videoDataUrl: data.videoDataUrl,
          mimeType: data.mimeType || 'video/mp4',
        });
        onRefreshHistory?.();
      }
    } catch {
      setVideoError('Network error while animating video.');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleRunSearch = async () => {
    if (!searchQuery.trim() || searchLoading) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch('/api/ai/search-intel', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || 'Search grounding request failed.');
      } else {
        setSearchResult({
          text: data.text || '',
          sources: data.sources || [],
        });
      }
    } catch {
      setSearchError('Network error while querying Google Search grounding.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4)),
        });
        setMapsQuery('Find makerspaces, metal fabrication shops, and robotics clubs near me');
      },
      () => {},
    );
  };

  const handleRunMaps = async () => {
    if (!mapsQuery.trim() || mapsLoading) return;
    setMapsLoading(true);
    setMapsError(null);
    try {
      const res = await fetch('/api/ai/maps-scouting', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          query: mapsQuery,
          lat: userCoords?.lat,
          lng: userCoords?.lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMapsError(data.error || 'Google Maps grounding request failed.');
      } else {
        setMapsResult({
          text: data.text || '',
          places: data.places || [],
        });
      }
    } catch {
      setMapsError('Network error while querying Google Maps grounding.');
    } finally {
      setMapsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6">
      <div className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-[#12161C] text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-white">
              ForgeClash Engineering & Media Lab
            </h2>
            <p className="text-xs text-slate-400">
              Compose custom arena soundtracks, render 4K bot liveries, animate combat highlights, and scout robotics intel
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Engineering Lab"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-800 bg-[#0D1014] px-4">
          {[
            { id: 'music' as const, label: 'Anthem Forge', icon: Music },
            { id: 'image' as const, label: 'Concept & Decal Lab', icon: ImageIcon },
            { id: 'video' as const, label: 'Highlight Animator', icon: Film },
            { id: 'search' as const, label: 'Combat Intel Search', icon: Search },
            { id: 'maps' as const, label: 'Maker & Arena Map', icon: MapPin },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                  active
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: LYRIA 3 MUSIC GENERATION */}
          {activeTab === 'music' && (
            <div className="grid gap-5 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Anthem Title
                  </label>
                  <input
                    type="text"
                    value={musicTitle}
                    onChange={(e) => setMusicTitle(e.target.value)}
                    maxLength={48}
                    className="w-full rounded-lg border border-slate-700 bg-[#0D1014] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Track Format
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setMusicMode('clip')}
                      className={`rounded-lg border px-3 py-2.5 text-left transition ${
                        musicMode === 'clip'
                          ? 'border-amber-500 bg-amber-500/15 text-white'
                          : 'border-slate-800 bg-[#0D1014] text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">30s High-Impact Clip</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Fast intro & drop loop</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMusicMode('full')}
                      className={`rounded-lg border px-3 py-2.5 text-left transition ${
                        musicMode === 'full'
                          ? 'border-amber-500 bg-amber-500/15 text-white'
                          : 'border-slate-800 bg-[#0D1014] text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">Full Battle Composition</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Extended multi-section track</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Musical Style & Instrumentation Prompt
                  </label>
                  <textarea
                    rows={3}
                    value={musicPrompt}
                    onChange={(e) => setMusicPrompt(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-[#0D1014] p-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      '150 BPM industrial metal with hydraulic press percussion and brass stabs',
                      'Heavy cyberpunk bass & dubstep wobbles with high-RPM saw synth leads',
                      'Epic symphonic colosseum orchestral rock with choir and double-kick drums',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMusicPrompt(preset)}
                        className="rounded border border-slate-700/80 bg-[#0D1014] px-2.5 py-1 text-[11px] text-slate-300 hover:border-amber-500/60 hover:text-amber-300"
                      >
                        {preset.slice(0, 44)}...
                      </button>
                    ))}
                  </div>
                </div>

                {musicError && (
                  <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                    {musicError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={musicLoading}
                  onClick={handleGenerateMusic}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {musicLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Synthesizing Arena Track...</span>
                    </>
                  ) : (
                    <>
                      <Music className="h-4 w-4" />
                      <span>Generate Custom Soundtrack</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0D1014] p-4 lg:col-span-5">
                {musicResult ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                        Ready for Playback
                      </div>
                      <h3 className="font-display text-base font-bold text-white mt-0.5">
                        {musicResult.title}
                      </h3>
                    </div>

                    <audio
                      controls
                      src={musicResult.audioDataUrl}
                      className="w-full"
                    />

                    {musicResult.lyrics && (
                      <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-800 bg-[#12161C] p-3 text-xs text-slate-300 whitespace-pre-wrap">
                        {musicResult.lyrics}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          soundEngine.playCustomTrack(musicResult.audioDataUrl, musicResult.title, 'both')
                        }
                        className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Activate in Workshop & Battle Rotation</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center text-slate-500">
                    <Music className="h-8 w-8 mb-2 text-slate-600" />
                    <p className="text-xs max-w-xs">
                      Generate a 30-second combat clip or full battle track and assign it directly to your Workshop turntable and Arena soundtrack rotation.
                    </p>
                  </div>
                )}

                {mediaHistory.length > 0 && (
                  <div className="mt-4 border-t border-slate-800 pt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Recent Cloud Creations
                    </div>
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {mediaHistory.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded border border-slate-800/80 bg-[#12161C] px-2.5 py-1.5 text-xs"
                        >
                          <span className="truncate font-medium text-slate-200">{item.title}</span>
                          <span className="text-[10px] uppercase text-amber-400 ml-2 shrink-0">
                            {item.kind}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: IMAGE CREATION & EDITING (gemini-nano-banana-2.1) */}
          {activeTab === 'image' && (
            <div className="grid gap-5 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Concept Art or Livery Prompt
                  </label>
                  <textarea
                    rows={3}
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-[#0D1014] p-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Aspect Ratio
                    </label>
                    <select
                      value={imageAspectRatio}
                      onChange={(e) =>
                        setImageAspectRatio(e.target.value as '1:1' | '16:9' | '9:16' | '4:3' | '3:4')
                      }
                      className="w-full rounded-lg border border-slate-700 bg-[#0D1014] px-3 py-2 text-xs text-white"
                    >
                      <option value="16:9">16:9 Landscape</option>
                      <option value="1:1">1:1 Square Emblem</option>
                      <option value="9:16">9:16 Vertical Poster</option>
                      <option value="4:3">4:3 Blueprint</option>
                      <option value="3:4">3:4 Trading Card</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Resolution
                    </label>
                    <select
                      value={imageSize}
                      onChange={(e) => setImageSize(e.target.value as '1K' | '2K' | '4K')}
                      className="w-full rounded-lg border border-slate-700 bg-[#0D1014] px-3 py-2 text-xs text-white"
                    >
                      <option value="1K">1K Standard</option>
                      <option value="2K">2K High-Detail</option>
                      <option value="4K">4K Ultra Studio</option>
                    </select>
                  </div>
                </div>

                {/* Optional Reference Image for Editing */}
                <div className="rounded-lg border border-slate-800 bg-[#0D1014] p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Reference Photo for Image Editing (Optional)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Upload a photo or bot screenshot to restyle or modify
                      </div>
                    </div>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e.target.files?.[0], (dataUrl, mime) => {
                          setEditSourceBase64(dataUrl);
                          setEditSourceMime(mime);
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>{editSourceBase64 ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>
                  </div>

                  {editSourceBase64 && (
                    <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-slate-800 pt-2.5">
                      <img
                        src={editSourceBase64}
                        alt="Reference input"
                        className="h-12 w-16 rounded object-cover border border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => setEditSourceBase64(null)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove Reference
                      </button>
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={imageUseSearch}
                    onChange={(e) => setImageUseSearch(e.target.checked)}
                    className="rounded border-slate-700 bg-[#0D1014] text-amber-500"
                  />
                  <span>Enable Web & Image Search Grounding for real-world mechanical references</span>
                </label>

                {imageError && (
                  <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                    {imageError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={imageLoading}
                  onClick={handleGenerateImage}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {imageLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Rendering Image...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-4 w-4" />
                      <span>{editSourceBase64 ? 'Apply AI Image Edit' : 'Generate Bot Concept Art'}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-[#0D1014] p-4 lg:col-span-6">
                {imageResult ? (
                  <div className="w-full space-y-3">
                    <img
                      src={imageResult.imageUrl}
                      alt="Generated Combat Bot Concept"
                      className="max-h-72 w-full rounded-lg object-contain border border-slate-800 bg-black"
                    />
                    {imageResult.text && (
                      <p className="text-xs text-slate-300">{imageResult.text}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setVideoSourceBase64(imageResult.imageUrl);
                          setVideoSourceMime('image/png');
                          setActiveTab('video');
                        }}
                        className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
                      >
                        Send to Highlight Video Animator
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditSourceBase64(imageResult.imageUrl);
                          setEditSourceMime('image/png');
                        }}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white"
                      >
                        Use as Edit Base
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-12">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-xs max-w-xs">
                      Create custom combat robot renders, clan emblems, or upload an existing photo to edit with titanium armor and battle damage.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: VIDEO ANIMATION (gemini-omni-1.2-flash) */}
          {activeTab === 'video' && (
            <div className="grid gap-5 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-6">
                <div className="rounded-lg border border-slate-800 bg-[#0D1014] p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Source Photo to Animate</div>
                      <div className="text-[11px] text-slate-400">
                        Upload a bot photo or send one from the Concept Lab
                      </div>
                    </div>
                    <input
                      ref={videoFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e.target.files?.[0], (dataUrl, mime) => {
                          setVideoSourceBase64(dataUrl);
                          setVideoSourceMime(mime);
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => videoFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload Photo</span>
                    </button>
                  </div>

                  {videoSourceBase64 && (
                    <div className="mt-3">
                      <img
                        src={videoSourceBase64}
                        alt="Video animation source"
                        className="max-h-36 w-full rounded-lg object-contain border border-slate-800 bg-black"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Video Aspect Ratio
                    </label>
                    <select
                      value={videoAspectRatio}
                      onChange={(e) => setVideoAspectRatio(e.target.value as '16:9' | '9:16')}
                      className="w-full rounded-lg border border-slate-700 bg-[#0D1014] px-3 py-2 text-xs text-white"
                    >
                      <option value="16:9">16:9 Landscape</option>
                      <option value="9:16">9:16 Portrait Reel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Clip Duration
                    </label>
                    <select
                      value={videoDuration}
                      onChange={(e) => setVideoDuration(e.target.value as '5s' | '10s')}
                      className="w-full rounded-lg border border-slate-700 bg-[#0D1014] px-3 py-2 text-xs text-white"
                    >
                      <option value="5s">5 Seconds (720p)</option>
                      <option value="10s">10 Seconds (720p)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Action & Camera Motion Prompt
                  </label>
                  <textarea
                    rows={3}
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-[#0D1014] p-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {videoError && (
                  <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                    {videoError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!videoSourceBase64 || videoLoading}
                  onClick={handleGenerateVideo}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {videoLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Animating Combat Video...</span>
                    </>
                  ) : (
                    <>
                      <Film className="h-4 w-4" />
                      <span>Animate Photo into Video</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-[#0D1014] p-4 lg:col-span-6">
                {videoResult ? (
                  <div className="w-full space-y-3">
                    <video
                      controls
                      autoPlay
                      loop
                      src={videoResult.videoDataUrl}
                      className="max-h-72 w-full rounded-lg border border-slate-800 bg-black"
                    />
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-12">
                    <Film className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-xs max-w-xs">
                      Upload any photo or send a generated bot render from the Concept Lab to animate a 720p arena highlight clip.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: GOOGLE SEARCH GROUNDING (gemini-4-hydrogen) */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask about real-world BattleBots armor metallurgy, weapon tip speeds, brushless drive motors..."
                  className="flex-1 rounded-lg border border-slate-700 bg-[#0D1014] px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={searchLoading}
                  onClick={handleRunSearch}
                  className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 shrink-0"
                >
                  {searchLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      <span>Search Combat Intel</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  'Compare AR500 steel vs Grade 5 Titanium vs UHMW armor in combat robotics',
                  'How do pneumatic flippers vs high-RPM vertical spinners store kinetic energy?',
                  'What are the latest heavyweight combat robotics rules on active weapons and LiPo batteries?',
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setSearchQuery(q)}
                    className="rounded border border-slate-800 bg-[#0D1014] px-2.5 py-1 text-xs text-slate-300 hover:border-amber-500/50 hover:text-amber-300"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {searchError && (
                <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                  {searchError}
                </div>
              )}

              {searchResult && (
                <div className="rounded-xl border border-slate-800 bg-[#0D1014] p-4 space-y-4">
                  <div className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                    {searchResult.text}
                  </div>

                  {searchResult.sources.length > 0 && (
                    <div className="border-t border-slate-800 pt-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
                        Grounded Web Sources
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {searchResult.sources.map((src, i) => (
                          <a
                            key={`${src.uri}_${i}`}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#12161C] px-3 py-2 text-xs text-slate-300 hover:border-amber-500/60 hover:text-white"
                          >
                            <span className="truncate">{src.title}</span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: GOOGLE MAPS GROUNDING (gemini-4-hydrogen) */}
          {activeTab === 'maps' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={mapsQuery}
                  onChange={(e) => setMapsQuery(e.target.value)}
                  placeholder="Find makerspaces, CNC waterjet shops, or robotics tournament venues..."
                  className="flex-1 rounded-lg border border-slate-700 bg-[#0D1014] px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:text-white shrink-0"
                >
                  {userCoords ? `GPS (${userCoords.lat}, ${userCoords.lng})` : 'Use My GPS'}
                </button>
                <button
                  type="button"
                  disabled={mapsLoading}
                  onClick={handleRunMaps}
                  className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 shrink-0"
                >
                  {mapsLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Scouting Maps...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4" />
                      <span>Scout Locations</span>
                    </>
                  )}
                </button>
              </div>

              {mapsError && (
                <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                  {mapsError}
                </div>
              )}

              {mapsResult && (
                <div className="rounded-xl border border-slate-800 bg-[#0D1014] p-4 space-y-4">
                  <div className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                    {mapsResult.text}
                  </div>

                  {mapsResult.places.length > 0 && (
                    <div className="border-t border-slate-800 pt-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
                        Verified Google Maps Locations
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {mapsResult.places.map((pl, idx) => (
                          <div
                            key={`${pl.uri}_${idx}`}
                            className="rounded-lg border border-slate-800 bg-[#12161C] p-3 space-y-1.5"
                          >
                            <a
                              href={pl.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between gap-2 font-semibold text-xs text-amber-400 hover:underline"
                            >
                              <span className="truncate">{pl.title}</span>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            </a>
                            {pl.reviews.slice(0, 2).map((rev, rIdx) => (
                              <p key={rIdx} className="text-[11px] text-slate-400 line-clamp-2">
                                "{rev}"
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
