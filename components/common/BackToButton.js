import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const BackToButton = ({ href = '/dashboard', label = 'Back to Dashboard' }) => {
  return (
    <Link href={href} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
      <ArrowLeft className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
      {label}
    </Link>
  );
};

export default BackToButton;
