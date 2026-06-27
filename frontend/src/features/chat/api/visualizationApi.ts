import apiClient from '@/core/api/apiClient';

export interface VisualizationResponse {
  message_id: string;
  image_url?: string;
  unavailable?: boolean;
  reason?: string;
}

export const getVisualization = async (messageId: string): Promise<VisualizationResponse> => {
  const response = await apiClient.post<VisualizationResponse>(`/rag/visualization/${messageId}`);
  return response.data;
};
