import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff } from 'lucide-react';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true);
  const [linkUsed, setLinkUsed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const processAuth = async () => {
      try {
        setIsProcessing(true);

        // First check if we have the token in the URL (directly from email link)
        const token = searchParams.get('token_hash');
        const type = searchParams.get('type');

        if (token && type === 'recovery') {
          // Check if this token has already been used
          const usedToken = localStorage.getItem(`pwd_reset_${token}`);
          if (usedToken) {
            setLinkUsed(true);
            setError('This password reset link has already been used. Please request a new one.');
            setIsProcessing(false);
            return;
          }

          // This means we're handling the direct link from email
          // We need to exchange the token for a session
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'recovery',
          });

          if (error) {
            console.error('Error verifying OTP:', error);
            setError('Invalid or expired reset link. Please request a new one.');
            setIsProcessing(false);
            return;
          }
        } else if (window.location.hash && window.location.hash.includes('type=recovery')) {
          const { error } = await supabase.auth.getSession();

          if (error) {
            console.error('Error getting session from URL:', error);
            setError('Invalid or expired reset link. Please request a new one.');
            setIsProcessing(false);
            return;
          }
        } else {
          // Check if we already have a session
          const { data: { session } } = await supabase.auth.getSession();

          if (!session) {
            setError('No active session found. Please request a new password reset link.');
            setIsProcessing(false);
            return;
          }
        }

        setIsProcessing(false);
      } catch (err) {
        console.error('Auth processing error:', err);
        setError('An unexpected error occurred');
        setIsProcessing(false);
      }
    };

    processAuth();
  }, [searchParams]);

  const validatePasswords = () => {
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswords()) return;

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // Mark the token as used
      const token = searchParams.get('token_hash');
      if (token) {
        localStorage.setItem(`pwd_reset_${token}`, 'used');
      }

      setSuccess(true);
      // Clear the URL parameters after successful reset
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while resetting your password');
    } finally {
      setLoading(false);
    }
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Processing Reset Link</h2>
          <p className="text-gray-600">Please wait while we verify your reset link...</p>
        </div>
      </div>
    );
  }

  if (linkUsed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Link Already Used</h2>
          <p className="text-gray-600 mb-6">
            This password reset link has already been used. Please request a new one.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full btn-primary"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-green-600 mb-4">Password Reset Successful!</h2>
          <p className="text-gray-600 mb-6">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full btn-primary"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Reset Your Password</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handlePasswordReset} className="space-y-6">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full btn-primary"
            disabled={loading}
          >
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </button>

          <p className="text-sm text-gray-600 text-center">
            Remember your password?{' '}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-indigo-600 hover:text-indigo-500"
            >
              Return to sign in
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;