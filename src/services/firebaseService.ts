import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Unsubscribe,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  isFallbackFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  applyAdminFullUnlock,
  computeBotStats,
  getBotWeapons,
  isAdminIdentifier,
  type ClanChatMessage,
  type ClanInfo,
  type CombatTeamInfo,
  type PilotConnectionRecord,
  type PilotDirectoryEntry,
  type PlayerProfile,
} from '../shared/types';
import {
  loadPlayerProfile,
  makeDefaultProfile,
  sanitizeProfile,
  savePlayerProfile,
  setSavedSessionUid,
} from './storage';

// Route cloud persistence and real-time directory operations through the server /api/cloud/* store
// so username + access code accounts work without requiring Firebase Email Auth.
let useServerCloudStore = true;

interface ServerCloudStatePayload {
  pilots: PilotDirectoryEntry[];
  connections: PilotConnectionRecord[];
  teams: CombatTeamInfo[];
  clans: ClanInfo[];
  clanMessages: ClanChatMessage[];
}

const cloudPollListeners = new Set<() => void>();

function triggerCloudStateRefresh() {
  cloudPollListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore listener error
    }
  });
}

async function postCloudJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchServerCloudState(
  uid?: string,
  clanId?: string,
): Promise<ServerCloudStatePayload | null> {
  try {
    const params = new URLSearchParams();
    if (uid) params.set('uid', uid);
    if (clanId) params.set('clanId', clanId);
    const res = await fetch(`/api/cloud/state?${params.toString()}`);
    if (!res.ok) return null;
    return (await res.json()) as ServerCloudStatePayload;
  } catch {
    return null;
  }
}

export function subscribeAuthState(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogleEmail(): Promise<User> {
  const res = await signInWithPopup(auth, googleAuthProvider);
  return res.user;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const res = await signInWithEmailAndPassword(auth, email.trim(), password);
  return res.user;
}

export async function registerWithEmailPassword(email: string, password: string): Promise<User> {
  const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (!res.user.emailVerified) {
    await sendEmailVerification(res.user);
  }
  return res.user;
}

export async function resendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function refreshAuthUser(user: User): Promise<User> {
  await reload(user);
  return auth.currentUser ?? user;
}

export async function signOutAccount(): Promise<void> {
  setSavedSessionUid(null);
  try {
    await signOut(auth);
  } catch {
    // Ignore if Firebase auth is unused
  }
}

export function normalizeUsernameKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
}

export function formatDisplayUsername(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  return trimmed.slice(0, 24);
}

function generateLocalAccessCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += alphabet[Math.floor(Math.random() * alphabet.length)];
    part2 += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `AETH-${part1}-${part2}`;
}

export async function registerUsernameWithCode(
  rawUsername: string,
  baseProfile: PlayerProfile,
): Promise<{
  ok: boolean;
  code?: string;
  isAdmin?: boolean;
  profile?: PlayerProfile;
  error?: string;
}> {
  const trimmed = rawUsername.trim();
  const isAdmin = isAdminIdentifier(trimmed);
  const display = isAdmin ? 'The_Architect' : formatDisplayUsername(trimmed);
  const usernameKey = isAdmin ? 'the_architect' : normalizeUsernameKey(display);

  if (!isAdmin && (usernameKey.length < 3 || usernameKey.length > 24)) {
    return {
      ok: false,
      error: 'Username must be 3–24 characters (letters, numbers, or underscores).',
    };
  }

  try {
    const res = await fetch('/api/cloud/code-auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: trimmed,
        starterProfile: baseProfile,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      uid?: string;
      code?: string;
      isAdmin?: boolean;
      profile?: PlayerProfile;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || 'Could not register that username.',
      };
    }
    const uid = data.uid || (isAdmin ? 'admin_the_architect' : `pilot_${usernameKey}`);
    const code = data.code || (isAdmin ? '9822' : generateLocalAccessCode());
    let nextProfile = sanitizeProfile(
      {
        ...(data.profile ?? baseProfile),
        id: uid,
        callsign: isAdmin ? 'The_Architect' : display,
        usernameClaimed: true,
        accessCode: code,
        isAdmin: Boolean(data.isAdmin || isAdmin),
      },
      uid,
      isAdmin ? 'aisystemsarchitect@gmail.com' : undefined,
    );
    if (isAdmin || data.isAdmin) {
      nextProfile = applyAdminFullUnlock(nextProfile);
    }
    setSavedSessionUid(uid);
    savePlayerProfile(nextProfile, uid);
    triggerCloudStateRefresh();
    return {
      ok: true,
      code: nextProfile.accessCode || code,
      isAdmin: Boolean(nextProfile.isAdmin),
      profile: nextProfile,
    };
  } catch {
    // Offline fallback
    const uid = isAdmin ? 'admin_the_architect' : `pilot_${usernameKey}_${Date.now().toString(36)}`;
    const code = isAdmin ? '9822' : generateLocalAccessCode();
    let nextProfile: PlayerProfile = {
      ...makeDefaultProfile(
        uid,
        isAdmin ? 'aisystemsarchitect@gmail.com' : undefined,
        isAdmin ? 'The_Architect' : display,
      ),
      id: uid,
      callsign: isAdmin ? 'The_Architect' : display,
      usernameClaimed: true,
      accessCode: code,
      isAdmin,
    };
    if (isAdmin) {
      nextProfile = applyAdminFullUnlock(nextProfile);
    }
    setSavedSessionUid(uid);
    savePlayerProfile(nextProfile, uid);
    return {
      ok: true,
      code,
      isAdmin,
      profile: nextProfile,
    };
  }
}

export async function loginWithAccessCode(
  rawCode: string,
  baseProfile: PlayerProfile,
): Promise<{
  ok: boolean;
  code?: string;
  isAdmin?: boolean;
  profile?: PlayerProfile;
  error?: string;
}> {
  const trimmed = rawCode.trim();
  if (!trimmed) {
    return { ok: false, error: 'Please enter your login access code.' };
  }
  const isAdmin = isAdminIdentifier(trimmed);

  try {
    const res = await fetch('/api/cloud/code-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: trimmed }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      uid?: string;
      code?: string;
      isAdmin?: boolean;
      profile?: PlayerProfile;
      error?: string;
    };
    if (res.ok && data.ok && data.profile) {
      const uid = data.uid || data.profile.id || (isAdmin ? 'admin_the_architect' : baseProfile.id);
      const code = data.code || data.profile.accessCode || (isAdmin ? '9822' : trimmed.toUpperCase());
      let nextProfile = sanitizeProfile(
        {
          ...data.profile,
          id: uid,
          usernameClaimed: true,
          accessCode: code,
          isAdmin: Boolean(data.isAdmin || isAdmin || data.profile.isAdmin),
        },
        uid,
        data.profile.email,
      );
      if (nextProfile.isAdmin || isAdmin) {
        nextProfile = applyAdminFullUnlock(nextProfile);
      }
      setSavedSessionUid(uid);
      savePlayerProfile(nextProfile, uid);
      triggerCloudStateRefresh();
      return {
        ok: true,
        code: nextProfile.accessCode || code,
        isAdmin: Boolean(nextProfile.isAdmin),
        profile: nextProfile,
      };
    }

    if (!isAdmin) {
      return {
        ok: false,
        error: data.error || 'Access code not found. Double-check your saved login code.',
      };
    }
  } catch {
    if (!isAdmin) {
      // Check if local profile matches the code
      if (
        baseProfile.accessCode &&
        baseProfile.accessCode.toUpperCase() === trimmed.toUpperCase()
      ) {
        const loaded: PlayerProfile = { ...baseProfile, usernameClaimed: true };
        setSavedSessionUid(loaded.id);
        savePlayerProfile(loaded, loaded.id);
        return { ok: true, code: loaded.accessCode, isAdmin: Boolean(loaded.isAdmin), profile: loaded };
      }
      return {
        ok: false,
        error: 'Unable to verify code while offline.',
      };
    }
  }

  // Fallback for Admin master unlock
  const adminUid = 'admin_the_architect';
  const adminProfile = applyAdminFullUnlock(
    makeDefaultProfile(adminUid, 'aisystemsarchitect@gmail.com', 'The_Architect'),
  );
  setSavedSessionUid(adminUid);
  savePlayerProfile(adminProfile, adminUid);
  triggerCloudStateRefresh();
  return {
    ok: true,
    code: '9822',
    isAdmin: true,
    profile: adminProfile,
  };
}

export async function hydrateCodeSessionAccount(
  uid: string,
  localProfile: PlayerProfile,
): Promise<PlayerProfile> {
  const email = localProfile.email || 'pilot@aetheris.local';
  const { profile } = await loadOrCreateViaServerStore(uid, email, localProfile);
  return profile;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function clampStr(v: string | null | undefined, minLen: number, maxLen: number, fallback: string): string {
  const clean = (v ?? '').trim();
  if (clean.length < minLen) return fallback.slice(0, maxLen);
  return clean.slice(0, maxLen);
}

function toInt(n: number | undefined, min = 0, fallback = 0): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return Math.max(min, fallback);
  return Math.max(min, Math.round(n));
}

function buildMutableAccountPayload(profile: PlayerProfile) {
  const currency = toInt(profile.coins ?? profile.scrap, 0, 200);
  const callsign = clampStr(profile.callsign, 2, 24, `Pilot_${profile.id.slice(-4)}`);
  const clanTag = clampStr(profile.clanTag, 1, 6, 'AETH').toUpperCase();

  return stripUndefinedDeep({
    callsign,
    accessCode: profile.accessCode ? profile.accessCode.slice(0, 32) : undefined,
    isAdmin: Boolean(profile.isAdmin),
    pilotTitle: (profile.pilotTitle ?? 'Aetheris Initiate').slice(0, 36),
    clanId: profile.clanId ?? null,
    clanTag,
    teamId: profile.teamId ?? null,
    teamName: profile.teamName ? profile.teamName.slice(0, 32) : null,
    level: toInt(profile.level, 1, 1),
    xp: toInt(profile.xp, 0, 0),
    coins: currency,
    scrap: currency,
    skillPoints: toInt(profile.skillPoints, 0, 0),
    rating: Math.min(9999, toInt(profile.rating, 0, 1200)),
    wins: toInt(profile.wins, 0, 0),
    losses: toInt(profile.losses, 0, 0),
    kos: toInt(profile.kos, 0, 0),
    gauntletStage: toInt(profile.gauntletStage, 1, 1),
    bestSurvivalWave: toInt(profile.bestSurvivalWave, 0, 0),
    activeLoadoutSlot: toInt(profile.activeLoadoutSlot, 0, 0),
    selectedWingmanIndex: toInt(profile.selectedWingmanIndex, -1, 0),
    ownedParts: (profile.ownedParts ?? []).slice(0, 160),
    unlockedArenas: (profile.unlockedArenas ?? ['foundry', 'colosseum']).slice(0, 32),
    partUpgrades: profile.partUpgrades ?? {},
    skills: profile.skills,
    botConfig: profile.botConfig,
    savedLoadouts: (profile.savedLoadouts ?? []).slice(0, 6),
    customGarageBots: (profile.customGarageBots ?? []).slice(0, 24),
    campaignStars: profile.campaignStars ?? {},
    arenaWins: profile.arenaWins ?? {},
    claimedEvents: (profile.claimedEvents ?? []).slice(0, 64),
    favorites: profile.favorites ?? {
      weapons: ['vspinner', 'hbar', 'sawblade'],
      chassis: ['wedge', 'brawler', 'rammer'],
      arenas: ['foundry', 'colosseum'],
      builds: [],
    },
    batteryMode: profile.batteryMode ?? 'balanced',
    controlScheme: profile.controlScheme ?? 'wasd_drive',
    deviceLayoutMode: profile.deviceLayoutMode ?? 'auto',
    touchControlsMode: profile.touchControlsMode ?? 'auto',
    muted: Boolean(profile.muted),
    commentaryMuted: Boolean(profile.commentaryMuted),
    commentaryDefaultOffApplied: true,
    masterVolume: typeof profile.masterVolume === 'number' ? profile.masterVolume : 0.85,
    musicVolume: typeof profile.musicVolume === 'number' ? profile.musicVolume : 0.65,
    sfxVolume: typeof profile.sfxVolume === 'number' ? profile.sfxVolume : 0.85,
    crowdVolume: typeof profile.crowdVolume === 'number' ? profile.crowdVolume : 0.7,
    commentaryVolume: typeof profile.commentaryVolume === 'number' ? profile.commentaryVolume : 0.9,
    traditionalMode: Boolean(profile.traditionalMode),
    usernameClaimed: Boolean(profile.usernameClaimed),
  });
}

function buildPilotUpdateFields(
  profile: PlayerProfile,
  status: 'garage' | 'searching' | 'fighting' | 'offline' = 'garage',
): Omit<PilotDirectoryEntry, 'uid' | 'isPublic'> {
  const username = clampStr(profile.callsign, 2, 24, `Pilot_${profile.id.slice(-4)}`);
  const usernameLower = (normalizeUsernameKey(username) || `pilot_${profile.id.slice(-4)}`).slice(0, 24);
  const stats = computeBotStats(profile.botConfig, profile.skills, profile.partUpgrades);
  const primaryWeapon = getBotWeapons(profile.botConfig)[0] ?? 'vspinner';

  return stripUndefinedDeep({
    username,
    usernameLower: usernameLower.length >= 2 ? usernameLower : `pilot_${profile.id.slice(-3)}`,
    pilotTitle: (profile.pilotTitle ?? 'Aetheris Initiate').slice(0, 36),
    clanId: profile.clanId ?? null,
    clanTag: clampStr(profile.clanTag, 1, 6, 'AETH').toUpperCase(),
    teamId: profile.teamId ?? null,
    teamName: profile.teamName ? profile.teamName.slice(0, 32) : null,
    level: toInt(profile.level, 1, 1),
    rating: Math.min(9999, toInt(profile.rating, 0, 1200)),
    wins: toInt(profile.wins, 0, 0),
    losses: toInt(profile.losses, 0, 0),
    kos: toInt(profile.kos, 0, 0),
    powerScore: toInt(stats.powerScore, 0, 100),
    botName: clampStr(profile.botConfig.name, 1, 28, 'Aetheris MK-I'),
    primaryWeapon,
    primaryArmor: profile.botConfig.armor ?? 'titanium',
    isOnline: status !== 'offline',
    status,
    lastSeenAt: Date.now(),
  });
}

async function loadOrCreateViaServerStore(
  uid: string,
  email: string,
  starterProfile: PlayerProfile,
): Promise<{ profile: PlayerProfile; isNewAccount: boolean }> {
  const pilotEntry: PilotDirectoryEntry = {
    uid,
    isPublic: true,
    ...buildPilotUpdateFields(starterProfile, 'garage'),
  };
  const res = await postCloudJson<{ exists: boolean; profile?: PlayerProfile }>(
    '/api/cloud/account/load',
    {
      uid,
      email,
      starterProfile,
      pilotEntry,
    },
  );
  if (res && res.profile) {
    const sanitized = sanitizeProfile(res.profile, uid, email);
    const hydrated: PlayerProfile = {
      ...sanitized,
      id: uid,
      email,
      usernameClaimed: Boolean(res.profile.usernameClaimed),
    };
    savePlayerProfile(hydrated, uid);
    triggerCloudStateRefresh();
    return { profile: hydrated, isNewAccount: !res.exists };
  }
  const cached = loadPlayerProfile(uid);
  const fallback = cached.id === uid ? { ...cached, id: uid, email } : starterProfile;
  savePlayerProfile(fallback, uid);
  return { profile: fallback, isNewAccount: cached.id !== uid };
}

export async function loadOrCreateUserAccount(
  user: User,
  desiredUsername?: string,
): Promise<{ profile: PlayerProfile; isNewAccount: boolean }> {
  try {
    await user.getIdToken();
  } catch {
    // Proceed if offline
  }
  const uid = user.uid;
  const email = user.email || 'pilot@aetheris.local';
  const accountPath = `users/${uid}/private/account`;
  const pilotPath = `pilots/${uid}`;
  const accountRef = doc(db, 'users', uid, 'private', 'account');
  const pilotRef = doc(db, 'pilots', uid);

  const rawCandidate =
    desiredUsername ||
    formatDisplayUsername(user.displayName || email.split('@')[0] || '');
  const fallbackName =
    rawCandidate && rawCandidate.length >= 3
      ? rawCandidate
      : `Pilot_${uid.slice(0, 5).toUpperCase()}`;
  const starterProfile: PlayerProfile = {
    ...makeDefaultProfile(uid, email, fallbackName),
    usernameClaimed: false,
  };

  if (useServerCloudStore) {
    return loadOrCreateViaServerStore(uid, email, starterProfile);
  }

  let accountSnap;
  try {
    accountSnap = await getDoc(accountRef);
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return loadOrCreateViaServerStore(uid, email, starterProfile);
    }
    handleFirestoreError(err, OperationType.GET, accountPath);
  }

  if (accountSnap && accountSnap.exists()) {
    const raw = accountSnap.data() as Partial<PlayerProfile>;
    const sanitized = sanitizeProfile(raw, uid, email);
    const lowerKey = normalizeUsernameKey(sanitized.callsign);
    let claimed = Boolean(sanitized.usernameClaimed);
    if (!claimed && lowerKey.length >= 3) {
      try {
        const uSnap = await getDoc(doc(db, 'usernames', lowerKey));
        if (uSnap.exists() && (uSnap.data() as { uid?: string }).uid === uid) {
          claimed = true;
        }
      } catch {
        // Ignore
      }
    }
    const loaded: PlayerProfile = {
      ...sanitized,
      id: uid,
      email,
      usernameClaimed: claimed,
    };
    savePlayerProfile(loaded, uid);

    const mutablePilot = buildPilotUpdateFields(loaded, 'garage');
    // Mirror to server cloud store so multi-user directory is always in sync
    void postCloudJson('/api/cloud/account/save', {
      uid,
      profile: loaded,
      pilotEntry: { uid, ...mutablePilot },
    });

    try {
      const pSnap = await getDoc(pilotRef);
      if (!pSnap.exists()) {
        await setDoc(pilotRef, {
          uid,
          ...mutablePilot,
          isPublic: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(pilotRef, {
          ...mutablePilot,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      if (!isFallbackFirestoreError(err)) {
        handleFirestoreError(err, OperationType.WRITE, pilotPath);
      }
    }

    return { profile: loaded, isNewAccount: false };
  }

  const mutableAccount = buildMutableAccountPayload(starterProfile);
  try {
    await setDoc(accountRef, {
      uid,
      email,
      ...mutableAccount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return loadOrCreateViaServerStore(uid, email, starterProfile);
    }
    handleFirestoreError(err, OperationType.CREATE, accountPath);
  }

  const mutablePilot = buildPilotUpdateFields(starterProfile, 'garage');
  try {
    await setDoc(pilotRef, {
      uid,
      ...mutablePilot,
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (!isFallbackFirestoreError(err)) {
      handleFirestoreError(err, OperationType.CREATE, pilotPath);
    }
  }

  void postCloudJson('/api/cloud/account/save', {
    uid,
    profile: starterProfile,
    pilotEntry: { uid, ...mutablePilot },
  });
  savePlayerProfile(starterProfile, uid);
  return { profile: starterProfile, isNewAccount: true };
}

export async function saveUserAccount(
  uid: string,
  profile: PlayerProfile,
  status: 'garage' | 'searching' | 'fighting' | 'offline' = 'garage',
): Promise<void> {
  if (!uid) return;
  const mutablePilot = buildPilotUpdateFields(profile, status);

  // Always persist to server store for instant reliability
  void postCloudJson('/api/cloud/account/save', {
    uid,
    profile,
    pilotEntry: { uid, isPublic: true, ...mutablePilot },
  }).then(() => triggerCloudStateRefresh());

  if (useServerCloudStore || !auth.currentUser || !auth.currentUser.emailVerified) return;

  const accountPath = `users/${uid}/private/account`;
  const pilotPath = `pilots/${uid}`;
  const accountRef = doc(db, 'users', uid, 'private', 'account');
  const pilotRef = doc(db, 'pilots', uid);

  const mutableAccount = buildMutableAccountPayload(profile);
  try {
    await updateDoc(accountRef, {
      ...mutableAccount,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('No document to update') || msg.includes('not-found')) {
      try {
        await setDoc(accountRef, {
          uid,
          email: profile.email || auth.currentUser.email || 'pilot@aetheris.local',
          ...mutableAccount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (createErr) {
        if (isFallbackFirestoreError(createErr)) {
          useServerCloudStore = true;
          return;
        }
        handleFirestoreError(createErr, OperationType.CREATE, accountPath);
      }
    } else {
      handleFirestoreError(err, OperationType.UPDATE, accountPath);
    }
  }

  try {
    await updateDoc(pilotRef, {
      ...mutablePilot,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('No document to update') || msg.includes('not-found')) {
      try {
        await setDoc(pilotRef, {
          uid,
          ...mutablePilot,
          isPublic: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (createErr) {
        if (!isFallbackFirestoreError(createErr)) {
          handleFirestoreError(createErr, OperationType.CREATE, pilotPath);
        }
      }
    } else {
      handleFirestoreError(err, OperationType.UPDATE, pilotPath);
    }
  }
}

export async function setPilotPresenceStatus(
  uid: string,
  status: 'garage' | 'searching' | 'fighting' | 'offline',
): Promise<void> {
  if (!uid) return;
  void postCloudJson('/api/cloud/pilot/status', { uid, status });
  if (useServerCloudStore || !auth.currentUser || !auth.currentUser.emailVerified) return;
  const pilotRef = doc(db, 'pilots', uid);
  try {
    await updateDoc(pilotRef, {
      isOnline: status !== 'offline',
      status,
      lastSeenAt: Date.now(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Ignore transient heartbeat errors
  }
}

async function claimUsernameViaServerStore(
  uid: string,
  display: string,
  newKey: string,
  oldKey: string,
  profile: PlayerProfile,
): Promise<{ ok: boolean; username?: string; error?: string }> {
  const email = profile.email || auth.currentUser?.email || 'pilot@aetheris.local';
  const nextProfile: PlayerProfile = {
    ...profile,
    id: uid,
    email,
    callsign: display,
    usernameClaimed: true,
  };
  const pilotEntry: PilotDirectoryEntry = {
    uid,
    isPublic: true,
    ...buildPilotUpdateFields(nextProfile, 'garage'),
  };
  const res = await postCloudJson<{ ok: boolean; username?: string; error?: string }>(
    '/api/cloud/username/claim',
    {
      uid,
      display,
      newKey,
      oldKey,
      profile: nextProfile,
      pilotEntry,
    },
  );
  if (res) {
    if (res.ok && res.username) {
      savePlayerProfile(nextProfile, uid);
      triggerCloudStateRefresh();
    }
    return res;
  }
  savePlayerProfile(nextProfile, uid);
  return { ok: true, username: display };
}

export async function claimUniqueUsername(
  uid: string,
  rawUsername: string,
  profile: PlayerProfile,
): Promise<{ ok: boolean; username?: string; error?: string }> {
  const display = formatDisplayUsername(rawUsername);
  const newKey = normalizeUsernameKey(display);
  if (newKey.length < 3 || newKey.length > 24) {
    return {
      ok: false,
      error: 'Username must be 3–24 characters using letters, numbers, or underscores.',
    };
  }

  const oldKey = normalizeUsernameKey(profile.callsign);

  if (useServerCloudStore || !auth.currentUser || !auth.currentUser.emailVerified) {
    return claimUsernameViaServerStore(uid, display, newKey, oldKey, profile);
  }

  const newUsernameRef = doc(db, 'usernames', newKey);
  const oldUsernameRef = oldKey.length >= 3 && oldKey !== newKey ? doc(db, 'usernames', oldKey) : null;
  const accountRef = doc(db, 'users', uid, 'private', 'account');
  const pilotRef = doc(db, 'pilots', uid);

  try {
    if (auth.currentUser) {
      await auth.currentUser.getIdToken();
    }
  } catch {
    // Proceed if offline
  }

  try {
    const outcome = await runTransaction(db, async (tx) => {
      const [targetSnap, accountSnap, pilotSnap, oldSnap] = await Promise.all([
        tx.get(newUsernameRef),
        tx.get(accountRef),
        tx.get(pilotRef),
        oldUsernameRef && profile.usernameClaimed ? tx.get(oldUsernameRef) : Promise.resolve(null),
      ]);

      if (targetSnap.exists()) {
        const owner = (targetSnap.data() as { uid?: string }).uid;
        if (owner !== uid) {
          return { ok: false as const, error: `Username "${display}" is already taken.` };
        }
      }

      if (oldUsernameRef && oldSnap && oldSnap.exists()) {
        const oldOwner = (oldSnap.data() as { uid?: string }).uid;
        if (oldOwner === uid) {
          tx.delete(oldUsernameRef);
        }
      }

      if (!targetSnap.exists()) {
        tx.set(newUsernameRef, {
          uid,
          username: display,
          createdAt: serverTimestamp(),
        });
      } else if ((targetSnap.data() as { username?: string }).username !== display) {
        tx.update(newUsernameRef, {
          username: display,
          updatedAt: serverTimestamp(),
        });
      }

      const email = profile.email || auth.currentUser?.email || 'pilot@aetheris.local';
      const nextProfile: PlayerProfile = {
        ...profile,
        id: uid,
        email,
        callsign: display,
        usernameClaimed: true,
      };

      if (accountSnap.exists()) {
        tx.update(accountRef, {
          callsign: display,
          usernameClaimed: true,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(accountRef, {
          uid,
          email,
          ...buildMutableAccountPayload(nextProfile),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (pilotSnap.exists()) {
        tx.update(pilotRef, {
          username: display,
          usernameLower: newKey,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(pilotRef, {
          uid,
          ...buildPilotUpdateFields(nextProfile, 'garage'),
          isPublic: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      return { ok: true as const, username: display };
    });

    if (outcome.ok && outcome.username) {
      await claimUsernameViaServerStore(uid, display, newKey, oldKey, profile);
    }

    return outcome;
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return claimUsernameViaServerStore(uid, display, newKey, oldKey, profile);
    }
    handleFirestoreError(err, OperationType.WRITE, `usernames/${newKey}`);
  }
}

export function subscribeOnlinePilots(
  cb: (pilots: PilotDirectoryEntry[]) => void,
): Unsubscribe {
  let pollTimer: number | null = null;
  let stopped = false;

  const pullFromServer = async () => {
    if (stopped) return;
    const state = await fetchServerCloudState();
    if (!stopped && state?.pilots) {
      cb(state.pilots);
    }
  };

  const startServerPolling = () => {
    if (pollTimer !== null || stopped) return;
    void pullFromServer();
    cloudPollListeners.add(pullFromServer);
    pollTimer = window.setInterval(() => {
      void pullFromServer();
    }, 6000);
  };

  if (useServerCloudStore) {
    startServerPolling();
    return () => {
      stopped = true;
      cloudPollListeners.delete(pullFromServer);
      if (pollTimer !== null) window.clearInterval(pollTimer);
    };
  }

  const q = query(collection(db, 'pilots'), where('isPublic', '==', true));
  const unsubFirestore = onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const list: PilotDirectoryEntry[] = [];
      snap.forEach((d) => {
        const data = d.data() as PilotDirectoryEntry;
        const activelyOnline = Boolean(data.isOnline) && now - (data.lastSeenAt || 0) < 180_000;
        list.push({
          ...data,
          isOnline: activelyOnline,
        });
      });
      list.sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        if (b.level !== a.level) return b.level - a.level;
        return b.rating - a.rating;
      });
      cb(list);
    },
    (err) => {
      if (isFallbackFirestoreError(err)) {
        useServerCloudStore = true;
        startServerPolling();
        return;
      }
      handleFirestoreError(err, OperationType.LIST, 'pilots');
    },
  );

  return () => {
    stopped = true;
    unsubFirestore();
    cloudPollListeners.delete(pullFromServer);
    if (pollTimer !== null) window.clearInterval(pollTimer);
  };
}

export function subscribeConnections(
  uid: string,
  cb: (connections: PilotConnectionRecord[]) => void,
): Unsubscribe {
  let pollTimer: number | null = null;
  let stopped = false;

  const pullFromServer = async () => {
    if (stopped) return;
    const state = await fetchServerCloudState(uid);
    if (!stopped && state?.connections) {
      cb(state.connections);
    }
  };

  const startServerPolling = () => {
    if (pollTimer !== null || stopped) return;
    void pullFromServer();
    cloudPollListeners.add(pullFromServer);
    pollTimer = window.setInterval(() => {
      void pullFromServer();
    }, 6000);
  };

  if (useServerCloudStore) {
    startServerPolling();
    return () => {
      stopped = true;
      cloudPollListeners.delete(pullFromServer);
      if (pollTimer !== null) window.clearInterval(pollTimer);
    };
  }

  const q = query(collection(db, 'connections'), where('users', 'array-contains', uid));
  const unsubFirestore = onSnapshot(
    q,
    (snap) => {
      const list: PilotConnectionRecord[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<PilotConnectionRecord, 'id'>;
        list.push({ id: d.id, ...data });
      });
      cb(list);
    },
    (err) => {
      if (isFallbackFirestoreError(err)) {
        useServerCloudStore = true;
        startServerPolling();
        return;
      }
      handleFirestoreError(err, OperationType.LIST, 'connections');
    },
  );

  return () => {
    stopped = true;
    unsubFirestore();
    cloudPollListeners.delete(pullFromServer);
    if (pollTimer !== null) window.clearInterval(pollTimer);
  };
}

export async function sendConnectionRequest(
  myUid: string,
  myName: string,
  targetUid: string,
  targetName: string,
): Promise<void> {
  if (!myUid || !targetUid || myUid === targetUid) return;
  const users = [myUid, targetUid].sort() as [string, string];
  const connId = `${users[0]}__${users[1]}`;
  const path = `connections/${connId}`;
  const ref = doc(db, 'connections', connId);

  const record: PilotConnectionRecord = {
    id: connId,
    users,
    requesterId: myUid,
    recipientId: targetUid,
    requesterName: clampStr(myName, 1, 24, 'Pilot'),
    recipientName: clampStr(targetName, 1, 24, 'Pilot'),
    status: 'pending',
  };

  await postCloudJson('/api/cloud/connections/request', { connId, record });
  triggerCloudStateRefresh();
  if (useServerCloudStore) return;

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const status = (existing.data() as { status?: string }).status;
      if (status === 'pending' || status === 'accepted') return;
      await deleteDoc(ref);
    }
    await setDoc(ref, {
      users,
      requesterId: myUid,
      recipientId: targetUid,
      requesterName: record.requesterName,
      recipientName: record.recipientName,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return;
    }
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function respondToConnectionRequest(
  connId: string,
  decision: 'accepted' | 'declined',
): Promise<void> {
  await postCloudJson('/api/cloud/connections/respond', { connId, decision });
  triggerCloudStateRefresh();
  if (useServerCloudStore) return;

  const path = `connections/${connId}`;
  try {
    if (decision === 'declined') {
      await deleteDoc(doc(db, 'connections', connId));
      return;
    }
    await updateDoc(doc(db, 'connections', connId), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return;
    }
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function removeConnection(connId: string): Promise<void> {
  await postCloudJson('/api/cloud/connections/remove', { connId });
  triggerCloudStateRefresh();
  if (useServerCloudStore) return;

  const path = `connections/${connId}`;
  try {
    await deleteDoc(doc(db, 'connections', connId));
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return;
    }
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeTeams(cb: (teams: CombatTeamInfo[]) => void): Unsubscribe {
  let pollTimer: number | null = null;
  let stopped = false;

  const pullFromServer = async () => {
    if (stopped) return;
    const state = await fetchServerCloudState();
    if (!stopped && state?.teams) {
      cb(state.teams);
    }
  };

  const startServerPolling = () => {
    if (pollTimer !== null || stopped) return;
    void pullFromServer();
    cloudPollListeners.add(pullFromServer);
    pollTimer = window.setInterval(() => {
      void pullFromServer();
    }, 6000);
  };

  if (useServerCloudStore) {
    startServerPolling();
    return () => {
      stopped = true;
      cloudPollListeners.delete(pullFromServer);
      if (pollTimer !== null) window.clearInterval(pollTimer);
    };
  }

  const q = query(collection(db, 'teams'), where('isPublic', '==', true));
  const unsubFirestore = onSnapshot(
    q,
    (snap) => {
      const list: CombatTeamInfo[] = [];
      snap.forEach((d) => {
        list.push(d.data() as CombatTeamInfo);
      });
      list.sort((a, b) => b.wins - a.wins || b.rating - a.rating);
      cb(list);
    },
    (err) => {
      if (isFallbackFirestoreError(err)) {
        useServerCloudStore = true;
        startServerPolling();
        return;
      }
      handleFirestoreError(err, OperationType.LIST, 'teams');
    },
  );

  return () => {
    stopped = true;
    unsubFirestore();
    cloudPollListeners.delete(pullFromServer);
    if (pollTimer !== null) window.clearInterval(pollTimer);
  };
}

export async function createCombatTeam(
  uid: string,
  profile: PlayerProfile,
  name: string,
  tag: string,
  motto: string,
): Promise<CombatTeamInfo> {
  const teamId = `team_${Date.now().toString(36)}_${uid.slice(0, 6)}`;
  const cleanName = clampStr(name, 2, 32, 'Alpha Squad');
  const cleanTag = clampStr(tag.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(), 2, 5, 'SQD');
  const cleanMotto = (motto || 'Coordinated arena domination.').trim().slice(0, 90);
  const leaderName = clampStr(profile.callsign, 2, 24, 'Pilot');

  const teamObj: CombatTeamInfo = {
    id: teamId,
    name: cleanName,
    tag: cleanTag,
    motto: cleanMotto,
    leaderId: uid,
    leaderName,
    clanId: profile.clanId ?? null,
    memberIds: [uid],
    memberNames: [leaderName],
    wins: 0,
    rating: toInt(profile.rating, 0, 1200),
    isPublic: true,
  };

  await postCloudJson('/api/cloud/teams/create', { uid, team: teamObj });
  triggerCloudStateRefresh();
  if (useServerCloudStore) return teamObj;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'teams', teamId), {
      ...teamObj,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', uid, 'private', 'account'), {
      teamId,
      teamName: cleanName,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'pilots', uid), {
      teamId,
      teamName: cleanName,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return teamObj;
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return teamObj;
    }
    handleFirestoreError(err, OperationType.CREATE, `teams/${teamId}`);
  }
}

export async function joinCombatTeam(
  uid: string,
  callsign: string,
  teamId: string,
): Promise<CombatTeamInfo | null> {
  const display = clampStr(callsign, 2, 24, 'Pilot');
  const serverRes = await postCloudJson<{ ok: boolean; team: CombatTeamInfo | null }>(
    '/api/cloud/teams/join',
    { uid, callsign: display, teamId },
  );
  triggerCloudStateRefresh();
  if (useServerCloudStore) {
    return serverRes?.team ?? null;
  }

  const teamRef = doc(db, 'teams', teamId);
  try {
    const joined = await runTransaction(db, async (tx) => {
      const snap = await tx.get(teamRef);
      if (!snap.exists()) return null;
      const data = snap.data() as CombatTeamInfo;
      if (data.memberIds.includes(uid)) return data;
      if (data.memberIds.length >= 6) return null;

      const nextIds = [...data.memberIds, uid];
      const nextNames = [...data.memberNames, display];
      tx.update(teamRef, {
        memberIds: nextIds,
        memberNames: nextNames,
        updatedAt: serverTimestamp(),
      });
      tx.update(doc(db, 'users', uid, 'private', 'account'), {
        teamId: data.id,
        teamName: data.name,
        updatedAt: serverTimestamp(),
      });
      tx.update(doc(db, 'pilots', uid), {
        teamId: data.id,
        teamName: data.name,
        updatedAt: serverTimestamp(),
      });
      return { ...data, memberIds: nextIds, memberNames: nextNames };
    });
    return joined ?? serverRes?.team ?? null;
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return serverRes?.team ?? null;
    }
    handleFirestoreError(err, OperationType.UPDATE, `teams/${teamId}`);
  }
}

export async function leaveCombatTeam(uid: string, teamId: string): Promise<void> {
  await postCloudJson('/api/cloud/teams/leave', { uid, teamId });
  triggerCloudStateRefresh();
  if (useServerCloudStore) return;

  const teamRef = doc(db, 'teams', teamId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(teamRef);
      if (snap.exists()) {
        const data = snap.data() as CombatTeamInfo;
        const idx = data.memberIds.indexOf(uid);
        if (idx >= 0) {
          if (data.leaderId === uid || data.memberIds.length <= 1) {
            tx.delete(teamRef);
          } else {
            const nextIds = data.memberIds.filter((id) => id !== uid);
            const nextNames = data.memberNames.filter((_, i) => i !== idx);
            tx.update(teamRef, {
              memberIds: nextIds,
              memberNames: nextNames,
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
      tx.update(doc(db, 'users', uid, 'private', 'account'), {
        teamId: null,
        teamName: null,
        updatedAt: serverTimestamp(),
      });
      tx.update(doc(db, 'pilots', uid), {
        teamId: null,
        teamName: null,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return;
    }
    handleFirestoreError(err, OperationType.UPDATE, `teams/${teamId}`);
  }
}

export function subscribeFirestoreClans(
  fallbackClans: ClanInfo[],
  cb: (clans: ClanInfo[]) => void,
): Unsubscribe {
  let pollTimer: number | null = null;
  let stopped = false;

  const pullFromServer = async () => {
    if (stopped) return;
    const state = await fetchServerCloudState();
    if (!stopped && state?.clans && state.clans.length > 0) {
      cb(state.clans);
    }
  };

  const startServerPolling = () => {
    if (pollTimer !== null || stopped) return;
    void pullFromServer();
    cloudPollListeners.add(pullFromServer);
    pollTimer = window.setInterval(() => {
      void pullFromServer();
    }, 6000);
  };

  if (useServerCloudStore) {
    startServerPolling();
    return () => {
      stopped = true;
      cloudPollListeners.delete(pullFromServer);
      if (pollTimer !== null) window.clearInterval(pollTimer);
    };
  }

  const q = query(collection(db, 'clans'), where('isPublic', '==', true));
  const unsubFirestore = onSnapshot(
    q,
    (snap) => {
      const byId = new Map<string, ClanInfo>();
      for (const fc of fallbackClans) byId.set(fc.id, { ...fc });
      snap.forEach((d) => {
        const data = d.data() as {
          id: string;
          name: string;
          tag: string;
          motto: string;
          perkLabel?: string;
          warPoints: number;
          memberCount: number;
          wins: number;
          tournamentSeed: number;
        };
        const existing = byId.get(data.id);
        byId.set(data.id, {
          id: data.id,
          name: data.name,
          tag: data.tag,
          motto: data.motto,
          perkLabel: data.perkLabel ?? existing?.perkLabel,
          warPoints: data.warPoints,
          memberCount: data.memberCount,
          wins: data.wins,
          tournamentSeed: data.tournamentSeed,
          chat: existing?.chat ?? [],
        });
      });
      const sorted = [...byId.values()]
        .sort((a, b) => b.warPoints - a.warPoints)
        .map((c, idx) => ({ ...c, tournamentSeed: idx + 1 }));
      cb(sorted);
    },
    (err) => {
      if (isFallbackFirestoreError(err)) {
        useServerCloudStore = true;
        startServerPolling();
        return;
      }
      handleFirestoreError(err, OperationType.LIST, 'clans');
    },
  );

  return () => {
    stopped = true;
    unsubFirestore();
    cloudPollListeners.delete(pullFromServer);
    if (pollTimer !== null) window.clearInterval(pollTimer);
  };
}

export async function ensureAndJoinClanInFirestore(
  uid: string,
  callsign: string,
  clan: ClanInfo,
): Promise<void> {
  await postCloudJson('/api/cloud/clans/join', { uid, clan });
  triggerCloudStateRefresh();
  if (useServerCloudStore) return;

  const clanRef = doc(db, 'clans', clan.id);
  const memberRef = doc(db, 'clans', clan.id, 'members', uid);
  const username = clampStr(callsign, 2, 24, 'Pilot');

  try {
    const [clanSnap, memberSnap] = await Promise.all([getDoc(clanRef), getDoc(memberRef)]);
    const batch = writeBatch(db);
    if (!clanSnap.exists()) {
      batch.set(clanRef, {
        id: clan.id,
        name: clampStr(clan.name, 2, 32, 'Clan'),
        tag: clampStr(clan.tag, 2, 5, 'CLAN').toUpperCase(),
        motto: (clan.motto || 'Built for arena supremacy.').slice(0, 100),
        perkLabel: (clan.perkLabel || '').slice(0, 80),
        leaderId: uid,
        warPoints: toInt(clan.warPoints, 0, 500),
        memberCount: toInt(clan.memberCount, 1, 1),
        wins: toInt(clan.wins, 0, 0),
        tournamentSeed: toInt(clan.tournamentSeed, 1, 1),
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (!memberSnap.exists()) {
      const curCount = toInt((clanSnap.data() as { memberCount?: number }).memberCount, 0, 0);
      batch.update(clanRef, {
        memberCount: curCount + 1,
        updatedAt: serverTimestamp(),
      });
    }

    if (!memberSnap.exists()) {
      batch.set(memberRef, {
        uid,
        clanId: clan.id,
        username,
        role: !clanSnap.exists() ? 'leader' : 'member',
        joinedAt: serverTimestamp(),
      });
    }

    batch.update(doc(db, 'users', uid, 'private', 'account'), {
      clanId: clan.id,
      clanTag: clampStr(clan.tag, 1, 6, 'CLAN').toUpperCase(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'pilots', uid), {
      clanId: clan.id,
      clanTag: clampStr(clan.tag, 1, 6, 'CLAN').toUpperCase(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, `clans/${clan.id}/members/${uid}`);
  }
}

export async function createClanInFirestore(
  uid: string,
  callsign: string,
  name: string,
  tag: string,
  motto: string,
  seedCount: number,
): Promise<ClanInfo> {
  const cleanTag = clampStr(tag.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(), 2, 5, 'CLAN');
  const cleanName = clampStr(name, 2, 32, 'Custom Syndicate');
  const cleanMotto = (motto || 'Built for arena supremacy.').trim().slice(0, 100);
  const clanId = `clan_${Date.now().toString(36)}_${uid.slice(0, 5)}`;
  const username = clampStr(callsign, 2, 24, 'Pilot');

  const newClan: ClanInfo = {
    id: clanId,
    name: cleanName,
    tag: cleanTag,
    motto: cleanMotto,
    perkLabel: '+6% Custom Syndicate Doctrine',
    warPoints: 600,
    memberCount: 1,
    wins: 0,
    tournamentSeed: Math.max(1, seedCount + 1),
    chat: [],
  };

  await postCloudJson('/api/cloud/clans/create', { uid, clan: newClan });
  triggerCloudStateRefresh();
  if (useServerCloudStore) return newClan;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'clans', clanId), {
      id: clanId,
      name: cleanName,
      tag: cleanTag,
      motto: cleanMotto,
      perkLabel: newClan.perkLabel,
      leaderId: uid,
      warPoints: 600,
      memberCount: 1,
      wins: 0,
      tournamentSeed: newClan.tournamentSeed,
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'clans', clanId, 'members', uid), {
      uid,
      clanId,
      username,
      role: 'leader',
      joinedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', uid, 'private', 'account'), {
      clanId,
      clanTag: cleanTag,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'pilots', uid), {
      clanId,
      clanTag: cleanTag,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return newClan;
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return newClan;
    }
    handleFirestoreError(err, OperationType.CREATE, `clans/${clanId}`);
  }
}

export function subscribeClanMessages(
  clanId: string,
  uid: string,
  cb: (messages: ClanChatMessage[]) => void,
): Unsubscribe {
  let pollTimer: number | null = null;
  let stopped = false;

  const pullFromServer = async () => {
    if (stopped) return;
    const state = await fetchServerCloudState(uid, clanId);
    if (!stopped && state?.clanMessages) {
      cb(state.clanMessages);
    }
  };

  const startServerPolling = () => {
    if (pollTimer !== null || stopped) return;
    void pullFromServer();
    cloudPollListeners.add(pullFromServer);
    pollTimer = window.setInterval(() => {
      void pullFromServer();
    }, 5000);
  };

  if (useServerCloudStore) {
    startServerPolling();
    return () => {
      stopped = true;
      cloudPollListeners.delete(pullFromServer);
      if (pollTimer !== null) window.clearInterval(pollTimer);
    };
  }

  const q = query(collection(db, 'clans', clanId, 'messages'), where('clanId', '==', clanId));
  const unsubFirestore = onSnapshot(
    q,
    (snap) => {
      const list: Array<ClanChatMessage & { _ms: number }> = [];
      snap.forEach((d) => {
        const data = d.data() as {
          id: string;
          sender: string;
          text: string;
          createdAt?: { toMillis?: () => number; toDate?: () => Date };
        };
        const ms = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();
        list.push({
          id: data.id || d.id,
          sender: data.sender,
          text: data.text,
          timestamp: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          _ms: ms,
        });
      });
      list.sort((a, b) => a._ms - b._ms);
      cb(list.slice(-30).map(({ _ms: _ignored, ...rest }) => rest));
    },
    (err) => {
      if (isFallbackFirestoreError(err)) {
        useServerCloudStore = true;
        startServerPolling();
        return;
      }
      handleFirestoreError(err, OperationType.LIST, `clans/${clanId}/messages`);
    },
  );

  return () => {
    stopped = true;
    unsubFirestore();
    cloudPollListeners.delete(pullFromServer);
    if (pollTimer !== null) window.clearInterval(pollTimer);
  };
}

export async function sendClanMessageInFirestore(
  uid: string,
  callsign: string,
  clan: ClanInfo,
  text: string,
): Promise<void> {
  const cleanText = text.trim().slice(0, 200);
  if (!cleanText) return;

  await postCloudJson('/api/cloud/clans/message', {
    uid,
    callsign,
    clan,
    text: cleanText,
  });
  triggerCloudStateRefresh();
  if (useServerCloudStore) return;

  await ensureAndJoinClanInFirestore(uid, callsign, clan);
  const msgId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const path = `clans/${clan.id}/messages/${msgId}`;
  try {
    await setDoc(doc(db, 'clans', clan.id, 'messages', msgId), {
      id: msgId,
      clanId: clan.id,
      senderId: uid,
      sender: clampStr(callsign, 2, 24, 'Pilot'),
      text: cleanText,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    if (isFallbackFirestoreError(err)) {
      useServerCloudStore = true;
      return;
    }
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}
