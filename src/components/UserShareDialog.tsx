import React, { useState } from 'react';
import { X, Link2, Mail, Facebook, Twitter, Copy, Check } from 'lucide-react';

interface UserShareDialogProps {
  userId: string;
  username: string;
  onClose: () => void;
}

export function UserShareDialog({ userId, username, onClose }: UserShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/users/${userId}`;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedName = encodeURIComponent(username);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleEmailShare = () => {
    const emailSubject = `Check out ${username}'s profile on FreeorBarter`;
    const emailBody = `I found this interesting profile on FreeorBarter:\n\n${username}\n\nCheck out their items here: ${shareUrl}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  };

  const handleFacebookShare = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
  };

  const handleTwitterShare = () => {
    const tweetText = `Check out ${username}'s items on FreeorBarter`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodedUrl}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold mb-6">Share Profile</h2>

        <div className="space-y-4">
          {/* Copy Link */}
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-gray-900">Profile Link</p>
              <p className="text-sm text-gray-500 truncate">{shareUrl}</p>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center space-x-1 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="text-sm">Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Share Options */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleEmailShare}
              className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Mail className="w-6 h-6 text-gray-700 mb-2" />
              <span className="text-sm font-medium">Email</span>
            </button>
            
            <button
              onClick={handleFacebookShare}
              className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Facebook className="w-6 h-6 text-blue-600 mb-2" />
              <span className="text-sm font-medium text-blue-600">Facebook</span>
            </button>
            
            <button
              onClick={handleTwitterShare}
              className="flex flex-col items-center justify-center p-4 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors"
            >
              <Twitter className="w-6 h-6 text-sky-500 mb-2" />
              <span className="text-sm font-medium text-sky-500">Twitter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}