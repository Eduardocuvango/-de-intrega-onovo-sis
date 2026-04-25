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
  Database
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../lib/AuthContext';

export const PatientList: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
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
    });
    return unsubscribe;
  }, []);

  const filteredPatients = patients.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPriority = filterPriority === 'Todas' || p.prioridade === filterPriority;
    const matchStatus = filterStatus === 'Todos' || p.status === filterStatus;
    const matchState = filterState === 'Todos' || p.estado === filterState;
    const matchProvince = filterProvince === 'Todas' || p.provincia === filterProvince;
    const matchDate = !filterDate || p.dataOcorrencia === filterDate;
    return matchSearch && matchPriority && matchStatus && matchState && matchProvince && matchDate;
  });

  const uniqueProvinces = Array.from(new Set(patients.map(p => p.provincia))).filter(Boolean);

  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este registro?")) {
      await deleteDoc(doc(db, 'patients', id));
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
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Fluxo de Urgência</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Monitorização de Atendimento em Tempo Real</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSeedDemoData} className="flex items-center gap-2 bg-amber-500 text-white px-3 py-2 rounded-xl hover:bg-amber-600 transition font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-100">
            <Database size={14} /> Dados Demo
          </button>
          <button 
            onClick={() => navigate('/register')}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100"
          >
            <Plus className="w-4 h-4" /> Novo Paciente
          </button>
        </div>
      </div>

      {/* Filter Matrix */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Nome ou ID..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border-none text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="Todas">Todas Prioridades</option>
          <option value="Emergência">Emergência</option>
          <option value="Muito Urgente">Muito Urgente</option>
          <option value="Urgente">Urgente</option>
          <option value="Pouco Urgente">Pouco Urgente</option>
          <option value="Não Urgente">Não Urgente</option>
        </select>

        <select className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="Todos">Todos Status</option>
          <option value="Em Espera">Em Espera</option>
          <option value="Atendido">Atendido</option>
        </select>

        <select className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none" value={filterState} onChange={e => setFilterState(e.target.value)}>
          <option value="Todos">Todos Estados</option>
          <option value="Internado">Internado</option>
          <option value="Alta">Alta</option>
          <option value="Transferido">Transferido</option>
          <option value="Óbito">Óbito</option>
        </select>

        <select className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none" value={filterProvince} onChange={e => setFilterProvince(e.target.value)}>
          <option value="Todas">Todas Províncias</option>
          {uniqueProvinces.map(prov => (
            <option key={prov} value={prov}>{prov}</option>
          ))}
        </select>

        <input 
          type="date" 
          className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none" 
          value={filterDate} 
          onChange={e => setFilterDate(e.target.value)} 
        />
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#0F172A] text-white">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Identificação</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Prioridade</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Status / Alerta</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Localidade</th>
              <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPatients.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-black text-slate-800 text-xs uppercase tracking-tight">{p.nome}</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      {p.genero[0]} • {p.idade} ANOS {p.idade > 21 && '⚠️'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <PriorityBadge priority={p.prioridade} />
                </td>
                <td className="px-6 py-4">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    p.status === 'Atendido' 
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                      : 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'
                  }`}>
                    {p.status === 'Atendido' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                    {p.status}
                  </div>
                  {(p.tempoAtendimento || 0) > 40 && (
                    <span className="ml-2 text-[9px] font-black text-amber-600 uppercase">Tempo Alto</span>
                  )}
                </td>
                <td className="px-6 py-4">
                   <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
                     <div className="text-slate-800 mb-0.5">{p.bairro}</div>
                     <div className="text-slate-400">{p.cidade}</div>
                   </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => navigate(`/edit/${p.id}`)} className="p-2 text-slate-400 hover:text-blue-600 bg-white border border-slate-100 rounded-xl transition-all shadow-sm">
                      <Edit3 size={14} />
                    </button>
                    {isAdmin && (
                      <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-rose-600 bg-white border border-slate-100 rounded-xl transition-all shadow-sm">
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

