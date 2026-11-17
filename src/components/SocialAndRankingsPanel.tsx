import React, { useState } from 'react';
import {
  Award,
  BatteryCharging,
  Calendar,
  Play,
  Send,
  Shield,
  Sliders,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type {
  ArenaId,
  BatteryMode,
  ClanInfo,
  LeaderboardEntry,
  OnlinePresence,
  PlayerProfile,
  PvpRecord,
  SeasonalEvent,
  SkillTree,
} from '../shared/types';
import { PWAInstallButton } from './PWAInstallButton';

export type HubModalTab = 'rankings' | 'pvp' | 'clans' | 'events' | 'skills';

interface SocialAndRankingsPanelProps {
  activeTab: HubModalTab | null;
  profile: PlayerProfile;
  leaderboard: LeaderboardEntry[];
  pvpBoard: PvpRecord[];
  presence: OnlinePresence | null;
  clans: ClanInfo[];
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
}) => {
  const [newClanName, setNewClanName] = useState('');
  const [newClanTag, setNewClanTag] = useState('');
  const [newClanMotto, setNewClanMotto] = useState('');
  const [chatText, setChatText] = useState('');

  if (!activeTab) return null;

  const myClan = clans.find((c) => c.id === profile.clanId) || clans[0];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-6">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-700 bg-[#141920] shadow-2xl overflow-hidden">
        {/* Header Tabs */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: 'rankings', label: 'Global Rankings', Icon: Trophy },
                { id: 'pvp', label: 'PvP Ladder', Icon: Swords },
                { id: 'clans', label: 'Clans & Team Wars', Icon: Users },
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Clan Bracket & Roster */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">
                      Syndicate Clan War Bracket
                    </h3>
                    <p className="text-xs text-slate-400">
                      Pledge to a faction and fight 1v1 or 2v2 Clan Wars for War Points
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
                              Active Faction
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
                  <div className="text-xs font-semibold text-slate-200 mb-2">Found a Custom Syndicate</div>
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
                      maxLength={4}
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
                    <div className="text-xs text-slate-400">Real-time WebSocket squad channel</div>
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
                      <span className="font-mono-tabular text-slate-200">{profile.scrap} Scrap</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {SKILL_META.map(({ key, label, effect }) => {
                    const rank = profile.skills[key] ?? 0;
                    const maxed = rank >= 5;
                    const scrapCost = 100 + rank * 60;
                    const canUpgrade = !maxed && (profile.skillPoints >= 1 || profile.scrap >= scrapCost);
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
                              : `Upgrade (${scrapCost} Scrap)`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile, Battery Saver & Profile Settings */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Pilot Identity & Device Optimization
                  </h3>
                  <p className="text-xs text-slate-400">
                    Customize callsign, title, frame rate profile, and touch controls
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#161B22] p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Pilot Callsign
                      </label>
                      <input
                        type="text"
                        maxLength={20}
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

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <div className="text-xs text-slate-400">
                      Install as standalone offline mobile app
                    </div>
                    <PWAInstallButton />
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
