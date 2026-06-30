import type { IconType } from 'react-icons';

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: IconType;
}

export interface PipelineStep {
  step: number;
  label: string;
  description: string;
  input: string;
  processing: string;
  output: string;
}

export interface TeamMember {
  name: string;
  role?: string;
  github: string;
  linkedin?: string;
  avatar: string;
}

export interface TechItem {
  id: string;
  label: string;
  icon: IconType;
  category: 'frontend' | 'backend' | 'ai' | 'infra';
}
