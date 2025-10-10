import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuthProps {
  onClose: () => void;
}

export function Auth({ onClose }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    gender: '',
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (isSignUp) {
      if (!formData.name.trim()) {
        setError('Name is required');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long');
        return false;
      }
      if (!acceptedTerms) {
        setError('You must accept the Terms of Service and Privacy Policy');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.name,
              gender: formData.gender || null,
            },
            emailRedirectTo: `${window.location.origin}/confirm-email`,
          },
        });

        if (signUpError) throw signUpError;
        setConfirmationSent(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (signInError) throw signInError;
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setSuccess('Password reset instructions have been sent to your email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        let errorMessage = 'Google sign in failed. Please try again.';
        
        // Handle specific error cases
        if (error.message.includes('popup_closed')) {
          errorMessage = 'Sign in was cancelled. Please try again.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('access_denied')) {
          errorMessage = 'Access denied. Please try again or contact support.';
        } else if (error.message.includes('invalid_request')) {
          errorMessage = 'Invalid request. Please refresh the page and try again.';
        } else if (error.message) {
          errorMessage = `Sign in failed: ${error.message}`;
        }
        
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error('Google OAuth error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during Google sign in');
    } finally {
      setGoogleLoading(false);
    }
  };

  const toggleForm = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setConfirmationSent(false);
    setAcceptedTerms(false);
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      gender: '',
    });
  };

  if (confirmationSent) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div ref={modalRef} className="bg-white rounded-lg p-6 max-w-md w-full relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold mb-4">Check Your Email</h2>
          <p className="text-gray-600 mb-4">
            We've sent a confirmation link to <strong>{formData.email}</strong>. 
            Please check your email and click the link to complete your registration.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Note: The confirmation link may take a few minutes to arrive. Don't forget to check your spam folder.
          </p>
          <button
            onClick={onClose}
            className="w-full btn-primary"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const inputClasses = "mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-4 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors";
  const selectClasses = "mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-4 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={modalRef} className="bg-white rounded-lg p-6 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {isForgotPassword ? (
          <>
            <div className="flex items-center mb-4">
              <button
                onClick={() => setIsForgotPassword(false)}
                className="text-gray-600 hover:text-indigo-600 mr-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold">Reset Password</h2>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                  {success}
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={inputClasses}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full btn-primary"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Instructions'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-4">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </h2>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={inputClasses}
                    required
                  />
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={inputClasses}
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`${inputClasses} pr-10`}
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
              {isSignUp && (
                <>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className={inputClasses}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                      Gender
                    </label>
                    <select
                      id="gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className={selectClasses}
                    >
                      <option value="">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="terms"
                        name="terms"
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div className="ml-3">
                      <label htmlFor="terms" className="text-sm text-gray-600">
                        I agree to the{' '}
                        <Link
                          to="/terms"
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="text-indigo-600 hover:text-indigo-500"
                        >
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link
                          to="/privacy"
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="text-indigo-600 hover:text-indigo-500"
                        >
                          Privacy Policy
                        </Link>
                      </label>
                    </div>
                  </div>
                </>
              )}
              <button
                type="submit"
                className="w-full btn-primary"
                disabled={loading || googleLoading}
              >
                {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
              </button>
            </form>

            {/* Divider */}
            <div className="mt-6 mb-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">OR</span>
                </div>
              </div>
            </div>

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <>
                  <div className="w-5 h-5 mr-2 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                  Signing in...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
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
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <div className="mt-4 flex flex-col items-center space-y-2">
              <button
                onClick={toggleForm}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
              {!isSignUp && (
                <button
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Forgot your password?
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}