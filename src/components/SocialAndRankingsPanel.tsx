import React, { useMemo, useState } from 'react';
import {
  Award,
  BatteryCharging,
  Calendar,
  Check,
  Play,
  Radio,
  Search,
  Send,
  Shield,
  Sliders,
  Swords,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  ArenaId,
  BatteryMode,
  ClanInfo,
  CombatTeamInfo,
  LeaderboardEntry,
  OnlinePresence,
  PilotConnectionRecord,
  PilotDirectoryEntry,
  PlayerProfile,
  PvpRecord,
  SeasonalEvent,
  SkillTree,
} from '../shared/types';
import { PWAInstallButton } from './PWAInstallButton';

export type HubModalTab = 'online' | 'rankings' | 'pvp' | 'clans' | 'events' | 'skills';

interface SocialAndRankingsPanelProps {
  activeTab: HubModalTab | null;
  profile: PlayerProfile;
  leaderboard: LeaderboardEntry[];
  pvpBoard: PvpRecord[];
  presence: OnlinePresence | null;
  clans: ClanInfo[];
  onlinePilots?: PilotDirectoryEntry[];
  connections?: PilotConnectionRecord[];
  teams?: CombatTeamInfo[];
  currentUid?: string;
  seasonalEvents: SeasonalEvent[];
  isOnline: boolean;
  onChangeTab: (tab: HubModalTab | null) => void;
  onUpgradeSkill: (key: keyof SkillTree) => void;
  onUpdateProfile: (patch: Partial<PlayerProfile>) => void;
  onCreateClan: (name: string, tag: string, motto: string) => void;
  onJoinClan: (clanId: string) => void;
  onSendClanChat: (clanId: string, text: string) => void;
  onStartClanWarMatch: (teamMode?: boolean) => void;
  onDeployEventArena?: (arenaId: ArenaId) => void;
  onClaimEventReward: (event: SeasonalEvent) => void;
  onSendConnection?: (targetUid: string, targetName: string) => void | Promise<void>;
  onRespondConnection?: (connId: string, decision: 'accepted' | 'declined') => void | Promise<void>;
  onRemoveConnection?: (connId: string) => void | Promise<void>;
  onCreateTeam?: (name: string, tag: string, motto: string) => void | Promise<void>;
  onJoinTeam?: (teamId: string) => void | Promise<void>;
  onLeaveTeam?: (teamId: string) => void | Promise<void>;
  onOpenSettings?: () => void;
}

const SKILL_META: Array<{ key: keyof SkillTree; label: string; effect: string }> = [
  { key: 'chassisReinforcement', label: 'Chassis Reinforcement', effect: '+9% Max Hull HP per rank' },
  { key: 'weaponTorque', label: 'Weapon Torque Drive', effect: '+7.5% Damage & faster rotor spin' },
  { key: 'gyroStabilizer', label: 'Gyroscopic Stabilizer', effect: '+8% Knockback & flip resistance' },
  { key: 'kineticArmor', label: 'Kinetic Armor Plating', effect: '+14% Zone Armor & frontal deflection' },
  { key: 'batteryCore', label: 'Solid-State Power Core', effect: '+14 Energy capacity & +2.4/s regen' },
  { key: 'coolingSystem', label: 'Cryo-Loop Heat Sinks', effect: '-4.5% Weapon cooldowns & faster boost' },
  { key: 'naniteRepair', label: 'Nanite Hull Reconstructor', effect: 'Passive HP & Armor Zone regen in combat' },
  { key: 'overclockCore', label: 'Quantum Overclock Core', effect: 'Longer Overdrive duration & +3% speed' },
];

export const SocialAndRankingsPanel: React.FC<SocialAndRankingsPanelProps> = ({
  activeTab,
  profile,
  leaderboard,
  pvpBoard,
  presence,
  clans,
  onlinePilots = [],
  connections = [],
  teams = [],
  currentUid,
  seasonalEvents,
  isOnline,
  onChangeTab,
  onUpgradeSkill,
  onUpdateProfile,
  onCreateClan,
  onJoinClan,
  onSendClanChat,
  onStartClanWarMatch,
  onDeployEventArena,
  onClaimEventReward,
  onSendConnection,
  onRespondConnection,
  onRemoveConnection,
  onCreateTeam,
  onJoinTeam,
  onLeaveTeam,
  onOpenSettings,
}) => {
  const [newClanName, setNewClanName] = useState('');
  const [newClanTag, setNewClanTag] = useState('');
  const [newClanMotto, setNewClanMotto] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamTag, setNewTeamTag] = useState('');
  const [newTeamMotto, setNewTeamMotto] = useState('');
  const [pilotSearch, setPilotSearch] = useState('');
  const [onlineOnlyFilter, setOnlineOnlyFilter] = useState(false);
  const [chatText, setChatText] = useState('');

  const myUid = currentUid || profile.id;

  const filteredPilots = useMemo(() => {
    const q = pilotSearch.trim().toLowerCase();
    return onlinePilots.filter((p) => {
      if (onlineOnlyFilter && !p.isOnline) return false;
      if (!q) return true;
      return (
        p.username.toLowerCase().includes(q) ||
        p.clanTag.toLowerCase().includes(q) ||
        (p.teamName || '').toLowerCase().includes(q) ||
        p.botName.toLowerCase().includes(q)
      );
    });
  }, [onlinePilots, pilotSearch, onlineOnlyFilter]);

  const incomingRequests = useMemo(
    () => connections.filter((c) => c.status === 'pending' && c.recipientId === myUid),
    [connections, myUid],
  );
  const outgoingRequests = useMemo(
    () => connections.filter((c) => c.status === 'pending' && c.requesterId === myUid),
    [connections, myUid],
  );
  const acceptedConnections = useMemo(
    () => connections.filter((c) => c.status === 'accepted'),
    [connections],
  );

  if (!activeTab) return null;

  const myClan = clans.find((c) => c.id === profile.clanId) || clans[0];
  const onlineNowCount = onlinePilots.filter((p) => p.isOnline).length;
  const coinsBalance = profile.coins ?? profile.scrap ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-6">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-700 bg-[#141920] shadow-2xl overflow-hidden">
        {/* Header Tabs */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: 'online', label: `Online & Connections (${onlineNowCount})`, Icon: Radio },
                { id: 'rankings', label: 'Global Rankings', Icon: Trophy },
                { id: 'pvp', label: 'PvP Ladder', Icon: Swords },
                { id: 'clans', label: 'Clans & Teams', Icon: Users },
                { id: 'events', label: 'Season 05 Events', Icon: Calendar },
                { id: 'skills', label: 'Engineering & Pilot', Icon: Sliders },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onChangeTab(id)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 min-h-[40px] text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                  activeTab === id
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-[#1A2029] text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onChangeTab(null)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-[#1A2029] text-slate-300 hover:text-white shrink-0"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === 'online' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Pilots Directory & Connections
                  </h3>
                  <p className="text-xs text-slate-400">
                    See pilots online right now, inspect their Level, W/L & KOs, and add Combat Connections.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 font-mono-tabular">
                    {onlineNowCount} Online · {onlinePilots.length} Registered Pilots
                  </div>
                </div>
              </div>

              {/* Connection Requests & Active Connections */}
              {(incomingRequests.length > 0 || outgoingRequests.length > 0 || acceptedConnections.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3.5 space-y-2">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                        Pending Connection Requests ({incomingRequests.length + outgoingRequests.length})
                      </div>
                      {incomingRequests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#0D1014] px-3 py-2 text-xs">
                          <span className="font-bold text-white">{req.requesterName} wants to connect</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onRespondConnection?.(req.id, 'accepted')}
                              className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => onRespondConnection?.(req.id, 'declined')}
                              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                      {outgoingRequests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#0D1014] px-3 py-2 text-xs">
                          <span className="text-slate-300">Invite sent to <strong className="text-white">{req.recipientName}</strong></span>
                          <button
                            type="button"
                            onClick={() => onRemoveConnection?.(req.id)}
                            className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-red-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {acceptedConnections.length > 0 && (
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3.5 space-y-2">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" />
                        My Connections ({acceptedConnections.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {acceptedConnections.map((conn) => {
                          const otherUid = conn.requesterId === myUid ? conn.recipientId : conn.requesterId;
                          const otherName = conn.requesterId === myUid ? conn.recipientName : conn.requesterName;
                          const dirEntry = onlinePilots.find((p) => p.uid === otherUid);
                          return (
                            <div
                              key={conn.id}
                              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0D1014] px-3 py-1.5 text-xs"
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  dirEntry?.isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                                }`}
                              />
                              <span className="font-bold text-white">{dirEntry?.username || otherName}</span>
                              {dirEntry && (
                                <span className="font-mono-tabular text-[11px] text-amber-300">
                                  Lv {dirEntry.level} · {dirEntry.wins}W
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => onRemoveConnection?.(conn.id)}
                                className="ml-1 text-slate-500 hover:text-red-400"
                                title="Remove connection"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Search & Filter */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={pilotSearch}
                    onChange={(e) => setPilotSearch(e.target.value)}
                    placeholder="Search pilots by username, clan tag, team, or bot..."
                    className="w-full rounded-xl border border-slate-700 bg-[#0D1014] pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOnlineOnlyFilter((v) => !v)}
                  className={`rounded-xl border px-3.5 py-2 min-h-[38px] text-xs font-bold transition ${
                    onlineOnlyFilter
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : 'border-slate-700 bg-[#1A2029] text-slate-300 hover:text-white'
                  }`}
                >
                  {onlineOnlyFilter ? 'Showing Online Only' : 'Show Online Only'}
                </button>
              </div>

              {/* Directory List */}
              {filteredPilots.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-[#0D1014] p-8 text-center text-xs text-slate-400">
                  No matching pilots found right now. Claim your username or invite friends to sign in with email!
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPilots.map((pilot) => {
                    const isSelf = pilot.uid === myUid;
                    const existingConn = connections.find(
                      (c) => c.users.includes(pilot.uid) && c.users.includes(myUid),
                    );
                    const statusLabel = !pilot.isOnline
                      ? 'Offline'
                      : pilot.status === 'fighting'
                        ? 'In Arena'
                        : pilot.status === 'searching'
                          ? 'Queueing'
                          : 'In Garage';
                    const statusColor = !pilot.isOnline
                      ? 'text-slate-400 bg-slate-800/80 border-slate-700'
                      : pilot.status === 'fighting'
                        ? 'text-rose-200 bg-rose-500/20 border-rose-500/50'
                        : 'text-emerald-200 bg-emerald-500/15 border-emerald-500/40';

                    return (
                      <div
                        key={pilot.uid}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 ${
                          isSelf
                            ? 'border-amber-500/70 bg-amber-500/10'
                            : 'border-slate-800 bg-[#161B22]'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span
                            className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                              pilot.isOnline ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-display text-sm font-extrabold text-white">
                                [{pilot.clanTag}] {pilot.username}
                              </span>
                              {isSelf && (
                                <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-300">
                                  YOU
                                </span>
                              )}
                              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusColor}`}>
                                {statusLabel}
                              </span>
                              {pilot.teamName && (
                                <span className="rounded-md border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                                  Team: {pilot.teamName}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              Bot: <span className="text-slate-200 font-semibold">{pilot.botName}</span>
                              {pilot.primaryWeapon ? ` · ${pilot.primaryWeapon}` : ''}
                              {pilot.pilotTitle ? ` · ${pilot.pilotTitle}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="grid grid-cols-4 gap-2 rounded-lg border border-slate-800 bg-[#0D1014] px-2.5 py-1.5 text-center font-mono-tabular text-[11px]">
                            <div>
                              <div className="text-[9px] text-slate-500">LVL</div>
                              <div className="font-extrabold text-amber-300">{pilot.level}</div>
                            </div>
                            <div>
                              <div className="text-[9px] text-slate-500">W-L</div>
                              <div className="font-bold text-emerald-300">
                                {pilot.wins}-{pilot.losses}
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] text-slate-500">KOs</div>
                              <div className="font-bold text-white">{pilot.kos}</div>
                            </div>
                            <div>
                              <div className="text-[9px] text-slate-500">ELO</div>
                              <div className="font-bold text-sky-300">{pilot.rating}</div>
                            </div>
                          </div>

                          {!isSelf && onSendConnection && (
                            existingConn?.status === 'accepted' ? (
                              <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300">
                                <Check className="h-3.5 w-3.5" />
                                Connected
                              </span>
                            ) : existingConn?.status === 'pending' ? (
                              <span className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">
                                Pending
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onSendConnection(pilot.uid, pilot.username)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 min-h-[38px] text-xs font-extrabold text-slate-950 hover:bg-amber-400 transition"
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                Connect
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {activeTab === 'pvp' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">Live PvP Win / Loss Ladder</h3>
                  <p className="text-xs text-slate-400">
                    Real pilots only. The server records every ranked fight; ratings move by Elo.
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                  {isOnline ? (presence ? `${presence.online} online · ${presence.fighting} fighting` : 'Connecting...') : 'Offline'}
                </div>
              </div>
              {pvpBoard.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-[#0F1318] p-6 text-center text-sm text-slate-400">
                  No ranked PvP fights yet. Open Deploy Arena, go to Online PvP, and challenge a real pilot.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0F1318] text-slate-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Pilot</th>
                        <th className="px-3 py-2">Bot</th>
                        <th className="px-3 py-2 text-right">W</th>
                        <th className="px-3 py-2 text-right">L</th>
                        <th className="px-3 py-2 text-right">D</th>
                        <th className="px-3 py-2 text-right">Win %</th>
                        <th className="px-3 py-2 text-right">KOs</th>
                        <th className="px-3 py-2 text-right">Streak</th>
                        <th className="px-3 py-2 text-right">Rating</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono-tabular">
                      {pvpBoard.map((r, i) => {
                        const games = r.wins + r.losses + r.draws;
                        const mine = r.id === profile.id;
                        return (
                          <tr key={r.id} className={`border-t border-slate-800 ${mine ? 'bg-amber-500/10' : ''}`}>
                            <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                            <td className="px-3 py-2 font-sans font-semibold text-white">
                              [{r.clanTag}] {r.name}
                              {mine && <span className="ml-1.5 text-[10px] text-amber-300">YOU</span>}
                            </td>
                            <td className="px-3 py-2 font-sans text-slate-300">{r.botName}</td>
                            <td className="px-3 py-2 text-right text-emerald-300">{r.wins}</td>
                            <td className="px-3 py-2 text-right text-red-300">{r.losses}</td>
                            <td className="px-3 py-2 text-right text-slate-400">{r.draws}</td>
                            <td className="px-3 py-2 text-right text-white">{games ? Math.round((r.wins / games) * 100) : 0}%</td>
                            <td className="px-3 py-2 text-right text-slate-300">{r.kos}</td>
                            <td className={`px-3 py-2 text-right ${r.streak > 0 ? 'text-emerald-300' : r.streak < 0 ? 'text-red-300' : 'text-slate-400'}`}>
                              {r.streak > 0 ? `W${r.streak}` : r.streak < 0 ? `L${-r.streak}` : '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-amber-300">{r.rating}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'rankings' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Aetheris Global Arena Standings
                  </h3>
                  <p className="text-xs text-slate-400">
                    Your Rating:{' '}
                    <span className="font-mono-tabular text-amber-400 font-semibold">{profile.rating}</span>
                    {' · '}Record {profile.wins}W - {profile.losses}L · {profile.kos} KOs · Gauntlet Stage{' '}
                    {profile.gauntletStage}
                  </p>
                </div>
                {!isOnline && (
                  <span className="text-xs text-amber-400">Showing cached standings (Offline)</span>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0D1014] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Rank</th>
                      <th className="py-2.5 px-3 font-medium">Pilot</th>
                      <th className="py-2.5 px-3 font-medium">Bot Build</th>
                      <th className="py-2.5 px-3 font-medium text-right">W / L · KOs</th>
                      <th className="py-2.5 px-3 font-medium text-right">Power</th>
                      <th className="py-2.5 px-3 font-medium text-right">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-[#161B22]">
                    {leaderboard.map((row, idx) => {
                      const isSelf = row.id === profile.id;
                      return (
                        <tr key={row.id} className={isSelf ? 'bg-amber-500/10' : ''}>
                          <td className="py-2.5 px-3 font-mono-tabular font-bold text-slate-300">
                            #{idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-white">
                              [{row.clanTag}] {row.name}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {row.botName} ·{' '}
                            <span className="text-slate-400">
                              {row.weapon} / {row.armor}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-300">
                            {row.wins}W / {row.losses}L · {row.kos} KO
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-400">
                            {row.powerScore}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-amber-400">
                            {row.rating}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'clans' && (
            <div className="space-y-6">
              {/* Combat Teams (2-6 Pilot Squads) */}
              <div className="rounded-2xl border border-sky-500/40 bg-[#0F141D] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-white">
                      Combat Teams (Up to 6 Pilots per Squad)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Form a squad with your connections or join an open team for 2v2 War fights.
                    </p>
                  </div>
                  {profile.teamName && (
                    <span className="rounded-lg border border-sky-400/50 bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-200">
                      Active Team: {profile.teamName}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {teams.length === 0 ? (
                      <div className="rounded-xl border border-slate-800 bg-[#141A24] p-4 text-xs text-slate-400">
                        No Combat Teams formed yet. Create the first team right beside this panel!
                      </div>
                    ) : (
                      teams.map((team) => {
                        const isMember = team.memberIds.includes(myUid) || profile.teamId === team.id;
                        const isFull = team.memberIds.length >= 6;
                        return (
                          <div
                            key={team.id}
                            className={`rounded-xl border p-3 ${
                              isMember ? 'border-sky-400 bg-sky-500/10' : 'border-slate-800 bg-[#151B25]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold text-white truncate">
                                  [{team.tag}] {team.name}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">
                                  {team.motto || 'Ready for 2v2 arena combat'} · Leader: {team.leaderName}
                                </div>
                              </div>
                              {isMember ? (
                                <button
                                  type="button"
                                  onClick={() => onLeaveTeam?.(team.id)}
                                  className="rounded-lg border border-red-500/50 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-500/20 shrink-0"
                                >
                                  Leave
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isFull}
                                  onClick={() => onJoinTeam?.(team.id)}
                                  className="rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-extrabold text-slate-950 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 shrink-0"
                                >
                                  {isFull ? 'Full (6/6)' : 'Join Team'}
                                </button>
                              )}
                            </div>
                            <div className="mt-1.5 flex items-center gap-3 text-[11px] font-mono-tabular text-slate-400">
                              <span className="text-sky-300">{team.memberIds.length}/6 Pilots</span>
                              <span>·</span>
                              <span>{team.wins} Wins</span>
                              <span>·</span>
                              <span>ELO {team.rating}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Create Combat Team Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newTeamName.trim() || !newTeamTag.trim()) return;
                      onCreateTeam?.(newTeamName, newTeamTag, newTeamMotto);
                      setNewTeamName('');
                      setNewTeamTag('');
                      setNewTeamMotto('');
                    }}
                    className="rounded-xl border border-slate-800 bg-[#141A24] p-3.5 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="text-xs font-extrabold text-sky-300">Create New Combat Team</div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Team Name"
                          maxLength={28}
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          className="col-span-2 rounded-lg border border-slate-700 bg-[#0D1014] px-3 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="TAG"
                          maxLength={5}
                          value={newTeamTag}
                          onChange={(e) => setNewTeamTag(e.target.value.toUpperCase())}
                          className="rounded-lg border border-slate-700 bg-[#0D1014] px-3 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Squad motto (optional)"
                        maxLength={80}
                        value={newTeamMotto}
                        onChange={(e) => setNewTeamMotto(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-[#0D1014] px-3 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="mt-2.5 w-full rounded-lg bg-sky-500 py-2 min-h-[38px] text-xs font-extrabold text-slate-950 hover:bg-sky-400 transition"
                    >
                      + Create & Join Combat Team
                    </button>
                  </form>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Clan Bracket & Roster */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-display text-lg font-bold text-white">
                        Syndicate Clan War Bracket
                      </h3>
                      <p className="text-xs text-slate-400">
                        Pledge to a clan or found your own syndicate for War Points
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onStartClanWarMatch(false)}
                        className="rounded-xl border border-amber-500/60 bg-amber-500/15 px-3 py-2 min-h-[38px] text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition whitespace-nowrap"
                      >
                        1v1 Clan Duel
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartClanWarMatch(true)}
                        className="rounded-xl bg-amber-500 px-3.5 py-2 min-h-[38px] text-xs font-bold text-slate-950 hover:bg-amber-400 transition whitespace-nowrap"
                      >
                        2v2 Clan Team War
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {clans.map((clan) => {
                      const isMember = clan.id === profile.clanId;
                      return (
                        <div
                          key={clan.id}
                          className={`rounded-xl border p-3.5 ${
                            isMember
                              ? 'border-amber-500/70 bg-amber-500/8'
                              : 'border-slate-800 bg-[#161B22]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-bold text-white">
                                Seed #{clan.tournamentSeed} · [{clan.tag}] {clan.name}
                              </div>
                              {clan.perkLabel && (
                                <div className="text-[11px] font-semibold text-emerald-400 mt-0.5">
                                  Faction Doctrine: {clan.perkLabel}
                                </div>
                              )}
                              <div className="text-xs text-slate-400 mt-0.5">{clan.motto}</div>
                            </div>
                            {!isMember ? (
                              <button
                                type="button"
                                onClick={() => onJoinClan(clan.id)}
                                className="rounded-lg border border-slate-600 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-slate-200 hover:border-amber-400"
                              >
                                Pledge
                              </button>
                            ) : (
                              <span className="rounded-md bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-300">
                                Active Clan
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 font-mono-tabular">
                            <span className="text-amber-400 font-semibold">{clan.warPoints} War Pts</span>
                            <span aria-hidden="true">·</span>
                            <span>{clan.wins} Team Wins</span>
                            <span aria-hidden="true">·</span>
                            <span>{clan.memberCount} Pilots</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Create New Clan */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newClanName.trim() || !newClanTag.trim()) return;
                      onCreateClan(newClanName, newClanTag, newClanMotto);
                      setNewClanName('');
                      setNewClanTag('');
                      setNewClanMotto('');
                    }}
                    className="mt-4 rounded-xl border border-slate-800 bg-[#0D1014] p-3.5"
                  >
                    <div className="text-xs font-semibold text-slate-200 mb-2">Found a Custom Clan</div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Clan Name"
                        value={newClanName}
                        onChange={(e) => setNewClanName(e.target.value)}
                        className="col-span-2 rounded-lg border border-slate-700 bg-[#161B22] px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="TAG"
                        maxLength={5}
                        value={newClanTag}
                        onChange={(e) => setNewClanTag(e.target.value.toUpperCase())}
                        className="rounded-lg border border-slate-700 bg-[#161B22] px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="Clan motto (optional)"
                        value={newClanMotto}
                        onChange={(e) => setNewClanMotto(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-700 bg-[#161B22] px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-slate-200 px-3.5 py-2 min-h-[38px] text-xs font-bold text-slate-950 hover:bg-white"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                </div>

                {/* Live Clan Comms */}
                <div className="flex flex-col rounded-xl border border-slate-800 bg-[#0D1014] p-4 min-h-[340px]">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div>
                      <div className="text-sm font-bold text-white">
                        {myClan ? `[${myClan.tag}] ${myClan.name} Comms` : 'Clan Comms'}
                      </div>
                      <div className="text-xs text-slate-400">Synced clan squad channel</div>
                    </div>
                    <Shield className="h-4 w-4 text-amber-400" />
                  </div>

                  <div className="flex-1 overflow-y-auto py-3 space-y-2.5 max-h-[320px]">
                    {myClan && myClan.chat.length > 0 ? (
                      myClan.chat.map((m) => (
                        <div key={m.id} className="rounded-lg bg-[#161B22] px-3 py-2 text-xs">
                          <span className="font-semibold text-amber-400">{m.sender}: </span>
                          <span className="text-slate-200">{m.text}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 py-8 text-center">
                        No squad messages yet. Coordinate your tournament strategy below.
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!myClan || !chatText.trim()) return;
                      onSendClanChat(myClan.id, chatText);
                      setChatText('');
                    }}
                    className="mt-2 flex gap-2 border-t border-slate-800 pt-3"
                  >
                    <input
                      type="text"
                      placeholder={isOnline ? 'Message clan mates...' : 'Post tactical note...'}
                      disabled={!myClan}
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-700 bg-[#161B22] px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!myClan}
                      className="flex items-center justify-center rounded-lg bg-amber-500 px-3.5 min-h-[40px] text-slate-950 hover:bg-amber-400 disabled:opacity-40"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Season 05 · Aetheris Ascension Operations
                  </h3>
                  <p className="text-xs text-slate-400">
                    Complete seasonal arena campaigns to earn Alloy Scrap, Skill Cores, and Pilot Titles.
                    Current Wins: <span className="text-amber-400 font-bold">{profile.wins}</span> · KOs:{' '}
                    <span className="text-emerald-400 font-bold">{profile.kos}</span>
                  </p>
                </div>
                {profile.pilotTitle && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
                    <Award className="h-4 w-4" />
                    Active Title: {profile.pilotTitle}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {seasonalEvents.map((ev) => {
                  const claimed = profile.claimedEvents.includes(ev.id);
                  const progress = Math.min(ev.targetWins, profile.wins);
                  const ready = progress >= ev.targetWins && !claimed;

                  return (
                    <div
                      key={ev.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#161B22] p-4"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-amber-400">{ev.modifierLabel}</span>
                          {ev.badgeTitle && (
                            <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-300">
                              Title: {ev.badgeTitle}
                            </span>
                          )}
                        </div>
                        <h4 className="mt-1 font-display text-base font-bold text-white">{ev.title}</h4>
                        <p className="mt-1 text-xs text-slate-400 leading-relaxed">{ev.description}</p>
                      </div>

                      <div className="mt-4">
                        <div className="flex justify-between text-xs font-mono-tabular text-slate-300 mb-1">
                          <span>Objective Progress</span>
                          <span>
                            {progress} / {ev.targetWins} Wins
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${Math.min(100, (progress / ev.targetWins) * 100)}%` }}
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-300 font-mono-tabular">
                            +{ev.rewardScrap} Scrap · +{ev.rewardSkillPoints} SP
                          </span>
                          <div className="flex items-center gap-1.5">
                            {onDeployEventArena && !claimed && (
                              <button
                                type="button"
                                onClick={() => onDeployEventArena(ev.arenaId)}
                                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#0D1014] px-2.5 py-1.5 min-h-[34px] text-xs font-semibold text-slate-200 hover:border-amber-400"
                              >
                                <Play className="h-3 w-3 text-amber-400" />
                                Deploy
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={!ready}
                              onClick={() => onClaimEventReward(ev)}
                              className={`rounded-lg px-3 py-1.5 min-h-[34px] text-xs font-bold transition ${
                                claimed
                                  ? 'bg-slate-800 text-slate-500'
                                  : ready
                                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                                    : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {claimed ? 'Claimed' : ready ? 'Claim' : 'Locked'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 8-Node Engineering Skill Tree */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">
                      Aetheris Engineering Skill Tree (8 Systems)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Available:{' '}
                      <span className="font-mono-tabular text-amber-400 font-bold">
                        {profile.skillPoints} Skill Points
                      </span>
                      {' · '}
                      <span className="font-mono-tabular text-amber-300 font-bold">{coinsBalance} Coins</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {SKILL_META.map(({ key, label, effect }) => {
                    const rank = profile.skills[key] ?? 0;
                    const maxed = rank >= 5;
                    const scrapCost = 100 + rank * 60;
                    const canUpgrade = !maxed && (profile.skillPoints >= 1 || coinsBalance >= scrapCost);
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#161B22] p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white">
                            {label}{' '}
                            <span className="font-mono-tabular text-xs text-amber-400">
                              Lv {rank}/5
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">{effect}</div>
                        </div>
                        <button
                          type="button"
                          disabled={!canUpgrade}
                          onClick={() => onUpgradeSkill(key)}
                          className="rounded-lg bg-amber-500 px-3 py-2 min-h-[38px] text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 transition whitespace-nowrap shrink-0"
                        >
                          {maxed
                            ? 'Maxed'
                            : profile.skillPoints >= 1
                              ? 'Upgrade (1 SP)'
                              : `Upgrade (${scrapCost} Coins)`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile, Battery Saver & Profile Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">
                      Pilot Identity & Device Optimization
                    </h3>
                    <p className="text-xs text-slate-400">
                      Customize title, frame rate profile, touch controls & iOS download
                    </p>
                  </div>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="rounded-xl border border-sky-500/50 bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/25 shrink-0"
                    >
                      Simple Settings Hub
                    </button>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#161B22] p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Pilot Callsign (Edit unique username in Settings)
                      </label>
                      <input
                        type="text"
                        maxLength={24}
                        value={profile.callsign}
                        onChange={(e) => onUpdateProfile({ callsign: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-[#0D1014] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Pilot Combat Title
                      </label>
                      <input
                        type="text"
                        maxLength={24}
                        value={profile.pilotTitle || 'Aetheris Vanguard'}
                        onChange={(e) => onUpdateProfile({ pilotTitle: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-[#0D1014] px-3 py-2 text-sm text-amber-400 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
                      <BatteryCharging className="h-4 w-4 text-emerald-400" />
                      <span>Battery & Frame Rate Profile</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'eco', label: 'Eco 30fps', sub: 'Max Battery' },
                          { id: 'balanced', label: 'Balanced', sub: 'Mobile Default' },
                          { id: 'ultra', label: 'Ultra 60fps', sub: 'Full DPR' },
                        ] as Array<{ id: BatteryMode; label: string; sub: string }>
                      ).map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => onUpdateProfile({ batteryMode: b.id })}
                          className={`rounded-xl border p-2.5 text-left transition ${
                            profile.batteryMode === b.id
                              ? 'border-emerald-500 bg-emerald-500/15'
                              : 'border-slate-800 bg-[#0D1014] hover:border-slate-600'
                          }`}
                        >
                          <div className="text-xs font-bold text-white">{b.label}</div>
                          <div className="text-[11px] text-slate-400">{b.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-2">
                      On-Screen Touch Joystick
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'auto', label: 'Auto Detect' },
                          { id: 'always', label: 'Always Show' },
                          { id: 'off', label: 'Keyboard Only' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onUpdateProfile({ touchControlsMode: t.id })}
                          className={`rounded-lg border py-2 px-2.5 min-h-[40px] text-xs font-semibold transition ${
                            profile.touchControlsMode === t.id
                              ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                              : 'border-slate-800 bg-[#0D1014] text-slate-300'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                    <div className="text-xs text-slate-400">
                      Download for iOS (Home Screen App) & offline play
                    </div>
                    <PWAInstallButton alwaysShowIOSOption />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
