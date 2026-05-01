import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Lock, LogIn, Key, Loader2, Gift, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotPasswordText, setForgotPasswordText] = useState("נא לפנות למנהל המערכת לקבלת סיסמה חדשה.");
  const [showForgotPasswordMessage, setShowForgotPasswordMessage] = useState(false);

  useEffect(() => {
    // Fetch the configured forgot password text from settings
    fetch("/api/db/settings").then(res => res.json()).then((data: any) => {
      if (data && Array.isArray(data)) {
        const global = data.find((it: any) => it.id === "global");
        if (global && global.forgotPasswordText) {
          setForgotPasswordText(global.forgotPasswordText);
        }
      }
    }).catch(err => console.warn("Login: Failed to fetch settings", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log(`[Client] Attempting login for user: ${username}`);
      
      const normalizedUsername = String(username).normalize('NFC').trim();
      
      // Safety timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalizedUsername, password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log(`[Client] Login response status: ${res.status}`);
      
      const data = await res.json();
      console.log(`[Client] Login response data:`, data);

      if (res.ok && data.success) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || 'פרטי התחברות שגויים');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('החיבור לשרת איטי מדי, נסה שוב');
      } else {
        setError('שגיאת תקשורת עם השרת - וודא שאתה מחובר לאינטרנט');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F3F6] p-4 font-sans text-right" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl shadow-blue-900/10 border border-white"
      >
        {/* Header Section */}
        <div className="bg-[#2D3E50] p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />
          
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-block p-4 bg-gradient-to-br from-[#7B68EE] to-[#6A5ACD] rounded-3xl shadow-lg shadow-blue-950/20 mb-6 relative z-10"
          >
            <Gift className="w-12 h-12 text-white" strokeWidth={1.5} />
          </motion.div>
          
          <h1 className="text-4xl font-black text-white mb-2 relative z-10 tracking-tight">צ'ופרקל</h1>
          <p className="text-blue-200/80 text-sm font-medium relative z-10">מערכת ניהול צ'ופרים</p>
        </div>

        {/* Form Section */}
        <div className="p-10 bg-white">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-[#1A1A1A] mb-2">ברוך הבא!</h2>
            <p className="text-[#8E8E8E] text-sm">התחבר לחשבונך כדי להמשיך</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="flex items-center justify-between text-xs font-bold text-[#1A1A1A] mb-2 mr-1">
                <span className="flex items-center gap-1.5 text-[#2D3E50]/60">
                   שם משתמש <User className="w-3.5 h-3.5 text-[#6366F1]" />
                </span>
               </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="הזן שם משתמש"
                  className="w-full h-14 pr-4 bg-[#EDF2F7] border-none rounded-xl text-[#2D3E50] placeholder-[#A0AEC0] focus:ring-2 focus:ring-[#6366F1]/50 transition-all outline-none font-medium text-right"
                  required
                />
              </div>
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-bold text-[#1A1A1A] mb-2 mr-1">
                <span className="flex items-center gap-1.5 text-[#2D3E50]/60">
                   סיסמה <Lock className="w-3.5 h-3.5 text-[#6366F1]" />
                </span>
              </label>
              <div className="relative">
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-14 pr-4 bg-[#EDF2F7] border-none rounded-xl text-[#2D3E50] placeholder-[#A0AEC0] focus:ring-2 focus:ring-[#6366F1]/50 transition-all outline-none font-medium"
                  required
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold text-center border border-red-100"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white rounded-xl font-black text-lg shadow-xl shadow-[#6366F1]/20 hover:shadow-2xl hover:shadow-[#6366F1]/30 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span>התחבר</span>
                  <LogIn className="w-5 h-5 ml-1" />
                </>
              )}
            </button>

            <button 
              type="button"
              onClick={() => setShowForgotPasswordMessage(!showForgotPasswordMessage)}
              className="w-full h-14 bg-white border-2 border-[#EDF2F7] text-[#6366F1] rounded-xl font-bold hover:bg-[#F8FAFC] transition-all flex items-center justify-center gap-3"
            >
              <Key className="w-4 h-4 ml-1" />
              <span>{showForgotPasswordMessage ? "הסתר הודעה" : "שכחתי סיסמא"}</span>
            </button>

            <AnimatePresence>
              {showForgotPasswordMessage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="mt-4 overflow-hidden bg-[#6366F1]/5 border border-[#6366F1]/10 rounded-xl p-4 flex items-start gap-3 shadow-lg"
                >
                  <AlertCircle className="w-5 h-5 text-[#6366F1] shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-[#2D3E50] leading-relaxed">
                    {forgotPasswordText}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

        </div>
      </motion.div>
    </div>
  );
};
