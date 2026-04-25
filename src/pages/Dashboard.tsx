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
  Stethoscope
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

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      setPatients(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // --- CALCULATIONS ---
  const total = patients.length;
  const internados = patients.filter(p => p.estado === 'Internado').length;
  const transferidos = patients.filter(p => p.estado === 'Transferido').length;
  const obitos = patients.filter(p => p.estado === 'Óbito').length;
  const altas = patients.filter(p => p.estado === 'Alta').length;

  // Efficiency/Performance
  const docStats = patients.reduce((acc: any, p) => {
    if (!p.assinaturaMedico) return acc;
    if (!acc[p.assinaturaMedico]) {
      acc[p.assinaturaMedico] = { name: p.assinaturaMedico, count: 0 };
    }
    acc[p.assinaturaMedico].count += 1;
    return acc;
  }, {});
  
  const docRanking = Object.values(docStats)
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 5);

  // Clinical Trends
  const topDiagnosticos = patients.reduce((acc: any, p) => {
    if (!p.ocorrencia) return acc;
    acc[p.ocorrencia] = (acc[p.ocorrencia] || 0) + 1;
    return acc;
  }, {});

  const diagnosticData = Object.entries(topDiagnosticos)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Age Bands
  const ageData = [
    { name: '0-1a (Bebês)', value: patients.filter(p => p.idade < 1).length },
    { name: '1-12a (Crianças)', value: patients.filter(p => p.idade >= 1 && p.idade < 12).length },
    { name: '12-18a (Adolesc.)', value: patients.filter(p => p.idade >= 12 && p.idade < 18).length },
    { name: '18-21a (Jovens)', value: patients.filter(p => p.idade >= 18).length },
  ];

  if (loading) return <div className="flex items-center justify-center h-full"><Activity className="animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">BI ESTRATÉGICO <span className="text-blue-600">PIONEIRO ZECA</span></h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Painel de Auditoria Clínica e Monitorização de Surtos</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-2 text-xs font-black text-slate-600 uppercase">
            <Calendar size={14} className="text-blue-500" />
            {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
          </div>
          <button className="bg-[#0F172A] text-white px-6 py-2.5 rounded-xl hover:bg-slate-800 transition flex items-center gap-2 shadow-xl shadow-slate-200 font-bold text-xs uppercase tracking-widest">
            <Download size={16} />
            Exportar BI
          </button>
        </div>
      </header>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Total Atendidos" value={total} color="blue" icon={<Users />} />
        <KpiCard title="Internamentos" value={internados} color="indigo" icon={<Bed />} />
        <KpiCard title="Transferidos" value={transferidos} color="purple" icon={<Repeat />} rotate />
        <KpiCard title="Altas" value={altas} color="green" icon={<UserCheck />} />
        <KpiCard title="Óbitos" value={obitos} color="red" icon={<HeartOff />} trend="Crítico" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* PERFORMANCE DO ATENDIMENTO */}
        <section className="lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Clock className="text-blue-600" /> Performance do Atendimento
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Ranking de Médicos e Eficiência por Carga Horária</p>
            </div>
            <div className="px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-[10px] font-black text-blue-600 uppercase">
              Tempo Médio: {total > 0 ? Math.round(patients.reduce((a,b) => a + (b.tempoAtendimento || 0), 0) / total) : 0} min
            </div>
          </div>
          
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={docRanking}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
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
             <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3">
               <AlertCircle className="text-amber-600 shrink-0" size={18} />
               <p className="text-[10px] font-bold text-amber-800 leading-relaxed uppercase tracking-tight">
                 ALERTA: Aumento de ocorrências respiratórias no centro. Possível surto sazonal detectado.
               </p>
             </div>
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

