import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Cake, Calendar, Plus, Search, Trash2, Edit2, X, User, UploadCloud, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { pushNotificationService } from '../services/pushNotificationService';
import { cloudinaryService } from '../services/cloudinaryService';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const Birthdays = () => {
  const { user, teamMember, settings } = useAuth();
  const isAdmin = (!!user && !teamMember) || teamMember?.role === 'administrador';
  
  const [birthdays, setBirthdays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBirthday, setEditingBirthday] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    day: 1,
    month: 1,
    department: '',
    photoUrl: ''
  });

  const [viewMode, setViewMode] = useState('list');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const displayPhoto = photoPreview || formData.photoUrl;

  useEffect(() => {
    // Removemos o orderBy múltiplo do Firestore para evitar a necessidade de criar índices compostos manualmente
    const q = query(collection(db, 'birthdays'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      // Ordenação em memória: primeiro por mês, depois por dia
      const sortedDocs = docs.sort((a, b) => {
        if (a.month !== b.month) {
          return a.month - b.month;
        }
        return a.day - b.day;
      });
      
      setBirthdays(sortedDocs);
      setLoading(false);

      // Check for today's birthdays and notify
      const currentMonth = new Date().getMonth() + 1;
      const todayDate = new Date().getDate();
      const todaysBirthdays = sortedDocs.filter(b => b.day === todayDate && b.month === currentMonth);
      
      if (todaysBirthdays.length > 0) {
        const notifiedToday = localStorage.getItem(`birthday_notified_${todayDate}_${currentMonth}`);
        if (!notifiedToday) {
          todaysBirthdays.forEach(b => {
            pushNotificationService.sendNotification(
              '🎉 Aniversário hoje',
              `Hoje é aniversário de ${b.name}.`,
              '/birthdays'
            );
          });
          localStorage.setItem(`birthday_notified_${todayDate}_${currentMonth}`, 'true');
        }
      }
    }, (error) => {
      console.error("Erro ao carregar aniversariantes:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;

    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
    
    // Store the raw file for upload
    setPendingPhoto(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setUploading(true);
    try {
      let finalPhotoUrl = formData.photoUrl;

      // Upload photo if there's a pending one
      if (pendingPhoto) {
        const data = await cloudinaryService.uploadImage(pendingPhoto);
        finalPhotoUrl = data.url;
      }

      if (editingBirthday) {
        await updateDoc(doc(db, 'birthdays', editingBirthday.id), {
          ...formData,
          photoUrl: finalPhotoUrl,
          day: Number(formData.day),
          month: Number(formData.month)
        });
      } else {
        await addDoc(collection(db, 'birthdays'), {
          ...formData,
          photoUrl: finalPhotoUrl,
          day: Number(formData.day),
          month: Number(formData.month),
          createdAt: Timestamp.now()
        });
      }
      closeModal();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar aniversariante.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!isAdmin || !deleteId) return;
    console.log('Iniciando exclusão do aniversariante:', deleteId);
    setIsDeleting(true);
    try {
      const birthdayToDelete = birthdays.find(b => b.id === deleteId);
      await deleteDoc(doc(db, 'birthdays', deleteId));
      console.log('Documento excluído do Firestore');
      
      // Note: Cloudinary deletion would require public_id. 
      // For now, we just delete the document.
      
      setDeleteId(null);
    } catch (err) {
      console.error('Erro ao excluir:', err);
      alert('Erro ao excluir aniversariante.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openModal = (birthday?: any) => {
    if (birthday) {
      setEditingBirthday(birthday);
      setFormData({
        name: birthday.name,
        day: birthday.day,
        month: birthday.month,
        department: birthday.department || '',
        photoUrl: birthday.photoUrl || ''
      });
    } else {
      setEditingBirthday(null);
      setFormData({
        name: '',
        day: new Date().getDate(),
        month: new Date().getMonth() + 1,
        department: '',
        photoUrl: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBirthday(null);
    setPendingPhoto(null);
    setPhotoPreview(null);
    setFormData({ name: '', day: 1, month: 1, department: '', photoUrl: '' });
  };

  const filteredBirthdays = birthdays.filter(b => 
    (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedBirthdays = MONTHS.map((monthName, index) => {
    const monthIndex = index + 1;
    const monthBirthdays = filteredBirthdays.filter(b => b.month === monthIndex);
    return { monthName, monthIndex, birthdays: monthBirthdays };
  }).filter(group => group.birthdays.length > 0);

  const currentMonth = new Date().getMonth() + 1;
  const todayDate = new Date().getDate();

  const isBirthdayToday = (day: number, month: number) => {
    return day === todayDate && month === currentMonth;
  };

  // Custom icon for view toggle
  const GridIcon = ({ active }: { active: boolean }) => (
    <div className={`grid grid-cols-2 gap-0.5 ${active ? 'text-white' : 'text-slate-400'}`}>
      <div className="w-2 h-2 bg-current rounded-[2px]"></div>
      <div className="w-2 h-2 bg-current rounded-[2px]"></div>
      <div className="w-2 h-2 bg-current rounded-[2px]"></div>
      <div className="w-2 h-2 bg-current rounded-[2px]"></div>
    </div>
  );

  const ListIcon = ({ active }: { active: boolean }) => (
    <div className={`flex flex-col gap-1 ${active ? 'text-white' : 'text-slate-400'}`}>
      <div className="w-4 h-1 bg-current rounded-full"></div>
      <div className="w-4 h-1 bg-current rounded-full"></div>
      <div className="w-4 h-1 bg-current rounded-full"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-10">
        <div className="text-center md:text-left">
          <h1 className="text-2xl md:text-4xl font-black text-[var(--text-main)] tracking-tight mb-1 md:mb-2 flex items-center justify-center md:justify-start gap-3">
            <Cake className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            Aniversariantes
          </h1>
          <p className="text-xs md:text-sm text-[var(--text-muted)] font-bold uppercase tracking-widest">Celebre a vida da nossa equipe</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
          <div className="flex bg-[var(--bg-card)] p-1 rounded-2xl border border-[var(--border-color)] shadow-sm shrink-0">
            <button 
              onClick={() => setViewMode('grid')}
              className={`flex-1 sm:flex-none p-2 md:p-2.5 rounded-xl transition-all flex items-center justify-center ${viewMode === 'grid' ? 'bg-primary text-[var(--text-inverse)] shadow-md' : 'hover:bg-[var(--bg-hover)]'}`}
              style={viewMode === 'grid' ? { backgroundColor: settings?.primaryColor } : {}}
            >
              <GridIcon active={viewMode === 'grid'} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex-1 sm:flex-none p-2 md:p-2.5 rounded-xl transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-primary text-[var(--text-inverse)] shadow-md' : 'hover:bg-[var(--bg-hover)]'}`}
              style={viewMode === 'list' ? { backgroundColor: settings?.primaryColor } : {}}
            >
              <ListIcon active={viewMode === 'list'} />
            </button>
          </div>

          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full pl-11 pr-4 py-2.5 md:py-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all shadow-sm text-sm text-[var(--text-main)]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {isAdmin && (
            <button
              onClick={() => openModal()}
              className="flex items-center justify-center gap-2 px-6 py-2.5 md:py-3 bg-primary text-[var(--text-inverse)] rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-xs md:text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 whitespace-nowrap"
              style={{ backgroundColor: settings?.primaryColor }}
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
              Novo
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-[var(--text-muted)] font-bold uppercase tracking-widest text-xs">Carregando celebrações...</p>
        </div>
      ) : groupedBirthdays.length === 0 ? (
        <div className="text-center py-20 bg-[var(--bg-card)] rounded-3xl border border-dashed border-[var(--border-color)]">
          <Cake className="w-16 h-16 text-[var(--text-muted)]/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[var(--text-muted)]">Nenhum aniversariante encontrado</h3>
          <p className="text-[var(--text-muted)]/50">Que tal cadastrar o primeiro da lista?</p>
        </div>
      ) : (
        <div className="space-y-12">
          {groupedBirthdays.map((group) => (
            <section key={group.monthIndex} className="relative">
              <div className="flex items-center gap-4 mb-6">
                <div className={`px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-widest ${group.monthIndex === currentMonth ? 'bg-primary text-[var(--text-inverse)]' : 'bg-[var(--bg-input)] text-[var(--text-muted)]'}`}
                     style={group.monthIndex === currentMonth ? { backgroundColor: settings?.primaryColor } : {}}>
                  {group.monthName}
                </div>
                <div className="h-px flex-1 bg-[var(--border-color)]"></div>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {group.birthdays.map((b) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={b.id}
                      className={`group bg-[var(--bg-card)] rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border transition-all relative overflow-hidden flex flex-col items-center text-center ${isBirthdayToday(b.day, b.month) ? 'border-primary shadow-2xl shadow-primary/10 ring-4 ring-primary/10' : 'border-[var(--border-color)] shadow-sm hover:shadow-xl hover:border-primary/20'}`}
                    >
                      {isBirthdayToday(b.day, b.month) && (
                        <div className="absolute top-0 right-0 bg-primary text-[var(--text-inverse)] px-3 md:px-4 py-1.5 md:py-2 rounded-bl-xl md:rounded-bl-2xl font-black text-[8px] md:text-[10px] uppercase tracking-widest shadow-lg z-10 flex items-center gap-1.5 md:gap-2" style={{ backgroundColor: settings?.primaryColor }}>
                          <Cake className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          Hoje!
                        </div>
                      )}
                      
                      {isAdmin && (
                        <div className="absolute top-3 md:top-4 left-3 md:left-4 flex flex-col gap-1.5 md:gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(b);
                            }} 
                            className="p-2 bg-[var(--bg-card)]/90 backdrop-blur rounded-lg md:rounded-xl text-[var(--text-muted)] hover:text-primary shadow-md border border-[var(--border-color)] transition-all hover:scale-110"
                          >
                            <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(b.id);
                            }} 
                            className="p-2 bg-[var(--bg-card)]/90 backdrop-blur rounded-lg md:rounded-xl text-[var(--text-muted)] hover:text-red-500 shadow-md border border-[var(--border-color)] transition-all hover:scale-110"
                          >
                            <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                        </div>
                      )}
 
                      <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-[var(--bg-input)] overflow-hidden border-4 border-[var(--bg-card)] shadow-xl ring-1 ring-[var(--border-color)] mb-4 md:mb-6 shrink-0">
                        {b.photoUrl ? (
                          <img 
                            src={b.photoUrl} 
                            alt={b.name} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Erro';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]/50">
                            <User className="w-10 h-10 md:w-12 md:h-12" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-center w-full">
                        <h4 className="font-black text-[var(--text-main)] text-lg md:text-xl leading-tight mb-1 md:mb-2 line-clamp-2 min-h-[2.5rem] md:min-h-[3rem] flex items-center justify-center">{b.name}</h4>
                        <p className="text-[9px] md:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4 md:mb-6 line-clamp-1">
                          {b.department || 'Setor não informado'}
                        </p>
                        <div className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-primary/5 dark:bg-primary/10 rounded-full text-primary font-black text-xs md:text-sm" style={{ color: settings?.primaryColor, backgroundColor: `${settings?.primaryColor}10` }}>
                          <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          Dia {b.day.toString().padStart(2, '0')}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="bg-[var(--bg-card)] rounded-3xl md:rounded-[2rem] border border-[var(--border-color)] shadow-xl overflow-hidden">
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[600px] md:min-w-0">
                      <thead>
                        <tr className="bg-[var(--bg-input)] border-b border-[var(--border-color)]">
                          <th className="px-6 md:px-8 py-4 md:py-6 text-[10px] md:text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest">Colaborador</th>
                          <th className="hidden sm:table-cell px-6 md:px-8 py-4 md:py-6 text-[10px] md:text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest">Setor</th>
                          <th className="px-6 md:px-8 py-4 md:py-6 text-[10px] md:text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest">Data</th>
                          {isAdmin && <th className="px-6 md:px-8 py-4 md:py-6 text-[10px] md:text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-color)]">
                        {group.birthdays.map((b) => (
                          <tr key={b.id} className={`hover:bg-[var(--bg-hover)] transition-colors ${isBirthdayToday(b.day, b.month) ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                            <td className="px-6 md:px-8 py-4 md:py-5">
                              <div className="flex items-center gap-3 md:gap-4">
                                <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-[var(--bg-input)] overflow-hidden border-2 border-[var(--bg-card)] shadow-sm shrink-0 relative">
                                  {b.photoUrl ? (
                                    <img src={b.photoUrl} alt={b.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]/50">
                                      <User className="w-5 h-5 md:w-6 md:h-6" />
                                    </div>
                                  )}
                                  {isBirthdayToday(b.day, b.month) && (
                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                      <Cake className="w-4 h-4 md:w-6 md:h-6 text-primary animate-bounce" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-black text-[var(--text-main)] text-sm md:text-lg truncate">{b.name}</span>
                                  <span className="sm:hidden text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest truncate">{b.department || 'Geral'}</span>
                                  {isBirthdayToday(b.day, b.month) && (
                                    <span className="text-[8px] md:text-[10px] font-black text-primary uppercase tracking-widest" style={{ color: settings?.primaryColor }}>Hoje! 🎂</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="hidden sm:table-cell px-6 md:px-8 py-4 md:py-5">
                              <span className="text-[10px] md:text-sm text-[var(--text-muted)] font-bold bg-[var(--bg-input)] px-2 md:px-3 py-1 rounded-lg">{b.department || 'Geral'}</span>
                            </td>
                            <td className="px-6 md:px-8 py-4 md:py-5">
                              <div className="flex items-center gap-2 md:gap-3 text-primary font-black text-sm md:text-base" style={{ color: settings?.primaryColor }}>
                                <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                                {b.day.toString().padStart(2, '0')}<span className="hidden sm:inline"> de {group.monthName}</span>
                              </div>
                            </td>
                            {isAdmin && (
                              <td className="px-6 md:px-8 py-4 md:py-5 text-right">
                                <div className="flex items-center justify-end gap-1 md:gap-3">
                                  <button 
                                    onClick={() => openModal(b)} 
                                    className="p-2 md:p-3 text-[var(--text-muted)]/50 hover:text-primary hover:bg-primary/10 rounded-lg md:rounded-xl transition-all"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                                  </button>
                                  <button 
                                    onClick={() => setDeleteId(b.id)} 
                                    className="p-2 md:p-3 text-[var(--text-muted)]/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg md:rounded-xl transition-all"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[var(--bg-card)] rounded-[2.5rem] shadow-2xl p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-black text-[var(--text-main)] mb-2">Tem certeza?</h3>
              <p className="text-[var(--text-muted)] mb-8 font-medium">Esta ação não pode ser desfeita. O aniversariante será removido permanentemente.</p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                >
                  {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sim, Excluir'}
                </button>
                <button
                  onClick={() => setDeleteId(null)}
                  disabled={isDeleting}
                  className="w-full py-4 bg-[var(--bg-input)] text-[var(--text-muted)] rounded-2xl font-black uppercase tracking-widest hover:bg-[var(--bg-hover)] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Cadastro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            onClick={closeModal}
            className="absolute inset-0 bg-[var(--bg-modal)] backdrop-blur-sm" 
          />
          <div 
            className="relative w-full max-w-md bg-[var(--bg-card)] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-500"
          >
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-6 md:mb-8">
                  <h3 className="text-xl md:text-2xl font-black text-[var(--text-main)] tracking-tight">
                    {editingBirthday ? 'Editar Aniversariante' : 'Novo Aniversariante'}
                  </h3>
                  <button onClick={closeModal} className="p-2 hover:bg-[var(--bg-hover)] rounded-xl transition-colors">
                    <X className="w-5 h-5 md:w-6 md:h-6 text-[var(--text-muted)]/50" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
                  <div className="space-y-3 md:space-y-4">
                    <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Foto do Colaborador</label>
                    <div className="flex items-center gap-4 p-3 md:p-4 bg-[var(--bg-input)] rounded-2xl border border-[var(--border-color)]">
                      <div className="w-14 h-14 md:w-16 md:h-16 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] flex items-center justify-center overflow-hidden shrink-0 relative">
                        {displayPhoto ? (
                          <img 
                            src={displayPhoto} 
                            className={`w-full h-full object-cover transition-all duration-500 ${uploading ? 'opacity-40 blur-[1px]' : 'opacity-100'}`} 
                          />
                        ) : (
                          <UploadCloud className="w-6 h-6 md:w-8 md:h-8 text-[var(--text-muted)]/20" />
                        )}
                        {uploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-card)]/50 backdrop-blur-sm">
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col gap-1.5 md:gap-2">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handlePhotoUpload} 
                          className="text-[10px] text-[var(--text-muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-primary file:text-[var(--text-inverse)] hover:file:bg-primary/80 cursor-pointer"
                          style={{ '--tw-bg-opacity': '1', backgroundColor: settings?.primaryColor } as any}
                        />
                        {displayPhoto && (
                          <button 
                            type="button"
                            onClick={() => {
                              setPhotoPreview(null);
                              setPendingPhoto(null);
                              setFormData(prev => ({ ...prev, photoUrl: '' }));
                            }} 
                            className="text-[9px] font-black text-red-500 uppercase flex items-center gap-1 hover:underline w-fit tracking-widest"
                          >
                            <Trash2 className="w-2.5 h-2.5" /> Remover
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 md:space-y-5">
                    <div>
                      <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5 md:mb-2">Nome Completo</label>
                      <input
                        required
                        type="text"
                        className="w-full px-4 md:px-5 py-2.5 md:py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-sm text-[var(--text-main)]"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5 md:mb-2">Dia</label>
                        <select
                          className="w-full px-4 md:px-5 py-2.5 md:py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-sm appearance-none text-[var(--text-main)]"
                          value={formData.day}
                          onChange={(e) => setFormData({ ...formData, day: parseInt(e.target.value) })}
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d} className="bg-[var(--bg-card)]">{d.toString().padStart(2, '0')}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5 md:mb-2">Mês</label>
                        <select
                          className="w-full px-4 md:px-5 py-2.5 md:py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-sm appearance-none text-[var(--text-main)]"
                          value={formData.month}
                          onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                        >
                          {MONTHS.map((m, i) => (
                            <option key={m} value={i + 1} className="bg-[var(--bg-card)]">{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5 md:mb-2">Setor / Departamento</label>
                      <input
                        type="text"
                        placeholder="Ex: Financeiro, TI, RH..."
                        className="w-full px-4 md:px-5 py-2.5 md:py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all font-bold text-sm text-[var(--text-main)]"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 md:py-4 bg-primary text-[var(--text-inverse)] rounded-xl md:rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:opacity-90 transition-all active:scale-95 mt-2 md:mt-4 text-xs md:text-sm"
                    style={{ backgroundColor: settings?.primaryColor }}
                  >
                    {editingBirthday ? 'Salvar Alterações' : 'Cadastrar'}
                  </button>
                </form>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};
