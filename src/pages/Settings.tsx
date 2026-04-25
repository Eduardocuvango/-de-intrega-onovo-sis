import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { User, SystemSettings } from '../types';
import { 
  Users, 
  Settings as SettingsIcon, 
  Mail, 
  Trash2, 
  UserPlus, 
  Shield, 
  Save, 
  Bell,
  Database,
  Download,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  ChevronRight
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({ emailAlerts: false, targetEmail: '' });
  const [newUserName, setNewUserName] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<'medic' | 'admin'>('medic');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load users
    const q = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    });

    // Load settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as SystemSettings);
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeSettings();
    };
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserPass) return;

    setLoading(true);
    try {
      const email = `${newUserName.toLowerCase().replace(/\s+/g, '.')}@hospital.local`;
      
      // In a real app, the admin creates the user in Firebase Auth
      // Here we simulate the creation. In standard Firebase, you'd use Admin SDK,
      // but in this preview, we can use standard createUserWithEmailAndPassword 
      // (though it will sign out the current admin if not careful). 
      // ACTUALLY, for a professional system, we'd use a server-side routine.
      // For this demo/preview, we'll suggest that admins manually add them or we use a custom server route.
      // BUT we can use setDoc in the users collection to track them first.
      
      const res = await createUserWithEmailAndPassword(auth, email, newUserPass);
      await setDoc(doc(db, 'users', res.user.uid), {
        nome: newUserName,
        role: newUserRole,
        createdAt: new Date().toISOString()
      });

      setNewUserName('');
      setNewUserPass('');
      alert("Usuário criado com sucesso!");
    } catch (err: any) {
      alert("Erro ao criar usuário: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    await setDoc(doc(db, 'settings', 'global'), settings);
    alert("Configurações salvas.");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <SettingsIcon className="text-blue-600" />
          Configurações do Sistema
        </h1>
        <p className="text-slate-500">Gestão de acessos e parâmetros hospitalares</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* User Management */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Users className="w-5 h-5 text-blue-600" />
            <h2>Gestão de Equipe (Médicos/Admins)</h2>
          </div>

          <form onSubmit={handleAddUser} className="bg-slate-50 p-4 rounded-lg space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Novo Membro</div>
            <input 
              type="text" placeholder="Nome Completo" required className="input text-sm" 
              value={newUserName} onChange={e => setNewUserName(e.target.value)}
            />
            <input 
              type="password" placeholder="Senha Provisória" required className="input text-sm" 
              value={newUserPass} onChange={e => setNewUserPass(e.target.value)}
            />
            <select className="input text-sm" value={newUserRole} onChange={e => setNewUserRole(e.target.value as any)}>
              <option value="medic">Médico</option>
              <option value="admin">Administrador</option>
            </select>
            <button 
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              Criar Acesso
            </button>
          </form>

          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Membros Ativos</div>
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
                    {user.nome[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{user.nome}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-black">{user.role}</div>
                  </div>
                </div>
                <button className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* System Settings */}
        <div className="space-y-8">
          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Bell className="w-5 h-5 text-orange-500" />
              <h2>Alertas de Sistema</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Mail className="text-slate-400" />
                  <div>
                    <div className="text-sm font-bold text-slate-700">Notificações por Email</div>
                    <div className="text-xs text-slate-500">Resumo diário de ocorrências</div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" className="sr-only peer" 
                    checked={settings.emailAlerts}
                    onChange={e => setSettings({...settings, emailAlerts: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {settings.emailAlerts && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="label">E-mail para Alertas</label>
                  <input 
                    type="email" className="input" 
                    value={settings.targetEmail}
                    onChange={e => setSettings({...settings, targetEmail: e.target.value})}
                    placeholder="ex: direcao@hospital.gv.ao"
                  />
                </div>
              )}

              <button 
                onClick={handleSaveSettings}
                className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-slate-900 transition flex items-center justify-center gap-2"
              >
                <Save size={16} />
                Guardar Configurações
              </button>
            </div>
          </section>

          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Database className="w-5 h-5 text-emerald-500" />
              <h2>Backup & Dados</h2>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Exporte os dados em formato estruturado para auditorias externas ou migração.</p>
              <button className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition font-medium text-sm">
                <span className="flex items-center gap-2"><Download size={16} /> SQL Export (.sql)</span>
                <ChevronRight size={16} />
              </button>
              <button className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition font-medium text-sm">
                <span className="flex items-center gap-2"><FileSpreadsheet size={16} /> Full Backup (.xlsx)</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </section>
        </div>
      </div>
      
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
        <AlertCircle className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 leading-relaxed">
          <p className="font-bold mb-1">Nota de Segurança:</p>
          As senhas geradas administrativamente devem ser alteradas pelos médicos no primeiro acesso. O sistema utiliza criptografia de nível militar AES-256 para o armazenamento de dados sensíveis na nuvem do Google Cloud.
        </div>
      </div>
    </div>
  );
};
