import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Sprout } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Auth } from '../components/Auth';

function About() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);

  const handleGetStarted = () => {
    if (user) {
      navigate('/');
      window.scrollTo(0, 0);
    } else {
      setShowAuth(true);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Hero Section */}
        <div className="relative h-64 sm:h-80 bg-gradient-to-r from-indigo-500 to-purple-600">
          <div className="absolute inset-0 bg-black opacity-50"></div>
          <div className="relative h-full flex items-center justify-center text-center px-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">Our Story</h1>
              <p className="text-lg text-white/90">Making the world better, one trade at a time</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Personal Letter */}
            <div className="prose max-w-none">
              <div className="bg-gray-50 rounded-lg p-6 sm:p-8 text-gray-700 leading-relaxed space-y-4">
                <p className="text-lg">Hey friend,</p>
                
                <p>
                  We're Dona and Dag, and we made this thing called Free or Barter because, frankly, 
                  we just got tired of watching good stuff collect dust—or worse, end up in the trash. 
                  Dona (that's me) is a designer who loves random, cool objects way too much and also 
                  happens to care deeply about the planet. Dag is a developer, an all-around brilliant 
                  human, and the kind of guy who gets excited about building ideas with his friends.
                </p>
                
                <p>
                  We're both first-generation immigrants (Cameroon and Ethiopia, what's up!) who grew 
                  up knowing the value of sharing what we have—and honestly, we just want to make it 
                  easier (and way more fun) for other people to do the same.
                </p>
                
                <p>
                  This site is for trading with your friends, your neighbors, your cousin, or some nice 
                  stranger down the street. Give stuff away. Grab something cool. Swap a waffle iron for 
                  a skateboard. Whatever. Nothing's for sale. There's no catch. Just people helping 
                  people while quietly saving the planet.
                </p>
                
                <p>
                  Thanks for being here and making this weird little experiment work. Now please, go get 
                  rid of something.
                </p>
                
                <p className="italic">
                  Fondly and with an unreasonable number of extension cords,<br />
                  Dona & Dag
                </p>
              </div>
            </div>

            {/* Join Us */}
            <div className="text-center bg-gray-50 p-6 rounded-lg">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Join Our Community</h2>
              <p className="text-gray-600 mb-6">
                Be part of the change. Start sharing, trading, and making connections today.
              </p>
              <button 
                onClick={handleGetStarted}
                className="btn-primary"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </div>
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
    </div>
  );
}

export default About;