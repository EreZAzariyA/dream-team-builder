'use client';

import { useSearchParams } from 'next/navigation';
import EnhancedChatWindow from '../../components/chat/EnhancedChatWindow';

export default function ChatPage() {
  const searchParams = useSearchParams();
  const template = searchParams.get('template');

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      <EnhancedChatWindow initialTemplate={template} />
    </div>
  );
}