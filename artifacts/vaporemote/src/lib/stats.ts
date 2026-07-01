import type { VaporizerType } from "./bluetooth";

export interface Session {
  id: string;
  deviceId: string;
  deviceType: VaporizerType;
  deviceName: string;
  startedAt: number;
  endedAt?: number;
  peakTemp: number;
  targetTemp: number;
  avgTemp: number;
  durationSeconds: number;
  tempReadings: Array<{ timestamp: number; temp: number }>;
}

export interface DeviceStats {
  deviceId: string;
  deviceType: VaporizerType;
  deviceName: string;
  totalSessions: number;
  totalMinutes: number;
  avgSessionMinutes: number;
  favoriteTempC: number;
  lastUsed: number;
}

export interface TempPreset {
  label: string;
  temp: number;
}

export interface BalloonStep {
  type: "pump_on" | "pump_off" | "wait";
  durationSeconds: number;
  label?: string;
}

export interface BalloonRoutine {
  id: string;
  name: string;
  steps: BalloonStep[];
  createdAt: number;
}

const SESSIONS_KEY  = "vaporemote_sessions";
const SETTINGS_KEY  = "vaporemote_settings";
const PRESETS_KEY   = "vaporemote_presets";
const ROUTINES_KEY  = "vaporemote_balloon_routines";

const DEFAULT_PRESETS: Partial<Record<VaporizerType, TempPreset[]>> = {
  volcano_hybrid:    [{ label: "Mild", temp: 170 }, { label: "Med", temp: 185 }, { label: "Full", temp: 200 }, { label: "Hot", temp: 215 }],
  venty:             [{ label: "Low",  temp: 160 }, { label: "Med", temp: 180 }, { label: "High", temp: 200 }, { label: "Max", temp: 210 }],
  crafty_plus:       [{ label: "Low",  temp: 160 }, { label: "Med", temp: 180 }, { label: "High", temp: 200 }, { label: "Max", temp: 210 }],
  focus_carta:       [{ label: "Low",  temp: 157 }, { label: "Med", temp: 176 }, { label: "High", temp: 195 }, { label: "Max", temp: 210 }],
  focus_carta_sport: [{ label: "Low",  temp: 157 }, { label: "Med", temp: 176 }, { label: "High", temp: 195 }, { label: "Max", temp: 210 }],
  puffco_peak:       [{ label: "Low",  temp: 170 }, { label: "Med", temp: 195 }, { label: "High", temp: 215 }, { label: "Max", temp: 240 }],
  puffco_peak_pro:   [{ label: "Low",  temp: 170 }, { label: "Med", temp: 195 }, { label: "High", temp: 215 }, { label: "Max", temp: 240 }],
  dr_dabber_switch:  [{ label: "Low",  temp: 157 }, { label: "Med", temp: 195 }, { label: "High", temp: 230 }, { label: "Max", temp: 270 }],
  dr_dabber_boost_evo:[{ label:"Low",  temp: 157 }, { label: "Med", temp: 195 }, { label: "High", temp: 230 }, { label: "Max", temp: 270 }],
  arizer_solo:       [{ label: "1",    temp:  50 }, { label: "2",   temp: 130 }, { label: "3",   temp: 170  }, { label: "4",   temp: 210 }],
  arizer_air:        [{ label: "1",    temp:  50 }, { label: "2",   temp: 130 }, { label: "3",   temp: 170  }, { label: "4",   temp: 210 }],
  pax3:              [{ label: "Low",  temp: 182 }, { label: "Med", temp: 193 }, { label: "High", temp: 204 }, { label: "Max", temp: 215 }],
  davinci_iq2:       [{ label: "Low",  temp: 149 }, { label: "Med", temp: 177 }, { label: "High", temp: 199 }, { label: "Max", temp: 221 }],
};

const FALLBACK_PRESETS: TempPreset[] = [
  { label: "Low", temp: 170 }, { label: "Med", temp: 185 },
  { label: "High", temp: 200 }, { label: "Max", temp: 215 },
];

const DEFAULT_BALLOON_ROUTINES: BalloonRoutine[] = [
  {
    id: "builtin-easy",
    name: "Easy Fill",
    createdAt: 0,
    steps: [
      { type: "pump_on",  durationSeconds: 30, label: "Fill balloon" },
      { type: "pump_off", durationSeconds: 0 },
    ],
  },
  {
    id: "builtin-standard",
    name: "Standard",
    createdAt: 0,
    steps: [
      { type: "pump_on",  durationSeconds: 45, label: "Fill balloon" },
      { type: "pump_off", durationSeconds: 0 },
    ],
  },
  {
    id: "builtin-double",
    name: "Double Fill",
    createdAt: 0,
    steps: [
      { type: "pump_on",  durationSeconds: 30, label: "Fill #1" },
      { type: "pump_off", durationSeconds: 5,  label: "Swap balloon" },
      { type: "pump_on",  durationSeconds: 30, label: "Fill #2" },
      { type: "pump_off", durationSeconds: 0 },
    ],
  },
];

export function loadPresets(deviceType: VaporizerType): TempPreset[] {
  try {
    const raw = localStorage.getItem(`${PRESETS_KEY}_${deviceType}`);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return (DEFAULT_PRESETS[deviceType] ?? FALLBACK_PRESETS).slice();
}

export function savePresets(deviceType: VaporizerType, presets: TempPreset[]): void {
  try { localStorage.setItem(`${PRESETS_KEY}_${deviceType}`, JSON.stringify(presets)); }
  catch { /* quota */ }
}

export function loadBalloonRoutines(): BalloonRoutine[] {
  try {
    const raw = localStorage.getItem(ROUTINES_KEY);
    if (raw) {
      const saved: BalloonRoutine[] = JSON.parse(raw);
      const builtinIds = DEFAULT_BALLOON_ROUTINES.map(r => r.id);
      const custom = saved.filter(r => !builtinIds.includes(r.id));
      return [...DEFAULT_BALLOON_ROUTINES, ...custom];
    }
  } catch { /* */ }
  return DEFAULT_BALLOON_ROUTINES.slice();
}

export function saveBalloonRoutines(routines: BalloonRoutine[]): void {
  try {
    const builtinIds = DEFAULT_BALLOON_ROUTINES.map(r => r.id);
    const custom = routines.filter(r => !builtinIds.includes(r.id));
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(custom));
  } catch { /* quota */ }
}

export function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveSessions(sessions: Session[]): void {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(-500))); }
  catch { /* quota */ }
}

export function startSession(
  deviceId: string,
  deviceType: VaporizerType,
  deviceName: string,
  targetTemp: number
): Session {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    deviceId,
    deviceType,
    deviceName,
    startedAt: Date.now(),
    peakTemp: 0,
    targetTemp,
    avgTemp: 0,
    durationSeconds: 0,
    tempReadings: [],
  };
}

export function updateSession(session: Session, currentTemp: number): Session {
  const now = Date.now();
  const readings = [...session.tempReadings, { timestamp: now, temp: currentTemp }];
  const totalTemp = readings.reduce((s, r) => s + r.temp, 0);
  return {
    ...session,
    peakTemp: Math.max(session.peakTemp, currentTemp),
    avgTemp: totalTemp / readings.length,
    durationSeconds: (now - session.startedAt) / 1000,
    tempReadings: readings,
  };
}

export function endSession(session: Session): Session {
  return {
    ...session,
    endedAt: Date.now(),
    durationSeconds: (Date.now() - session.startedAt) / 1000,
  };
}

export function getDeviceStats(sessions: Session[]): DeviceStats[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!map.has(s.deviceId)) map.set(s.deviceId, []);
    map.get(s.deviceId)!.push(s);
  }
  return Array.from(map.entries()).map(([deviceId, deviceSessions]) => {
    const totalSeconds = deviceSessions.reduce((s, d) => s + d.durationSeconds, 0);
    const avgTarget =
      deviceSessions.reduce((s, d) => s + d.targetTemp, 0) / deviceSessions.length;
    const lastSession = deviceSessions.sort((a, b) => b.startedAt - a.startedAt)[0];
    return {
      deviceId,
      deviceType: lastSession.deviceType,
      deviceName: lastSession.deviceName,
      totalSessions: deviceSessions.length,
      totalMinutes: Math.round(totalSeconds / 60),
      avgSessionMinutes: Math.round(totalSeconds / deviceSessions.length / 60 * 10) / 10,
      favoriteTempC: Math.round(avgTarget),
      lastUsed: lastSession.startedAt,
    };
  });
}

export function getWeeklyData(sessions: Session[]): Array<{ day: string; sessions: number; minutes: number }> {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dayKey = d.toDateString();
    const daySessions = sessions.filter(s => new Date(s.startedAt).toDateString() === dayKey);
    return {
      day: days[d.getDay()],
      sessions: daySessions.length,
      minutes: Math.round(daySessions.reduce((s, d) => s + d.durationSeconds, 0) / 60),
    };
  });
}

export interface AppSettings {
  tempUnit: "C" | "F";
  dashboardWidgets: string[];
  darkMode: boolean;
  geekMode: boolean;
  autoReconnect: boolean;
  notificationsEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  tempUnit: "C",
  dashboardWidgets: ["device_cards", "active_temp", "battery", "session_timer", "quick_actions"],
  darkMode: true,
  geekMode: false,
  autoReconnect: true,
  notificationsEnabled: false,
};

export const ALL_WIDGETS = [
  { id: "device_cards",    label: "Device Cards",      description: "Connected device overview" },
  { id: "active_temp",     label: "Live Temperature",  description: "Real-time temperature gauge" },
  { id: "battery",         label: "Battery Status",    description: "Battery levels for all devices" },
  { id: "session_timer",   label: "Session Timer",     description: "Current session duration" },
  { id: "quick_actions",   label: "Quick Actions",     description: "Heat/fan/power controls" },
  { id: "weekly_chart",    label: "Weekly Overview",   description: "Sessions this week" },
  { id: "last_session",    label: "Last Session",      description: "Summary of last session" },
  { id: "temp_history",    label: "Temp History",      description: "Temperature trend chart" },
];

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

export function saveSettings(settings: AppSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  catch { /* quota */ }
}

export function formatTemp(celsius: number, unit: "C" | "F"): string {
  if (unit === "F") return `${Math.round(celsius * 9 / 5 + 32)}°F`;
  return `${Math.round(celsius)}°C`;
}
