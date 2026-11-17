import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flame,
  Gamepad2,
  ShieldPlus,
  Swords,
} from 'lucide-react';
import { WEAPON_CATALOG, type PlayerInputState, type WeaponId } from '../shared/types';

interface TouchControlsProps {
  inputRef: React.MutableRefObject<PlayerInputState>;
  energy: number;
  maxEnergy: number;
  boostCooldown: number;
  weapons: WeaponId[];
  weaponCooldowns: number[];
  overdriveTimer: number;
}

type DirectionKey = 'up' | 'down' | 'left' | 'right';

const WEAPON_SHORT_NAME: Record<WeaponId, string> = {
  vspinner: 'V-Spin',
  hbar: 'H-Bar',
  body_spinner: '360-Spin',
  sawblade: 'Saws',
  drum: 'Drum',
  flipper: 'Flipper',
  hammer: 'Hammer',
  crush_jaw: 'Jaws',
  flame: 'Flame',
  cryo_jet: 'Cryo',
  tesla: 'Tesla',
  laser: 'Laser',
  railgun: 'Railgun',
  mortar: 'Mortar',
  lance: 'Lance',
  magnet: 'Magnet',
  missiles: 'Rockets',
  lightning_strike: 'Lightning',
  bomb_drop: 'Bomb Drop',
};

export const TouchControls: React.FC<TouchControlsProps> = ({
  inputRef,
  energy,
  maxEnergy,
  boostCooldown,
  weapons,
  weaponCooldowns,
  overdriveTimer,
}) => {
  const [drivePadMode, setDrivePadMode] = useState<'dpad' | 'stick'>('dpad');
  const [pressedDirs, setPressedDirs] = useState<Record<DirectionKey, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const dirsRef = useRef<Record<DirectionKey, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const padRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [firingSlots, setFiringSlots] = useState<boolean[]>([false, false, false]);
  const [drifting, setDrifting] = useState(false);

  const maxRadius = 46;

  useEffect(() => {
    const input = inputRef.current;
    return () => {
      input.throttle = 0;
      input.steer = 0;
      input.boost = false;
      input.drift = false;
      input.overdrive = false;
      input.fireWeapon = false;
      input.fireWeapons = [false, false, false];
    };
  }, [inputRef]);

  const setDirection = (dir: DirectionKey, pressed: boolean) => {
    if (dirsRef.current[dir] === pressed) return;
    dirsRef.current[dir] = pressed;
    setPressedDirs({ ...dirsRef.current });
    const d = dirsRef.current;
    // Forward = +1, Reverse = -1; Steer Left = +1, Steer Right = -1
    inputRef.current.throttle = (d.up ? 1 : 0) - (d.down ? 1 : 0);
    inputRef.current.steer = (d.left ? 1 : 0) - (d.right ? 1 : 0);
  };

  const resetAllDirs = () => {
    dirsRef.current = { up: false, down: false, left: false, right: false };
    setPressedDirs({ up: false, down: false, left: false, right: false });
    inputRef.current.throttle = 0;
    inputRef.current.steer = 0;
  };

  const updateStick = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnobOffset({ x: dx, y: dy });

    // Up on stick = forward throttle (+1), Left on stick = steer left (+1 yaw)
    const normY = -dy / maxRadius;
    const normX = -dx / maxRadius;
    inputRef.current.throttle = Math.abs(normY) < 0.12 ? 0 : normY;
    inputRef.current.steer = Math.abs(normX) < 0.12 ? 0 : normX;
  };

  const resetStick = () => {
    activePointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    inputRef.current.throttle = 0;
    inputRef.current.steer = 0;
  };

  const setSlotTrigger = (slotIdx: number, pressed: boolean) => {
    setFiringSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = pressed;
      return next;
    });
    const current = Array.isArray(inputRef.current.fireWeapons)
      ? [...inputRef.current.fireWeapons]
      : [false, false, false];
    current[slotIdx] = pressed;
    inputRef.current.fireWeapons = current;
    inputRef.current.fireWeapon = current.some(Boolean);
  };

  const renderDirButton = (
    dir: DirectionKey,
    label: string,
    Icon: React.FC<{ className?: string }>,
  ) => {
    const active = pressedDirs[dir];
    return (
      <button
        type="button"
        aria-label={`Drive ${label}`}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setDirection(dir, true);
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          setDirection(dir, false);
        }}
        onPointerCancel={() => setDirection(dir, false)}
        onLostPointerCapture={() => setDirection(dir, false)}
        className={`flex h-12 w-12 sm:h-14 sm:w-14 flex-col items-center justify-center rounded-2xl border-2 select-none touch-none shadow-xl transition active:scale-95 ${
          active
            ? 'border-amber-300 bg-amber-500 text-slate-950 shadow-amber-500/30'
            : 'border-slate-600/90 bg-[#12161C]/90 text-slate-100 hover:border-amber-400/70'
        }`}
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6 stroke-[2.6]" />
        <span className="font-mono-tabular text-[8px] font-extrabold uppercase leading-none tracking-wider opacity-85">
          {label}
        </span>
      </button>
    );
  };

  const energyPct = maxEnergy > 0 ? Math.round((energy / maxEnergy) * 100) : 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-between px-3 pb-4 sm:px-8 sm:pb-7">
      {/* Left Thumb Zone: Up / Down / Left / Right Buttons (default) or Stick */}
      <div className="pointer-events-auto touch-control-zone flex flex-col items-start gap-1.5 select-none">
        <button
          type="button"
          onClick={() => {
            resetAllDirs();
            resetStick();
            setDrivePadMode((m) => (m === 'dpad' ? 'stick' : 'dpad'));
          }}
          className="flex items-center gap-1 rounded-lg border border-slate-700/90 bg-[#0D1117]/85 px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:border-amber-400/60 hover:text-amber-300 transition cursor-pointer"
          title="Switch between Up/Down/Left/Right buttons and Virtual Joystick"
        >
          <Gamepad2 className="h-3 w-3 text-amber-400" />
          <span>{drivePadMode === 'dpad' ? 'Buttons · Switch Stick' : 'Stick · Switch Buttons'}</span>
        </button>

        {drivePadMode === 'dpad' ? (
          <div
            className="grid grid-cols-3 grid-rows-3 gap-1.5 rounded-3xl border border-slate-700/75 bg-[#0B0F15]/65 p-2 backdrop-blur-sm shadow-2xl"
            aria-label="Directional drive controls"
          >
            <div />
            {renderDirButton('up', 'Up', ArrowUp)}
            <div />

            {renderDirButton('left', 'Left', ArrowLeft)}
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-slate-800/80 bg-[#0D1014]/70 text-[9px] font-mono font-bold uppercase text-slate-500">
              Drive
            </div>
            {renderDirButton('right', 'Right', ArrowRight)}

            <div />
            {renderDirButton('down', 'Down', ArrowDown)}
            <div />
          </div>
        ) : (
          <div
            ref={padRef}
            onPointerDown={(e) => {
              e.preventDefault();
              activePointerId.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              updateStick(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (activePointerId.current !== e.pointerId) return;
              updateStick(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              if (activePointerId.current !== e.pointerId) return;
              resetStick();
            }}
            onPointerCancel={resetStick}
            className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-slate-600/80 bg-[#12161C]/80 shadow-xl touch-none"
            aria-label="Drive joystick"
          >
            <div className="pointer-events-none absolute inset-3 rounded-full border border-slate-700/70" />
            <div
              style={{
                transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
              }}
              className="pointer-events-none h-14 w-14 rounded-full border-2 border-amber-400 bg-amber-500/90 shadow-lg"
            />
          </div>
        )}
      </div>

      {/* Right Thumb Zone: Tactical Utility + Individual Button Per Equipped Weapon */}
      <div className="pointer-events-auto touch-control-zone flex items-end gap-2 sm:gap-3 select-none">
        <div className="flex flex-col items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrifting(true);
              inputRef.current.drift = true;
            }}
            onPointerUp={() => {
              setDrifting(false);
              inputRef.current.drift = false;
            }}
            onPointerCancel={() => {
              setDrifting(false);
              inputRef.current.drift = false;
            }}
            className={`relative flex h-11 w-12 sm:h-12 sm:w-13 flex-col items-center justify-center rounded-2xl border text-[10px] font-bold touch-none transition active:scale-95 ${
              drifting
                ? 'border-fuchsia-400 bg-fuchsia-500/35 text-fuchsia-100'
                : 'border-fuchsia-500/75 bg-[#1B1222]/90 text-fuchsia-300'
            }`}
          >
            <span className="font-mono-tabular text-[8px] font-extrabold leading-none">SHIFT</span>
            <span className="mt-0.5 leading-none">Drift</span>
          </button>

          <button
            type="button"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.preventDefault();
              inputRef.current.overdrive = true;
            }}
            onPointerUp={() => {
              inputRef.current.overdrive = false;
            }}
            onPointerCancel={() => {
              inputRef.current.overdrive = false;
            }}
            disabled={energy < 28 || overdriveTimer > 0}
            className={`relative flex h-11 w-12 sm:h-12 sm:w-13 flex-col items-center justify-center rounded-2xl border text-[10px] font-semibold touch-none transition active:scale-95 ${
              overdriveTimer > 0
                ? 'border-sky-400 bg-sky-500/30 text-sky-200'
                : energy >= 28
                  ? 'border-emerald-500/80 bg-[#14201C]/90 text-emerald-300'
                  : 'border-slate-700 bg-[#12161C]/80 text-slate-500'
            }`}
          >
            <span className="font-mono-tabular absolute top-1 right-1 text-[8px] font-bold opacity-85">
              F/↓
            </span>
            <ShieldPlus className="h-4 w-4" />
            <span className="mt-0.5 leading-none">Repair</span>
          </button>

          <button
            type="button"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              inputRef.current.boost = true;
            }}
            onPointerUp={() => {
              inputRef.current.boost = false;
            }}
            onPointerCancel={() => {
              inputRef.current.boost = false;
            }}
            className={`flex h-11 w-12 sm:h-12 sm:w-13 flex-col items-center justify-center rounded-2xl border text-[10px] font-semibold touch-none transition active:scale-95 ${
              boostCooldown > 1.8
                ? 'border-amber-400 bg-amber-500/30 text-amber-200'
                : 'border-sky-400/80 bg-[#121E2A]/90 text-sky-300'
            }`}
          >
            <Flame className="h-4 w-4" />
            <span className="mt-0.5 leading-none">Boost</span>
          </button>
        </div>

        {/* Dedicated Independent Button For Each Equipped Weapon */}
        <div className="flex items-end gap-1.5 sm:gap-2">
          {weapons.map((wId, idx) => {
            const cd = weaponCooldowns[idx] ?? 0;
            const isFiring = Boolean(firingSlots[idx]);
            const shortName = WEAPON_SHORT_NAME[wId] || WEAPON_CATALOG[wId].label.split(' ')[0];
            const isPrimary = idx === 0;
            const arrowBadge = idx === 0 ? '←' : idx === 1 ? '↑' : '→';
            return (
              <button
                key={`${wId}_${idx}`}
                type="button"
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setSlotTrigger(idx, true);
                }}
                onPointerUp={() => setSlotTrigger(idx, false)}
                onPointerCancel={() => setSlotTrigger(idx, false)}
                className={`relative flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl border-2 font-bold shadow-2xl touch-none transition active:scale-95 ${
                  isPrimary ? 'h-20 w-16 sm:h-24 sm:w-22 text-[11px] sm:text-xs' : 'h-16 w-14 sm:h-20 sm:w-18 text-[10px] sm:text-[11px]'
                } ${
                  isFiring
                    ? 'border-amber-300 bg-amber-500 text-slate-950'
                    : cd > 0.05
                      ? 'border-slate-700 bg-[#161B22]/90 text-slate-400'
                      : 'border-amber-500 bg-amber-500/20 text-amber-300'
                }`}
              >
                <span className="font-mono-tabular absolute top-1 right-1.5 sm:top-1.5 sm:right-2 text-[8px] sm:text-[9px] font-extrabold opacity-90">
                  {arrowBadge} #{idx + 1}
                </span>
                <Swords className={isPrimary ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-4 w-4 sm:h-5 sm:w-5'} />
                <span className="mt-1 leading-none truncate max-w-full px-1">{shortName}</span>
                <span className="font-mono-tabular mt-0.5 sm:mt-1 text-[8px] sm:text-[9px] opacity-80">
                  {cd > 0.05 ? `${cd.toFixed(1)}s` : `${energyPct}% EN`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
