import { useMemo } from 'react';

export const useChatMessages = ({ messages, elicitationAsMessage }) => {
  const allMessages = useMemo(() => {
    // Filter out internal system messages that shouldn't be displayed to users
    const displayableMessages = messages.filter(message => {
      // Only show user-facing message types
      const userFacingTypes = [
        'agent_response',
        'user_input', 
        'user_message',
        'elicitation_request',
        'elicitation_response',
        'workflow_step_update',
        'error'
      ];
      
      // Filter out internal completion/system messages that go to 'system'
      if (message.to === 'system' && message.type === 'completion') {
        return false;
      }
      
      // Only show messages with recognized user-facing types
      return userFacingTypes.includes(message.type);
    });
    
    const combined = [...displayableMessages];
    if (elicitationAsMessage) {
      combined.push(elicitationAsMessage);
    }
    return combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [messages, elicitationAsMessage]);

  return { allMessages };
};
