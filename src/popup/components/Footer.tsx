import React from 'react';
import { Star, Share2 } from 'lucide-react';

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
    <footer className="flex flex-col gap-3 px-4 py-3 bg-white border-t border-gray-200">
      {/* 첫 번째 줄: Rating과 Share */}
      <div className="flex items-center justify-between">
        <button
          onClick={onRatingClick}
          className="flex items-center gap-2 text-gray-700 hover:text-yellow-500 transition-colors"
          title="Rate Me"
        >
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <span className="text-sm font-medium">Rate Me</span>
        </button>

        <button
          onClick={onShareClick}
          className="flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors"
          title="Share"
        >
          <Share2 className="w-4 h-4" />
          <span className="text-sm">Share</span>
        </button>
      </div>

      {/* 두 번째 줄: Contact Us와 Bug Report */}
      <div className="flex items-center justify-between">
        <button
          onClick={onMessageClick}
          className="text-gray-600 hover:text-primary-600 transition-colors text-sm font-medium"
          title="Contact Us"
        >
          Contact Us
        </button>

        <button
          onClick={onBugReportClick}
          className="text-gray-600 hover:text-red-500 transition-colors text-sm font-medium"
          title="Bug Report"
        >
          Bug Report
        </button>
      </div>
    </footer>
  );
};

export default Footer;



