import apiClient from '@/core/api/apiClient';

export interface VisualizationResponse {
  message_id: string;
  image_url?: string;
  unavailable?: boolean;
  reason?: string;
}

export const getVisualization = async (messageId: string, force: boolean = false): Promise<VisualizationResponse> => {
  const url = force ? `/rag/visualization/${messageId}?force=true` : `/rag/visualization/${messageId}`;
  const response = await apiClient.post<VisualizationResponse>(url);
  return response.data;
};
