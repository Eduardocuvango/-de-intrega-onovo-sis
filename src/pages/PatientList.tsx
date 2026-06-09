import React, { useEffect, useState } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Patient } from '../types';
import { 
  Search, 
  Trash2, 
  Edit3, 
  Plus,
  Clock,
  CheckCircle2,
  History,
  Database,
  Printer,
  FileText,
  Thermometer,
  Weight,
  Heart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export const PatientList: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [hoveredPatient, setHoveredPatient] = useState<string | null>(null);
  
  // Filters
  const [filterPriority, setFilterPriority] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterState, setFilterState] = useState('Todos');
  const [filterProvince, setFilterProvince] = useState('Todas');
  const [filterDate, setFilterDate] = useState('');

  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
      setLoading(false);
    }, (error) => {
      console.error("PatientList Snapshot Error:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  const filteredPatients = patients.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (p.idPaciente || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPriority = filterPriority === 'Todas' || p.prioridade === filterPriority;
    const matchStatus = filterStatus === 'Todos' || p.status === filterStatus;
    const matchState = filterState === 'Todos' || p.estado === filterState;
    const matchProvince = filterProvince === 'Todas' || p.provincia === filterProvince;
    const matchDate = !filterDate || p.dataOcorrencia === filterDate;
    return matchSearch && matchPriority && matchStatus && matchState && matchProvince && matchDate;
  });

  const uniqueProvinces = Array.from(new Set(patients.map(p => p.provincia))).filter(Boolean);

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      alert("⚠️ ACESSO NEGADO: Apenas administradores podem apagar registros.");
      return;
    }
    if (window.confirm("❗ AVISO CRÍTICO\n\nTem certeza que deseja EXCLUIR este registro de paciente permanentemente?\n\nEsta ação não pode ser desfeita.")) {
      try {
        setLoading(true);
        await deleteDoc(doc(db, 'patients', id));
        alert("✅ Sucesso: Registro de paciente removido.");
      } catch (err: any) {
        console.error("Erro ao apagar paciente:", err);
        alert(`❌ Erro ao apagar: ${err.message || 'Verifique as permissões de administrador no Firebase'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSeedDemoData = async () => {
    if (!window.confirm("Deseja gerar 5 registros de demonstração para visualizar o sistema?")) return;
    
    const demoData = [
      { nome: "João Pedro Silva", genero: "Masculino", idade: 5, faixaEtaria: "Criança", dataNascimento: "2019-05-15", ocorrencia: "Febre", prioridade: "Urgente", status: "Em Espera", estado: "Atendido", provincia: "Huila", cidade: "Lubango", bairro: "Arimba" },
      { nome: "Maria Joana", genero: "Feminino", idade: 14, faixaEtaria: "Adolescente", dataNascimento: "2010-02-20", ocorrencia: "Traumatismo", prioridade: "Emergência", status: "Atendido", estado: "Internado", provincia: "Huila", cidade: "Lubango", bairro: "Hoque" },
      { nome: "Lucas Manuel", genero: "Masculino", idade: 1, faixaEtaria: "Bebê", dataNascimento: "2023-11-10", ocorrencia: "Tosse", prioridade: "Muito Urgente", status: "Atendido", estado: "Transferido", provincia: "Huila", cidade: "Humpata", bairro: "Centro" },
      { nome: "Beatriz Costa", genero: "Feminino", idade: 22, faixaEtaria: "Jovem Adulto", dataNascimento: "2004-01-01", ocorrencia: "Vómito", prioridade: "Não Urgente", status: "Atendido", estado: "Alta", provincia: "Huila", cidade: "Lubango", bairro: "Palanca" },
      { nome: "Anselmo Ralph Jr", genero: "Masculino", idade: 8, faixaEtaria: "Criança", dataNascimento: "2016-08-12", ocorrencia: "Diarreia", prioridade: "Pouco Urgente", status: "Em Espera", estado: "Atendido", provincia: "Huila", cidade: "Lubango", bairro: "Arimba" },
    ];

    for (const item of demoData) {
      await addDoc(collection(db, 'patients'), {
        ...item,
        idMedico: auth.currentUser?.uid,
        assinaturaMedico: "Dr. Administrador",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        horaEntrada: "10:30",
        dataOcorrencia: format(new Date(), "yyyy-MM-dd"),
        tempoAtendimento: Math.floor(Math.random() * 40) + 10,
        peso: 25,
        temperatura: 37.5,
        pressaoArterial: "11/7",
        sinaisSintomas: "Sintomas de demonstração.",
        diagnosticos: "Diagnóstico de demonstração."
      });
    }
    alert("Dados Demo Criados com Sucesso!");
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Fluxo de Urgência</h1>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white px-3 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 dark:shadow-none">
                {patients.length} Total
              </span>
              {filteredPatients.length !== patients.length && (
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                  {filteredPatients.length} Encontrados
                </span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">Monitorização de Atendimento em Tempo Real</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSeedDemoData} className="flex items-center gap-2 bg-amber-500 text-white px-3 py-2 rounded-xl hover:bg-amber-600 transition font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-100 dark:shadow-none">
            <Database size={14} /> Dados Demo
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 px-5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition font-black text-[10px] uppercase tracking-widest no-print"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button 
            onClick={() => navigate('/register')}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 dark:shadow-none no-print"
          >
            <Plus className="w-4 h-4" /> Novo Paciente
          </button>
        </div>
      </div>

      {/* Filter Matrix */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Nome ou ID..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 outline-none" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="Todas">Todas Prioridades</option>
          <option value="Emergência">Emergência</option>
          <option value="Muito Urgente">Muito Urgente</option>
          <option value="Urgente">Urgente</option>
          <option value="Pouco Urgente">Pouco Urgente</option>
          <option value="Não Urgente">Não Urgente</option>
        </select>

        <select className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="Todos">Todos Status</option>
          <option value="Em Espera">Em Espera</option>
          <option value="Atendido">Atendido</option>
        </select>

        <select className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 outline-none" value={filterState} onChange={e => setFilterState(e.target.value)}>
          <option value="Todos">Todos Estados</option>
          <option value="Internado">Internado</option>
          <option value="Alta">Alta</option>
          <option value="Transferido">Transferido</option>
          <option value="Óbito">Óbito</option>
        </select>

        <select className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 outline-none" value={filterProvince} onChange={e => setFilterProvince(e.target.value)}>
          <option value="Todas">Todas Províncias</option>
          {uniqueProvinces.map(prov => (
            <option key={prov} value={prov}>{prov}</option>
          ))}
        </select>

        <input 
          type="date" 
          className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 outline-none" 
          value={filterDate} 
          onChange={e => setFilterDate(e.target.value)} 
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#0F172A] dark:bg-slate-950 text-white">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">ID / Paciente</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Prioridade</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Status / Alerta</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Localidade</th>
              <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest whitespace-nowrap no-print">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors">
            {filteredPatients.map((p) => (
              <tr 
                key={p.id} 
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group relative"
                onMouseEnter={() => setHoveredPatient(p.id)}
                onMouseLeave={() => setHoveredPatient(null)}
              >
                <td className="px-6 py-4">
                  <div className="flex flex-col relative">
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight mb-1">{p.idPaciente || "S/ID"}</span>
                    <span className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-tight">{p.nome}</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
                      {p.genero[0]} • {p.idade} ANOS {p.idade > 21 && '⚠️'}
                    </span>
                    
                    {/* Tooltip Detalhado */}
                    <AnimatePresence>
                      {hoveredPatient === p.id && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, x: 20 }}
                          animate={{ opacity: 1, scale: 1, x: 30 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute left-full top-0 z-[100] w-[320px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-6 no-print pointer-events-none transition-colors"
                        >
                          <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Ficha Rápida</h4>
                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{p.dataOcorrencia}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors">
                                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Nascimento</span>
                                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">{p.dataNascimento || "N/A"}</span>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors">
                                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1">Género</span>
                                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">{p.genero}</span>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <div className="flex-1 flex items-center gap-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-2 rounded-lg border border-rose-100 dark:border-rose-900/30 transition-colors">
                                <Thermometer size={12} className="shrink-0" />
                                <span className="text-[10px] font-black">{p.temperatura || "0"}°C</span>
                              </div>
                              <div className="flex-1 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-2 rounded-lg border border-blue-100 dark:border-blue-900/30 transition-colors">
                                <Heart size={12} className="shrink-0" />
                                <span className="text-[10px] font-black">{p.pressaoArterial || "0/0"}</span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-1 flex items-center gap-1">
                                <FileText size={10} /> Queixa Principal
                              </span>
                              <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 italic transition-colors">
                                "{p.sinaisSintomas || "Nenhuma queixa registada."}"
                              </p>
                            </div>

                            {p.diagnosticos && (
                              <div>
                                <span className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase block mb-1">Diagnóstico Provável</span>
                                <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 leading-relaxed transition-colors">
                                  {p.diagnosticos}
                                </p>
                              </div>
                            )}

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between transition-colors">
                              <div className="flex flex-col">
                                <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Assinado por</span>
                                <span className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase">{p.assinaturaMedico}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                                <Clock size={10} />
                                <span className="text-[9px] font-black">{p.tempoAtendimento || 0}m</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <PriorityBadge priority={p.prioridade} />
                </td>
                <td className="px-6 py-4">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    p.status === 'Atendido' 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' 
                      : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 animate-pulse'
                  }`}>
                    {p.status === 'Atendido' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                    {p.status}
                  </div>
                  {(p.tempoAtendimento || 0) > 40 && (
                    <span className="ml-2 text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase">Tempo Alto</span>
                  )}
                </td>
                <td className="px-6 py-4">
                   <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tighter">
                     <div className="text-slate-800 dark:text-slate-200 mb-0.5">{p.bairro}</div>
                     <div className="text-slate-400 dark:text-slate-500">{p.cidade}</div>
                   </div>
                </td>
                <td className="px-6 py-4 text-right no-print">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => navigate(`/edit/${p.id}`)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl transition-all shadow-sm">
                      <Edit3 size={14} />
                    </button>
                    {isAdmin && (
                      <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl transition-all shadow-sm">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredPatients.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <History className="w-12 h-12 text-slate-200" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum registo encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  const configs: any = {
    'Emergência': { color: 'bg-rose-600 ring-rose-200' },
    'Muito Urgente': { color: 'bg-orange-500 ring-orange-200' },
    'Urgente': { color: 'bg-amber-400 ring-amber-100' },
    'Pouco Urgente': { color: 'bg-emerald-500 ring-emerald-100' },
    'Não Urgente': { color: 'bg-blue-500 ring-blue-100' },
  };

  const config = configs[priority] || configs['Urgente'];

  return (
    <span className={`px-2.5 py-1 rounded-md text-[9px] font-black text-white uppercase tracking-widest ring-4 ring-offset-0 ${config.color}`}>
      {priority}
    </span>
  );
};

