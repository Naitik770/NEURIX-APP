export interface User {
  uid: string;
  displayName: string;
  photoURL?: string;
  lastSeen?: string;
  isTyping?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  replyToMessageId?: string;
  status: 'sent' | 'delivered' | 'seen';
}

export interface ChatState {
  user: User | null;
  messages: Message[];
  users: Record<string, User>;
  replyingTo: Message | null;
  setReplyingTo: (msg: Message | null) => void;
  setTyping: (isTyping: boolean) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  markAsSeen: (messageId: string) => Promise<void>;
}
