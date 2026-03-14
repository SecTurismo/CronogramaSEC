import React, { useState, useEffect } from 'react';
import { doc, setDoc, collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Palette, Type as TypeIcon, Image as ImageIcon, Instagram, LogOut, Save, Loader2, Lock as LockIcon, Trash2, Users as UsersIcon, UserPlus, Edit2, CheckCircle, XCircle, UploadCloud, Sun, Moon, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import { pushNotificationService } from '../services/pushNotificationService';

const IMAGE_KEYS_MAP: Record<string, string> = {
  faviconUrl: 'favicon',
  logoTitleUrl: 'logoCabecalho',
  logoLoginTopUrl: 'logoLoginTopo',
  loginBackgroundUrl: 'fundoLogin',
  logoLoginBottomUrl: 'logoLoginBase',
  headerImageUrl: 'bannerCabecalho',
};

export const Settings = () => {
  const { user, teamMember, settings, logout, refreshSettings } = useAuth();
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const isAdmin = (!!user && !teamMember) || teamMember?.role === 'administrador';
  const [users, setUsers] = useState<any[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [userFormData, setUserFormData] = useState({
    name: '',
    username: '',
    password: '',
    function: '',
    role: 'usuario',
    status: 'active'
  });

  const [formData, setFormData] = useState({
    appName: 'Meu Cronograma',
    tabTitle: '',
    faviconUrl: '',
    primaryColor: '#3b82f6',
    instagramUrl: '',
    adminPassword: '',
    logoTitleSize: 32,
    logoLoginTopSize: 128,
    logoLoginBottomSize: 48,
    logoTitleUrl: '',
    logoLoginTopUrl: '',
    logoLoginBottomUrl: '',
    loginBackgroundUrl: '',
    headerImageUrl: '',
    theme: 'light',
  });

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter((u: any) => u.username !== 'SEC TURISMO GERAL'); // Filter out the restricted user
      setUsers(docs);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    const checkSubscription = async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    };
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      checkSubscription();
    }
  }, []);

  const handleToggleNotifications = async () => {
    setSubscriptionLoading(true);
    try {
      if (isSubscribed) {
        const success = await pushNotificationService.unsubscribeUser();
        if (success) setIsSubscribed(false);
      } else {
        const permission = await pushNotificationService.requestPermission();
        if (permission) {
          const subscription = await pushNotificationService.subscribeUser();
          if (subscription) setIsSubscribed(true);
        } else {
          setErrorMessage('Permissão de notificação negada.');
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 3000);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao alterar notificações.');
      setSaveStatus('error');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);

  useEffect(() => {
    if (settings && !hasLoadedSettings) {
      setFormData({
        appName: settings.appName || 'Meu Cronograma',
        tabTitle: settings.tabTitle || '',
        faviconUrl: settings.faviconUrl || '',
        primaryColor: settings.primaryColor || '#3b82f6',
        instagramUrl: settings.instagramUrl || '',
        adminPassword: settings.adminPassword || '',
        logoTitleSize: settings.logoTitleSize || 32,
        logoLoginTopSize: settings.logoLoginTopSize || 128,
        logoLoginBottomSize: settings.logoLoginBottomSize || 48,
        logoTitleUrl: settings.logoTitleUrl || '',
        logoLoginTopUrl: settings.logoLoginTopUrl || '',
        logoLoginBottomUrl: settings.logoLoginBottomUrl || '',
        loginBackgroundUrl: settings.loginBackgroundUrl || '',
        headerImageUrl: settings.headerImageUrl || '',
        theme: settings.theme || 'light',
      });
      setHasLoadedSettings(true);
    }
  }, [settings, hasLoadedSettings]);

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    if (!isAdmin) return;
    
    // Update local state
    setFormData(prev => ({ ...prev, theme: newTheme }));
    
    try {
      // Save to Firestore immediately for global effect
      const settingsRef = doc(db, 'settings', 'app_config');
      await setDoc(settingsRef, { theme: newTheme }, { merge: true });
    } catch (err) {
      console.error('Erro ao salvar tema globalmente:', err);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;

    // Check file size (Firestore limit is 1MB, but we should stay well below for performance)
    if (file.size > 800000) {
      setErrorMessage('A imagem é muito grande. O limite é de 800KB para garantir o salvamento global.');
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
      return;
    }

    setSettingsLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      
      try {
        // Update local state for immediate feedback
        setFormData(prev => ({ ...prev, [field]: base64String }));
        
        // Save to Firestore immediately for global persistence
        const settingsRef = doc(db, 'settings', 'app_config');
        await setDoc(settingsRef, { [field]: base64String }, { merge: true });
        
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err: any) {
        console.error('Erro ao salvar imagem globalmente:', err);
        setErrorMessage('Erro ao salvar imagem globalmente. Verifique o tamanho.');
        setSaveStatus('error');
      } finally {
        setSettingsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!isAdmin) {
      setErrorMessage('Você não tem permissão para realizar esta ação.');
      setSaveStatus('error');
      return;
    }
    
    setSettingsLoading(true);
    setSaveStatus('idle');
    setErrorMessage('');
    
    try {
      // Save all current formData to Firestore
      const settingsRef = doc(db, 'settings', 'app_config');
      await setDoc(settingsRef, formData, { merge: true });
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);

    } catch (err: any) {
      console.error('Erro ao salvar configurações:', err);
      setSaveStatus('error');
      setErrorMessage(err.message || 'Erro ao salvar as configurações.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleRemoveLogo = async (field: string) => {
    if (!isAdmin) return;
    
    setSettingsLoading(true);
    try {
      setFormData(prev => ({ ...prev, [field]: '' }));
      
      // Remove from Firestore
      const settingsRef = doc(db, 'settings', 'app_config');
      await setDoc(settingsRef, { [field]: '' }, { merge: true });
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      setErrorMessage('Erro ao remover logo.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setUserLoading(true);
    try {
      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.id), userFormData);
      } else {
        await addDoc(collection(db, 'users'), userFormData);
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
      setUserFormData({ name: '', username: '', password: '', function: '', role: 'usuario', status: 'active' });
      setSaveStatus('success');
      setErrorMessage(editingUser ? 'Usuário atualizado!' : 'Usuário cadastrado!');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      setErrorMessage('Erro ao salvar usuário.');
    } finally {
      setUserLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    setIsDeletingUser(true);
    try {
      await deleteDoc(doc(db, 'users', id));
      setUserToDelete(null);
      setSaveStatus('success');
      setErrorMessage('Usuário removido!');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      setErrorMessage('Erro ao remover usuário.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const openUserModal = (u?: any) => {
    if (u) {
      setEditingUser(u);
      setUserFormData({
        name: u.name,
        username: u.username,
        password: u.password || '',
        function: u.function || '',
        role: u.role,
        status: u.status
      });
    } else {
      setEditingUser(null);
      setUserFormData({ name: '', username: '', password: '', function: '', role: 'usuario', status: 'active' });
    }
    setIsUserModalOpen(true);
  };

  return (
    <div className="pb-24 max-w-4xl mx-auto px-4 md:px-6">
      <div className="mb-8 text-center md:text-left">
        <h2 className="text-2xl md:text-3xl font-black text-[var(--text-main)] tracking-tight">Configurações</h2>
        <p className="text-xs md:text-sm text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Gerencie a equipe e identidade do sistema</p>
      </div>

      <div className="space-y-6 md:space-y-8">
        {/* Identidade Visual */}
        <section className="bg-[var(--bg-card)] rounded-3xl p-6 md:p-8 border border-[var(--border-color)] shadow-sm">
          <div className="flex items-center gap-3 mb-6 text-primary">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Palette className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-[var(--text-main)] tracking-tight">Identidade Visual</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Nome do Aplicativo</label>
                <div className="relative">
                  <TypeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-[var(--text-main)]"
                    value={formData.appName}
                    onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Título da Aba (Browser)</label>
                <div className="relative">
                  <TypeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Ex: Meu Cronograma - Home"
                    className="w-full pl-10 pr-4 py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-[var(--text-main)]"
                    value={formData.tabTitle}
                    onChange={(e) => setFormData({ ...formData, tabTitle: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Cor Primária</label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    className="w-14 h-14 rounded-xl border-none cursor-pointer shadow-sm"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Hex Code</span>
                    <span className="text-sm text-[var(--text-main)] font-mono font-bold uppercase">{formData.primaryColor}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--text-muted)] mb-3">Tema do Sistema</label>
                <div className="flex p-1 bg-[var(--bg-input)] rounded-2xl w-fit">
                  <button
                    type="button"
                    onClick={() => handleThemeChange('light')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      formData.theme === 'light'
                        ? 'bg-[var(--bg-card)] text-primary shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    Claro
                  </button>
                  <button
                    type="button"
                    onClick={() => handleThemeChange('dark')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      formData.theme === 'dark'
                        ? 'bg-[var(--border-strong)] text-[var(--text-main)] shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    Escuro
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-[var(--text-muted)]">Favicon (Logo da Aba)</label>
                <div className="flex items-center gap-4 p-4 bg-[var(--bg-input)] rounded-2xl border border-[var(--border-color)]">
                  <div className="w-12 h-12 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] flex items-center justify-center overflow-hidden">
                    {formData.faviconUrl ? (
                      <img src={formData.faviconUrl} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-[var(--text-muted)]/20" />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <input 
                      type="file" 
                      id="faviconUrl"
                      accept="image/*" 
                      onChange={(e) => handleLogoUpload(e, 'faviconUrl')}
                      className="hidden"
                    />
                    <label 
                      htmlFor="faviconUrl"
                      className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer hover:underline flex items-center gap-1"
                      style={{ color: settings?.primaryColor }}
                    >
                      <UploadCloud className="w-3 h-3" /> Alterar Ícone
                    </label>
                    {formData.faviconUrl && (
                      <button 
                        onClick={() => handleRemoveLogo('faviconUrl')}
                        className="text-[10px] font-bold text-red-500 uppercase flex items-center gap-1 hover:underline w-fit"
                      >
                        <Trash2 className="w-3 h-3" /> Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Notificações */}
        <section className="bg-[var(--bg-card)] rounded-3xl p-6 md:p-8 border border-[var(--border-color)] shadow-sm">
          <div className="flex items-center gap-3 mb-6 text-primary">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Bell className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-[var(--text-main)] tracking-tight">Notificações Push</h3>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-[var(--bg-input)] rounded-2xl border border-[var(--border-color)]">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-[var(--text-main)]">Notificações do Navegador</span>
              <p className="text-[10px] text-[var(--text-muted)] italic">Receba avisos de novas atividades e aniversários no seu dispositivo.</p>
            </div>
            <button
              onClick={handleToggleNotifications}
              disabled={subscriptionLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isSubscribed ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isSubscribed ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
              {subscriptionLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-full">
                  <Loader2 className="w-3 h-3 animate-spin text-white" />
                </div>
              )}
            </button>
          </div>
        </section>

        {/* Segurança */}
        <section className="bg-[var(--bg-card)] rounded-3xl p-6 md:p-8 border border-[var(--border-color)] shadow-sm">
          <div className="flex items-center gap-3 mb-6 text-primary">
            <div className="p-2 bg-primary/10 rounded-xl">
              <LockIcon className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-[var(--text-main)] tracking-tight">Segurança Administrativa</h3>
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Senha Administrativa (Acesso)</label>
            <input
              type="text"
              placeholder="Ex: admin_master_2024"
              className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-sm text-[var(--text-main)]"
              value={formData.adminPassword}
              onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-2 italic">Esta senha será usada para entrar no sistema.</p>
          </div>
        </section>

        {/* Usuários / Equipe */}
        <section className="bg-[var(--bg-card)] rounded-3xl p-6 md:p-8 border border-[var(--border-color)] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3 text-primary">
              <div className="p-2 bg-primary/10 rounded-xl">
                <UsersIcon className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <h3 className="text-lg md:text-xl font-black text-[var(--text-main)] tracking-tight">Usuários / Equipe</h3>
            </div>
            <button
              onClick={() => openUserModal()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-xs hover:opacity-90 transition-all shadow-lg shadow-primary/20 border-none"
              style={{ backgroundColor: settings?.primaryColor || 'var(--primary-color)' }}
            >
              <UserPlus className="w-4 h-4" /> Novo Usuário
            </button>
          </div>
          
          <div className="overflow-x-auto no-scrollbar -mx-6 px-6">
            <table className="w-full text-left border-collapse min-w-[600px] md:min-w-0">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="pb-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Usuário</th>
                  <th className="pb-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Login</th>
                  <th className="hidden sm:table-cell pb-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Função</th>
                  <th className="pb-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Nível</th>
                  <th className="pb-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {users.map((u) => (
                  <tr key={u.id} className="group hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-[10px] shrink-0 ${u.status === 'active' ? 'bg-primary' : 'bg-[var(--text-muted)]'}`} style={u.status === 'active' ? { backgroundColor: settings?.primaryColor } : {}}>
                          {u.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-[var(--text-main)] text-sm">{u.name}</span>
                          <span className="sm:hidden text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{u.function || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-xs text-[var(--text-muted)] font-bold">{u.username}</td>
                    <td className="hidden sm:table-cell py-4 text-xs text-[var(--text-muted)] font-bold">{u.function || '-'}</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.role === 'administrador' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openUserModal(u)} className="p-2 text-[var(--text-muted)]/30 hover:text-primary transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setUserToDelete(u.id)} className="p-2 text-[var(--text-muted)]/30 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="py-12 text-center bg-[var(--bg-input)] rounded-2xl border border-dashed border-[var(--border-color)] mt-4">
                <UsersIcon className="w-10 h-10 text-[var(--text-muted)]/20 mx-auto mb-2" />
                <p className="text-[var(--text-muted)] text-sm font-medium">Nenhum usuário cadastrado.</p>
              </div>
            )}
          </div>
        </section>

        {/* Gerenciamento de Logos Simplificado */}
        <section className="bg-[var(--bg-card)] rounded-3xl p-6 md:p-8 border border-[var(--border-color)] shadow-sm">
          <div className="flex items-center gap-3 mb-8 text-primary">
            <div className="p-2 bg-primary/10 rounded-xl">
              <ImageIcon className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-[var(--text-main)] tracking-tight">Gerenciamento de Logos</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Logo Cabeçalho */}
            <div className="p-5 md:p-6 bg-[var(--bg-input)] rounded-3xl border border-[var(--border-color)] space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Logo do Cabeçalho</label>
                {formData.logoTitleUrl && (
                  <span className="text-[9px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Visualização Ativa</span>
                )}
              </div>
              <div className="w-full aspect-video bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] flex items-center justify-center overflow-hidden relative group/preview">
                {formData.logoTitleUrl ? (
                  <div className="flex items-center justify-center w-full h-full p-4" style={{ backgroundColor: 'rgba(var(--primary-color-rgb), 0.03)' }}>
                    <img 
                      src={formData.logoTitleUrl} 
                      className="max-w-full max-h-full object-contain transition-transform group-hover/preview:scale-105" 
                      style={{ height: `${formData.logoTitleSize}px` }}
                      referrerPolicy="no-referrer" 
                    />
                  </div>
                ) : (
                  <ImageIcon className="w-8 h-8 md:w-12 md:h-12 text-[var(--text-muted)]/20" />
                )}
              </div>
              <div className="flex flex-col gap-3">
                <input 
                  type="file" 
                  id="logoTitleUrl"
                  accept="image/*" 
                  onChange={(e) => handleLogoUpload(e, 'logoTitleUrl')} 
                  className="hidden"
                />
                <label 
                  htmlFor="logoTitleUrl"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-[10px] cursor-pointer hover:opacity-90 transition-all shadow-lg shadow-primary/10"
                  style={{ backgroundColor: settings?.primaryColor }}
                >
                  <UploadCloud className="w-4 h-4" /> Escolher Logo
                </label>
                
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    <span>Ajustar Tamanho</span>
                    <span className="text-primary" style={{ color: settings?.primaryColor }}>{formData.logoTitleSize}px</span>
                  </div>
                  <input type="range" min="10" max="200" value={formData.logoTitleSize} onChange={(e) => setFormData({...formData, logoTitleSize: parseInt(e.target.value)})} className="w-full h-1.5 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-primary" style={{ accentColor: settings?.primaryColor } as any} />
                </div>
                
                {formData.logoTitleUrl && (
                  <button onClick={() => handleRemoveLogo('logoTitleUrl')} className="text-[10px] font-black text-red-500 uppercase flex items-center justify-center gap-1 hover:underline tracking-widest pt-2"><Trash2 className="w-3 h-3" /> Remover Logo</button>
                )}
              </div>
            </div>

            {/* Logo Login Topo */}
            <div className="p-5 md:p-6 bg-[var(--bg-input)] rounded-3xl border border-[var(--border-color)] space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Logo Login (Topo)</label>
                {formData.logoLoginTopUrl && (
                  <span className="text-[9px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Visualização Ativa</span>
                )}
              </div>
              <div className="w-full aspect-video bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] flex items-center justify-center overflow-hidden relative group/preview">
                {formData.logoLoginTopUrl ? (
                  <img 
                    src={formData.logoLoginTopUrl} 
                    className="max-w-[80%] max-h-[80%] object-contain transition-transform group-hover/preview:scale-105" 
                    style={{ height: `${formData.logoLoginTopSize}px` }}
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 md:w-12 md:h-12 text-[var(--text-muted)]/20" />
                )}
              </div>
              <div className="flex-col flex gap-3">
                <input 
                  type="file" 
                  id="logoLoginTopUrl"
                  accept="image/*" 
                  onChange={(e) => handleLogoUpload(e, 'logoLoginTopUrl')} 
                  className="hidden"
                />
                <label 
                  htmlFor="logoLoginTopUrl"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-[10px] cursor-pointer hover:opacity-90 transition-all shadow-lg shadow-primary/10"
                  style={{ backgroundColor: settings?.primaryColor }}
                >
                  <UploadCloud className="w-4 h-4" /> Escolher Logo
                </label>
                
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    <span>Ajustar Tamanho</span>
                    <span className="text-primary" style={{ color: settings?.primaryColor }}>{formData.logoLoginTopSize}px</span>
                  </div>
                  <input type="range" min="10" max="300" value={formData.logoLoginTopSize} onChange={(e) => setFormData({...formData, logoLoginTopSize: parseInt(e.target.value)})} className="w-full h-1.5 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-primary" style={{ accentColor: settings?.primaryColor } as any} />
                </div>
                
                {formData.logoLoginTopUrl && (
                  <button onClick={() => handleRemoveLogo('logoLoginTopUrl')} className="text-[10px] font-black text-red-500 uppercase flex items-center justify-center gap-1 hover:underline tracking-widest pt-2"><Trash2 className="w-3 h-3" /> Remover Logo</button>
                )}
              </div>
            </div>

            {/* Logo Login Base */}
            <div className="p-5 md:p-6 bg-[var(--bg-input)] rounded-3xl border border-[var(--border-color)] space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Logo Login (Base)</label>
                {formData.logoLoginBottomUrl && (
                  <span className="text-[9px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Visualização Ativa</span>
                )}
              </div>
              <div className="w-full aspect-video bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] flex items-center justify-center overflow-hidden relative group/preview">
                {formData.logoLoginBottomUrl ? (
                  <img 
                    src={formData.logoLoginBottomUrl} 
                    className="max-w-[80%] max-h-[80%] object-contain transition-transform group-hover/preview:scale-105" 
                    style={{ height: `${formData.logoLoginBottomSize}px` }}
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 md:w-12 md:h-12 text-[var(--text-muted)]/20" />
                )}
              </div>
              <div className="flex flex-col gap-3">
                <input 
                  type="file" 
                  id="logoLoginBottomUrl"
                  accept="image/*" 
                  onChange={(e) => handleLogoUpload(e, 'logoLoginBottomUrl')} 
                  className="hidden"
                />
                <label 
                  htmlFor="logoLoginBottomUrl"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-[10px] cursor-pointer hover:opacity-90 transition-all shadow-lg shadow-primary/10"
                  style={{ backgroundColor: settings?.primaryColor }}
                >
                  <UploadCloud className="w-4 h-4" /> Escolher Logo
                </label>
                
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    <span>Ajustar Tamanho</span>
                    <span className="text-primary" style={{ color: settings?.primaryColor }}>{formData.logoLoginBottomSize}px</span>
                  </div>
                  <input type="range" min="10" max="200" value={formData.logoLoginBottomSize} onChange={(e) => setFormData({...formData, logoLoginBottomSize: parseInt(e.target.value)})} className="w-full h-1.5 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-primary" style={{ accentColor: settings?.primaryColor } as any} />
                </div>
                
                {formData.logoLoginBottomUrl && (
                  <button onClick={() => handleRemoveLogo('logoLoginBottomUrl')} className="text-[10px] font-black text-red-500 uppercase flex items-center justify-center gap-1 hover:underline tracking-widest pt-2"><Trash2 className="w-3 h-3" /> Remover Logo</button>
                )}
              </div>
            </div>

            {/* Imagem de Fundo (Login) */}
            <div className="p-5 md:p-6 bg-[var(--bg-input)] rounded-3xl border border-[var(--border-color)] space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Imagem de Fundo (Login)</label>
                {formData.loginBackgroundUrl && (
                  <span className="text-[9px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Visualização Ativa</span>
                )}
              </div>
              <div className="w-full aspect-video bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] flex items-center justify-center overflow-hidden relative group/preview">
                {formData.loginBackgroundUrl ? (
                  <img src={formData.loginBackgroundUrl} className="w-full h-full object-cover transition-transform group-hover/preview:scale-105" referrerPolicy="no-referrer" />
                ) : (
                  <ImageIcon className="w-8 h-8 md:w-12 md:h-12 text-[var(--text-muted)]/20" />
                )}
              </div>
              <div className="flex flex-col gap-3">
                <input 
                  type="file" 
                  id="loginBackgroundUrl"
                  accept="image/*" 
                  onChange={(e) => handleLogoUpload(e, 'loginBackgroundUrl')} 
                  className="hidden"
                />
                <label 
                  htmlFor="loginBackgroundUrl"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-[10px] cursor-pointer hover:opacity-90 transition-all shadow-lg shadow-primary/10"
                  style={{ backgroundColor: settings?.primaryColor }}
                >
                  <UploadCloud className="w-4 h-4" /> Escolher Fundo
                </label>
                {formData.loginBackgroundUrl && (
                  <button onClick={() => handleRemoveLogo('loginBackgroundUrl')} className="text-[10px] font-black text-red-500 uppercase flex items-center justify-center gap-1 hover:underline tracking-widest pt-2"><Trash2 className="w-3 h-3" /> Remover Fundo</button>
                )}
              </div>
            </div>

            {/* Imagem de Cabeçalho (Banner) */}
            <div className="p-5 md:p-6 bg-[var(--bg-input)] rounded-3xl border border-[var(--border-color)] space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Imagem de Cabeçalho (Banner)</label>
                {formData.headerImageUrl && (
                  <span className="text-[9px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Visualização Ativa</span>
                )}
              </div>
              <div className="w-full aspect-video bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] flex items-center justify-center overflow-hidden relative group/preview">
                {formData.headerImageUrl ? (
                  <img src={formData.headerImageUrl} className="w-full h-full object-cover transition-transform group-hover/preview:scale-105" referrerPolicy="no-referrer" />
                ) : (
                  <ImageIcon className="w-8 h-8 md:w-12 md:h-12 text-[var(--text-muted)]/20" />
                )}
              </div>
              <div className="flex flex-col gap-3">
                <input 
                  type="file" 
                  id="headerImageUrl"
                  accept="image/*" 
                  onChange={(e) => handleLogoUpload(e, 'headerImageUrl')} 
                  className="hidden"
                />
                <label 
                  htmlFor="headerImageUrl"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-[10px] cursor-pointer hover:opacity-90 transition-all shadow-lg shadow-primary/10"
                  style={{ backgroundColor: settings?.primaryColor }}
                >
                  <UploadCloud className="w-4 h-4" /> Escolher Banner
                </label>
                {formData.headerImageUrl && (
                  <button onClick={() => handleRemoveLogo('headerImageUrl')} className="text-[10px] font-black text-red-500 uppercase flex items-center justify-center gap-1 hover:underline tracking-widest pt-2"><Trash2 className="w-3 h-3" /> Remover Banner</button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Redes Sociais */}
        <section className="bg-[var(--bg-card)] rounded-3xl p-8 border border-[var(--border-color)] shadow-sm">
          <div className="flex items-center gap-3 mb-6 text-primary">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Instagram className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-main)]">Presença Digital</h3>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">Link do Instagram</label>
            <div className="relative">
              <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]/50" />
              <input
                type="url"
                placeholder="https://instagram.com/seuusuario"
                className="w-full pl-10 pr-4 py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-[var(--text-main)]"
                value={formData.instagramUrl}
                onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
              />
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4 pt-4">
          {(saveStatus === 'error' || settingsLoading) && errorMessage && (
            <div className={`p-4 rounded-2xl text-sm font-bold border animate-shake ${
              settingsLoading ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'
            }`}>
              {settingsLoading && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
              {errorMessage}
            </div>
          )}
          
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={settingsLoading}
            className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-2xl text-lg font-black shadow-xl transition-all active:scale-95 ${
              saveStatus === 'success' 
                ? 'bg-green-500 text-white' 
                : saveStatus === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-primary text-white'
            }`}
            style={{ backgroundColor: saveStatus === 'idle' ? (settings?.primaryColor || '#3b82f6') : undefined }}
          >
            {settingsLoading ? (
              <><Loader2 className="w-6 h-6 animate-spin" /> Processando...</>
            ) : saveStatus === 'success' ? (
              <><CheckCircle className="w-6 h-6" /> Tudo Pronto!</>
            ) : saveStatus === 'error' ? (
              <><XCircle className="w-6 h-6" /> Tentar Novamente</>
            ) : (
              <><Save className="w-6 h-6" /> Confirmar Alterações</>
            )}
          </button>
        </div>
      </div>

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            onClick={() => setIsUserModalOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
          />
          <div className="relative bg-[var(--bg-card)] rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md p-6 md:p-8 shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl md:text-2xl font-black text-[var(--text-main)] tracking-tight flex items-center gap-3">
                <UsersIcon className="w-6 h-6 text-primary" />
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-[var(--bg-hover)] rounded-xl transition-colors">
                <XCircle className="w-6 h-6 text-[var(--text-muted)]/50" />
              </button>
            </div>
            
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-[var(--text-muted)] mb-1.5 md:mb-2 uppercase tracking-widest">Nome Completo</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 md:px-5 py-2.5 md:py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-sm text-[var(--text-main)]"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-[var(--text-muted)] mb-1.5 md:mb-2 uppercase tracking-widest">Função</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Designer, Desenvolvedor..."
                  className="w-full px-4 md:px-5 py-2.5 md:py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-sm text-[var(--text-main)]"
                  value={userFormData.function}
                  onChange={(e) => setUserFormData({ ...userFormData, function: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-[10px] font-black text-[var(--text-muted)] mb-1.5 md:mb-2 uppercase tracking-widest">Login</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 md:px-5 py-2.5 md:py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-sm text-[var(--text-main)]"
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[var(--text-muted)] mb-1.5 md:mb-2 uppercase tracking-widest">Senha</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 md:px-5 py-2.5 md:py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-sm text-[var(--text-main)]"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-[var(--text-muted)] mb-1.5 md:mb-2 uppercase tracking-widest">Nível de Acesso</label>
                <select
                  className="w-full px-4 md:px-5 py-2.5 md:py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-[var(--text-main)] appearance-none text-sm"
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                >
                  <option value="usuario" className="bg-[var(--bg-card)]">Usuário Comum</option>
                  <option value="administrador" className="bg-[var(--bg-card)]">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-[var(--text-muted)] mb-1.5 md:mb-2 uppercase tracking-widest">Status</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUserFormData({ ...userFormData, status: 'active' })}
                    className={`flex-1 py-2.5 md:py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${userFormData.status === 'active' ? 'bg-green-100 text-green-600 border-2 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50' : 'bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-color)]'}`}
                  >
                    <CheckCircle className="w-4 h-4" /> Ativo
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFormData({ ...userFormData, status: 'inactive' })}
                    className={`flex-1 py-2.5 md:py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${userFormData.status === 'inactive' ? 'bg-red-100 text-red-600 border-2 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50' : 'bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-color)]'}`}
                  >
                    <XCircle className="w-4 h-4" /> Inativo
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-[var(--bg-input)] text-[var(--text-muted)] rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-[var(--bg-hover)] transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={userLoading}
                  className="flex-1 bg-primary text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
                  style={{ backgroundColor: settings?.primaryColor }}
                >
                  {userLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Deletion Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] rounded-[2rem] w-full max-w-sm p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-[var(--text-main)] mb-2">Confirmar Exclusão</h3>
            <p className="text-[var(--text-muted)] text-sm mb-8">
              Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="flex-1 px-6 py-3 bg-[var(--bg-input)] text-[var(--text-muted)] rounded-xl font-bold hover:bg-[var(--bg-hover)] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteUser(userToDelete)}
                disabled={isDeletingUser}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2"
              >
                {isDeletingUser ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
