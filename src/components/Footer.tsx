import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, Mail, Heart, Facebook, Instagram, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

function Footer() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const handleNavigation = (path: string) => {
    navigate(path);
    window.scrollTo(0, 0);
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribing(true);
    
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert([{ email }]);

      if (error) throw error;
      setSubscribeSuccess(true);
      setEmail('');
    } catch (err) {
      console.error('Error subscribing to newsletter:', err);
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <footer className="bg-white border-t mt-auto">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand and Description */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <BarChart2 className="w-8 h-8 text-indigo-600" />
              <span className="text-xl font-bold text-indigo-600">FreeorBarter</span>
            </div>
            <p className="text-gray-600 text-sm">
              FreeorBarter is a community marketplace where you can give away items you no longer need
              or trade them with others. Join us in reducing waste and building connections through
              sharing.
            </p>
            
            {/* App Store CTA */}
            <div className="mt-4">
              <p className="text-xs text-gray-600 mb-2">Get the iOS App</p>
              <div className="flex items-center space-x-2">
                <div className="bg-white border border-gray-200 rounded-lg p-1.5 flex-shrink-0">
                  <img
                    src="/app-store-qr.png"
                    alt="QR code to download FreeorBarter on the App Store"
                    className="w-20 h-20 object-contain"
                  />
                </div>
                <a
                  href="https://apps.apple.com/us/app/freeorbarter/id6754944684"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block hover:opacity-90 transition-opacity"
                >
                  <img
                    src="/download-app-store-button.png"
                    alt="Download on the App Store"
                    className="h-10 w-auto"
                  />
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => handleNavigation('/')}
                  className="text-gray-600 hover:text-indigo-600 text-sm"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavigation('/about')}
                  className="text-gray-600 hover:text-indigo-600 text-sm"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavigation('/terms')}
                  className="text-gray-600 hover:text-indigo-600 text-sm"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavigation('/privacy')}
                  className="text-gray-600 hover:text-indigo-600 text-sm"
                >
                  Privacy Policy
                </button>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-4">Contact Us</h3>
            <a
              href="mailto:support@freeorbarter.com"
              className="flex items-center text-gray-600 hover:text-indigo-600 text-sm"
            >
              <Mail className="w-4 h-4 mr-2" />
              support@freeorbarter.com
            </a>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-gray-900 font-semibold mb-4">Stay Updated</h3>
            <form onSubmit={handleSubscribe} className="space-y-3">
              {subscribeSuccess ? (
                <p className="text-sm text-green-600">
                  Thanks for subscribing! 🎉
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Subscribe to our newsletter for updates and new features.
                  </p>
                  <div className="flex space-x-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
                      disabled={subscribing}
                    >
                      {subscribing ? (
                        <span className="text-sm">Subscribing...</span>
                      ) : (
                        <>
                          <span className="text-sm">Subscribe</span>
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>

            <div className="mt-6">
              <h4 className="text-gray-900 font-semibold mb-3">Follow Us</h4>
              <div className="flex space-x-4">
                <a
                  href="https://instagram.com/freeorbarter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-indigo-600 transition-colors"
                >
                  <Instagram className="w-6 h-6" />
                </a>
                <a
                  href="https://facebook.com/freeorbarter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-indigo-600 transition-colors"
                >
                  <Facebook className="w-6 h-6" />
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-600 mb-4 md:mb-0">
            © {new Date().getFullYear()} FreeorBarter. All rights reserved.
          </p>
          <div className="flex items-center text-sm text-gray-600">
            <Heart className="w-4 h-4 mr-1 text-red-500" />
            Made with love for a sustainable future
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;