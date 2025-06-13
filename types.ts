
import { Chat } from "@google/genai";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  category: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface GeminiAnalysisResponse {
  analysis: string;
  similarProducts: Product[];
  complementaryProducts: Product[];
}

export interface AppState {
  uploadedImage: string | null;
  uploadedImageType: string | null;
  analyzedText: string | null;
  similarProducts: Product[];
  complementaryProducts: Product[];
  chatMessages: ChatMessage[];
  currentChat: Chat | null;
  isLoading: boolean;
  // Add missing loadingState property
  loadingState: LoadingState;
  error: string | null;
  isCheckoutModalOpen: boolean;
  userInput: string;
  activeTab: 'similar' | 'complementary';
}

export enum LoadingState {
  IDLE = 'idle',
  ANALYZING_IMAGE = 'analyzing_image',
  CHATTING = 'chatting',
}