import React, { useRef, useState } from 'react';
import { Flame, ShieldPlus, Swords } from 'lucide-react';
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

const WEAPON_SHORT_NAME: Record<WeaponId, string> = {
  vspinner: 'V-Spin',
  hbar: 'H-Bar',
  sawblade: 'Saws',
  drum: 'Drum',
  flipper: 'Flipper',
  hammer: 'Hammer',
  crush_jaw: 'Jaws',
  flame: 'Flame',
  cryo_jet: 'Cryo',
  tesla: 'Tesla',
  railgun: 'Railgun',
  mortar: 'Mortar',
  lance: 'Lance',
  magnet: 'Magnet',
  missiles: 'Rockets',
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
  const padRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [firingSlots, setFiringSlots] = useState<boolean[]>([false, false, false]);

  const maxRadius = 46;

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

  const energyPct = maxEnergy > 0 ? Math.round((energy / maxEnergy) * 100) : 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-between px-4 pb-5 sm:px-8 sm:pb-7">
      {/* Left Thumb Zone: Analog Virtual Stick */}
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
        className="pointer-events-auto touch-control-zone relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-slate-600/80 bg-[#12161C]/80 shadow-xl"
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

      {/* Right Thumb Zone: Tactical Utility + Individual Button Per Equipped Weapon */}
      <div className="pointer-events-auto touch-control-zone flex items-end gap-2.5 sm:gap-3">
        <div className="flex flex-col items-center gap-2.5">
          <button
            type="button"
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
            disabled={energy < 40 || overdriveTimer > 0}
            className={`flex h-13 w-13 flex-col items-center justify-center rounded-2xl border text-[10px] font-semibold transition active:scale-95 ${
              overdriveTimer > 0
                ? 'border-sky-400 bg-sky-500/30 text-sky-200'
                : energy >= 40
                  ? 'border-emerald-500/80 bg-[#14201C]/90 text-emerald-300'
                  : 'border-slate-700 bg-[#12161C]/80 text-slate-500'
            }`}
          >
            <ShieldPlus className="h-4 w-4" />
            <span className="mt-0.5 leading-none">Repair</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              inputRef.current.boost = true;
            }}
            onPointerUp={() => {
              inputRef.current.boost = false;
            }}
            onPointerCancel={() => {
              inputRef.current.boost = false;
            }}
            disabled={boostCooldown > 0 || energy < 24}
            className={`flex h-13 w-13 flex-col items-center justify-center rounded-2xl border text-[10px] font-semibold transition active:scale-95 ${
              boostCooldown <= 0 && energy >= 24
                ? 'border-sky-400/80 bg-[#121E2A]/90 text-sky-300'
                : 'border-slate-700 bg-[#12161C]/80 text-slate-500'
            }`}
          >
            <Flame className="h-4 w-4" />
            <span className="mt-0.5 leading-none">Boost</span>
          </button>
        </div>

        {/* Dedicated Independent Button For Each Equipped Weapon */}
        <div className="flex items-end gap-2">
          {weapons.map((wId, idx) => {
            const cd = weaponCooldowns[idx] ?? 0;
            const isFiring = Boolean(firingSlots[idx]);
            const shortName = WEAPON_SHORT_NAME[wId] || WEAPON_CATALOG[wId].label.split(' ')[0];
            const isPrimary = idx === 0;
            return (
              <button
                key={`${wId}_${idx}`}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setSlotTrigger(idx, true);
                }}
                onPointerUp={() => setSlotTrigger(idx, false)}
                onPointerCancel={() => setSlotTrigger(idx, false)}
                className={`relative flex flex-col items-center justify-center rounded-3xl border-2 font-bold shadow-2xl transition active:scale-95 ${
                  isPrimary ? 'h-24 w-22 text-xs' : 'h-20 w-18 text-[11px]'
                } ${
                  isFiring
                    ? 'border-amber-300 bg-amber-500 text-slate-950'
                    : cd > 0.05
                      ? 'border-slate-700 bg-[#161B22]/90 text-slate-400'
                      : 'border-amber-500 bg-amber-500/20 text-amber-300'
                }`}
              >
                <span className="font-mono-tabular absolute top-1.5 right-2 text-[9px] opacity-80">
                  #{idx + 1}
                </span>
                <Swords className={isPrimary ? 'h-6 w-6' : 'h-5 w-5'} />
                <span className="mt-1 leading-none">{shortName}</span>
                <span className="font-mono-tabular mt-1 text-[9px] opacity-80">
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
