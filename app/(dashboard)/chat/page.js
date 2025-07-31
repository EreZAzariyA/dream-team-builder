'use client';

import { useSearchParams } from 'next/navigation';
import EnhancedChatWindow from '../../../components/chat/EnhancedChatWindow';

export default function ChatPage() {
  const searchParams = useSearchParams();
  const template = searchParams.get('template');

  return (
    <div className="h-full flex flex-col">
        <EnhancedChatWindow initialTemplate={template} />
    </div>
  );
}