// ===== English Plus - App Shell with bottom navigation =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB, loadSettings } from '@/lib/db';
import { checkUpcomingLessonsAndNotify, requestNotificationPermission, checkAndRunAutoBackup } from '@/lib/advanced';
import { toast } from 'sonner';
import { Dashboard } from '@/components/screens/Dashboard';
import { StudentsScreen } from '@/components/screens/StudentsScreen';
import { StudentProfile } from '@/components/screens/StudentProfile';
import { AddStudent } from '@/components/screens/AddStudent';
import { GroupsScreen } from '@/components/screens/GroupsScreen';
import { GroupsScheduleScreen } from '@/components/screens/GroupsScheduleScreen';
import { GroupDetails } from '@/components/screens/GroupDetails';
import { AddGroup } from '@/components/screens/AddGroup';
import { AttendanceScreen } from '@/components/screens/AttendanceScreen';
import { ScannerScreen } from '@/components/screens/ScannerScreen';
import { KioskScreen } from '@/components/screens/KioskScreen';
import { TodayClassScreen } from '@/components/screens/TodayClassScreen';
import { SubscriptionsScreen } from '@/components/screens/SubscriptionsScreen';
import { ReportsScreen } from '@/components/screens/ReportsScreen';
import { WhatsAppScreen } from '@/components/screens/WhatsAppScreen';
import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { ArchiveScreen } from '@/components/screens/ArchiveScreen';
import { AppLock } from '@/components/screens/AppLock';
import { NotificationsScreen } from '@/components/screens/NotificationsScreen';
import { BottomNav } from '@/components/BottomNav';
import { TopBar } from '@/components/TopBar';
import { UniversalSearch } from '@/components/UniversalSearch';
import { VoiceControlButton } from '@/components/VoiceControlButton';
import { ParentAppView } from '@/components/ParentAppView';
import { FloatingBackButton } from '@/components/FloatingBackButton';

export function AppShell() {
  const { screen, settings, initialized, setInitialized, setSettings, locked } = useApp();
  const [searchOpen, setSearchOpen] = useState(false);
  const [parentToken, setParentToken] = useState<string | null>(null);

  // Check for parent app mode (?parent=TOKEN)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const parent = params.get('parent');
      if (parent) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setParentToken(parent);
        return;
      }
    }
  }, []);

  // Initialize on mount (only if not parent mode)
  useEffect(() => {
    if (parentToken) return;
    (async () => {
      const s = loadSettings();
      setSettings(s);
      // apply dark mode class
      if (s.darkMode) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      // ===== v3: NO auto-seed. App starts empty =====
      // (user can manually add demo data from settings if needed)
      // Request notification permission if smart notifications enabled
      if (s.smartNotificationsEnabled) {
        requestNotificationPermission().then(granted => {
          if (granted) {
            // Check upcoming lessons every minute
            checkUpcomingLessonsAndNotify(s);
            setInterval(() => checkUpcomingLessonsAndNotify(s), 60000);
          }
        });
      }
      // ===== v3: Auto weekly backup check =====
      if (s.autoWeeklyBackup) {
        checkAndRunAutoBackup(s).then(result => {
          if (result.ran) {
            toast.success(`تم إنشاء نسخة احتياطية أسبوعية: ${result.filename}`);
          }
        });
      }
      // app lock
      if (s.appLockEnabled) {
        useApp.setState({ locked: true });
      }
      setInitialized(true);
    })();
  }, [setSettings, setInitialized, parentToken]);

  // Sync dark mode with settings
  useEffect(() => {
    if (settings.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [settings.darkMode]);

  // ===== Parent App Mode =====
  if (parentToken) {
    return <ParentAppView token={parentToken} />;
  }

  if (!initialized) {
    return (
      <div className="app-shell flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-6xl font-extrabold bg-gradient-to-br from-blue-700 to-cyan-600 bg-clip-text text-transparent mb-2">E+</div>
          <div className="text-xl font-bold text-slate-700 dark:text-slate-200">English Plus</div>
          <div className="text-sm text-slate-500 mt-1">جارٍ التحميل...</div>
          <div className="mt-4 h-1 w-32 bg-slate-200 rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-blue-600 animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="app-shell">
        <AppLock />
      </div>
    );
  }

  const showBottomNav = ['dashboard', 'students', 'groups', 'attendance', 'today_class'].includes(screen);

  return (
    <div className="app-shell flex flex-col">
      <TopBar onSearch={() => setSearchOpen(true)} />
      <VoiceControlButton onCommand={(action, params) => {
        // Handle voice commands
        if (action === 'save_lesson') {
          // Trigger save button click
          const saveBtn = document.querySelector('[data-voice-action="save_lesson"]') as HTMLButtonElement;
          saveBtn?.click();
        } else if (action === 'open_scanner') {
          useApp.getState().navigate('scanner');
        } else if (action === 'search') {
          setSearchOpen(true);
        }
      }} />
      <main className="flex-1 overflow-y-auto pb-24 safe-bottom">
        {renderScreen(screen)}
      </main>
      {showBottomNav && <BottomNav />}
      <FloatingBackButton />
      <UniversalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

function renderScreen(screen: string) {
  switch (screen) {
    case 'dashboard': return <Dashboard />;
    case 'students': return <StudentsScreen />;
    case 'student_profile': return <StudentProfile />;
    case 'add_student': return <AddStudent />;
    case 'groups': return <GroupsScreen />;
    case 'groups_schedule': return <GroupsScheduleScreen />;
    case 'group_details': return <GroupDetails />;
    case 'add_group': return <AddGroup />;
    case 'attendance': return <AttendanceScreen />;
    case 'scanner': return <ScannerScreen />;
    case 'kiosk': return <KioskScreen />;
    case 'today_class': return <TodayClassScreen />;
    case 'subscriptions': return <SubscriptionsScreen />;
    case 'reports': return <ReportsScreen />;
    case 'whatsapp': return <WhatsAppScreen />;
    case 'notifications': return <NotificationsScreen />;
    case 'settings': return <SettingsScreen />;
    case 'archive': return <ArchiveScreen />;
    default: return <Dashboard />;
  }
}
