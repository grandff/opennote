import React from 'react';
import { FaUser, FaCog, FaHistory, FaCreditCard } from 'react-icons/fa';

interface HeaderProps {
  onProfileClick?: () => void;
  onSettingClick?: () => void;
  onHistoryClick?: () => void;
  onPaymentClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onProfileClick,
  onSettingClick,
  onHistoryClick,
  onPaymentClick,
}) => {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
      <button
        onClick={onProfileClick}
        className="flex items-center gap-2 text-gray-700 hover:text-primary-600 transition-colors"
        title="Profile"
      >
        <FaUser className="w-5 h-5" />
        <span className="text-sm font-medium">Profile</span>
      </button>

      <div className="flex items-center gap-4">
        <button
          onClick={onSettingClick}
          className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Settings"
        >
          <FaCog className="w-5 h-5" />
        </button>

        <button
          onClick={onHistoryClick}
          className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="History"
        >
          <FaHistory className="w-5 h-5" />
        </button>

        <button
          onClick={onPaymentClick}
          className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Payment"
        >
          <FaCreditCard className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default Header;



