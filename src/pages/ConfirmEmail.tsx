import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle2, XCircle } from 'lucide-react';

function ConfirmEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showResetLink, setShowResetLink] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        setVerifying(true);

        // First check if we already have a session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSuccess(true);
          setVerifying(false);
          setTimeout(() => {
            navigate('/');
          }, 2000);
          return;
        }

        // Check for error parameters in the URL
        const errorCode = searchParams.get('error_code');
        const errorDescription = searchParams.get('error_description');

        if (errorCode) {
          // Handle known error cases
          if (errorCode === 'otp_expired') {
            setError('This confirmation link has expired. Please request a new one.');
            setShowResetLink(true);
            setVerifying(false);
            return;
          }
          throw new Error(errorDescription || 'Verification failed');
        }

        // Get token from URL
        const token = searchParams.get('token_hash');
        const type = searchParams.get('type');

        if (!token || type !== 'signup') {
          // If we're here without a token, and without a session (checked above), it's invalid
          throw new Error('Invalid confirmation link');
        }

        // Verify the signup OTP
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'signup'
        });

        if (verifyError) throw verifyError;

        setSuccess(true);
        // Wait a moment before redirecting
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } catch (err) {
        console.error('Error verifying email:', err);
        setError(err instanceof Error ? err.message : 'Failed to verify email');
        setShowResetLink(true);
      } finally {
        setVerifying(false);
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  if (verifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <h2 className="text-2xl font-bold mt-4 mb-2">Verifying Your Email</h2>
          <p className="text-gray-600">Please wait while we confirm your email address...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold mt-4 mb-2">Verification Failed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          {showResetLink && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Need to create a new account? Click the button below to start over.
              </p>
              <button
                onClick={() => navigate('/')}
                className="btn-primary"
              >
                Sign Up Again
              </button>
            </div>
          )}
          {!showResetLink && (
            <button
              onClick={() => navigate('/')}
              className="btn-primary"
            >
              Return to Home
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
        <h2 className="text-2xl font-bold mt-4 mb-2">Email Verified!</h2>
        <p className="text-gray-600 mb-2">Your email has been successfully verified.</p>
        <p className="text-gray-500 text-sm mb-6">Redirecting you to the home page...</p>
        <button
          onClick={() => navigate('/')}
          className="btn-primary"
        >
          Go to Home Page
        </button>
      </div>
    </div>
  );
}

export default ConfirmEmail;