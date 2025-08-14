import React from 'react';
import BackToButton from '../../components/common/BackToButton';

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <BackToButton href="/auth/signin" label="Back to Sign-in" />
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
            Privacy Policy
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-500 dark:text-gray-400">
            Last updated: August 11, 2025
          </p>
        </div>

        <div className="mt-16 prose prose-lg dark:prose-dark max-w-none text-gray-700 dark:text-gray-300">
          <p>
            Welcome to our Privacy Policy. Your privacy is critically important to us. It is our policy to respect your privacy regarding any information we may collect from you across our website, and other sites we own and operate.
          </p>

          <h2 className="text-2xl font-bold mt-8 text-gray-900 dark:text-white">1. Information We Collect</h2>
          <p>
            We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we’re collecting it and how it will be used.
          </p>

          <h3 className="text-xl font-bold mt-6 text-gray-900 dark:text-white">Log Data</h3>
          <p>
            We log standard data provided by your web browser when you visit our website. This data may include your computer’s Internet Protocol (IP) address, your browser type and version, the pages you visit, the time and date of your visit, the time spent on each page, and other details.
          </p>

          <h3 className="text-xl font-bold mt-6 text-gray-900 dark:text-white">Personal Information</h3>
          <p>
            We may ask for personal information, such as your name and email address, when you register for an account or subscribe to our newsletter.
          </p>

          <h2 className="text-2xl font-bold mt-8 text-gray-900 dark:text-white">2. How We Use Your Information</h2>
          <p>
            We use the information we collect in various ways, including to:
          </p>
          <ul>
            <li>Provide, operate, and maintain our website</li>
            <li>Improve, personalize, and expand our website</li>
            <li>Understand and analyze how you use our website</li>
            <li>Develop new products, services, features, and functionality</li>
            <li>Communicate with you, either directly or through one of our partners, including for customer service, to provide you with updates and other information relating to the website, and for marketing and promotional purposes</li>
            <li>Send you emails</li>
            <li>Find and prevent fraud</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 text-gray-900 dark:text-white">3. Cookies</h2>
          <p>
            We use “cookies” to collect information about you and your activity across our site. A cookie is a small piece of data that our website stores on your computer, and accesses each time you visit, so we can understand how you use our site. This helps us serve you content based on preferences you have specified.
          </p>

          <h2 className="text-2xl font-bold mt-8 text-gray-900 dark:text-white">4. Your Rights</h2>
          <p>
            You are free to refuse our request for your personal information, with the understanding that we may be unable to provide you with some of your desired services. Your continued use of our website will be regarded as acceptance of our practices around privacy and personal information. If you have any questions about how we handle user data and personal information, feel free to contact us.
          </p>

          <h2 className="text-2xl font-bold mt-8 text-gray-900 dark:text-white">5. Changes to This Policy</h2>
          <p>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicyPage;