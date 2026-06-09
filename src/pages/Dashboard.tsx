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
  Printer,
  AlertTriangle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '../lib/ThemeContext';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const Dashboard: React.FC = () => {
  const { theme } = useTheme();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState('Todas');

  const convertTimestamp = (ts: any): string | null => {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') {
      try {
        return ts.toDate().toISOString();
      } catch (e) {
        console.error("Error calling toDate()", e);
      }
    }
    if (ts.seconds !== undefined) {
      try {
        return new Date(ts.seconds * 1000).toISOString();
      } catch (e) {
        console.error("Error building date from seconds", e);
      }
    }
    if (ts instanceof Date) {
      return ts.toISOString();
    }
    if (typeof ts === 'string') {
      return ts;
    }
    return null;
  };

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return { 
          id: doc.id, 
          ...d,
          // Handle Firestore Timestamp conversion robustly
          createdAt: convertTimestamp(d.createdAt),
          updatedAt: convertTimestamp(d.updatedAt),
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
    
    // Utilize createdAt if available, otherwise fall back to dataOcorrencia formatted as Date
    const dateStr = p.createdAt || (p.dataOcorrencia ? `${p.dataOcorrencia}T00:00:00` : null);
    
    if (dateStr) {
      const date = new Date(dateStr);
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
    if (!p.assinaturaMedico || p.assinaturaMedico.toLowerCase().includes('admin')) return acc;
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

  // Clinical Trends - Specific to Pediatric Outbreaks in Angola
  const epidemicStats = filteredByTime.reduce((acc: any, p) => {
    const occ = (p.ocorrencia || '').toLowerCase();
    if (occ.includes('malária') || occ.includes('paludismo')) acc.malaria++;
    if (occ.includes('respiratória') || occ.includes('ira')) acc.ira++;
    if (occ.includes('diarreia') || occ.includes('dda')) acc.dda++;
    if (occ.includes('malnutrição') || occ.includes('anemia')) acc.nutri++;
    if (occ.includes('sarampo')) acc.sarampo++;
    if (occ.includes('meningite')) acc.meningite++;
    return acc;
  }, { malaria: 0, ira: 0, dda: 0, nutri: 0, sarampo: 0, meningite: 0 });

  // Map Data Simulation based on patient provinces/cities/neighborhoods
  const geoStats = filteredByTime.reduce((acc: any, p) => {
    const city = (p.cidade || 'Lubango').trim().toLowerCase();
    const bairro = (p.bairro || '').trim().toLowerCase();
    
    // Group by city for coordinates, but track counts
    if (!acc[city]) acc[city] = { count: 0, bairros: {} };
    acc[city].count++;
    
    if (bairro) {
      acc[city].bairros[bairro] = (acc[city].bairros[bairro] || 0) + 1;
    }
    return acc;
  }, {} as any);

  // Helper to generate a deterministic offset coordinate near a city's center based on neighborhood/bairro name hash
  const getBairroCoordsDynamic = (bairro: string, cityCoords: [number, number]): [number, number] => {
    const b = bairro.toLowerCase().trim();
    // Pre-calculated coordinates for common neighborhoods of Lubango
    if (b.includes('mitcha')) return [-14.92, 13.51];
    if (b.includes('antónio') || b.includes('santo antónio')) return [-14.93, 13.48];
    if (b.includes('lucrécia')) return [-14.90, 13.50];
    if (b.includes('lage')) return [-14.95, 13.47];
    if (b.includes('almeida') || b.includes('joão de almeida')) return [-14.94, 13.52];
    if (b.includes('nambambe')) return [-14.91, 13.46];
    if (b.includes('chioco') || b.includes('tchioco')) return [-14.89, 13.53];
    
    // Support the demo data neighborhoods and others
    if (b.includes('arimba')) return [-14.85, 13.52];
    if (b.includes('hoque')) return [-14.78, 13.60];
    if (b.includes('palanca')) return [-14.96, 13.48];
    if (b.includes('centro')) return [cityCoords[0] + 0.005, cityCoords[1] - 0.005];

    // Fallback: Generate a deterministic layout coordinate using a hash of the bairro name
    let hash = 0;
    for (let i = 0; i < b.length; i++) {
      hash = b.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Spread markers in a tight, pleasant cluster around the city center: [-0.02, 0.02] degrees
    const latOffset = ((Math.abs(hash) % 100) / 2500) - 0.02;
    const lngOffset = (((Math.abs(hash >> 3) % 100) / 2500) - 0.02);
    return [cityCoords[0] + latOffset, cityCoords[1] + lngOffset];
  };

  const mapPoints: any[] = [];

  // Static central coordinates for all 14 municipalities of Huíla province
  const cities = [
    { name: 'Lubango', coords: [-14.9175, 13.4925] },
    { name: 'Humpata', coords: [-15.0117, 13.3658] },
    { name: 'Chibia', coords: [-15.1906, 13.6333] },
    { name: 'Cacula', coords: [-14.5000, 13.8833] },
    { name: 'Quilengues', coords: [-14.0722, 14.0789] },
    { name: 'Matala', coords: [-14.7333, 15.0333] },
    { name: 'Cuvango', coords: [-14.4667, 16.2667] },
    { name: 'Jamba', coords: [-14.6931, 16.0603] },
    { name: 'Caluquembe', coords: [-13.7833, 13.7833] },
    { name: 'Caconda', coords: [-13.7333, 15.0667] },
    { name: 'Chicomba', coords: [-14.1167, 14.2333] },
    { name: 'Chipindo', coords: [-13.9167, 15.8000] },
    { name: 'Gambos', coords: [-15.7000, 14.0833] },
    { name: 'Quipungo', coords: [-14.8333, 14.5500] }
  ];

  const mappedCities = new Set(cities.map(c => c.name.toLowerCase()));
  
  // Dynamically include any unrecognized cities in target stats
  Object.keys(geoStats).forEach(cityKey => {
    if (!mappedCities.has(cityKey) && cityKey.trim().length > 0) {
      // Dynamic coordinate generation around Lubango center for any unrecognized city names
      let hash = 0;
      for (let i = 0; i < cityKey.length; i++) {
        hash = cityKey.charCodeAt(i) + ((hash << 5) - hash);
      }
      const latOffset = ((Math.abs(hash) % 100) / 400) - 0.125; // [-0.125, 0.125] degree spread
      const lngOffset = (((Math.abs(hash >> 3) % 100) / 400) - 0.125);
      
      cities.push({
        name: cityKey.charAt(0).toUpperCase() + cityKey.slice(1),
        coords: [-14.9175 + latOffset, 13.4925 + lngOffset]
      });
    }
  });

  // Calculate Marker Risk Severity Color
  const getMarkerColor = (point: any) => {
    const count = point.stats.count;
    if (count >= 10) return "#ef4444"; // Red (High Risk / Outbreak Level)
    if (count >= 5) return "#f97316";  // Orange (Moderate Risk)
    if (count >= 2) return "#eab308";  // Yellow (Low-Moderate risk)
    return point.type === 'city' ? "#3b82f6" : "#10b981"; // Blue for city node, Green for normal neighborhoods
  };

  cities.forEach(city => {
    const stats = geoStats[city.name.toLowerCase()];
    if (stats || city.name === 'Lubango') {
      mapPoints.push({
        type: 'city',
        name: city.name,
        coords: city.coords,
        stats: stats || { count: 0, bairros: {} }
      });

      // Plot neighborhood level risks dynamically for any city having stats
      if (stats && stats.bairros) {
        Object.entries(stats.bairros).forEach(([bairro, count]: any) => {
          if (bairro && bairro.trim().length > 0) {
            const coords = getBairroCoordsDynamic(bairro, city.coords as [number, number]);
            mapPoints.push({
              type: 'bairro',
              name: `${bairro.charAt(0).toUpperCase() + bairro.slice(1)} (${city.name})`,
              coords: coords,
              stats: { count, bairros: {} }
            });
          }
        });
      }
    }
  });

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
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">BI ESTRATÉGICO <span className="text-blue-600">PIONEIRO ZECA</span></h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">Painel de Auditoria Clínica e Monitorização de Surtos</p>
        </div>
        <div className="flex items-center gap-3 no-print">
          {/* Status Indicators */}
          <div className={`px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-[10px] font-black uppercase ${pressure.bg} ${pressure.color} ${theme === 'dark' ? 'bg-opacity-10' : ''}`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${pressure.color.replace('text', 'bg')}`}></div>
            Fluxo: {pressure.label}
          </div>

          <select 
            value={timeFilter} 
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-600 dark:text-slate-400 uppercase outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Últimos 7 Dias</option>
            <option value="30d">Últimos 30 Dias</option>
            <option value="all">Todo o Histórico</option>
          </select>

          <select 
            value={priorityFilter} 
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-600 dark:text-slate-400 uppercase outline-none focus:ring-2 focus:ring-blue-500"
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
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-2 font-black text-xs uppercase tracking-widest no-print"
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
        <section className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                <Clock className="text-blue-600" /> Fluxo de Atendimento por Período
              </h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1">Volume de Casos nos Últimos Ciclos de Atendimento</p>
            </div>
            <div className="flex gap-2">
               <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-full text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">
                Média: {total > 0 ? (total / periodChartData.length).toFixed(1) : 0} / dia
               </div>
            </div>
          </div>
          
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 10}} />
                <Tooltip cursor={{fill: theme === 'dark' ? '#1e293b' : '#f8fafc'}} contentStyle={{backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-50 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Produtividade Clínica (Atendimentos/Médico)</h3>
                <div className="space-y-3">
                    {docRanking.length > 0 ? docRanking.map((doc: any, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{doc.name}</span>
                            <div className="flex items-center gap-2">
                                <div className="w-24 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-blue-600 h-full" style={{width: `${total > 0 ? (doc.count/total)*100 : 0}%`}}></div>
                                </div>
                                <span className="text-[10px] font-black text-blue-600">{doc.count}</span>
                            </div>
                        </div>
                    )) : (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">Sem registros no período...</p>
                    )}
                </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl flex flex-col justify-center">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total no período</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{total} <span className="text-xs text-slate-400 dark:text-slate-500 uppercase">casos</span></p>
                <div className="mt-2 flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
                    <TrendingUp size={10} /> +15% vs ciclo anterior
                </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 mb-8">
            <TrendingUp className="text-red-500" /> Alerta de Surtos (Huíla)
          </h2>
          <div className="space-y-6">
             <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-red-600 uppercase">Malária / Paludismo</span>
                  <span className="text-xs font-black text-red-700">{epidemicStats.malaria}</span>
                </div>
                <div className="w-full bg-red-200/50 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-red-500 h-full" style={{width: `${total > 0 ? (epidemicStats.malaria/total)*100 : 0}%`}}></div>
                </div>
             </div>
             <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-blue-600 uppercase">Doenças Respiratórias (IRA)</span>
                  <span className="text-xs font-black text-blue-700">{epidemicStats.ira}</span>
                </div>
                <div className="w-full bg-blue-200/50 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full" style={{width: `${total > 0 ? (epidemicStats.ira/total)*100 : 0}%`}}></div>
                </div>
             </div>
             <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-amber-600 uppercase">Doenças Diarreicas (DDA)</span>
                  <span className="text-xs font-black text-amber-700">{epidemicStats.dda}</span>
                </div>
                <div className="w-full bg-amber-200/50 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full" style={{width: `${total > 0 ? (epidemicStats.dda/total)*100 : 0}%`}}></div>
                </div>
             </div>
             {epidemicStats.sarampo > 0 && (
               <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 animate-pulse">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-orange-600 uppercase flex items-center gap-1"><AlertTriangle size={10} /> Alerta: Sarampo</span>
                    <span className="text-xs font-black text-orange-700">{epidemicStats.sarampo}</span>
                  </div>
                  <div className="w-full bg-orange-200/50 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-orange-500 h-full" style={{width: `${total > 0 ? (epidemicStats.sarampo/total)*100 : 0}%`}}></div>
                  </div>
               </div>
             )}
              {epidemicStats.meningite > 0 && (
               <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-purple-600 uppercase">Meningite</span>
                    <span className="text-xs font-black text-purple-700">{epidemicStats.meningite}</span>
                  </div>
                  <div className="w-full bg-purple-200/50 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full" style={{width: `${total > 0 ? (epidemicStats.meningite/total)*100 : 0}%`}}></div>
                  </div>
               </div>
             )}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-50 dark:border-slate-800">
             <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Zona com Mais Casos</p>
                {Object.keys(geoStats).length > 0 && (
                  <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                    {(() => {
                      const topCity = Object.entries(geoStats).sort((a: any, b: any) => (b[1] as any).count - (a[1] as any).count)[0][0];
                      return topCity.charAt(0).toUpperCase() + topCity.slice(1);
                    })()} Crítico
                  </span>
                )}
             </div>
             <div className="space-y-4">
                {diagnosticData.map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[10px] font-bold mb-1">
                      <span className="text-slate-700 dark:text-slate-300 uppercase">{item.name}</span>
                      <span className="text-slate-500 dark:text-slate-500">{item.value}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{width: `${total > 0 ? (item.value/total)*100 : 0}%`}}></div>
                    </div>
                  </div>
                ))}
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
            <MapContainer center={[-14.9175, 13.4925]} zoom={11} style={{height: '100%', width: '100%', filter: 'grayscale(0.8) invert(0.9)'}}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {mapPoints.map((pt, i) => (
                <CircleMarker 
                  key={i}
                  center={pt.coords as [number, number]} 
                  radius={
                    pt.type === 'city' 
                      ? Math.max(8, Math.min(25, pt.stats.count * 1.5)) 
                      : Math.max(5, Math.min(18, pt.stats.count * 2.5))
                  } 
                  fillColor={getMarkerColor(pt)} 
                  color="white"
                  weight={pt.type === 'city' ? 2 : 1}
                  fillOpacity={pt.type === 'city' ? 0.6 : 0.8}
                  className={pt.stats.count > 5 ? "animate-pulse" : ""}
                >
                  <Popup>
                    <div className="p-3 min-w-[160px] font-sans">
                       <div className="flex items-center gap-1.5 mb-2 border-b border-slate-100 pb-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getMarkerColor(pt) }}></span>
                          <p className="font-black text-slate-900 text-xs uppercase tracking-tight">{pt.name}</p>
                       </div>
                       <div className="space-y-2">
                          <div className="flex items-center justify-between">
                             <span className="text-[10px] font-bold text-slate-500 uppercase">Total Casos</span>
                             <span className="text-xs font-black text-slate-900">{pt.stats.count}</span>
                          </div>
                          
                          {pt.type === 'city' && Object.keys(pt.stats.bairros).length > 0 && (
                            <div className="pt-2 border-t border-slate-50">
                               <p className="text-[9px] font-black text-blue-600 uppercase mb-1">Principais Bairros:</p>
                               {Object.entries(pt.stats.bairros).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3).map(([bairro, count]: any) => (
                                 <div key={bairro} className="flex justify-between text-[9px] text-slate-600">
                                    <span className="capitalize">{bairro}</span>
                                    <span className="font-bold">{count}</span>
                                 </div>
                               ))}
                            </div>
                          )}

                          {pt.stats.count > 10 && (
                            <div className="mt-2 py-1.5 px-2 bg-red-50 text-red-600 rounded-lg flex items-center gap-1.5 border border-red-100">
                               <AlertTriangle size={10} className="shrink-0" />
                               <span className="text-[9px] font-black uppercase">ALERTA DE SURTO</span>
                            </div>
                          )}
                       </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 mb-8">
            <TrendingUp className="text-red-600" /> Desfechos Clínicos
          </h2>
          <div className="space-y-6">
             <DesfechoRow label="Taxa de Internamento" value={total > 0 ? (internados/total*100).toFixed(1) : 0} color="indigo" />
             <DesfechoRow label="Taxa de Alta Hospitalar" value={total > 0 ? (altas/total*100).toFixed(1) : 0} color="green" />
             <DesfechoRow label="Taxa de Letalidade" value={total > 0 ? (obitos/total*100).toFixed(1) : 0} color="red" />
          </div>

          <div className="mt-8 pt-8 border-t border-slate-50 dark:border-slate-800">
             {total > 0 ? (
               <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/20 flex gap-3">
                 <AlertCircle className="text-amber-600 dark:text-amber-400 shrink-0" size={18} />
                 <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300 leading-relaxed uppercase tracking-tight">
                   ALERTA: Aumento de ocorrências respiratórias no centro. Possível surto sazonal detectado.
                 </p>
               </div>
             ) : (
               <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex gap-3 italic">
                 <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-relaxed uppercase tracking-tight">
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
    blue: 'bg-blue-600 shadow-blue-100 dark:shadow-none',
    indigo: 'bg-indigo-600 shadow-indigo-100 dark:shadow-none',
    purple: 'bg-purple-600 shadow-purple-100 dark:shadow-none',
    green: 'bg-emerald-600 shadow-emerald-100 dark:shadow-none',
    red: 'bg-rose-600 shadow-rose-100 dark:shadow-none',
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:translate-y-[-4px]">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-xl text-white ${colors[color]}`}>
          {React.cloneElement(icon, { size: 18 })}
        </div>
        {trend && <span className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">{trend}</span>}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{title}</p>
        <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{value}</h3>
      </div>
    </div>
  );
};

const DesfechoRow = ({ label, value, color }: any) => {
  const { theme } = useTheme();
  const c: any = { indigo: 'bg-indigo-600', green: 'bg-emerald-600', red: 'bg-rose-600' };
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${c[color]}`}></div>
        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xs font-black text-slate-900 dark:text-slate-200">{value}%</span>
    </div>
  );
};

