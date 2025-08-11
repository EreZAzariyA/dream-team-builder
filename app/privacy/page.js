
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white text-center">Privacy Policy</h1>
        <div className="prose dark:prose-invert text-gray-700 dark:text-gray-300">
          <p>Your privacy is important to us. This Privacy Policy explains how Dream Team - AI Documentation Assistant collects, uses, and protects your personal information.</p>

          <h2>1. Information We Collect</h2>
          <p>We collect information that you provide directly to us, such as when you create an account, use our services, or communicate with us. This may include your name, email address, and any content you generate or upload using our services.</p>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve our services.</li>
            <li>Process your transactions and send you related information.</li>
            <li>Communicate with you about products, services, and offers.</li>
            <li>Monitor and analyze trends, usage, and activities in connection with our services.</li>
            <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities.</li>
          </ul>

          <h2>3. Information Sharing</h2>
          <p>We do not share your personal information with third parties except as described in this Privacy Policy or with your consent. We may share information with service providers who perform services on our behalf, such as hosting, data analysis, and customer service.</p>

          <h2>4. Data Security</h2>
          <p>We implement reasonable measures to protect your personal information from unauthorized access, use, or disclosure. However, no method of transmission over the Internet or electronic storage is 100% secure.</p>

          <h2>5. Your Choices</h2>
          <p>You may update, correct, or delete your account information at any time by logging into your account settings. You may also opt out of receiving promotional communications from us by following the instructions in those communications.</p>

          <h2>6. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. Your continued use of the services after any such changes constitutes your acceptance of the new Policy.</p>

          <h2>7. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at support@dreamteam.com.</p>
        </div>
        <div className="text-center mt-8">
          <Link href="/auth/signin" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
