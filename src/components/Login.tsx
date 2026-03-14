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
      className="min-h-screen flex flex-col items-center justify-center p-4 md:p-6 bg-[var(--bg-main)] transition-colors duration-300 bg-cover bg-center bg-no-repeat"
      style={settings?.loginBackgroundUrl ? { backgroundImage: `url(${settings.loginBackgroundUrl})` } : {}}
    >
      {/* Box de Login */}
      <div className="w-full max-w-md bg-[var(--bg-card)] rounded-[2.5rem] md:rounded-[3rem] shadow-2xl p-8 md:p-12 border border-[var(--border-color)] relative overflow-hidden flex flex-col items-center min-h-[550px] md:min-h-[650px]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
        
        <div className="relative z-10 w-full flex flex-col items-center flex-1">
          {/* Topo do box: Logo superior */}
          <div className="mb-6 md:mb-8">
            {settings?.logoLoginTopUrl ? (
              <img 
                key={settings.logoLoginTopUrl}
                src={settings.logoLoginTopUrl} 
                alt="Logo Superior" 
                className="object-contain" 
                style={{ height: `${(settings?.logoLoginTopSize || 128) * (window.innerWidth < 768 ? 0.7 : 1)}px` }}
                onError={(e) => {
                  console.error('Erro ao carregar logo superior do login');
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-primary flex items-center justify-center text-[var(--text-inverse)] shadow-xl">
                <LockIcon className="w-8 h-8 md:w-10 md:h-10" />
              </div>
            )}
          </div>

          {/* Centro: Título, Senha, Botão */}
          <div className="text-center mb-8 md:mb-10">
            <h1 className="text-2xl md:text-3xl font-black text-[var(--text-main)] tracking-tight">
              {settings?.appName || 'Meu Cronograma'}
            </h1>
            <p className="text-[var(--text-muted)] text-[10px] md:text-xs font-bold uppercase tracking-widest mt-2">Acesso Restrito</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8 w-full">
            <div>
              <label className="block text-[10px] md:text-xs font-bold text-[var(--text-muted)] mb-3 uppercase tracking-widest text-center">Digite sua Senha</label>
              <div className="relative">
                <LockIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-[var(--text-muted)]" />
                <input
                  type="password"
                  required
                  className="w-full px-12 md:px-14 py-4 md:py-5 bg-[var(--bg-input)] border-2 border-[var(--border-color)] rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-[var(--text-main)] text-center text-base md:text-lg"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] md:text-xs font-bold p-3 md:p-4 rounded-xl text-center animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-[var(--text-inverse)] flex items-center justify-center gap-3 py-4 md:py-5 rounded-2xl text-base md:text-lg shadow-xl active:scale-[0.98] transition-all disabled:opacity-50"
              style={{ backgroundColor: settings?.primaryColor || 'var(--primary-color)' }}
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Entrar no Sistema'}
            </button>
          </form>
        </div>

        {/* Parte inferior do box: Instagram e Logo inferior */}
        <div className="w-full flex flex-col items-center gap-6 md:gap-8 mt-10 md:mt-12 pt-6 md:pt-8 border-t border-[var(--border-color)]">
          {settings?.instagramUrl && (
            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-3 px-6 py-3 md:py-4 bg-[var(--bg-input)] text-[var(--text-main)] rounded-2xl border border-[var(--border-color)] hover:bg-primary hover:text-[var(--text-inverse)] hover:border-primary transition-all duration-300 w-full"
            >
              <Instagram className="w-4 h-4 md:w-5 md:h-5" />
              <span className="font-bold text-xs md:text-sm">Siga-nos no Instagram</span>
            </a>
          )}

          {settings?.logoLoginBottomUrl && (
            <img 
              key={settings.logoLoginBottomUrl}
              src={settings.logoLoginBottomUrl} 
              alt="Logo Inferior" 
              className="object-contain" 
              style={{ height: `${(settings?.logoLoginBottomSize || 48) * (window.innerWidth < 768 ? 0.8 : 1)}px` }}
              onError={(e) => {
                console.error('Erro ao carregar logo inferior do login');
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
        </div>
      </div>
      
      <p className="mt-6 md:mt-8 text-[var(--text-muted)] text-[9px] md:text-[10px] font-bold uppercase tracking-widest">© {new Date().getFullYear()} {settings?.appName || 'Cronograma'}</p>
    </div>
  );
};
