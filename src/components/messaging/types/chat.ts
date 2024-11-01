interface Message {
    id: string;
    content: string;
    fromAccount: string;
    toAccount: string;
    timestamp: Date;
    status: 'sent' | 'delivered' | 'read';
    type: 'encrypted' | 'text';
  }
  
  interface Chat {
    id: string;
    name: string;
    lastMessage?: Message;
    unreadCount: number;
    avatar?: string;
    participants: string[];
  }
  
  interface User {
    id: string;
    name: string;
    avatar?: string;
    status: 'online' | 'offline';
  }