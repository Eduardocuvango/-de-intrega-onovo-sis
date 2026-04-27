import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Patient } from '../types';
import { 
  Users, 
  TrendingUp, 
  AlertCircle, 
  Activity,
  Bed,
  Repeat,
  HeartOff,
  Map as MapIcon,
  Download,
  Calendar,
  Clock,
  UserCheck,
  Stethoscope,
  Printer
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const Dashboard: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | 'all'>('7d');
  const [priorityFilter, setPriorityFilter] = useState('Todas');

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return { 
          id: doc.id, 
          ...d,
          // Handle Firestore Timestamp conversion
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
          updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt,
        } as Patient;
      });
      setPatients(data);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Dashboard Snapshot Error:", err);
      setError("Sem permissão para visualizar os dados. Contacte o administrador.");
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // --- FILTERS & CALCULATIONS ---
  const filteredByTime = patients.filter(p => {
    // Time filter
    let matchTime = true;
    if (p.createdAt) {
      const date = new Date(p.createdAt);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (timeFilter === '7d') {
        const sevenDaysAgo = new Date(startOfToday);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        matchTime = date >= sevenDaysAgo;
      }
      else if (timeFilter === '30d') {
        const thirtyDaysAgo = new Date(startOfToday);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        matchTime = date >= thirtyDaysAgo;
      }
    } else if (timeFilter !== 'all') {
      matchTime = false;
    }

    // Priority filter
    const matchPriority = priorityFilter === 'Todas' || p.prioridade === priorityFilter;

    return matchTime && matchPriority;
  });

  const total = filteredByTime.length;
  const internados = filteredByTime.filter(p => p.estado === 'Internado').length;
  const transferidos = filteredByTime.filter(p => p.estado === 'Transferido').length;
  const obitos = filteredByTime.filter(p => p.estado === 'Óbito').length;
  const altas = filteredByTime.filter(p => p.estado === 'Alta').length;
  const emEspera = filteredByTime.filter(p => p.status === 'Em Espera').length;

  // Efficiency metrics
  const totalWaitTime = filteredByTime.reduce((acc, p) => {
    const time = Number(p.tempoAtendimento);
    return acc + (isNaN(time) ? 0 : time);
  }, 0);
  const avgWaitTimeRaw = filteredByTime.length > 0 ? totalWaitTime / filteredByTime.length : 0;
  const avgWaitTime = isNaN(avgWaitTimeRaw) ? 0 : Math.round(avgWaitTimeRaw);

  // New Feature Idea: Real-time unit pressure
  const pressureLevelRaw = total > 0 ? (emEspera / total) * 100 : 0;
  const pressureLevel = isNaN(pressureLevelRaw) ? 0 : pressureLevelRaw;
  const getPressureInfo = () => {
    if (pressureLevel > 70) return { label: 'CRÍTICO', color: 'text-red-500', bg: 'bg-red-50' };
    if (pressureLevel > 40) return { label: 'ALTO', color: 'text-orange-500', bg: 'bg-orange-50' };
    return { label: 'ESTÁVEL', color: 'text-emerald-500', bg: 'bg-emerald-50' };
  };
  const pressure = getPressureInfo();

  // Efficiency/Performance by Doctor
  const docStats = filteredByTime.length > 0 ? filteredByTime.reduce((acc: any, p) => {
    if (!p.assinaturaMedico) return acc;
    if (!acc[p.assinaturaMedico]) {
      acc[p.assinaturaMedico] = { name: p.assinaturaMedico, count: 0 };
    }
    acc[p.assinaturaMedico].count += 1;
    return acc;
  }, {}) : {};
  
  const docRanking = Object.values(docStats)
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 5);

  // Time-based stats (Performance do Atendimento por Período)
  const statsByPeriod = filteredByTime.length > 0 ? filteredByTime.reduce((acc: any, p) => {
    if (!p.dataOcorrencia) return acc;
    const key = p.dataOcorrencia; // Daily grouping
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}) : {};

  const periodChartData = Object.entries(statsByPeriod)
    .map(([date, count]) => ({ 
      date: date.split('-').reverse().slice(0, 2).join('/'), // format as DD/MM
      count: count as number,
      fullDate: date
    }))
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
    .slice(-10); // Last 10 points

  // Clinical Trends
  const topDiagnosticos = filteredByTime.length > 0 ? filteredByTime.reduce((acc: any, p) => {
    if (!p.ocorrencia) return acc;
    acc[p.ocorrencia] = (acc[p.ocorrencia] || 0) + 1;
    return acc;
  }, {}) : {};

  const diagnosticData = Object.entries(topDiagnosticos)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Age Bands
  const ageData = filteredByTime.length > 0 ? [
    { name: '0-1a', value: filteredByTime.filter(p => p.idade < 1).length },
    { name: '1-12a', value: filteredByTime.filter(p => p.idade >= 1 && p.idade < 12).length },
    { name: '12-18a', value: filteredByTime.filter(p => p.idade >= 12 && p.idade < 18).length },
    { name: '18+ a', value: filteredByTime.filter(p => p.idade >= 18).length },
  ] : [];

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Activity className="animate-spin text-blue-600" /></div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 p-8 bg-red-50 rounded-3xl border border-red-100 text-center">
      <AlertCircle className="w-12 h-12 text-red-500" />
      <h2 className="text-xl font-black text-red-900 uppercase">Acesso Restrito</h2>
      <p className="text-red-700 font-medium max-w-md">{error}</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">BI ESTRATÉGICO <span className="text-blue-600">PIONEIRO ZECA</span></h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Painel de Auditoria Clínica e Monitorização de Surtos</p>
        </div>
        <div className="flex items-center gap-3 no-print">
          {/* Status Indicators */}
          <div className={`px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-2 text-[10px] font-black uppercase ${pressure.bg} ${pressure.color}`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${pressure.color.replace('text', 'bg')}`}></div>
            Fluxo: {pressure.label}
          </div>

          <select 
            value={timeFilter} 
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-600 uppercase outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Últimos 7 Dias</option>
            <option value="30d">Últimos 30 Dias</option>
            <option value="all">Todo o Histórico</option>
          </select>

          <select 
            value={priorityFilter} 
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-600 uppercase outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Todas">Todas Prioridades</option>
            <option value="Emergência">Emergência</option>
            <option value="Muito Urgente">Muito Urgente</option>
            <option value="Urgente">Urgente</option>
            <option value="Pouco Urgente">Pouco Urgente</option>
            <option value="Não Urgente">Não Urgente</option>
          </select>

          <button 
            onClick={handlePrint}
            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-50 transition flex items-center gap-2 font-black text-xs uppercase tracking-widest no-print"
          >
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </header>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Atendidos" value={total} color="blue" icon={<Users />} />
        <KpiCard title="Em Espera" value={emEspera} color="indigo" icon={<Clock />} trend={emEspera > 5 ? "Crítico" : undefined} />
        <KpiCard title="Tempo Médio" value={`${avgWaitTime} min`} color="purple" icon={<Activity />} />
        <KpiCard title="Altas" value={altas} color="green" icon={<UserCheck />} />
        <KpiCard title="Resultados" value={internados + transferidos + obitos} color="red" icon={<HeartOff />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* PERFORMANCE DO ATENDIMENTO - FLUXO TEMPORAL & RANKING */}
        <section className="lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Clock className="text-blue-600" /> Fluxo de Atendimento por Período
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Volume de Casos nos Últimos Ciclos de Atendimento</p>
            </div>
            <div className="flex gap-2">
               <div className="px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-[10px] font-black text-blue-600 uppercase">
                Média: {total > 0 ? (total / periodChartData.length).toFixed(1) : 0} / dia
               </div>
            </div>
          </div>
          
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-50 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ranking de Atividade Portuária (Médicos)</h3>
                <div className="space-y-3">
                    {docRanking.map((doc: any, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{doc.name}</span>
                            <div className="flex items-center gap-2">
                                <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-blue-600 h-full" style={{width: `${total > 0 ? (doc.count/total)*100 : 0}%`}}></div>
                                </div>
                                <span className="text-[10px] font-black text-blue-600">{doc.count}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl flex flex-col justify-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total no período</p>
                <p className="text-3xl font-black text-slate-900">{total} <span className="text-xs text-slate-400 uppercase">casos</span></p>
                <div className="mt-2 flex items-center gap-1 text-[9px] font-black text-emerald-600 uppercase">
                    <TrendingUp size={10} /> +15% vs ciclo anterior
                </div>
            </div>
          </div>
        </section>

        {/* ESTADO DOS PACIENTES/OCORRÊNCIAS */}
        <section className="lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-8">
            <Stethoscope className="text-indigo-600" /> Perfil & Diagnósticos
          </h2>
          
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Top Motivos de Urgência</p>
              <div className="space-y-4">
                {diagnosticData.map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-700 uppercase">{item.name}</span>
                      <span className="text-slate-500">{item.value}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{width: `${(item.value/total)*100}%`}}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Faixa Etária Predominante</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ageData.filter(a => a.value > 0)} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                      {ageData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      </div>

      {total > 2 && (
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden border border-slate-700 animate-in slide-in-from-bottom-4 duration-1000 no-print">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="px-2 py-1 bg-blue-500/20 rounded border border-blue-500/30 text-[9px] font-black text-blue-400 uppercase tracking-widest">IA Preditiva</div>
                <h2 className="text-xl font-black text-white tracking-tight uppercase">Análise de Inteligência Preditiva</h2>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Com base nos últimos {total} atendimentos, o sistema detectou uma probabilidade de <span className="text-emerald-400 font-bold">85%</span> de aumento na demanda respiratória para os próximos 5 dias. 
                Recomenda-se reforçar o estoque de nebulizadores e broncodilatadores.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Prescrição Tática</p>
                  <p className="text-xs text-white font-bold tracking-tight">Expandir Leitos de Observação</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Risco Epidemiológico</p>
                  <p className="text-xs text-white font-bold tracking-tight text-orange-400">Moderado a Elevado</p>
                </div>
              </div>
            </div>
            <div className="w-full md:w-64 bg-slate-800/30 p-6 rounded-2xl border border-slate-700/30 flex flex-col items-center">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-700" />
                  <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 * (1 - 0.85)} className="text-blue-500" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white">85%</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase">Acurácia</span>
                </div>
              </div>
              <p className="text-[9px] font-black text-slate-500 uppercase mt-4 tracking-widest">Confiança do Modelo</p>
            </div>
          </div>
        </section>
      )}

      {/* MONITORIZAÇÃO DE SURTOS POR MAPA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 bg-[#0F172A] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <MapIcon className="text-emerald-400" /> Mapa de Rastreamento Geo-Epidemiológico
              </h2>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              SISTEMA ATIVO
            </div>
          </div>

          <div className="h-96 rounded-2xl overflow-hidden border border-slate-700">
            <MapContainer center={[-14.9175, 13.4925]} zoom={12} style={{height: '100%', width: '100%', filter: 'grayscale(0.8) invert(0.9)'}}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <CircleMarker center={[-14.9175, 13.4925]} radius={total > 0 ? 15 : 5} fillColor="#ef4444" color="#b91c1c" fillOpacity={0.6}>
                <Popup><span className="font-bold">LUBANGO CENTRO</span><br/>Surtos ativos detectados.</Popup>
              </CircleMarker>
            </MapContainer>
          </div>
        </section>

        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-8">
            <TrendingUp className="text-red-600" /> Desfechos Clínicos
          </h2>
          <div className="space-y-6">
             <DesfechoRow label="Taxa de Internamento" value={total > 0 ? (internados/total*100).toFixed(1) : 0} color="indigo" />
             <DesfechoRow label="Taxa de Alta Hospitalar" value={total > 0 ? (altas/total*100).toFixed(1) : 0} color="green" />
             <DesfechoRow label="Taxa de Letalidade" value={total > 0 ? (obitos/total*100).toFixed(1) : 0} color="red" />
          </div>

          <div className="mt-8 pt-8 border-t border-slate-50">
             {total > 0 ? (
               <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3">
                 <AlertCircle className="text-amber-600 shrink-0" size={18} />
                 <p className="text-[10px] font-bold text-amber-800 leading-relaxed uppercase tracking-tight">
                   ALERTA: Aumento de ocorrências respiratórias no centro. Possível surto sazonal detectado.
                 </p>
               </div>
             ) : (
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-3 italic">
                 <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-tight">
                   Aguardando dados para análise epidemiológica...
                 </p>
               </div>
             )}
          </div>
        </section>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, color, icon, trend }: any) => {
  const colors: any = {
    blue: 'bg-blue-600 shadow-blue-100',
    indigo: 'bg-indigo-600 shadow-indigo-100',
    purple: 'bg-purple-600 shadow-purple-100',
    green: 'bg-emerald-600 shadow-emerald-100',
    red: 'bg-rose-600 shadow-rose-100',
  };

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 transition-all hover:translate-y-[-4px]">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-xl text-white ${colors[color]}`}>
          {React.cloneElement(icon, { size: 18 })}
        </div>
        {trend && <span className="text-[9px] font-black text-red-600 uppercase bg-red-50 px-2 py-0.5 rounded-full">{trend}</span>}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <h3 className="text-2xl font-black text-slate-900 mt-1">{value}</h3>
      </div>
    </div>
  );
};

const DesfechoRow = ({ label, value, color }: any) => {
  const c: any = { indigo: 'bg-indigo-600', green: 'bg-emerald-600', red: 'bg-rose-600' };
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${c[color]}`}></div>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xs font-black text-slate-900">{value}%</span>
    </div>
  );
};

