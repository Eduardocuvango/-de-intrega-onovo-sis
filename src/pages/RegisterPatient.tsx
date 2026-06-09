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

const PROVINCIAS = [
  'Huíla',
  'Luanda',
  'Benguela',
  'Namibe',
  'Cunene',
  'Huambo',
  'Bié',
  'Cabinda',
  'Uíge',
  'Cuanza Sul',
  'Cuanza Norte',
  'Malanje',
  'Lunda Sul',
  'Lunda Norte',
  'Moxico',
  'Cuando Cubango',
  'Zaire',
  'Bengo'
];

const PROVINCIAS_MUNICIPALS: Record<string, string[]> = {
  'Huíla': ['Lubango', 'Humpata', 'Chibia', 'Cacula', 'Quilengues', 'Matala', 'Cuvango', 'Jamba', 'Caluquembe', 'Caconda', 'Chicomba', 'Chipindo', 'Gambos', 'Quipungo'],
  'Luanda': ['Luanda', 'Belas', 'Cacuaco', 'Cazenga', 'Icolo e Bengo', 'Kilamba Kiaxi', 'Quiçama', 'Talatona', 'Viana'],
  'Benguela': ['Benguela', 'Lobito', 'Baía Farta', 'Catumbela', 'Caimbambo', 'Chongoroi', 'Balombo', 'Ganda', 'Cubal', 'Bocoio'],
  'Namibe': ['Moçâmedes', 'Bibala', 'Camucuio', 'Virei', 'Tômbwa'],
  'Cunene': ['Cahama', 'Cuanhama', 'Curoca', 'Cuvelai', 'Namacunde', 'Ombadja'],
  'Huambo': ['Huambo', 'Caála', 'Ekunha', 'Longonjo', 'Ukuma', 'Chinjenje', 'Bailundo', 'Mungo', 'Tchicala Tcholohanga', 'Catchiungo', 'Londuimbali']
};

const BAIRROS_LUBANGO = [
  'Mitcha', 'Santo António', 'Lucrécia', 'Lage', 'João de Almeida', 
  'Nambambe', 'Chioco', 'Comercial', 'Bacalhau', 'Arco-Íris', 'Arimba', 'Hoque', 'Palanca'
];

const SINTOMAS_COMUNS = [
  'Febre Alta',
  'Tosse Seca',
  'Tosse Produtiva',
  'Dificuldade Respiratória',
  'Vómitos Frequentes',
  'Diarreia Líquida',
  'Convulsões',
  'Rigidez de Nuca',
  'Letargia / Sonolência',
  'Recusa Alimentar',
  'Desidratação Severa',
  'Dor Abdominal',
  'Palidez Cutânea',
  'Cefaleia Intensa',
  'Irritabilidade'
];

interface PatientFormProps {
  initialData?: Patient;
  isEditing?: boolean;
}

export const RegisterPatient: React.FC<PatientFormProps> = ({ initialData, isEditing }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<Partial<Patient>>(initialData || {
    nome: '',
    genero: 'Masculino',
    dataNascimento: '',
    dataOcorrencia: format(new Date(), 'yyyy-MM-dd'),
    horaEntrada: format(new Date(), 'HH:mm'),
    status: 'Em Espera',
    prioridade: 'Urgente',
    estado: 'Atendido',
    provincia: 'Huíla',
    cidade: 'Lubango',
    bairro: '',
    peso: 0,
    temperatura: 36.5,
    pressaoArterial: '120/80',
    ocorrencia: '',
    sinaisSintomas: '',
    diagnosticos: '',
  });

  // Calculate derived fields on the fly to avoid extra state updates
  const calculatedAge = React.useMemo(() => {
    if (!formData.dataNascimento) return null;
    try {
      const age = differenceInYears(new Date(), parseISO(formData.dataNascimento));
      return isNaN(age) ? null : age;
    } catch {
      return null;
    }
  }, [formData.dataNascimento]);

  const calculatedFaixa = React.useMemo(() => {
    if (calculatedAge === null) return '';
    if (calculatedAge < 1) return 'Recém-nascido';
    if (calculatedAge < 12) return 'Criança';
    if (calculatedAge < 18) return 'Adolescente';
    return 'Jovem Adulto';
  }, [calculatedAge]);

  const ageWarning = calculatedAge !== null && calculatedAge > 21;

  // Toggle quick symptom addition
  const handleToggleSintoma = (sintoma: string) => {
    const currentText = formData.sinaisSintomas || '';
    const sintomaUpper = sintoma.toUpperCase();
    
    // Split on commas/newlines, clean up results
    let list = currentText
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    const index = list.findIndex(s => s.toUpperCase() === sintomaUpper);
    if (index >= 0) {
      list.splice(index, 1);
    } else {
      list.push(sintoma);
    }
    
    setFormData(prev => ({
      ...prev,
      sinaisSintomas: list.join(', ')
    }));
    if (errors.sinaisSintomas) {
      setErrors(prev => ({ ...prev, sinaisSintomas: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome || formData.nome.trim().length < 3) {
      newErrors.nome = "O nome deve ter pelo menos 3 caracteres.";
    } else {
      const nameParts = formData.nome.trim().split(/\s+/);
      if (nameParts.length < 2) {
        newErrors.nome = "Por favor, introduza o nome completo (pelo menos nome e apelido).";
      }
    }

    if (!formData.dataNascimento) {
      newErrors.dataNascimento = "A data de nascimento é obrigatória.";
    } else {
      const bDate = new Date(formData.dataNascimento);
      const today = new Date();
      if (bDate > today) {
        newErrors.dataNascimento = "A data de nascimento não pode estar no futuro.";
      }
    }

    if (!formData.dataOcorrencia) {
      newErrors.dataOcorrencia = "A data da ocorrência é obrigatória.";
    } else {
      const oDate = new Date(formData.dataOcorrencia);
      const today = new Date();
      if (oDate > today) {
        newErrors.dataOcorrencia = "A data da ocorrência não pode estar no futuro.";
      }
      if (formData.dataNascimento) {
        const bDate = new Date(formData.dataNascimento);
        if (oDate < bDate) {
          newErrors.dataOcorrencia = "A data da ocorrência não pode ser anterior ao nascimento.";
        }
      }
    }

    if (!formData.provincia || formData.provincia.trim().length < 2) {
      newErrors.provincia = "A província é obrigatória.";
    }
    
    if (!formData.cidade || formData.cidade.trim().length < 2) {
      newErrors.cidade = "O município é obrigatório.";
    }

    if (!formData.bairro || formData.bairro.trim().length < 2) {
      newErrors.bairro = "O bairro/zona é obrigatório.";
    }

    if (formData.temperatura === undefined || formData.temperatura < 33 || formData.temperatura > 43 || isNaN(formData.temperatura)) {
      newErrors.temperatura = "Temperatura inválida (deve estar entre 33°C e 43°C).";
    }

    if (formData.peso === undefined || formData.peso <= 0 || formData.peso > 150 || isNaN(formData.peso)) {
      newErrors.peso = "Indique um peso pediátrico válido (0.1kg a 150kg).";
    }

    if (!formData.ocorrencia) {
      newErrors.ocorrencia = "Selecione a patologia principal.";
    }

    if (!formData.sinaisSintomas || formData.sinaisSintomas.trim().length < 3) {
      newErrors.sinaisSintomas = "Os sinais e sintomas são obrigatórios.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!validateForm()) {
      alert("⚠️ Existem erros de validação no formulário. Por favor, corrija os campos destacados.");
      return;
    }
    
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

      // Smart status logic during submission if not manually set
      let finalStatus = formData.status;
      if (formData.diagnosticos && formData.diagnosticos.trim().length > 5 && finalStatus === 'Em Espera') {
        finalStatus = 'Atendido';
      }

      const timestamp = serverTimestamp();
      const randomId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const datePart = format(new Date(), 'yyyyMMdd');
      const generatedId = `HPZ-${datePart}-${randomId}`;

      const data = {
        ...formData,
        status: finalStatus,
        idade: calculatedAge,
        faixaEtaria: calculatedFaixa,
        idPaciente: isEditing ? (formData.idPaciente || generatedId) : generatedId,
        idMedico: user.id || auth.currentUser?.uid,
        assinaturaMedico: user.nome || auth.currentUser?.displayName || "Médico de Plantão",
        tempoAtendimento: serviceTime > 0 ? serviceTime : 0,
        updatedAt: timestamp,
      };

      if (isEditing && initialData) {
        await updateDoc(doc(db, 'patients', initialData.id), data);
      } else {
        await addDoc(collection(db, 'patients'), {
          ...data,
          createdAt: timestamp,
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
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {isEditing ? 'Editar Registro' : 'Novo Atendimento'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Preencha os dados de triagem e atendimento</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação Básica - Matching sleek theme */}
        <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center gap-2 mb-8 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400 transition-colors"><User size={18} /></div>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">01. Identificação de Amostra/Paciente</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Nome Completo do Paciente</label>
              <input 
                type="text" required 
                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border ${errors.nome ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/10' : 'border-slate-100 dark:border-slate-700'} rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider`}
                value={formData.nome || ''}
                onChange={e => {
                  setFormData(prev => ({ ...prev, nome: e.target.value }));
                  if (errors.nome) setErrors(prev => ({ ...prev, nome: '' }));
                }}
              />
              {errors.nome && (
                <p className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-tight">{errors.nome}</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Gênero Bio</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100 uppercase"
                value={formData.genero || 'Masculino'}
                onChange={e => setFormData(prev => ({ ...prev, genero: e.target.value as any }))}
              >
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Calendário de Nascimento</label>
              <input 
                type="date" required 
                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border ${errors.dataNascimento ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/10' : (ageWarning ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-100 dark:border-slate-700')} rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black ${ageWarning ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}
                value={formData.dataNascimento}
                onChange={e => {
                  setFormData(prev => ({ ...prev, dataNascimento: e.target.value }));
                  if (errors.dataNascimento) setErrors(prev => ({ ...prev, dataNascimento: '' }));
                }}
              />
              {errors.dataNascimento && (
                <p className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-tight">{errors.dataNascimento}</p>
              )}
              {ageWarning && !errors.dataNascimento && (
                <p className="text-[9px] font-bold text-red-600 dark:text-red-400 mt-2 flex items-center gap-1 uppercase tracking-tighter">
                  <AlertTriangle size={12} /> Idade fora do intervalo (0-21 anos)
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Idade (Cálculo)</label>
              <input type="text" disabled className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/50 border-none rounded-xl text-xs font-black text-slate-500 dark:text-slate-400" value={(calculatedAge !== null && !isNaN(calculatedAge)) ? calculatedAge : ''} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Estrato Etário</label>
              <input type="text" disabled className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/50 border-none rounded-xl text-xs font-black text-blue-600 dark:text-blue-400 uppercase" value={calculatedFaixa ?? ''} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">ID do Médico (Auto)</label>
              <input type="text" disabled className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/50 border-none rounded-xl text-xs font-black text-slate-500 dark:text-slate-400" value={user?.id?.slice(-8).toUpperCase() || 'S/ID'} />
            </div>
          </div>
        </section>

        {/* Informações da Ocorrência */}
        <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center gap-2 mb-8 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400 transition-colors"><Clock size={18} /></div>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">02. Cronometria & Localidade</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Data Ocorrência</label>
              <input 
                type="date" 
                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border ${errors.dataOcorrencia ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/10' : 'border-slate-100 dark:border-slate-700'} rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100`} 
                value={formData.dataOcorrencia} 
                onChange={e => {
                  setFormData(prev => ({...prev, dataOcorrencia: e.target.value}));
                  if (errors.dataOcorrencia) setErrors(prev => ({...prev, dataOcorrencia: ''}));
                }} 
              />
              {errors.dataOcorrencia && (
                <p className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-tight">{errors.dataOcorrencia}</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Hora Entrada</label>
              <input type="time" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100" value={formData.horaEntrada} onChange={e => setFormData(prev => ({...prev, horaEntrada: e.target.value}))} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Hora Saída</label>
              <input type="time" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100" value={formData.horaSaida || ''} onChange={e => setFormData(prev => ({...prev, horaSaida: e.target.value}))} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Cores de Prioridade</label>
              <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100 uppercase" value={formData.prioridade} onChange={e => setFormData(prev => ({...prev, prioridade: e.target.value as any}))} >
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
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Província (Lista / Manual)</label>
              <input 
                type="text" 
                list="provincia-list"
                placeholder="Selecione ou digite..."
                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border ${errors.provincia ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/10' : 'border-slate-100 dark:border-slate-700'} rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100 uppercase`} 
                value={formData.provincia || ''} 
                onChange={e => {
                  setFormData(prev => ({...prev, provincia: e.target.value}));
                  if (errors.provincia) setErrors(prev => ({...prev, provincia: ''}));
                }} 
              />
              <datalist id="provincia-list">
                {PROVINCIAS.map(p => <option key={p} value={p} />)}
              </datalist>
              {errors.provincia && (
                <p className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-tight">{errors.provincia}</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Cidade / Município (Lista / Manual)</label>
              <input 
                type="text" 
                list="cidade-list"
                placeholder="Selecione ou digite..."
                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border ${errors.cidade ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/10' : 'border-slate-100 dark:border-slate-700'} rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100 uppercase`} 
                value={formData.cidade || ''} 
                onChange={e => {
                  setFormData(prev => ({...prev, cidade: e.target.value}));
                  if (errors.cidade) setErrors(prev => ({...prev, cidade: ''}));
                }} 
              />
              <datalist id="cidade-list">
                {((formData.provincia && PROVINCIAS_MUNICIPALS[formData.provincia]) || PROVINCIAS_MUNICIPALS['Huíla'] || []).map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {errors.cidade && (
                <p className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-tight">{errors.cidade}</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Bairro / Zona (Lista / Manual)</label>
              <input 
                type="text" 
                list="bairros-list"
                placeholder="Selecione ou digite..."
                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border ${errors.bairro ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/10' : 'border-slate-100 dark:border-slate-700'} rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100 uppercase`} 
                value={formData.bairro || ''} 
                onChange={e => {
                  setFormData(prev => ({...prev, bairro: e.target.value}));
                  if (errors.bairro) setErrors(prev => ({...prev, bairro: ''}));
                }} 
              />
              <datalist id="bairros-list">
                {BAIRROS_LUBANGO.map(b => (
                  <option key={b} value={b} />
                ))}
              </datalist>
              {errors.bairro && (
                <p className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-tight">{errors.bairro}</p>
              )}
            </div>
          </div>
        </section>

        {/* Sinais Vitais */}
        <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center gap-2 mb-8 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-600 dark:text-rose-400 transition-colors"><Thermometer size={18} /></div>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">03. Triagem de Sinais Vitais</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Peso Corporal (kg)</label>
              <div className="relative">
                <Weight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 dark:text-slate-600" />
                <input 
                  type="number" step="0.1" 
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border ${errors.peso ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/10' : 'border-slate-100 dark:border-slate-700'} rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100`} 
                  value={formData.peso !== undefined && !isNaN(formData.peso) && formData.peso !== 0 ? formData.peso : ''} 
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setFormData(prev => ({...prev, peso: isNaN(val) ? 0 : val}));
                    if (errors.peso) setErrors(prev => ({...prev, peso: ''}));
                  }} 
                />
              </div>
              {errors.peso && (
                <p className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-tight">{errors.peso}</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Temperatura (°C)</label>
              <div className="relative">
                <Thermometer className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 dark:text-slate-600" />
                <input 
                  type="number" step="0.1" 
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border ${errors.temperatura ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/10' : 'border-slate-100 dark:border-slate-700'} rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100`} 
                  value={formData.temperatura !== undefined && !isNaN(formData.temperatura) && formData.temperatura !== 0 ? formData.temperatura : ''} 
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setFormData(prev => ({...prev, temperatura: isNaN(val) ? 0 : val}));
                    if (errors.temperatura) setErrors(prev => ({...prev, temperatura: ''}));
                  }} 
                />
              </div>
              {errors.temperatura && (
                <p className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-tight">{errors.temperatura}</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Pressão Arterial</label>
              <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100" placeholder="ex: 120/80" value={formData.pressaoArterial} onChange={e => setFormData(prev => ({...prev, pressaoArterial: e.target.value}))} />
            </div>
          </div>
        </section>

        {/* Diagnóstico e Status */}
        <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center gap-2 mb-8 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400 transition-colors"><Stethoscope size={18} /></div>
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">04. Atendimento & Desfecho Clínico</h4>
          </div>
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Motivo / Patologia Principal</label>
              <select 
                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border ${errors.ocorrencia ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/10' : 'border-slate-100 dark:border-slate-700'} rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100 uppercase appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOTQ5N2FjIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik02IDlsNiA2IDYtNiIvPjwvc3ZnPg==')] bg-[length:20px] bg-[right_16px_center] bg-no-repeat`} 
                value={formData.ocorrencia || ''} 
                onChange={e => {
                  setFormData(prev => ({...prev, ocorrencia: e.target.value}));
                  if (errors.ocorrencia) setErrors(prev => ({...prev, ocorrencia: ''}));
                }}
              >
                <option value="">Selecione...</option>
                <option value="Malária">Malária (Paludismo)</option>
                <option value="Infeção Respiratória">IRA (Respiratória)</option>
                <option value="Diarreia">DDA (Diarreica / Cólera)</option>
                <option value="Malnutrição">Malnutrição (Kwas/Mara)</option>
                <option value="Anemia Falciforme">Anemia Falciforme (SS)</option>
                <option value="Sarampo">Sarampo / Exantemática</option>
                <option value="Meningite">Meningite Bacteriana</option>
                <option value="Febre Tifóide">Febre Tifóide</option>
                <option value="Traumatismo">Traumatismo / Acidente</option>
                <option value="Febre a Esclarecer">Febre a Esclarecer</option>
                <option value="Tuberculose">Tuberculose Pediátrica</option>
                <option value="Sepsis">Sepsis Neonatal</option>
                <option value="Outro">Outro Motivo</option>
              </select>
              {errors.ocorrencia && (
                <p className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-tight">{errors.ocorrencia}</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Seleção Rápida de Sinais & Sintomas Comuns (Automático)</label>
              <div className="flex flex-wrap gap-2 mb-3 max-h-40 overflow-y-auto p-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                {SINTOMAS_COMUNS.map(sintoma => {
                  const active = (formData.sinaisSintomas || '').toUpperCase().includes(sintoma.toUpperCase());
                  return (
                    <button
                      type="button"
                      key={sintoma}
                      onClick={() => handleToggleSintoma(sintoma)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                        active 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {active ? '✓ ' : ''}{sintoma}
                    </button>
                  );
                })}
              </div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Sinais / Sintomas Observados (Edição Manual / Detalhes)</label>
              <textarea 
                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border ${errors.sinaisSintomas ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/10' : 'border-slate-100 dark:border-slate-700'} rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100 uppercase h-32 resize-none`}
                placeholder="Selecione acima ou descreva pormenorizadamente os sintomas apresentados..."
                value={formData.sinaisSintomas} 
                onChange={e => {
                  setFormData(prev => ({...prev, sinaisSintomas: e.target.value}));
                  if (errors.sinaisSintomas) setErrors(prev => ({...prev, sinaisSintomas: ''}));
                }} 
              />
              {errors.sinaisSintomas && (
                <p className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-tight">{errors.sinaisSintomas}</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Conclusão Diagnóstica</label>
              <textarea className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100 uppercase h-32 resize-none" value={formData.diagnosticos} onChange={e => setFormData(prev => ({...prev, diagnosticos: e.target.value}))} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Estado de Fluxo</label>
              <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100 uppercase" value={formData.status} onChange={e => setFormData(prev => ({...prev, status: e.target.value as any}))} >
                <option value="Em Espera">Em Espera</option>
                <option value="Atendido">Atendido</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Estado Final do Paciente</label>
              <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 transition-all outline-none text-xs font-black text-slate-800 dark:text-slate-100 uppercase" value={formData.estado} onChange={e => setFormData(prev => ({...prev, estado: e.target.value as any}))} >
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
            className="px-8 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Cancelar Registo
          </button>
          <button 
            disabled={loading}
            type="submit" 
            className="px-10 py-4 rounded-2xl bg-[#0F172A] dark:bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-[#1E293B] dark:hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-slate-200 dark:shadow-none disabled:opacity-50"
          >
            {loading ? <Clock className="animate-spin w-4 h-4" /> : <Save size={14} />}
            {isEditing ? 'Salvar Alterações' : 'Concluir Admissão'}
          </button>
        </div>
      </form>
    </div>
  );
};
