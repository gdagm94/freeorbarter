import React from 'react';

function Privacy() {
  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
        
        <div className="space-y-6 text-gray-600">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Account information (name, email, location)</li>
              <li>Profile information (username, avatar, preferences)</li>
              <li>Item listings and trading history</li>
              <li>Messages between users</li>
              <li>Usage data and analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Provide and improve our services</li>
              <li>Facilitate trades and communications between users</li>
              <li>Send important updates and notifications</li>
              <li>Prevent fraud and ensure platform safety</li>
              <li>Analyze usage patterns to improve user experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Information Sharing</h2>
            <p>We share information in the following ways:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>With other users as necessary for trades and communications</li>
              <li>With service providers who assist in platform operations</li>
              <li>When required by law or to protect rights</li>
              <li>In aggregate, anonymized form for analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Security</h2>
            <p>
              We implement appropriate security measures to protect your information, including:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Encryption of sensitive data</li>
              <li>Regular security assessments</li>
              <li>Secure data storage practices</li>
              <li>Limited access to personal information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your data</li>
              <li>Opt-out of certain data uses</li>
              <li>Export your data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to improve user experience and analyze platform usage. 
              You can control cookie settings through your browser preferences.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Contact Us</h2>
            <p>
              If you have questions about this privacy policy or your data, please contact us at{' '}
              <a href="mailto:support@freeorbarter.com" className="text-indigo-600 hover:text-indigo-800">
                support@freeorbarter.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Privacy;