import React, { useState } from 'react';
import { X, User as UserIcon, Mail, Lock, LogOut, CheckCircle2 } from 'lucide-react';
import { 
  AppUser,
  loginWithEmail, 
  registerWithEmail, 
  loginWithGoogle, 
  logout 
} from '../services/cloudStorage';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialMode = 'login',
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (activeTab === 'register') {
        await registerWithEmail(email, password, displayName);
      } else {
        await loginWithEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || (activeTab === 'register' ? '建立帳號失敗' : '登入失敗，請確認帳號與密碼'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Google 登入失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-3">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">
              {currentUser ? '帳號中心' : (activeTab === 'register' ? '建立帳號' : '登入帳號')}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {currentUser ? (
          /* User Logged In State */
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#171717] border border-[#2a2a2a]">
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
                {currentUser.email ? currentUser.email[0].toUpperCase() : 'U'}
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-medium text-white truncate">
                  {currentUser.displayName || currentUser.email}
                </div>
                <div className="text-xs text-neutral-400 truncate">
                  {currentUser.email}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                帳號已就緒！所有模組資料夾、貼圖與對話皆與此帳號專屬綁定。
              </span>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-medium transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>登出帳號</span>
            </button>
          </div>
        ) : (
          /* Strictly 3 Options: 1) 建立帳號, 2) 登入帳號, 3) 使用 Google 登入 */
          <div className="space-y-4">
            {/* Tabs for Option 1 & Option 2 */}
            <div className="grid grid-cols-2 p-1 bg-[#141414] rounded-xl border border-[#2a2a2a]">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMsg(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'login'
                    ? 'bg-[#2a2a2a] text-white shadow'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                登入帳號
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErrorMsg(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'register'
                    ? 'bg-[#2a2a2a] text-white shadow'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                建立帳號
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Email + Password Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {activeTab === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    暱稱 (選填)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="創作者暱稱"
                    className="w-full bg-[#141414] border border-[#383838] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  電子郵件
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className="w-full bg-[#141414] border border-[#383838] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  密碼 {activeTab === 'register' && '(至少 6 個字元)'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="請輸入密碼"
                    className="w-full bg-[#141414] border border-[#383838] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow"
              >
                {isLoading 
                  ? '處理中...' 
                  : (activeTab === 'register' ? '立即建立帳號' : '登入帳號')}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-[#2d2d2d]" />
              <span className="text-[10px] text-neutral-500">或</span>
              <div className="flex-1 h-px bg-[#2d2d2d]" />
            </div>

            {/* Option 3: 使用 Google 登入 */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-2.5 px-3 rounded-lg bg-[#242424] hover:bg-[#2e2e2e] border border-[#3a3a3a] text-xs font-semibold text-neutral-200 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>使用 Google 登入</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

