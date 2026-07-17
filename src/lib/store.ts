// ===== English Plus - App Store (Zustand) =====
'use client';
import { create } from 'zustand';
import type { Settings, Student } from './types';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from './db';

export type ScreenKey =
  | 'dashboard'
  | 'students'
  | 'student_profile'
  | 'add_student'
  | 'groups'
  | 'group_details'
  | 'add_group'
  | 'groups_schedule'
  | 'attendance'
  | 'scanner'
  | 'kiosk'
  | 'today_class'
  | 'subscriptions'
  | 'reports'
  | 'whatsapp'
  | 'notifications'
  | 'settings'
  | 'archive'
  | 'app_lock'
  | 'revenue_forecast'
  | 'contact_log'
  | 'calendar'
  | 'todo';

interface AppState {
  // navigation
  screen: ScreenKey;
  params: Record<string, string>;
  history: Array<{ screen: ScreenKey; params: Record<string, string> }>;
  navigate: (screen: ScreenKey, params?: Record<string, string>) => void;
  back: () => void;

  // settings
  settings: Settings;
  setSettings: (s: Settings) => void;

  // global refresh trigger (for refreshing lists after mutations)
  refreshKey: number;
  triggerRefresh: () => void;

  // app lock
  locked: boolean;
  setLocked: (v: boolean) => void;

  // initialized?
  initialized: boolean;
  setInitialized: (v: boolean) => void;
}

export const useApp = create<AppState>((set, get) => ({
  screen: 'dashboard',
  params: {},
  history: [],
  navigate: (screen, params = {}) => {
    const { screen: curScreen, params: curParams, history } = get();
    set({
      screen,
      params,
      history: [...history, { screen: curScreen, params: curParams }].slice(-30),
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },
  back: () => {
    const { history } = get();
    if (history.length === 0) {
      set({ screen: 'dashboard', params: {} });
      return;
    }
    const prev = history[history.length - 1];
    set({
      screen: prev.screen,
      params: prev.params,
      history: history.slice(0, -1),
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  settings: DEFAULT_SETTINGS,
  setSettings: (s) => {
    saveSettings(s);
    set({ settings: s });
  },

  refreshKey: 0,
  triggerRefresh: () => set((st) => ({ refreshKey: st.refreshKey + 1 })),

  locked: false,
  setLocked: (v) => set({ locked: v }),

  initialized: false,
  setInitialized: (v) => set({ initialized: v }),
}));

export function initSettings(): Settings {
  const s = loadSettings();
  useApp.setState({ settings: s });
  return s;
}
