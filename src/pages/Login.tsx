import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { Activity, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export const Login: React.FC = () => {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !senha) return;

    setLoading(true);
    setError('');

    try {
      // Standardize input: trim and lowercase
      const cleanName = nome.trim().toLowerCase().replace(/\s+/g, '.');
      const email = `${cleanName}@hospital.local`;
      
      await signInWithEmailAndPassword(auth, email, senha);
      navigate('/');
    } catch (err: any) {
      console.error("Login detail:", err.code, err.message);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Nome de usuário ou senha incorretos. Use o Setup Inicial se for o primeiro acesso.');
      } else {
        setError('Ocorreu um erro ao tentar entrar. Verifique sua conexão.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrap = async () => {
    setLoading(true);
    try {
      // Create admin user
      const email = "administrador@hospital.local";
      const password = "admin123";
      
      try {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', res.user.uid), {
          nome: "Administrador",
          role: "admin",
          createdAt: new Date().toISOString()
        });
        alert("SISTEMA CONFIGURADO!\n\nUsuário: Administrador\nSenha: admin123\n\nUse estas credenciais para entrar.");
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          alert("O sistema já foi configurado anteriormente.");
        } else {
          throw authErr;
        }
      }
    } catch (err: any) {
      alert("Erro no setup: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      
      <div className="fixed top-4 right-4 z-50">
        <button 
          onClick={handleBootstrap}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors bg-slate-800/50 px-2 py-1 rounded border border-slate-700"
        >
          Setup Inicial
        </button>
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden relative z-10"
      >
        <div className="bg-blue-600 p-8 text-center relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Activity size={100} className="text-white" />
          </div>
          <div className="bg-white p-3 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center shadow-lg">
            <Activity className="text-blue-600 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Pioneiro Zeca</h2>
          <p className="text-blue-100 text-sm">Hospital Pediátrico do Lubango</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="nome">
                Nome de Usuário
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="nome"
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-slate-800"
                  placeholder="Seu nome completo"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="senha">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="senha"
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-slate-800"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg flex items-center gap-2 text-sm animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar no Sistema'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>© 2026 Lubango Digital</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              Servidor Seguro
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
