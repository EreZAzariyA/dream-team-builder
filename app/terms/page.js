
import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white text-center">Terms of Service</h1>
        <div className="prose dark:prose-invert text-gray-700 dark:text-gray-300">
          <p>Welcome to Dream Team - AI Documentation Assistant. These Terms of Service govern your use of our website and services.</p>
          
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using our services, you agree to be bound by these Terms and all policies referenced herein. If you do not agree to these Terms, please do not use our services.</p>

          <h2>2. Changes to Terms</h2>
          <p>We reserve the right to modify these Terms at any time. We will notify you of any changes by posting the new Terms on this page. Your continued use of the services after any such changes constitutes your acceptance of the new Terms.</p>

          <h2>3. User Accounts</h2>
          <p>You may need to create an account to access certain features. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>

          <h2>4. Use of Service</h2>
          <p>You agree to use the services only for lawful purposes and in accordance with these Terms. You are prohibited from using the services in any way that could damage, disable, overburden, or impair our servers or networks.</p>

          <h2>5. Intellectual Property</h2>
          <p>All content, trademarks, and data on our services, including but not limited to text, graphics, logos, and software, are the property of Dream Team or its licensors and are protected by intellectual property laws.</p>

          <h2>6. Limitation of Liability</h2>
          <p>Dream Team shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the services; (ii) any conduct or content of any third party on the services; (iii) any content obtained from the services; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage, and even if a remedy set forth herein is found to have failed of its essential purpose.</p>

          <h2>7. Governing Law</h2>
          <p>These Terms shall be governed and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.</p>

          <h2>8. Contact Us</h2>
          <p>If you have any questions about these Terms, please contact us at support@dreamteam.com.</p>
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
