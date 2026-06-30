export interface ISession {
  id: string;
  title: string;
  created_at?: string | number;
  last_message_at?: string | number;
  messages?: IMessage[];
  messages_loaded?: boolean;
  documents?: unknown[];
  message_count?: number;
}

export interface IMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: number | string;
  status?: 'pending' | 'sent' | 'failed';
}
