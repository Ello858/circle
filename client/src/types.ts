export type User = {
  id: number;
  username: string;
  display_name: string;
  avatar_color: string;
  online?: boolean;
};

export type Conversation = {
  id: number;
  type: "dm" | "group";
  name: string | null;
  title: string;
  peer: {
    id: number;
    username: string;
    display_name: string;
    avatar_color: string;
  } | null;
  last_message: {
    id: number;
    body: string | null;
    image_path: string | null;
    sender_id: number;
    created_at: string;
    preview: string;
  } | null;
  unread_count: number;
  updated_at: string;
};

export type MessageRow = {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string | null;
  image_path: string | null;
  created_at: string;
  sender_display_name: string;
  sender_username: string;
  sender_avatar_color: string;
  is_admin?: boolean;
};
