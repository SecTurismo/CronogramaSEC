import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, CheckCircle, Clock, X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Notifications = ({ onClose }: { onClose: () => void }) => {
  const { teamMember, settings } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!teamMember) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', teamMember.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Sort in memory to avoid composite index requirement
      docs.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setNotifications(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamMember]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { status });
    } catch (err) {
      console.error(err);
    }
  };

  const filteredNotifications = notifications.filter((n: any) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return n.status === 'pending' || n.status === 'viewed';
    return n.status === 'completed';
  });

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[var(--bg-modal)] backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-md bg-[var(--bg-card)] h-full shadow-2xl flex flex-col animate-slide-in-right">
        <div className="p-5 md:p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-primary text-[var(--text-inverse)]">
          <div className="flex items-center gap-2 md:gap-3">
            <Bell className="w-5 h-5 md:w-6 md:h-6" />
            <h2 className="text-lg md:text-xl font-black tracking-tight">Notificações</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-all">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <div className="flex p-3 md:p-4 gap-2 bg-[var(--bg-input)] border-b border-[var(--border-color)]">
          {['all', 'pending', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
                filter === f ? 'bg-primary text-[var(--text-inverse)] shadow-md' : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : 'Concluídas'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 md:space-y-4 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
              <Clock className="w-8 h-8 md:w-10 md:h-10 animate-pulse mb-2" />
              <p className="text-xs md:text-sm font-bold uppercase tracking-widest">Carregando...</p>
            </div>
          ) : filteredNotifications.length > 0 ? (
            filteredNotifications.map((n) => (
              <div 
                key={n.id} 
                className={`p-4 md:p-5 rounded-2xl md:rounded-3xl border transition-all relative group ${
                  n.status === 'pending' ? 'bg-primary/5 border-primary/20' : 'bg-[var(--bg-card)] border-[var(--border-color)]'
                }`}
              >
                {n.status === 'pending' && (
                  <div className="absolute top-3 md:top-4 right-3 md:right-4 w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                )}
                
                <div className="flex gap-3 md:gap-4">
                  <div className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl shrink-0 h-fit ${
                    n.type === 'reminder' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                  }`}>
                    {n.type === 'reminder' ? <AlertCircle className="w-4 h-4 md:w-5 md:h-5" /> : <Bell className="w-4 h-4 md:w-5 md:h-5" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-[var(--text-main)] text-xs md:text-sm mb-0.5 md:mb-1 truncate">{n.title}</h3>
                    <p className="text-[10px] md:text-xs text-[var(--text-muted)] font-medium leading-relaxed mb-3 line-clamp-2">{n.message}</p>
                    
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[8px] md:text-[10px] font-black text-[var(--text-muted)]/50 uppercase tracking-widest whitespace-nowrap">
                        {format(n.createdAt.toDate(), "d 'de' MMM, HH:mm", { locale: ptBR })}
                      </span>
                      
                      <div className="flex gap-1.5">
                        {n.status !== 'completed' ? (
                          <button 
                            onClick={() => handleStatusChange(n.id, 'completed')}
                            className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-green-500 text-[var(--text-inverse)] rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition-all shadow-sm whitespace-nowrap"
                          >
                            <CheckCircle className="w-2.5 h-2.5 md:w-3 md:h-3" /> <span className="hidden xs:inline">Concluir</span>
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-[8px] md:text-[10px] font-black text-green-500 uppercase tracking-widest whitespace-nowrap">
                            <CheckCircle className="w-2.5 h-2.5 md:w-3 md:h-3" /> <span className="hidden xs:inline">Concluída</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]/20 py-12">
              <Bell className="w-12 h-12 md:w-16 md:h-16 mb-3 md:mb-4 opacity-20" />
              <p className="text-[10px] md:text-xs font-black uppercase tracking-widest">Nenhuma notificação</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
