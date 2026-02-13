import React, { useState, useRef, useEffect, useCallback } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { supabase } from '../lib/supabase';
import { PASSWORD_RESET_REDIRECT } from '../lib/config';
import { X, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const HCAPTCHA_SITEKEY = import.meta.env.VITE_HCAPTCHA_SITEKEY as string;

const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/;
const PROHIBITED_USERNAMES = ['admin', 'moderator', 'system', 'support', 'freeorbarter', 'null', 'undefined'];

interface AuthProps {
  onClose: () => void;
}

export function Auth({ onClose }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const captchaRef = useRef<HCaptcha>(null);

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    username: '',
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

  const checkUsernameAvailability = useCallback(async (username: string) => {
    const lower = username.toLowerCase();
    if (!USERNAME_REGEX.test(lower)) {
      setUsernameStatus('invalid');
      setUsernameError('Username must be 3–20 characters: letters, numbers, _ or .');
      return;
    }
    if (PROHIBITED_USERNAMES.includes(lower)) {
      setUsernameStatus('invalid');
      setUsernameError('This username is not allowed');
      return;
    }
    setUsernameStatus('checking');
    setUsernameError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('check_username_available', { p_username: lower });
      if (rpcError) throw rpcError;
      if (data) {
        setUsernameStatus('available');
        setUsernameError(null);
      } else {
        setUsernameStatus('taken');
        setUsernameError('Username already taken');
      }
    } catch {
      setUsernameStatus('invalid');
      setUsernameError('Could not check availability. Please try again.');
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'username') {
      const lower = value.toLowerCase();
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
      if (!lower) {
        setUsernameStatus('idle');
        setUsernameError(null);
        return;
      }
      if (!USERNAME_REGEX.test(lower)) {
        setUsernameStatus('invalid');
        setUsernameError('Username must be 3–20 characters: letters, numbers, _ or .');
        return;
      }
      if (PROHIBITED_USERNAMES.includes(lower)) {
        setUsernameStatus('invalid');
        setUsernameError('This username is not allowed');
        return;
      }
      setUsernameStatus('checking');
      setUsernameError(null);
      usernameTimerRef.current = setTimeout(() => {
        checkUsernameAvailability(lower);
      }, 300);
    }
  };

  const validateForm = () => {
    if (isSignUp) {
      if (!formData.username.trim()) {
        setError('Username is required');
        return false;
      }
      if (!USERNAME_REGEX.test(formData.username.toLowerCase())) {
        setError('Username must be 3–20 characters: letters, numbers, _ or .');
        return false;
      }
      if (usernameStatus !== 'available') {
        setError('Please choose an available username');
        return false;
      }
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
            captchaToken: captchaToken ?? undefined,
            data: {
              username: formData.username.toLowerCase(),
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
          options: { captchaToken: captchaToken ?? undefined },
        });
        if (signInError) throw signInError;
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setCaptchaToken(null);
      captchaRef.current?.resetCaptcha();
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: PASSWORD_RESET_REDIRECT,
      });

      if (error) throw error;
      setSuccess('Password reset instructions have been sent to your email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };


  const toggleForm = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setConfirmationSent(false);
    setAcceptedTerms(false);
    setUsernameStatus('idle');
    setUsernameError(null);
    setFormData({
      name: '',
      username: '',
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
                <>
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      value={formData.username}
                      onChange={handleInputChange}
                      className={inputClasses}
                      placeholder="e.g. jane_doe"
                      required
                      autoComplete="username"
                    />
                    {formData.username && (
                      <p className={`mt-1 text-sm ${usernameStatus === 'available' ? 'text-green-600' :
                        usernameStatus === 'checking' ? 'text-gray-500' :
                          'text-red-600'
                        }`}>
                        {usernameStatus === 'checking' && '⏳ Checking availability…'}
                        {usernameStatus === 'available' && '✅ Username is available'}
                        {usernameStatus === 'taken' && '❌ Username already taken'}
                        {usernameStatus === 'invalid' && `❌ ${usernameError}`}
                      </p>
                    )}
                  </div>
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
                </>
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
              {HCAPTCHA_SITEKEY && (
                <div className="flex justify-center my-3">
                  <HCaptcha
                    ref={captchaRef}
                    sitekey={HCAPTCHA_SITEKEY}
                    onVerify={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken(null)}
                    onError={() => setCaptchaToken(null)}
                  />
                </div>
              )}
              <button
                type="submit"
                className="w-full btn-primary"
                disabled={loading || (!!HCAPTCHA_SITEKEY && !captchaToken)}
              >
                {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
              </button>
            </form>

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