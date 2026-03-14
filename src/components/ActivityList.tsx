import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, deleteDoc, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, isAfter, startOfDay, isSameDay } from 'date-fns';
import { Search, Calendar as CalendarIcon, Clock, Trash2, CheckCircle2, AlertCircle, Edit2, Users, StickyNote, Plus, Save, X, Loader2, Star } from 'lucide-react';

export const ActivityList = ({ onEditActivity }: { onEditActivity: (activity: any) => void }) => {
  const { user, teamMember } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [noteSearch, setNoteSearch] = useState('');
  
  // Confirmation state
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'activity' | 'note' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Note form state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      const snapshot = await getDocs(collection(db, 'users'));
      const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeamMembers(members);
    };
    fetchMembers();
  }, []);

  useEffect(() => {
    if (!user && !teamMember) return;

    const isAdmin = !!user || teamMember?.role === 'administrador';
    const currentUserId = user?.uid || teamMember?.id;

    // Everyone logged in can see all activities to ensure team visibility
    const qActivities = query(collection(db, 'activities'));

    const unsubscribeActivities = onSnapshot(qActivities, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      docs.sort((a: any, b: any) => {
        const dateA = a.date?.toDate?.() || new Date(0);
        const dateB = b.date?.toDate?.() || new Date(0);
        const today = startOfDay(new Date());
        
        const isTodayA = isSameDay(dateA, today);
        const isTodayB = isSameDay(dateB, today);
        
        if (isTodayA && !isTodayB) return -1;
        if (!isTodayA && isTodayB) return 1;
        
        // For others, sort by date descending (most recent first)
        return dateB.getTime() - dateA.getTime();
      });
      setActivities(docs);
    });

    // Notes listener
    const qNotes = query(
      collection(db, 'notes'),
      where('userId', '==', currentUserId)
    );

    const unsubscribeNotes = onSnapshot(qNotes, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      docs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotes(docs);
    });

    return () => {
      unsubscribeActivities();
      unsubscribeNotes();
    };
  }, [user, teamMember]);

  const getCollaboratorNames = (ids: string[] = []) => {
    return ids.map(id => teamMembers.find(m => m.id === id)?.name || 'Usuário').join(', ');
  };

  const getActivityColors = (activity: any) => {
    if (activity.status === 'completed') {
      return {
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        accent: 'bg-green-500',
        text: 'text-green-500'
      };
    }

    switch (activity.priority) {
      case 'high':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
          accent: 'bg-red-500',
          text: 'text-red-500'
        };
      case 'medium':
        return {
          bg: 'bg-orange-500/10',
          border: 'border-orange-500/20',
          accent: 'bg-orange-500',
          text: 'text-orange-500'
        };
      case 'low':
        return {
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/20',
          accent: 'bg-yellow-500',
          text: 'text-yellow-500'
        };
      default:
        return {
          bg: 'bg-[var(--bg-card)]',
          border: 'border-[var(--border-color)]',
          accent: 'bg-[var(--border-strong)]',
          text: 'text-[var(--text-main)]'
        };
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  const filteredActivities = activities.filter((a: any) => {
    if (!a.date || typeof a.date.toDate !== 'function') return false;
    const activityDate = a.date.toDate();
    const today = new Date();
    
    const matchesFilter = filter === 'all' || a.status === filter;
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || 
                          a.description.toLowerCase().includes(search.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const filteredNotes = notes.filter((n: any) => 
    n.content.toLowerCase().includes(noteSearch.toLowerCase())
  );

  const handleStatusChange = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    await updateDoc(doc(db, 'activities', id), { status: newStatus });
  };

  const handleDeleteActivity = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'activities', id));
      setItemToDelete(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao apagar atividade.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    
    setIsSavingNote(true);
    try {
      const currentUserId = user?.uid || teamMember?.id;
      if (!currentUserId) return;

      if (editingNote) {
        await updateDoc(doc(db, 'notes', editingNote.id), {
          content: noteContent,
          updatedAt: Timestamp.now()
        });
      } else {
        await addDoc(collection(db, 'notes'), {
          userId: currentUserId,
          content: noteContent,
          createdAt: Timestamp.now()
        });
      }
      setIsNoteModalOpen(false);
      setEditingNote(null);
      setNoteContent('');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar nota.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'notes', id));
      setItemToDelete(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao apagar nota.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openNoteModal = (note?: any) => {
    if (note) {
      setEditingNote(note);
      setNoteContent(note.content);
    } else {
      setEditingNote(null);
      setNoteContent('');
    }
    setIsNoteModalOpen(true);
  };

  return (
    <div className="pb-24 max-w-6xl mx-auto px-4 space-y-8 md:space-y-12">
      {/* Section 1: Calendar Activities */}
      <section>
        <div className="mb-6 md:mb-8 text-center">
          <h2 className="text-xl md:text-2xl font-black text-[var(--text-main)] tracking-tight flex items-center justify-center gap-2">
            <CalendarIcon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            Atividades do Calendário
          </h2>
          <p className="text-[10px] md:text-sm text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Acompanhe os próximos compromissos</p>
        </div>

        <div className="space-y-3 md:space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar atividades..."
              className="w-full pl-10 pr-4 py-2.5 md:py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl md:rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium text-sm text-[var(--text-main)]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            {['all', 'pending', 'completed', 'cancelled'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 md:px-6 py-1.5 md:py-2 rounded-full text-[9px] md:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  filter === f ? 'bg-primary text-[var(--text-inverse)] shadow-lg' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : f === 'completed' ? 'Concluídas' : 'Canceladas'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {filteredActivities.length > 0 ? filteredActivities.map(activity => {
            const colors = getActivityColors(activity);
            const activityDate = activity.date?.toDate?.() || new Date();
            const isToday = isSameDay(activityDate, new Date());
            
            return (
              <div key={activity.id} className={`${colors.bg} ${colors.border} rounded-3xl md:rounded-[2.5rem] p-5 md:p-6 border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col h-full group relative overflow-hidden ${isToday ? 'ring-2 ring-primary/20' : ''}`}>
                {isToday && (
                  <div className="absolute top-0 right-0 bg-primary text-white px-3 py-1 rounded-bl-xl font-black text-[8px] uppercase tracking-widest flex items-center gap-1 z-10 animate-pulse">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    Atividade de Hoje
                  </div>
                )}
                <div className="flex gap-4 md:gap-5 h-full">
                  <div className={`w-1 md:w-1.5 rounded-full shrink-0 bg-[#ff0000]`} />
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-black ${colors.text} text-base md:text-lg group-hover:text-primary transition-colors truncate`}>{activity.title}</h3>
                        <p className="text-[11px] md:text-xs text-[var(--text-muted)] mt-1 font-medium leading-relaxed">{activity.description || 'Sem descrição'}</p>
                        {activity.recurrence && activity.recurrence !== 'none' && (
                          <p className="text-[9px] font-black text-primary uppercase tracking-widest mt-2 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            Recorrência: {activity.recurrence === 'daily' ? 'Diária' : activity.recurrence === 'weekly' ? 'Semanal' : 'Mensal'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto pt-4 md:pt-6 space-y-4 md:space-y-5">
                      <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <div className="flex items-center gap-1 md:gap-1.5 text-[9px] md:text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest bg-[var(--bg-input)]/50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl border border-[var(--border-color)]">
                          <CalendarIcon className="w-3 h-3 md:w-3.5 md:h-3.5" />
                          {format(activity.date.toDate(), "dd/MM/yy")}
                        </div>
                        <div className="flex items-center gap-1 md:gap-1.5 text-[9px] md:text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest bg-[var(--bg-input)]/50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl border border-[var(--border-color)]">
                          <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                          {format(activity.date.toDate(), "HH:mm")}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 md:pt-5 border-t border-[var(--border-color)]">
                        <div className="flex flex-col gap-1.5 min-w-0">
                          <div className={`w-fit px-2 md:px-3 py-0.5 md:py-1 rounded-md md:rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-widest ${
                            activity.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                            activity.priority === 'high' ? 'bg-red-500/10 text-red-500' :
                            activity.priority === 'medium' ? 'bg-orange-500/10 text-orange-500' :
                            'bg-yellow-500/10 text-yellow-500'
                          }`}>
                            {activity.status === 'completed' ? 'Concluída' : getPriorityLabel(activity.priority)}
                          </div>
                          <div className="flex items-center gap-1 text-[9px] md:text-[10px] font-bold text-[var(--text-muted)] truncate max-w-[120px] md:max-w-none">
                            <Users className="w-3 h-3 md:w-3.5 md:h-3.5" />
                            <span className="truncate">{getCollaboratorNames(activity.collaboratorIds)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 md:gap-1">
                          {(!!user || !!teamMember) && (
                            <button 
                              onClick={() => onEditActivity(activity)}
                              className="p-2 md:p-2.5 rounded-lg md:rounded-2xl text-[var(--text-muted)] hover:text-primary hover:bg-primary/5 transition-all active:scale-90"
                              title="Editar atividade"
                            >
                              <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleStatusChange(activity.id, activity.status)}
                            className={`p-2 md:p-2.5 rounded-lg md:rounded-2xl transition-all active:scale-90 ${activity.status === 'completed' ? 'text-green-500 bg-green-500/10 shadow-inner' : 'text-[var(--text-muted)] hover:text-green-500 hover:bg-green-500/10'}`}
                            title={activity.status === 'completed' ? "Marcar como pendente" : "Marcar como concluída"}
                          >
                            <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
                          </button>
                          {(!!user || !!teamMember) && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: activity.id, type: 'activity' }); }}
                              className="p-2 md:p-2.5 rounded-lg md:rounded-2xl text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-90"
                              title="Excluir atividade"
                            >
                              <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="col-span-full text-center py-10 md:py-12 bg-[var(--bg-card)] rounded-3xl md:rounded-[3rem] border border-dashed border-[var(--border-color)]">
              <AlertCircle className="w-10 h-10 md:w-12 md:h-12 text-[var(--border-color)] mx-auto mb-3" />
              <p className="text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px]">Nenhuma atividade encontrada</p>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Bloco de Notas */}
      <section>
        <div className="mb-6 md:mb-8 flex items-center justify-between gap-4">
          <div className="text-left">
            <h2 className="text-xl md:text-2xl font-black text-[var(--text-main)] tracking-tight flex items-center gap-2">
              <StickyNote className="w-5 h-5 md:w-6 md:h-6 text-orange-400" />
              Bloco de Notas
            </h2>
            <p className="text-[10px] md:text-sm text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Anotações e lembretes rápidos</p>
          </div>
          <button 
            onClick={() => openNoteModal()}
            className="btn-primary flex items-center gap-2 py-2 md:py-2.5 px-4 md:px-5 text-xs md:text-sm rounded-xl md:rounded-2xl shadow-lg shadow-primary/20 shrink-0"
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nova Nota</span>
          </button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar notas..."
              className="w-full pl-10 pr-4 py-2.5 md:py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl md:rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium text-sm text-[var(--text-main)]"
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filteredNotes.length > 0 ? filteredNotes.map(note => (
            <div key={note.id} className="bg-orange-500/10 p-5 md:p-6 rounded-2xl md:rounded-[2rem] border border-orange-500/20 shadow-sm hover:shadow-md transition-all group relative min-h-[120px] flex flex-col">
              <p className="text-[var(--text-main)] text-xs md:text-sm font-medium leading-relaxed whitespace-pre-wrap mb-6 flex-1">
                {note.content}
              </p>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-[9px] md:text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                  {note.createdAt ? format(note.createdAt.toDate(), "dd/MM/yy HH:mm") : ''}
                </span>
                <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => openNoteModal(note)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-primary hover:bg-primary/5 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: note.id, type: 'note' }); }}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <div className="col-span-full text-center py-10 md:py-12 bg-[var(--bg-main)] rounded-3xl border border-dashed border-[var(--border-color)]">
              <StickyNote className="w-10 h-10 md:w-12 md:h-12 text-[var(--border-color)] mx-auto mb-3" />
              <p className="text-[var(--text-muted)] font-black uppercase tracking-widest text-[10px]">Nenhuma nota encontrada</p>
            </div>
          )}
        </div>
      </section>

      {/* Note Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            onClick={() => setIsNoteModalOpen(false)}
            className="absolute inset-0 bg-[var(--bg-modal)] backdrop-blur-sm" 
          />
          <div className="relative bg-[var(--bg-card)] rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md p-6 md:p-8 shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl md:text-2xl font-black text-[var(--text-main)] flex items-center gap-3 tracking-tight">
                <StickyNote className="w-6 h-6 text-orange-400" />
                {editingNote ? 'Editar Nota' : 'Nova Nota'}
              </h3>
              <button onClick={() => setIsNoteModalOpen(false)} className="p-2 hover:bg-[var(--bg-hover)] rounded-xl transition-all text-[var(--text-muted)]">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSaveNote} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">Conteúdo da Nota</label>
                <textarea
                  required
                  autoFocus
                  className="w-full px-5 py-4 bg-[var(--bg-input)] border-2 border-[var(--border-color)] rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-medium text-[var(--text-main)] h-48 resize-none text-sm"
                  placeholder="Escreva sua nota aqui..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-[var(--bg-hover)] text-[var(--text-muted)] rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-95 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingNote}
                  className="flex-1 btn-primary py-3 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px]"
                >
                  {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Salvar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            onClick={() => setItemToDelete(null)}
            className="absolute inset-0 bg-[var(--bg-modal)] backdrop-blur-sm" 
          />
          <div className="relative bg-[var(--bg-card)] rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl text-center animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-[var(--text-main)] mb-2 tracking-tight">Confirmar Exclusão</h3>
            <p className="text-[var(--text-muted)] text-sm mb-8">
              Tem certeza que deseja apagar esta {itemToDelete.type === 'activity' ? 'atividade' : 'nota'}? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 px-6 py-3 bg-[var(--bg-hover)] text-[var(--text-muted)] rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => itemToDelete.type === 'activity' ? handleDeleteActivity(itemToDelete.id) : handleDeleteNote(itemToDelete.id)}
                disabled={isDeleting}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
