import React from 'react';
import { FaStar, FaShare, FaEnvelope, FaBug } from 'react-icons/fa';

interface FooterProps {
  onRatingClick?: () => void;
  onShareClick?: () => void;
  onMessageClick?: () => void;
  onBugReportClick?: () => void;
}

const Footer: React.FC<FooterProps> = ({
  onRatingClick,
  onShareClick,
  onMessageClick,
  onBugReportClick,
}) => {
  return (
    <footer className="flex items-center justify-around px-4 py-3 bg-white border-t border-gray-200">
      <button
        onClick={onRatingClick}
        className="flex flex-col items-center gap-1 text-gray-600 hover:text-yellow-500 transition-colors"
        title="Rate"
      >
        <FaStar className="w-5 h-5" />
        <span className="text-xs">Rating</span>
      </button>

      <button
        onClick={onShareClick}
        className="flex flex-col items-center gap-1 text-gray-600 hover:text-primary-600 transition-colors"
        title="Share"
      >
        <FaShare className="w-5 h-5" />
        <span className="text-xs">Share</span>
      </button>

      <button
        onClick={onMessageClick}
        className="flex flex-col items-center gap-1 text-gray-600 hover:text-primary-600 transition-colors"
        title="Message"
      >
        <FaEnvelope className="w-5 h-5" />
        <span className="text-xs">Message</span>
      </button>

      <button
        onClick={onBugReportClick}
        className="flex flex-col items-center gap-1 text-gray-600 hover:text-red-500 transition-colors"
        title="Bug Report"
      >
        <FaBug className="w-5 h-5" />
        <span className="text-xs">Bug Report</span>
      </button>
    </footer>
  );
};

export default Footer;



