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
    participants: { _id: string; [key: string]: any }[];
    sharedAccount?: string;
    type?: 'private' | 'group' | 'channel';
    creator?: string;
    muted?: boolean;
    mutedMentions?: boolean; // not notified of @mentions when the group is muted
    mutedEveryone?: boolean; // the admin's @everyone is a normal message
    unreadMention?: boolean; // "[@you]" in the chats list
  }
  
  interface User {
    id: string;
    name: string;
    avatar?: string;
    status: 'online' | 'offline';
  }