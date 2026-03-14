import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Calendar } from './components/Calendar';
import { ActivityList } from './components/ActivityList';
import { Settings } from './components/Settings';
import { Birthdays } from './components/Birthdays';
import { ActivityModal } from './components/ActivityModal';
import { Notifications } from './components/Notifications';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home, ListTodo, Settings as SettingsIcon, Plus, Loader2, Bell, LogOut, Cake, Sun, Moon, X } from 'lucide-react';
import { collection, query, where, onSnapshot, Timestamp, addDoc, getDocs } from 'firebase/firestore';
import { db } from './lib/firebase';
import { startOfDay, endOfDay } from 'date-fns';
import { pushNotificationService } from './services/pushNotificationService';

function AppContent() {
  const { user, teamMember, loading, settings, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [localTheme, setLocalTheme] = useState<string | null>(localStorage.getItem('theme_preference'));
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  const isAdmin = (!!user && !teamMember) || teamMember?.role === 'administrador';

  useEffect(() => {
    if (user || teamMember) {
      // Check if we should show push notification prompt
      const hasPrompted = localStorage.getItem('push_prompted');
      if (!hasPrompted && Notification.permission === 'default') {
        setTimeout(() => setShowPushPrompt(true), 5000);
      }
      
      // Register service worker
      pushNotificationService.registerServiceWorker();
    }
  }, [user, teamMember]);

  const handleAllowPush = async () => {
    const granted = await pushNotificationService.requestPermission();
    if (granted) {
      await pushNotificationService.subscribeUser();
    }
    localStorage.setItem('push_prompted', 'true');
    setShowPushPrompt(false);
  };

  const handleDeclinePush = () => {
    localStorage.setItem('push_prompted', 'true');
    setShowPushPrompt(false);
  };

  const toggleTheme = () => {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setLocalTheme(newTheme);
    localStorage.setItem('theme_preference', newTheme);
  };

  // Dark mode support
  useEffect(() => {
    const themeToApply = localTheme || settings?.theme;

    if (themeToApply) {
      if (themeToApply === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Fallback to system preference if no theme is set
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localTheme && !settings?.theme) {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings?.theme, localTheme]);

  // Check for today's activities and create persistent notifications
  useEffect(() => {
    if (!teamMember) return;

    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);

    const q = query(
      collection(db, 'activities'),
      where('collaboratorIds', 'array-contains', teamMember.id)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const activities = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter((activity: any) => {
          const date = activity.date?.toDate();
          return date && date >= start && date <= end;
        });
      
      for (const activity of activities) {
        const notifQ = query(
          collection(db, 'notifications'),
          where('userId', '==', teamMember.id),
          where('activityId', '==', activity.id),
          where('type', '==', 'reminder'),
          where('date', '>=', Timestamp.fromDate(start))
        );
        
        const notifSnapshot = await getDocs(notifQ);
        
        if (notifSnapshot.empty) {
          await addDoc(collection(db, 'notifications'), {
            userId: teamMember.id,
            activityId: activity.id,
            title: 'Atividade para Hoje!',
            message: `Você tem a atividade "${activity.title}" agendada para hoje.`,
            date: Timestamp.fromDate(today),
            type: 'reminder',
            status: 'pending',
            createdAt: Timestamp.now()
          });
        }
      }
    });

    return () => unsubscribe();
  }, [teamMember]);

  // Listen for unread notifications
  useEffect(() => {
    if (!teamMember) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', teamMember.id),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [teamMember]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!user && !teamMember) {
    return <Login />;
  }

  const handleAddActivity = (date: Date) => {
    setSelectedDate(date);
    setEditingActivity(null);
    setIsModalOpen(true);
  };

  const handleEditActivity = (activity: any) => {
    setEditingActivity(activity);
    setSelectedDate(activity.date.toDate());
    setIsModalOpen(true);
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'settings' && !isAdmin) {
      setActiveTab('home');
      return;
    }
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] flex flex-col relative transition-colors duration-300">
      <header 
        className="sticky top-0 z-40 bg-[var(--bg-card)]/90 backdrop-blur-xl border-b border-[var(--border-color)] px-4 md:px-6 py-3 md:py-5 flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={settings?.headerImageUrl ? { backgroundImage: `url(${settings.headerImageUrl})` } : {}}
      >
        <div className="w-full max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center group cursor-default">
              {settings?.logoTitleUrl ? (
                <div className="flex items-center transition-transform group-hover:scale-105 bg-[var(--text-main)]/5 p-1.5 md:p-2 rounded-xl mr-2 md:mr-4" style={{ height: `${(settings?.logoTitleSize || 32) + (window.innerWidth < 768 ? 8 : 16)}px`, minHeight: '32px' }}>
                  <img src={settings.logoTitleUrl} alt="Logo" className="h-full w-auto object-contain" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-primary flex items-center justify-center text-white font-black shadow-lg mr-2 md:mr-4 shrink-0 transition-transform group-hover:rotate-6" style={{ backgroundColor: settings?.primaryColor }}>
                  {settings?.appName?.charAt(0) || 'C'}
                </div>
              )}
              <div className="flex flex-col">
                <h1 className="font-black text-lg md:text-xl text-[var(--text-main)] tracking-tighter truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
                  {settings?.appName || 'Meu Cronograma'}
                </h1>
                {teamMember && (
                  <span className="text-[9px] md:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest truncate max-w-[100px] sm:max-w-none">Olá, {teamMember.name}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-4">
            {teamMember && (
              <button onClick={() => setIsNotificationsOpen(true)} className="relative p-2 md:p-3 text-[var(--text-muted)] hover:text-primary hover:bg-primary/5 rounded-xl md:rounded-2xl transition-all active:scale-90">
                <Bell className="w-5 h-5 md:w-6 md:h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 md:top-2 md:right-2 w-4 h-4 md:w-5 md:h-5 bg-red-500 text-white text-[8px] md:text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[var(--bg-card)] animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}

            <button 
              onClick={toggleTheme} 
              className="p-2 md:p-3 text-[var(--text-muted)] hover:text-primary hover:bg-primary/5 rounded-xl md:rounded-2xl transition-all active:scale-90"
              title="Alternar Tema"
            >
              {localTheme === 'dark' || (!localTheme && document.documentElement.classList.contains('dark')) ? (
                <Sun className="w-5 h-5 md:w-6 md:h-6" />
              ) : (
                <Moon className="w-5 h-5 md:w-6 md:h-6" />
              )}
            </button>

            {activeTab === 'activities' && isAdmin && (
              <button 
                onClick={() => handleAddActivity(new Date())}
                className="p-2.5 md:p-3.5 text-white rounded-xl md:rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-xl shadow-primary/20 flex items-center justify-center shrink-0"
                style={{ backgroundColor: settings?.primaryColor }}
              >
                <Plus className="w-6 h-6 md:w-7 md:h-7" />
              </button>
            )}

            <button onClick={logout} className="p-2 md:p-3 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl md:rounded-2xl transition-all active:scale-90" title="Sair">
              <LogOut className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-3 md:p-8 overflow-y-auto no-scrollbar flex justify-center pb-28 md:pb-24">
        <div className="w-full max-w-5xl">
          <ErrorBoundary>
            {activeTab === 'home' && <Calendar onAddActivity={handleAddActivity} onEditActivity={handleEditActivity} />}
            {activeTab === 'activities' && <ActivityList onEditActivity={handleEditActivity} />}
            {activeTab === 'birthdays' && <Birthdays />}
            {activeTab === 'settings' && (isAdmin ? <Settings /> : <div className="text-center py-20"><h2 className="text-xl font-bold text-[var(--text-main)]">Acesso Restrito</h2><p className="text-[var(--text-muted)]">Você não tem permissão para acessar esta área.</p></div>)}
            
            {isModalOpen && (
              <ActivityModal 
                date={selectedDate} 
                activity={editingActivity}
                onClose={() => {
                  setIsModalOpen(false);
                  setEditingActivity(null);
                }} 
              />
            )}
          </ErrorBoundary>
        </div>
      </main>

      <nav className="fixed bottom-4 left-4 right-4 bg-[var(--bg-card)]/80 backdrop-blur-xl border border-[var(--border-color)] px-6 py-3 rounded-[2rem] flex items-center justify-center z-40 shadow-2xl shadow-[var(--shadow-color)] max-w-lg mx-auto">
        <div className="w-full flex items-center justify-between">
          {[
            { id: 'home', icon: Home, label: 'Início' },
            { id: 'activities', icon: ListTodo, label: 'Atividades' },
            { id: 'birthdays', icon: Cake, label: 'Níver' },
            ...(isAdmin ? [{ id: 'settings', icon: SettingsIcon, label: 'Ajustes' }] : [])
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 transition-all relative ${activeTab === tab.id ? 'text-primary scale-110' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              <tab.icon className={`w-6 h-6 transition-all ${activeTab === tab.id ? 'fill-primary/10' : ''}`} />
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-tighter">{tab.label}</span>
              {activeTab === tab.id && (
                <span className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {isNotificationsOpen && <Notifications onClose={() => setIsNotificationsOpen(false)} />}

      {/* Push Notification Prompt */}
      {showPushPrompt && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] w-full max-w-md rounded-3xl shadow-2xl border border-[var(--border-color)] p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Bell className="w-6 h-6" />
              </div>
              <button onClick={handleDeclinePush} className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>
            <h3 className="text-xl font-black text-[var(--text-main)] mb-2">Ativar Notificações?</h3>
            <p className="text-[var(--text-muted)] mb-6 leading-relaxed">
              Ative as notificações para acompanhar novidades do sistema, novas atividades e avisos importantes diretamente no seu dispositivo.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleAllowPush}
                className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                style={{ backgroundColor: settings?.primaryColor }}
              >
                Permitir Notificações
              </button>
              <button 
                onClick={handleDeclinePush}
                className="w-full py-4 bg-[var(--bg-main)] text-[var(--text-main)] font-bold rounded-2xl hover:bg-[var(--bg-hover)] transition-all"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
