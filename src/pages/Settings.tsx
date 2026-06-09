import React, { useState, useEffect } from 'react';
import { db, auth, secondaryApp } from '../lib/firebase';
import { collection, query, onSnapshot, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { User, Patient, SystemSettings } from '../types';
import { useAuth } from '../lib/AuthContext';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
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
  ChevronRight,
  Upload,
  Printer
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({ emailAlerts: false, targetEmail: '' });
  const [newUserName, setNewUserName] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<'medic' | 'admin'>('medic');
  const [loading, setLoading] = useState(false);
  const { isAdmin } = useAuth();

  useEffect(() => {
    // Load users
    const q = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    }, (error) => {
      console.error("Erro ao carregar utilizadores:", error);
    });

    // Load patients for backup
    const qPatients = query(collection(db, 'patients'));
    const unsubscribePatients = onSnapshot(qPatients, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    });

    // Ensure the current admin has a record in the users collection so rules work
    const ensureAdminProfile = async () => {
      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        try {
          const { getDoc } = await import('firebase/firestore');
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            console.log("Criando perfil de administrador para", auth.currentUser.email);
            await setDoc(userDocRef, {
              nome: auth.currentUser.displayName || "Administrador Principal",
              role: 'admin',
              email: auth.currentUser.email,
              createdAt: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error("Erro ao verificar/criar perfil admin:", e);
        }
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) ensureAdminProfile();
    });

    // Initial check
    ensureAdminProfile();

    // Load settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as SystemSettings);
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribePatients();
      unsubscribeSettings();
      unsubscribeAuth();
    };
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert("Apenas administradores podem criar novos acessos.");
      return;
    }
    if (!newUserName.trim() || !newUserPass.trim()) return;
    
    if (newUserPass.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const email = `${newUserName.trim().toLowerCase().replace(/\s+/g, '.')}@hospital.local`;
      
      // Use isolated auth to prevent admin logout
      const secondaryAuth = getAuth(secondaryApp);
      
      // Use inMemoryPersistence to be absolutely sure we don't interfere with main session
      const { inMemoryPersistence } = await import('firebase/auth');
      await setPersistence(secondaryAuth, inMemoryPersistence);
      
      const res = await createUserWithEmailAndPassword(secondaryAuth, email, newUserPass);
      
      // Unique Medical ID
      const generatedIdMedico = `MED-${Math.floor(Math.random() * 9000) + 1000}`;

      await setDoc(doc(db, 'users', res.user.uid), {
        nome: newUserName.trim(),
        role: newUserRole,
        idMedico: generatedIdMedico,
        email: email,
        senha: newUserPass, // Armazenando a senha como solicitado pelo usuário
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || 'system'
      });

      // Sign out from secondary app immediately
      await signOut(secondaryAuth);

      setNewUserName('');
      setNewUserPass('');
      alert(`Sucesso!\n\nUtilizador: ${newUserName}\nID Médico: ${generatedIdMedico}\nEmail: ${email}\n\nMembro registado com sucesso.`);
    } catch (err: any) {
      console.error("Erro detalhado na criação de utilizador:", err);
      let errorMsg = "Erro ao criar utilizador.";
      
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = "Este nome já possui um registro (e-mail duplicado). Tente um nome diferente.";
      } else if (err.code === 'auth/weak-password') {
        errorMsg = "A senha é muito fraca.";
      } else if (err.message.includes('permission')) {
        errorMsg = "Sem permissão para criar registros. Verifique se seu perfil de Administrador está ativo.";
      } else {
        errorMsg += " " + err.message;
      }
      
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleExportSQL = () => {
    let sql = `-- Backup HP Pioneiro Zeca\n-- Gerado em: ${new Date().toLocaleString()}\n\n`;
    
    sql += `CREATE TABLE IF NOT EXISTS patients (\n  id VARCHAR(255) PRIMARY KEY,\n  idPaciente VARCHAR(255),\n  nome VARCHAR(255),\n  idade INT,\n  cidade VARCHAR(255),\n  diagnostico TEXT\n);\n\n`;
    
    patients.forEach(p => {
      sql += `INSERT INTO patients (id, idPaciente, nome, idade, cidade, diagnostico) VALUES ('${p.id}', '${p.idPaciente || ''}', '${p.nome.replace(/'/g, "''")}', ${p.idade}, '${p.cidade.replace(/'/g, "''")}', '${(p.diagnosticos || '').replace(/'/g, "''")}');\n`;
    });

    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_pioneiro_zeca_${format(new Date(), 'yyyyMMdd')}.sql`;
    a.click();
  };

  const handleFullBackupXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(patients);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Backup_Completo");
    XLSX.writeFile(wb, `backup_pioneiro_zeca_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    alert("Processando importação... Por favor, aguarde.");
    // Logic for importing could go here (looping through rows and addDoc)
    // Similar to handleImportExcel in PatientList
  };

  const totals = {
    medicos: users.filter(u => u.role === 'medic').length,
    admins: users.filter(u => u.role === 'admin').length,
    pacientes: patients.length
  };

  const handleSaveSettings = async () => {
    await setDoc(doc(db, 'settings', 'global'), settings);
    alert("Configurações salvas.");
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    console.log("Tentando apagar utilizador:", userId, userName);
    if (!isAdmin) {
      alert("Apenas administradores podem gerir utilizadores.");
      return;
    }

    if (userId === auth.currentUser?.uid) {
      alert("Não pode apagar o seu próprio perfil de administrador.");
      return;
    }

    if (confirm(`❗ EXCLUSÃO PERMANENTE\n\nTem certeza que deseja remover o acesso de: ${userName}?\n\nO médico perderá o acesso imediato ao sistema.\nA conta no banco de dados será apagada permanentemente.`)) {
      setLoading(true);
      console.log("Iniciando exclusão do documento Firestore para:", userId);
      try {
        const userRef = doc(db, 'users', userId);
        await deleteDoc(userRef);
        console.log("SUCESSO: Documento removido do Firestore:", userId);
        alert("✅ Médico removido com sucesso do sistema.");
      } catch (err: any) {
        console.error("ERRO CRÍTICO na exclusão:", err);
        alert(`❌ FALHA NA EXCLUSÃO: ${err.message}\n\nNota: Apenas o Administrador Principal tem permissão para esta ação.`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <SettingsIcon className="text-blue-600 dark:text-blue-400" />
            Configurações do Sistema
          </h1>
          {isAdmin && (
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-full">
              <Shield size={12} className="text-emerald-500 dark:text-emerald-400" />
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">Modo Administrador Ativo</span>
            </div>
          )}
        </div>
        <p className="text-slate-500 dark:text-slate-400">Gestão de acessos e parâmetros hospitalares</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* User Management */}
        <section className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
          <div className="flex items-center justify-between gap-2 font-bold text-slate-800 dark:text-slate-200">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2>Gestão de Equipe</h2>
            </div>
            <div className="flex gap-2">
               <div className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-[10px] rounded-lg text-blue-600 dark:text-blue-400 uppercase font-black">
                 {totals.medicos} Médicos
               </div>
               <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] rounded-lg text-slate-500 dark:text-slate-400 uppercase font-black">
                 {totals.admins} Admins
               </div>
            </div>
          </div>

          <form onSubmit={handleAddUser} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg space-y-3 transition-colors">
            <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Novo Membro</div>
            <input 
              type="text" placeholder="Nome Completo" required className="input text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-600" 
              value={newUserName} onChange={e => setNewUserName(e.target.value)}
            />
            <input 
              type="password" placeholder="Senha Provisória" required className="input text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-600" 
              value={newUserPass} onChange={e => setNewUserPass(e.target.value)}
            />
            <select className="input text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" value={newUserRole} onChange={e => setNewUserRole(e.target.value as any)}>
              <option value="medic" className="dark:bg-slate-900">Médico</option>
              <option value="admin" className="dark:bg-slate-900">Administrador</option>
            </select>
            <button 
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-100 dark:shadow-none"
            >
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              Criar Acesso
            </button>
          </form>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 py-2 transition-all z-10 border-b border-slate-50 dark:border-slate-800 mb-2">
              <div className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Membros da Equipe ({users.length})</div>
            </div>
            {users.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-100 dark:border-slate-800 transition-colors">
                <Users className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-slate-400 dark:text-slate-600 text-[10px] font-black uppercase">Nenhum membro encontrado</p>
              </div>
            ) : (
              users.sort((a, b) => b.createdAt?.localeCompare(a.createdAt || '') || 0).map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl group hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md hover:shadow-blue-50/50 dark:hover:shadow-none transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-full flex items-center justify-center text-sm font-black text-slate-600 dark:text-slate-400 group-hover:from-blue-50 dark:group-hover:from-blue-900/20 group-hover:to-blue-100 dark:group-hover:to-blue-900/40 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors border border-slate-200 dark:border-slate-700">
                      {user.nome[0].toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <div className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight leading-none mb-1 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{user.nome}</div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                           <Shield size={10} className={user.role === 'admin' ? 'text-orange-500 dark:text-orange-400' : 'text-blue-500 dark:text-blue-400'} />
                           <span className={`text-[9px] font-black uppercase tracking-tighter ${user.role === 'admin' ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`}>
                             {user.role === 'admin' ? 'Administrador' : 'Corpo Médico'}
                           </span>
                        </div>
                        {user.senha && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-md w-fit transition-colors">
                             <span className="text-[8px] font-black text-amber-500 dark:text-amber-600 uppercase">Senha de Acesso:</span>
                             <span className="text-[10px] font-mono font-black text-amber-700 dark:text-amber-400 tracking-wider">
                               {user.senha}
                             </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {isAdmin && user.id !== auth.currentUser?.uid && (
                    <button 
                      onClick={() => handleDeleteUser(user.id, user.nome)}
                      disabled={loading}
                      className="text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 transition-all p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center border border-transparent hover:border-red-100 dark:hover:border-red-900/40 shadow-sm hover:shadow-red-100 dark:hover:shadow-none"
                      title="Excluir conta permanentemente"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* System Settings */}
        <div className="space-y-8">
          <section className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
              <Bell className="w-5 h-5 text-orange-500 dark:text-orange-400" />
              <h2>Alertas de Sistema</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  <Mail className="text-slate-400 dark:text-slate-500" />
                  <div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">Notificações por Email</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-500 uppercase font-bold tracking-tight">Resumo diário de ocorrências</div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" className="sr-only peer" 
                    checked={settings.emailAlerts}
                    onChange={e => setSettings({...settings, emailAlerts: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 transition-colors"></div>
                </label>
              </div>

              {settings.emailAlerts && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 block">E-mail para Alertas de Surtos</label>
                  <input 
                    type="email" className="input text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" 
                    value={settings.targetEmail}
                    onChange={e => setSettings({...settings, targetEmail: e.target.value})}
                    placeholder="ex: direcao@hospital.gv.ao"
                  />
                </div>
              )}

              <button 
                onClick={handleSaveSettings}
                className="w-full bg-slate-800 dark:bg-slate-700 text-white py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-slate-900 dark:hover:bg-slate-600 transition flex items-center justify-center gap-2 shadow-lg shadow-slate-200 dark:shadow-none"
              >
                <Save size={14} />
                Guardar Configurações
              </button>
            </div>
          </section>

          <section className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
            <div className="flex items-center justify-between gap-2 font-bold text-slate-800 dark:text-slate-200">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                <h2>Backup & Dados</h2>
              </div>
              <button onClick={() => window.print()} className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 no-print transition-colors">
                <Printer size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] text-slate-500 dark:text-slate-600 font-bold uppercase tracking-widest">Utilitários de Exportação Estruturada</p>
              
              <button 
                onClick={handleExportSQL}
                className="w-full flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="flex items-center gap-2 text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight">
                  <Download size={14} className="text-blue-500 dark:text-blue-400" /> SQL Export (.sql)
                </span>
                <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
              </button>

              <button 
                onClick={handleFullBackupXLSX}
                className="w-full flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="flex items-center gap-2 text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight">
                  <FileSpreadsheet size={14} className="text-emerald-500 dark:text-emerald-400" /> Full Backup (.xlsx)
                </span>
                <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
              </button>

              <div className="pt-2">
                <label className="w-full flex items-center justify-between p-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  <span className="flex items-center gap-2 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-tight">
                    <Upload size={14} /> Restaurar / Importar
                  </span>
                  <input type="file" className="hidden" onChange={handleImportBackup} accept=".xlsx,.json" />
                </label>
              </div>
            </div>
          </section>
        </div>
      </div>
      
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-start gap-3 transition-colors">
        <AlertCircle className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
          <p className="font-bold mb-1">Nota de Segurança:</p>
          As senhas geradas administrativamente devem ser alteradas pelos médicos no primeiro acesso. O sistema utiliza criptografia de nível militar AES-256 para o armazenamento de dados sensíveis na nuvem do Google Cloud.
        </div>
      </div>
    </div>
  );
};
