import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, List as ListIcon, LayoutGrid, Edit2, Trash2, Users, Loader2, Clock } from 'lucide-react';
import { collection, query, where, onSnapshot, Timestamp, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface CalendarProps {
  onAddActivity: (date: Date) => void;
  onEditActivity: (activity: any) => void;
}

export const Calendar = ({ onAddActivity, onEditActivity }: CalendarProps) => {
  const { user, teamMember, settings } = useAuth();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [activities, setActivities] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const activitiesRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDate && window.innerWidth < 1024) {
      activitiesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedDate]);

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

    // Everyone logged in can see all activities in the calendar to ensure team visibility
    const q = query(collection(db, 'activities'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActivities(docs);
    }, (err) => {
      console.error("Error fetching activities:", err);
    });

    return () => unsubscribe();
  }, [user, teamMember]);

  const handleDeleteActivity = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'activities', id));
      setActivityToDelete(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao apagar atividade.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getCollaboratorNames = (ids: string[] = []) => {
    return ids.map(id => teamMembers.find(m => m.id === id)?.name || 'Usuário').join(', ');
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluída';
      case 'cancelled': return 'Cancelada';
      case 'pending': return 'Pendente';
      default: return status;
    }
  };

  const next = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    if (viewMode === 'day') setCurrentDate(addDays(currentDate, 1));
  };

  const prev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    if (viewMode === 'day') setCurrentDate(subDays(currentDate, 1));
  };

  const renderHeader = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h2 className="text-xl md:text-2xl font-black text-[var(--text-main)] capitalize tracking-tighter">
          {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <p className="text-[10px] md:text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
          {viewMode === 'month' ? 'Visão Mensal' : viewMode === 'week' ? 'Visão Semanal' : 'Visão Diária'}
        </p>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2">
        <div className="flex bg-[var(--bg-input)] p-1 rounded-xl">
          <button 
            onClick={() => setViewMode('month')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'month' ? 'bg-[var(--bg-card)] shadow-sm text-primary scale-105' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode('week')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'week' ? 'bg-[var(--bg-card)] shadow-sm text-primary scale-105' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
          >
            <ListIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode('day')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'day' ? 'bg-[var(--bg-card)] shadow-sm text-primary scale-105' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
          >
            <CalendarIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-color)] p-1 rounded-xl shadow-sm">
          <button onClick={prev} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors active:scale-90">
            <ChevronLeft className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
          <button onClick={next} className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors active:scale-90">
            <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderMonth = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const getContrastColor = (hexcolor: string | undefined) => {
      if (!hexcolor) return 'text-white';
      const hex = hexcolor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 128) ? 'text-[var(--text-inverse)]' : 'text-white';
    };

    const contrastClass = getContrastColor(settings?.primaryColor);

    const getActivityDate = (activity: any) => {
      if (!activity.date) return null;
      if (typeof activity.date.toDate === 'function') return activity.date.toDate();
      if (activity.date instanceof Date) return activity.date;
      if (activity.date.seconds) return new Date(activity.date.seconds * 1000);
      return null;
    };

    return (
      <div className="grid grid-cols-7 gap-1.5 md:gap-3 bg-transparent">
        {weekDays.map(day => (
          <div key={day} className="py-1 md:py-2 text-center text-[9px] md:text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">
            {day}
          </div>
        ))}
        {days.map(day => {
          const dayActivities = activities.filter((a: any) => {
            const date = getActivityDate(a);
            return date && isSameDay(date, day);
          });
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);
          return (
            <div
              key={day.toString()}
              onClick={() => setSelectedDate(day)}
              className={`aspect-square md:aspect-auto md:h-24 cursor-pointer transition-all relative group rounded-xl md:rounded-2xl border overflow-hidden ${
                !isSameMonth(day, monthStart) 
                  ? 'bg-[var(--bg-main)]/20 text-[var(--text-muted)]/50 border-transparent' 
                  : isToday 
                    ? `bg-primary border-primary ${contrastClass} shadow-lg shadow-primary/20 scale-105 z-20` 
                    : 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-color)] shadow-sm'
              } ${isSelected && !isToday ? 'ring-2 ring-primary border-transparent z-10' : ''} ${!isToday ? 'hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5' : ''}`}
            >
              <div className="flex flex-col h-full w-full">
                {/* Top Half: Day Number */}
                <div className="h-1/2 flex items-center justify-center">
                  <span className={`text-[10px] sm:text-xs md:text-sm font-black transition-all ${
                    isToday 
                      ? '' 
                      : isSelected ? 'text-primary' : 'text-[var(--text-main)]'
                  }`}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                {/* Bottom Half: Activity Count */}
                <div className={`h-1/2 flex items-center justify-center transition-colors ${dayActivities.length > 0 ? 'bg-red-600' : ''}`}>
                  {dayActivities.length > 0 && (
                    <span className="text-xs sm:text-sm md:text-xl font-black text-white">
                      {dayActivities.length}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeek = () => {
    const startDate = startOfWeek(currentDate);
    const endDate = endOfWeek(currentDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const getContrastColor = (hexcolor: string | undefined) => {
      if (!hexcolor) return 'text-white';
      const hex = hexcolor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 128) ? 'text-[var(--text-inverse)]' : 'text-white';
    };

    const contrastClass = getContrastColor(settings?.primaryColor);

    return (
      <div className="space-y-3">
        {days.map(day => {
          const dayActivities = activities.filter((a: any) => a.date && typeof a.date.toDate === 'function' && isSameDay(a.date.toDate(), day));
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toString()} className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-color)] shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-sm transition-all ${isToday ? 'bg-primary shadow-lg scale-110' : 'bg-[var(--bg-input)] text-[var(--text-muted)]'}`}>
                    <span className={`text-[10px] font-black uppercase tracking-tighter ${isToday ? contrastClass : ''}`}>{format(day, 'EEE', { locale: ptBR })}</span>
                    <span className={`text-lg font-black leading-none ${isToday ? contrastClass : ''}`}>{format(day, 'd')}</span>
                  </div>
                  <div>
                    <h3 className={`font-bold ${isToday ? 'text-primary text-lg' : 'text-[var(--text-main)]'}`}>
                      {isToday ? 'Hoje' : format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </h3>
                    {isToday && <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Seu dia atual</p>}
                  </div>
                </div>
                {(!!user || !!teamMember) && (
                  <button onClick={() => onAddActivity(day)} className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {dayActivities.length > 0 ? dayActivities.map(activity => (
                  <div key={activity.id} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg-input)] border-l-4 border-[#ff0000]">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-[var(--text-main)]">{activity.title}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-[var(--text-muted)]">{format(activity.date.toDate(), 'HH:mm')}</p>
                        <span className="text-[10px] text-[var(--text-muted)]/50">•</span>
                        <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                          <Users className="w-3 h-3" />
                          <span>{getCollaboratorNames(activity.collaboratorIds)}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      activity.priority === 'high' ? 'bg-red-500/10 text-red-500' :
                      activity.priority === 'medium' ? 'bg-orange-500/10 text-orange-500' :
                      'bg-blue-500/10 text-blue-500'
                    }`}>
                      {getPriorityLabel(activity.priority)}
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-[var(--text-muted)] italic text-center py-2">Nenhuma atividade</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDay = () => {
    const dayActivities = activities.filter((a: any) => a.date && typeof a.date.toDate === 'function' && isSameDay(a.date.toDate(), currentDate));
    return (
      <div className="space-y-4">
        <div className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-color)] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-[var(--text-main)]">Atividades do Dia</h3>
            {(!!user || !!teamMember) && (
              <button onClick={() => onAddActivity(currentDate)} className="btn-primary flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            )}
          </div>
          <div className="space-y-4">
            {dayActivities.length > 0 ? dayActivities.map(activity => (
              <div key={activity.id} className="flex gap-4 p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
                <div className="w-1 bg-[#ff0000] rounded-full" />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-[var(--text-main)]">{activity.title}</h4>
                      <p className="text-sm text-[var(--text-muted)] mt-1">{activity.description}</p>
                    </div>
                    <span className="text-xs font-bold text-[var(--text-muted)]">{format(activity.date.toDate(), 'HH:mm')}</span>
                  </div>
                  <div className="flex flex-col gap-2 mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Equipe:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(activity.collaboratorIds || []).map((id: string) => {
                          const member = teamMembers.find(m => m.id === id);
                          return (
                            <div key={id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-card)] text-[10px] font-bold text-[var(--text-main)] border border-[var(--border-color)] shadow-sm">
                              <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] text-primary" style={{ color: settings?.primaryColor, backgroundColor: `${settings?.primaryColor}15` }}>
                                <Users className="w-2.5 h-2.5" />
                              </div>
                              {member?.name || 'Usuário'}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <span className={`w-fit px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                      activity.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                      activity.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                      'bg-blue-500/10 text-blue-500'
                    }`}>
                      {getStatusLabel(activity.status)}
                    </span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-12">
                <CalendarIcon className="w-12 h-12 text-[var(--border-color)] mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">Nenhuma atividade para este dia.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSelectedDayActivities = () => {
    const dayActivities = activities.filter((a: any) => a.date && typeof a.date.toDate === 'function' && isSameDay(a.date.toDate(), selectedDate));
    
    return (
      <div ref={activitiesRef} className="mt-6 md:mt-8 bg-[var(--bg-card)] rounded-[2rem] md:rounded-3xl p-5 md:p-8 border border-[var(--border-color)] shadow-xl shadow-[var(--border-color)]/20 dark:shadow-none animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg md:text-xl font-black text-[var(--text-main)] tracking-tighter">
              {isSameDay(selectedDate, today) ? 'Atividades de Hoje' : `Atividades de ${format(selectedDate, "d 'de' MMMM", { locale: ptBR })}`}
            </h3>
            <p className="text-[10px] md:text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{dayActivities.length} {dayActivities.length === 1 ? 'atividade agendada' : 'atividades agendadas'}</p>
          </div>
          {(!!user || !!teamMember) && (
            <button 
              onClick={() => onAddActivity(selectedDate)}
              className="btn-primary flex items-center justify-center gap-2 text-sm py-3 px-6 rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" /> Adicionar
            </button>
          )}
        </div>

        <div className="space-y-3 md:space-y-4">
          {dayActivities.length > 0 ? (
            dayActivities.sort((a, b) => a.date.seconds - b.date.seconds).map(activity => (
              <div key={activity.id} className="flex gap-3 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-primary/20 transition-all group relative overflow-hidden">
                <div className="w-1 md:w-1.5 rounded-full shrink-0 bg-[#ff0000]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-[var(--text-main)] group-hover:text-primary transition-colors truncate">{activity.title}</h4>
                      {activity.description && <p className="text-xs md:text-sm text-[var(--text-muted)] mt-1">{activity.description}</p>}
                      {activity.recurrence && activity.recurrence !== 'none' && (
                        <p className="text-[8px] font-black text-primary uppercase tracking-widest mt-2 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Recorrência: {activity.recurrence === 'daily' ? 'Diária' : activity.recurrence === 'weekly' ? 'Semanal' : 'Mensal'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[10px] md:text-xs font-black text-[var(--text-muted)] bg-[var(--bg-card)] px-2 py-1 rounded-lg border border-[var(--border-color)] shadow-sm">
                        {format(activity.date.toDate(), 'HH:mm')}
                      </span>
                      {(!!user || !!teamMember) && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onEditActivity(activity); }}
                            className="p-1.5 md:p-2 rounded-lg text-[var(--text-muted)]/50 hover:text-primary hover:bg-primary/5 transition-all active:scale-90"
                            title="Editar atividade"
                          >
                            <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActivityToDelete(activity.id); }}
                            className="p-1.5 md:p-2 rounded-lg text-[var(--text-muted)]/50 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-90"
                            title="Excluir atividade"
                          >
                            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 mt-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-[10px] md:text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">
                        <Users className="w-3.5 h-3.5 text-primary" style={{ color: settings?.primaryColor }} />
                        Equipe Envolvida
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(activity.collaboratorIds || []).map((id: string) => {
                          const member = teamMembers.find(m => m.id === id);
                          return (
                            <div key={id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-card)] text-[10px] md:text-xs font-bold text-[var(--text-main)] border border-[var(--border-color)] shadow-sm hover:border-primary/30 transition-colors">
                              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary" style={{ color: settings?.primaryColor, backgroundColor: `${settings?.primaryColor}15` }}>
                                {member?.name?.charAt(0) || 'U'}
                              </div>
                              {member?.name || 'Usuário'}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-color)]/50">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest ${
                        activity.priority === 'high' ? 'bg-red-500/10 text-red-500' :
                        activity.priority === 'medium' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        Prioridade {getPriorityLabel(activity.priority)}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest ${
                        activity.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                        activity.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        Status: {getStatusLabel(activity.status)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 md:py-12 bg-[var(--bg-main)] rounded-2xl border border-dashed border-[var(--border-color)]">
              <CalendarIcon className="w-10 h-10 md:w-12 md:h-12 text-[var(--border-color)] mx-auto mb-3" />
              <p className="text-[var(--text-muted)] text-sm font-bold uppercase tracking-widest">Nenhuma atividade</p>
              {(!!user || !!teamMember) && (
                <button 
                  onClick={() => onAddActivity(selectedDate)}
                  className="mt-4 text-primary font-black text-[10px] uppercase tracking-widest hover:underline"
                >
                  Adicionar Primeira
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-24 max-w-7xl mx-auto px-4">
      <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-8 items-start">
        <div className="flex-1">
          {renderHeader()}
          <div className={viewMode === 'month' ? 'w-full' : ''}>
            {viewMode === 'month' && renderMonth()}
            {viewMode === 'week' && renderWeek()}
            {viewMode === 'day' && renderDay()}
          </div>
        </div>
        
        <div className="mt-8 lg:mt-[88px] lg:sticky lg:top-24">
          {viewMode === 'month' && renderSelectedDayActivities()}
        </div>
      </div>

      {/* Confirmation Modal */}
      {activityToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[var(--bg-modal)] backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-card)] rounded-[2rem] w-full max-w-sm p-8 shadow-2xl animate-slide-in-up text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-[var(--text-main)] mb-2">Confirmar Exclusão</h3>
            <p className="text-[var(--text-muted)] text-sm mb-8">
              Tem certeza que deseja apagar esta atividade? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setActivityToDelete(null)}
                className="flex-1 px-6 py-3 bg-[var(--bg-hover)] text-[var(--text-muted)] rounded-xl font-bold hover:brightness-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteActivity(activityToDelete)}
                disabled={isDeleting}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
