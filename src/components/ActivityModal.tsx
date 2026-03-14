import React, { useState, useEffect } from 'react';
import { Timestamp, collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { X, Save, Loader2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { pushNotificationService } from '../services/pushNotificationService';

interface ActivityModalProps {
  date: Date;
  onClose: () => void;
  activity?: any;
}

export const ActivityModal = ({ date, onClose, activity }: ActivityModalProps) => {
  const { user, teamMember, settings } = useAuth();
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  
  const getInitialDate = () => {
    try {
      if (activity?.date) {
        // If it's a Firestore Timestamp
        if (typeof activity.date.toDate === 'function') {
          return activity.date.toDate();
        }
        // If it's already a Date object
        if (activity.date instanceof Date) {
          return activity.date;
        }
        // If it's a string or number
        return new Date(activity.date);
      }
      return date instanceof Date ? date : new Date();
    } catch (e) {
      console.error('Error parsing date:', e);
      return new Date();
    }
  };

  const initialDate = getInitialDate();

  const [formData, setFormData] = useState({
    title: activity?.title || '',
    description: activity?.description || '',
    date: format(initialDate, 'yyyy-MM-dd'),
    time: format(initialDate, 'HH:mm'),
    collaboratorIds: (activity?.collaboratorIds as string[]) || [],
    color: '#ff0000',
    priority: activity?.priority || '',
    recurrence: activity?.recurrence || 'none',
  });

  useEffect(() => {
    const fetchMembers = async () => {
      const q = query(collection(db, 'users'), where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      const members = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter((member: any) => member.name !== 'SEC TURISMO GERAL');
      setTeamMembers(members);
    };
    fetchMembers();
  }, []);

  const toggleCollaborator = (id: string) => {
    setFormData(prev => ({
      ...prev,
      collaboratorIds: prev.collaboratorIds.includes(id)
        ? prev.collaboratorIds.filter(cid => cid !== id)
        : [...prev.collaboratorIds, id]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUserId = user?.uid || teamMember?.id;
    if (!currentUserId) return;

    if (!formData.priority) {
      alert('Por favor, selecione uma prioridade.');
      return;
    }

    if (!formData.date || !formData.time) {
      alert('Por favor, preencha a data e o horário.');
      return;
    }

    setLoading(true);
    try {
      const [year, month, day] = formData.date.split('-').map(Number);
      const [hours, minutes] = formData.time.split(':').map(Number);
      const activityDate = new Date(year, month - 1, day, hours, minutes);

      const activityData = {
        userId: currentUserId,
        title: formData.title,
        description: formData.description,
        date: Timestamp.fromDate(activityDate),
        collaboratorIds: formData.collaboratorIds,
        color: '#ff0000',
        priority: formData.priority,
        status: activity?.status || 'pending',
        recurrence: formData.recurrence,
        updatedAt: Timestamp.now(),
      };

      let activityId = activity?.id;

      if (activityId) {
        await updateDoc(doc(db, 'activities', activityId), activityData);
        // Send push notification for update
        pushNotificationService.sendNotification(
          'Atividade atualizada',
          `A atividade "${formData.title}" foi atualizada.`,
          '/'
        );
      } else {
        const docRef = await addDoc(collection(db, 'activities'), {
          ...activityData,
          createdAt: Timestamp.now(),
        });
        activityId = docRef.id;
        // Send push notification for new activity
        const collaboratorNames = teamMembers
          .filter(m => formData.collaboratorIds.includes(m.id))
          .map(m => m.name)
          .join(', ');
          
        pushNotificationService.sendNotification(
          'Nova atividade registrada',
          `Atividade: ${formData.title}\nData: ${format(activityDate, 'dd/MM/yyyy')}\nEquipe: ${collaboratorNames || 'Nenhum'}`,
          '/'
        );
      }

      // Create notifications for new collaborators
      const newCollaborators = formData.collaboratorIds.filter(id => !activity?.collaboratorIds?.includes(id));
      
      for (const memberId of newCollaborators) {
        await addDoc(collection(db, 'notifications'), {
          userId: memberId,
          activityId: activityId,
          title: 'Nova Atividade Vinculada',
          message: `Você foi adicionado à atividade "${formData.title}" no dia ${format(activityDate, 'dd/MM/yyyy')}.`,
          date: Timestamp.fromDate(activityDate),
          type: 'added',
          status: 'pending',
          createdAt: Timestamp.now()
        });
      }

      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar atividade.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--bg-modal)] backdrop-blur-md p-0 sm:p-4">
      <div className="w-full max-w-lg bg-[var(--bg-card)] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between p-6 md:p-8 border-b border-[var(--border-color)]">
          <div>
            <h3 className="text-xl md:text-2xl font-black text-[var(--text-main)] tracking-tight">
              {activity ? 'Editar Atividade' : 'Nova Atividade'}
            </h3>
            <p className="text-[10px] md:text-sm text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">
              {activity ? 'Altere as informações abaixo' : format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 md:p-3 hover:bg-[var(--bg-hover)] rounded-xl md:rounded-2xl text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5 md:space-y-6 max-h-[80vh] sm:max-h-[70vh] overflow-y-auto no-scrollbar">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Título da Atividade</label>
            <input
              type="text"
              required
              className="w-full px-4 md:px-5 py-3 md:py-4 bg-[var(--bg-input)] border-2 border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-[var(--text-main)] text-sm md:text-base"
              placeholder="Ex: Reunião de Planejamento"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Descrição Detalhada</label>
            <textarea
              className="w-full px-4 md:px-5 py-3 md:py-4 bg-[var(--bg-input)] border-2 border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-medium text-[var(--text-main)] h-24 md:h-32 resize-none text-sm md:text-base"
              placeholder="Descreva o que será feito..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Data</label>
              <input
                type="date"
                required
                className="w-full px-4 md:px-5 py-3 md:py-4 bg-[var(--bg-input)] border-2 border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-[var(--text-main)] text-sm md:text-base"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Horário</label>
              <input
                type="time"
                required
                className="w-full px-4 md:px-5 py-3 md:py-4 bg-[var(--bg-input)] border-2 border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-[var(--text-main)] text-sm md:text-base"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Colaboradores Vinculados
              </label>
              {teamMembers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allIds = teamMembers.map(m => m.id);
                    const allSelected = allIds.every(id => formData.collaboratorIds.includes(id));
                    setFormData(prev => ({
                      ...prev,
                      collaboratorIds: allSelected ? [] : allIds
                    }));
                  }}
                  className="text-[10px] font-black text-primary uppercase tracking-widest hover:opacity-70 transition-opacity"
                >
                  {teamMembers.every(m => formData.collaboratorIds.includes(m.id)) ? 'Desmarcar Todos' : 'Marcar Todos'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {teamMembers.map(member => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleCollaborator(member.id)}
                  className={`flex items-center gap-2 p-2.5 md:p-3 rounded-xl border-2 text-left transition-all ${
                    formData.collaboratorIds.includes(member.id)
                      ? 'bg-primary/5 border-primary text-primary'
                      : 'bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-primary/30'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${formData.collaboratorIds.includes(member.id) ? 'bg-primary' : 'bg-[var(--text-muted)]/50'}`} />
                  <span className="text-[10px] md:text-xs font-bold truncate">{member.name}</span>
                </button>
              ))}
              {teamMembers.length === 0 && (
                <p className="col-span-2 text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest p-4 bg-[var(--bg-input)] rounded-xl border border-dashed border-[var(--border-color)] text-center">
                  Nenhum colaborador
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Prioridade *</label>
              <select
                required
                className="w-full px-4 md:px-5 py-3 md:py-4 bg-[var(--bg-input)] border-2 border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-[var(--text-main)] appearance-none text-sm md:text-base"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="" disabled>Selecionar</option>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-[var(--text-inverse)] flex items-center justify-center gap-3 py-4 md:py-5 mt-2 rounded-xl md:rounded-2xl text-base md:text-lg shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-6 h-6 md:w-7 md:h-7 animate-spin" /> : <><Save className="w-5 h-5 md:w-6 md:h-6" /> {activity ? 'Salvar Alterações' : 'Agendar Atividade'}</>}
          </button>
        </form>
      </div>
    </div>
  );
};
