import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { Patient, PatientPriority, PatientStatus, PatientState } from '../types';
import { format, differenceInYears, differenceInMinutes, parseISO } from 'date-fns';
import { 
  User, 
  Calendar, 
  Clock, 
  Thermometer, 
  Weight, 
  MapPin, 
  Stethoscope, 
  FileText,
  AlertTriangle,
  CheckCircle2,
  Save,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PatientFormProps {
  initialData?: Patient;
  isEditing?: boolean;
}

export const RegisterPatient: React.FC<PatientFormProps> = ({ initialData, isEditing }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ageWarning, setAgeWarning] = useState(false);

  const [formData, setFormData] = useState<Partial<Patient>>(initialData || {
    nome: '',
    genero: 'Masculino',
    dataNascimento: '',
    dataOcorrencia: format(new Date(), 'yyyy-MM-dd'),
    horaEntrada: format(new Date(), 'HH:mm'),
    status: 'Em Espera',
    prioridade: 'Urgente',
    estado: 'Atendido',
    provincia: 'Huila',
    cidade: 'Lubango',
    bairro: '',
    peso: 0,
    temperatura: 36.5,
    pressaoArterial: '120/80',
    ocorrencia: '',
    sinaisSintomas: '',
    diagnosticos: '',
  });

  // Derived fields
  useEffect(() => {
    if (formData.dataNascimento) {
      const age = differenceInYears(new Date(), parseISO(formData.dataNascimento));
      setAgeWarning(age > 21);
      
      let faixa = 'Infantil';
      if (age < 1) faixa = 'Recém-nascido';
      else if (age < 12) faixa = 'Criança';
      else if (age < 18) faixa = 'Adolescente';
      else faixa = 'Jovem Adulto';

      setFormData(prev => ({ ...prev, idade: age, faixaEtaria: faixa }));
    }
  }, [formData.dataNascimento]);

  // Smart Status Logic
  useEffect(() => {
    if (formData.diagnosticos && formData.diagnosticos.trim().length > 5 && formData.status === 'Em Espera') {
      setFormData(prev => ({ ...prev, status: 'Atendido' }));
    }
  }, [formData.diagnosticos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (ageWarning) {
      const confirmAge = window.confirm("ATENÇÃO: O paciente tem mais de 21 anos. Este hospital é pediátrico. Deseja continuar com o registo extraordinário?");
      if (!confirmAge) return;
    }

    setLoading(true);
    try {
      // Calculate service time if possible
      let serviceTime = 0;
      if (formData.horaSaida && formData.horaEntrada) {
        serviceTime = differenceInMinutes(
          parseISO(`2000-01-01T${formData.horaSaida}`),
          parseISO(`2000-01-01T${formData.horaEntrada}`)
        );
      }

      const data = {
        ...formData,
        idMedico: user.id || auth.currentUser?.uid,
        assinaturaMedico: user.nome || auth.currentUser?.displayName || "Médico de Plantão",
        tempoAtendimento: serviceTime > 0 ? serviceTime : 0,
        updatedAt: serverTimestamp(),
      };

      if (isEditing && initialData) {
        await updateDoc(doc(db, 'patients', initialData.id), data);
      } else {
        await addDoc(collection(db, 'patients'), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      navigate('/list');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'patients');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isEditing ? 'Editar Registro' : 'Novo Atendimento'}
          </h1>
          <p className="text-slate-500">Preencha os dados de triagem e atendimento</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação Básica - Matching sleek theme */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-8 pb-3 border-b border-slate-100">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><User size={18} /></div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">01. Identificação de Amostra/Paciente</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nome Completo do Paciente</label>
              <input 
                type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 uppercase tracking-wider" 
                value={formData.nome || ''}
                onChange={e => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Gênero Bio</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 uppercase"
                value={formData.genero || 'Masculino'}
                onChange={e => setFormData(prev => ({ ...prev, genero: e.target.value as any }))}
              >
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Calendário de Nascimento</label>
              <input 
                type="date" required 
                className={`w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black ${ageWarning ? 'border-red-500 bg-red-50 text-red-700' : 'text-slate-800'}`}
                value={formData.dataNascimento}
                onChange={e => setFormData(prev => ({ ...prev, dataNascimento: e.target.value }))}
              />
              {ageWarning && (
                <p className="text-[9px] font-bold text-red-600 mt-2 flex items-center gap-1 uppercase tracking-tighter">
                  <AlertTriangle size={12} /> Idade fora do intervalo (0-21 anos)
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Idade (Cálculo)</label>
              <input type="text" disabled className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl text-xs font-black text-slate-500" value={formData.idade ?? ''} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Estrato Etário</label>
              <input type="text" disabled className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl text-xs font-black text-blue-600 uppercase" value={formData.faixaEtaria ?? ''} />
            </div>
          </div>
        </section>

        {/* Informações da Ocorrência */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-8 pb-3 border-b border-slate-100">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Clock size={18} /></div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">02. Cronometria & Localidade</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Data Ocorrência</label>
              <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800" value={formData.dataOcorrencia} onChange={e => setFormData(prev => ({...prev, dataOcorrencia: e.target.value}))} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Hora Entrada</label>
              <input type="time" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800" value={formData.horaEntrada} onChange={e => setFormData(prev => ({...prev, horaEntrada: e.target.value}))} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Hora Saída</label>
              <input type="time" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800" value={formData.horaSaida || ''} onChange={e => setFormData(prev => ({...prev, horaSaida: e.target.value}))} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Cores de Prioridade</label>
              <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 uppercase" value={formData.prioridade} onChange={e => setFormData(prev => ({...prev, prioridade: e.target.value as any}))} >
                <option value="Emergência">Emergência (Vermelho)</option>
                <option value="Muito Urgente">Muito Urgente (Laranja)</option>
                <option value="Urgente">Urgente (Amarelo)</option>
                <option value="Pouco Urgente">Pouco Urgente (Verde)</option>
                <option value="Não Urgente">Não Urgente (Azul)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Província</label>
              <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 uppercase" value={formData.provincia} onChange={e => setFormData(prev => ({...prev, provincia: e.target.value}))} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Cidade / Município</label>
              <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 uppercase" value={formData.cidade} onChange={e => setFormData(prev => ({...prev, cidade: e.target.value}))} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Bairro / Zona</label>
              <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 uppercase" value={formData.bairro} onChange={e => setFormData(prev => ({...prev, bairro: e.target.value}))} />
            </div>
          </div>
        </section>

        {/* Sinais Vitais */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-8 pb-3 border-b border-slate-100">
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600"><Thermometer size={18} /></div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">03. Triagem de Sinais Vitais</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Peso Corporal (kg)</label>
              <div className="relative">
                <Weight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input type="number" step="0.1" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800" value={formData.peso} onChange={e => setFormData(prev => ({...prev, peso: parseFloat(e.target.value)}))} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Temperatura (°C)</label>
              <div className="relative">
                <Thermometer className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input type="number" step="0.1" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800" value={formData.temperatura} onChange={e => setFormData(prev => ({...prev, temperatura: parseFloat(e.target.value)}))} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Pressão Arterial</label>
              <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800" placeholder="ex: 120/80" value={formData.pressaoArterial} onChange={e => setFormData(prev => ({...prev, pressaoArterial: e.target.value}))} />
            </div>
          </div>
        </section>

        {/* Diagnóstico e Status */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-8 pb-3 border-b border-slate-100">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><Stethoscope size={18} /></div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">04. Atendimento & Desfecho Clínico</h4>
          </div>
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Ocorrência Principais (Motivo)</label>
              <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 uppercase" placeholder="Febre, vômito, queda..." value={formData.ocorrencia} onChange={e => setFormData(prev => ({...prev, ocorrencia: e.target.value}))} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Sinais / Sintomas Observados</label>
              <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 uppercase h-32 resize-none" value={formData.sinaisSintomas} onChange={e => setFormData(prev => ({...prev, sinaisSintomas: e.target.value}))} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Conclusão Diagnóstica</label>
              <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 uppercase h-32 resize-none" value={formData.diagnosticos} onChange={e => setFormData(prev => ({...prev, diagnosticos: e.target.value}))} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Estado de Fluxo</label>
              <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 uppercase" value={formData.status} onChange={e => setFormData(prev => ({...prev, status: e.target.value as any}))} >
                <option value="Em Espera">Em Espera</option>
                <option value="Atendido">Atendido</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Estado Final do Paciente</label>
              <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 uppercase" value={formData.estado} onChange={e => setFormData(prev => ({...prev, estado: e.target.value as any}))} >
                <option value="Atendido">Atendido</option>
                <option value="Internado">Internado</option>
                <option value="Transferido">Transferido</option>
                <option value="Alta">Alta</option>
                <option value="Óbito">Óbito</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4 pb-12">
          <button 
            type="button" 
            onClick={() => navigate('/list')}
            className="px-8 py-4 rounded-2xl border border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            Cancelar Registo
          </button>
          <button 
            disabled={loading}
            type="submit" 
            className="px-10 py-4 rounded-2xl bg-[#0F172A] text-white font-black text-[10px] uppercase tracking-widest hover:bg-[#1E293B] transition-all flex items-center gap-2 shadow-xl shadow-slate-200 disabled:opacity-50"
          >
            {loading ? <Clock className="animate-spin w-4 h-4" /> : <Save size={14} />}
            {isEditing ? 'Salvar Alterações' : 'Concluir Admissão'}
          </button>
        </div>
      </form>
    </div>
  );
};
