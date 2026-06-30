import { z } from 'zod';

export interface AudioVisemePacket {
  id: string;
  url: string;
  mouthCues: Viseme[];
}

export const VisemeSchema = z.object({
  start: z.number().catch(0),
  end: z.number().catch(0),
  value: z.string().catch(''),
}).passthrough();

export type Viseme = z.infer<typeof VisemeSchema>;

export interface PendingFirstMessage {
  message_id: string;
  text: string;
}

export const WSPayloadSchema = z.object({
  session_id: z.string().optional(),
  message_id: z.string().optional(),
  text: z.string().optional(),
  created_at: z.union([z.string(), z.number()]).nullable().optional(),
  delta: z.string().optional(),
  is_final: z.boolean().optional(),
  audio: z.object({
    url: z.string().optional(),
    duration_ms: z.number().optional()
  }).passthrough().optional(),
  mouthCues: z.array(VisemeSchema).optional(),
  message: z.string().optional(),
  state: z.enum(['idle', 'thinking', 'speaking', 'error']).optional(),
}).passthrough();

export type WSPayload = z.infer<typeof WSPayloadSchema>;
