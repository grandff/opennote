import React, { useEffect, useState } from 'react';
import { User, History, Crown, LogOut } from 'lucide-react';
import useAuthStore from '@/stores/authStore';
import { signInWithGoogle, logOut, initAuthListener } from '@/services/authService';

interface HeaderProps {
  onHistoryClick?: () => void;
  onPremiumClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onHistoryClick,
  onPremiumClick,
}) => {
  const { user, status } = useAuthStore();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // 인증 상태 리스너 초기화
  useEffect(() => {
    const unsubscribe = initAuthListener();
    return () => unsubscribe();
  }, []);

  // Google 로그인 핸들러
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 로그아웃 핸들러
  const handleLogout = async () => {
    setShowUserMenu(false);
    try {
      await logOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // 이메일에서 표시 이름 추출 (@ 앞부분)
  const getDisplayEmail = (email: string | null): string => {
    if (!email) return '';
    return email.length > 20 ? email.substring(0, 17) + '...' : email;
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
      {/* 왼쪽: 프로필 영역 */}
      <div className="relative">
        {user ? (
          // 로그인 상태: 사용자 이메일 표시
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 text-gray-700 hover:text-primary-600 transition-colors"
            title={user.email || '사용자'}
          >
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Profile" 
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <User className="w-4 h-4 text-primary-600" />
              </div>
            )}
            <span className="text-sm font-medium max-w-[120px] truncate">
              {getDisplayEmail(user.email)}
            </span>
          </button>
        ) : (
          // 비로그인 상태: Start For Free 버튼 (Rainbow effect)
          <button
            onClick={handleLogin}
            disabled={isLoggingIn || status === 'loading'}
            className="group relative flex items-center justify-center px-5 py-2.5 text-white text-sm font-semibold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 50%, #7C3AED 100%)',
            }}
          >
            {/* Rainbow border animation */}
            <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: 'linear-gradient(135deg, #C084FC, #A855F7, #8B5CF6, #7C3AED, #6D28D9)',
                backgroundSize: '200% 200%',
                animation: 'rainbow-shift 2s ease infinite',
              }}
            />
            {/* Inner background */}
            <span className="absolute inset-[2px] rounded-full"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 50%, #7C3AED 100%)',
              }}
            />
            {/* Shine effect */}
            <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-300"
              style={{
                background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
                backgroundSize: '200% 200%',
                animation: 'shine 1.5s ease-in-out infinite',
              }}
            />
            {/* Content */}
            <span className="relative z-10 flex items-center gap-2">
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>로그인 중...</span>
                </>
              ) : (
                <span>Start For Free</span>
              )}
            </span>
          </button>
        )}

        {/* 사용자 메뉴 드롭다운 */}
        {showUserMenu && user && (
          <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-800 truncate">
                {user.displayName || '사용자'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>로그아웃</span>
            </button>
          </div>
        )}
      </div>

      {/* 오른쪽: 기능 버튼들 */}
      <div className="flex items-center gap-2">
        <button
          onClick={onHistoryClick}
          className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="History"
        >
          <History className="w-4 h-4" />
        </button>

        <button
          onClick={onPremiumClick}
          className="p-2 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
          title="Premium"
        >
          <Crown className="w-4 h-4" />
        </button>
      </div>

      {/* 드롭다운 외부 클릭 시 닫기 */}
      {showUserMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </header>
  );
};

export default Header;



