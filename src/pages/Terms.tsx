import React from 'react';

function Terms() {
  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
        
        <div className="space-y-6 text-gray-600">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using FreeorBarter, you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. User Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You must be at least 18 years old to use FreeorBarter.</li>
              <li>You agree to provide accurate and truthful information when creating your account.</li>
              <li>You are responsible for maintaining the security of your account.</li>
              <li>You agree not to use the platform for any illegal or unauthorized purpose.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Listing Guidelines</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Items listed must be legal and appropriate for general audiences.</li>
              <li>Descriptions must be accurate and truthful.</li>
              <li>Images must be of the actual item being offered.</li>
              <li>You must have the right to give away or trade the items you list.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Trading and Giving</h2>
            <p>
              FreeorBarter is a platform that facilitates the giving and trading of items between users. 
              We are not responsible for:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>The condition of items exchanged</li>
              <li>The completion of trades</li>
              <li>Any disputes between users</li>
              <li>Lost or damaged items during exchange</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Prohibited Items</h2>
            <p>The following items are not allowed on FreeorBarter:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Illegal items or substances</li>
              <li>Dangerous or hazardous materials</li>
              <li>Counterfeit goods</li>
              <li>Adult content or materials</li>
              <li>Live animals</li>
              <li>Prescription medications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Account Termination</h2>
            <p>
              We reserve the right to terminate or suspend accounts that violate these terms or engage 
              in behavior that compromises the platform's integrity or user safety.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Changes to Terms</h2>
            <p>
              We may modify these terms at any time. Continued use of FreeorBarter after changes 
              constitutes acceptance of the new terms.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default Terms;