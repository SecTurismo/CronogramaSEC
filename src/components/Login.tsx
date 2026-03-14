import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Instagram, Lock as LockIcon, Loader2, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Login = () => {
  const { settings, loginAsTeamMember } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 1. Check if it's the admin password
      const effectiveAdminPass = settings?.adminPassword || 'admin';
      if (password === effectiveAdminPass) {
        const adminEmail = 'admin_system@cronograma.com';
        const adminFirebasePassword = 'admin_password_123';
        try {
          await signInWithEmailAndPassword(auth, adminEmail, adminFirebasePassword);
        } catch (signInErr: any) {
          if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/wrong-password') {
            await createUserWithEmailAndPassword(auth, adminEmail, adminFirebasePassword);
          } else {
            throw signInErr;
          }
        }
        return;
      }

      // 2. Check if it matches any team member's password
      const q = query(
        collection(db, 'users'),
        where('password', '==', password),
        where('status', '==', 'active')
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('Senha incorreta ou usuário inativo.');
      } else {
        const memberDoc = querySnapshot.docs[0];
        const memberData = { id: memberDoc.id, ...memberDoc.data() };
        
        // Log in to Firebase Auth as well to ensure Storage/Firestore access
        const teamEmail = 'team_system@cronograma.com';
        const teamFirebasePassword = 'team_password_123';
        try {
          await signInWithEmailAndPassword(auth, teamEmail, teamFirebasePassword);
        } catch (signInErr: any) {
          if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/wrong-password') {
            await createUserWithEmailAndPassword(auth, teamEmail, teamFirebasePassword);
          }
        }
        
        loginAsTeamMember(memberData);
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao acessar o sistema. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-[var(--bg-main)] transition-colors duration-300 bg-cover bg-center bg-no-repeat relative"
      style={settings?.loginBackgroundUrl ? { backgroundImage: `url(${settings.loginBackgroundUrl})` } : {}}
    >
      {/* Overlay para garantir legibilidade se houver imagem de fundo */}
      {settings?.loginBackgroundUrl && <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] z-0" />}

      {/* Box de Login */}
      <div className="w-full max-w-md bg-[var(--bg-card)] rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl p-8 md:p-14 border border-[var(--border-color)] relative overflow-hidden flex flex-col items-center z-10">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full -ml-12 -mb-12 blur-2xl" />
        
        <div className="relative z-10 w-full flex flex-col items-center">
          {/* Topo do box: Logo superior */}
          <div className="mb-8 md:mb-10 flex justify-center w-full">
            {settings?.logoLoginTopUrl ? (
              <img 
                key={settings.logoLoginTopUrl}
                src={settings.logoLoginTopUrl} 
                alt="Logo Superior" 
                className="object-contain max-w-full" 
                style={{ height: `${(settings?.logoLoginTopSize || 128) * (window.innerWidth < 768 ? 0.8 : 1)}px` }}
                onError={(e) => {
                  console.error('Erro ao carregar logo superior do login');
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-primary flex items-center justify-center text-[var(--text-inverse)] shadow-xl shadow-primary/20">
                <LockIcon className="w-10 h-10 md:w-12 md:h-12" />
              </div>
            )}
          </div>

          {/* Centro: Título, Senha, Botão */}
          <div className="text-center mb-10 md:mb-12">
            <h1 className="text-2xl md:text-4xl font-black text-[var(--text-main)] tracking-tight leading-tight">
              {settings?.appName || 'Meu Cronograma'}
            </h1>
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="h-[2px] w-6 bg-primary/30 rounded-full" />
              <p className="text-[var(--text-muted)] text-[10px] md:text-xs font-black uppercase tracking-[0.2em]">Acesso Restrito</p>
              <div className="h-[2px] w-6 bg-primary/30 rounded-full" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 md:space-y-10 w-full">
            <div className="space-y-4">
              <label className="block text-[10px] md:text-xs font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Credenciais de Acesso</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <LockIcon className="w-5 h-5 text-[var(--text-muted)] group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  className="w-full pl-14 pr-6 py-5 bg-[var(--bg-input)] border-2 border-[var(--border-color)] rounded-2xl focus:ring-8 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-[var(--text-main)] text-center text-lg placeholder:text-[var(--text-muted)]/30"
                  placeholder="Sua senha secreta"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border-2 border-red-500/20 text-red-500 text-xs font-black p-4 rounded-2xl text-center animate-shake flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-[var(--text-inverse)] flex items-center justify-center gap-3 py-5 rounded-2xl text-lg font-black uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-[0.97] hover:brightness-110 transition-all disabled:opacity-50"
              style={{ backgroundColor: settings?.primaryColor || 'var(--primary-color)' }}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span>Entrar no Painel</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Parte inferior do box: Instagram e Logo inferior */}
        <div className="w-full flex flex-col items-center gap-8 md:gap-10 mt-12 md:mt-14 pt-10 md:pt-12 border-t-2 border-[var(--border-color)]/50">
          {settings?.instagramUrl && (
            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-3 px-8 py-4 bg-[var(--bg-input)] text-[var(--text-main)] rounded-2xl border-2 border-[var(--border-color)] hover:bg-primary hover:text-[var(--text-inverse)] hover:border-primary transition-all duration-500 w-full shadow-sm hover:shadow-xl hover:shadow-primary/20"
            >
              <Instagram className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="font-black text-xs md:text-sm uppercase tracking-widest">Nossas Redes</span>
            </a>
          )}

          {settings?.logoLoginBottomUrl && (
            <div className="flex justify-center w-full">
              <img 
                key={settings.logoLoginBottomUrl}
                src={settings.logoLoginBottomUrl} 
                alt="Logo Inferior" 
                className="object-contain max-w-full opacity-80 hover:opacity-100 transition-opacity" 
                style={{ height: `${(settings?.logoLoginBottomSize || 48) * (window.innerWidth < 768 ? 0.8 : 1)}px` }}
                onError={(e) => {
                  console.error('Erro ao carregar logo inferior do login');
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-10 md:mt-12 flex flex-col items-center gap-2 z-10">
        <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.3em] opacity-50">
          © {new Date().getFullYear()} {settings?.appName || 'Cronograma'}
        </p>
        <div className="h-1 w-8 bg-primary/20 rounded-full" />
      </div>
    </div>
  );
};
