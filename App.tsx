
import React, { useState, useCallback, useEffect } from 'react';
import { Chat } from '@google/genai';
import ImageUpload from './components/ImageUpload';
import ProductCard from './components/ProductCard';
import ChatInterface from './components/ChatInterface';
import Modal from './components/Modal';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Product, ChatMessage, AppState, LoadingState } from './types';
import { analyzeImageAndSuggestProducts, startChatSession, sendMessageInChat } from './services/geminiService';

const initialState: AppState = {
  uploadedImage: null,
  uploadedImageType: null,
  analyzedText: null,
  similarProducts: [],
  complementaryProducts: [],
  chatMessages: [],
  currentChat: null,
  isLoading: false, // General loading state, specific states handled by loadingState
  loadingState: LoadingState.IDLE,
  error: null,
  isCheckoutModalOpen: false,
  userInput: '',
  activeTab: 'similar',
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(initialState);
  const [initialChatPrompt, setInitialChatPrompt] = useState<string | undefined>(undefined);

  const handleImageUpload = useCallback(async (base64Image: string, imageType: string) => {
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      loadingState: LoadingState.ANALYZING_IMAGE,
      uploadedImage: base64Image, 
      uploadedImageType: imageType,
      error: null, 
      similarProducts: [], 
      complementaryProducts: [],
      chatMessages: [], // Reset chat on new image
      analyzedText: null,
    }));

    try {
      const result = await analyzeImageAndSuggestProducts(base64Image, imageType);
      const newChat = startChatSession();
      
      let initialMessages: ChatMessage[] = [];
      if(result.analysis && !result.analysis.startsWith("Error:")) {
        initialMessages.push({
          id: Date.now().toString(),
          sender: 'ai',
          text: `Okay, I've analyzed your image! Here's what I see: ${result.analysis}`,
          timestamp: new Date(),
        });
        setInitialChatPrompt(`Tell me more about similar items or what I can pair with this.`);
      } else {
         initialMessages.push({
          id: Date.now().toString(),
          sender: 'ai',
          text: result.analysis.startsWith("Error:") ? result.analysis : "I've processed the image. How can I help you find what you're looking for?",
          timestamp: new Date(),
        });
        setInitialChatPrompt(`Can you find products like in the image?`);
      }


      setState(prev => ({
        ...prev,
        analyzedText: result.analysis,
        similarProducts: result.similarProducts,
        complementaryProducts: result.complementaryProducts,
        currentChat: newChat,
        chatMessages: initialMessages,
        isLoading: false,
        loadingState: LoadingState.IDLE,
      }));
    } catch (err) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred.';
      setState(prev => ({ 
        ...prev, 
        error: `Failed to analyze image: ${errorMsg}`, 
        isLoading: false,
        loadingState: LoadingState.IDLE,
      }));
    }
  }, []);

  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!state.currentChat) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      chatMessages: [...prev.chatMessages, userMessage],
      isLoading: true,
      loadingState: LoadingState.CHATTING,
      error: null,
    }));

    try {
      const aiResponseText = await sendMessageInChat(state.currentChat, messageText);
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date(),
      };
      setState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, aiMessage],
        isLoading: false,
        loadingState: LoadingState.IDLE,
      }));
    } catch (err) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred during chat.';
      const aiErrorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `Sorry, I encountered an error: ${errorMsg}`,
        timestamp: new Date(),
      };
      setState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, aiErrorMessage],
        isLoading: false,
        loadingState: LoadingState.IDLE,
      }));
    }
  }, [state.currentChat]);

  const openCheckoutModal = () => setState(prev => ({ ...prev, isCheckoutModalOpen: true }));
  const closeCheckoutModal = () => setState(prev => ({ ...prev, isCheckoutModalOpen: false }));

  // Effect to clear initial chat prompt after it's used
  useEffect(() => {
    if (initialChatPrompt && state.chatMessages.length > 0) {
      // Small delay to ensure ChatInterface picks it up
      const timer = setTimeout(() => setInitialChatPrompt(undefined), 100);
      return () => clearTimeout(timer);
    }
  }, [initialChatPrompt, state.chatMessages.length]);


  const productsToDisplay = state.activeTab === 'similar' ? state.similarProducts : state.complementaryProducts;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <header className="py-6 px-4 sm:px-8 shadow-2xl bg-opacity-50 bg-black backdrop-blur-md">
        <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-4xl font-bold tracking-tight">
                <i className="fas fa-magic mr-3 text-indigo-400"></i>ShopSmarter AI
            </h1>
            { (state.similarProducts.length > 0 || state.complementaryProducts.length > 0) && (
                <button
                    onClick={openCheckoutModal}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105"
                >
                    <i className="fas fa-shopping-cart mr-2"></i>Proceed to Checkout
                </button>
            )}
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl shadow-xl">
                <h2 className="text-2xl font-semibold mb-4 text-indigo-300">1. Upload Your Inspiration</h2>
                <ImageUpload onImageUpload={handleImageUpload} isLoading={state.loadingState === LoadingState.ANALYZING_IMAGE} />
            </div>
            {state.error && (
                <div className="bg-red-500/20 text-red-300 p-4 rounded-lg shadow-md">
                    <p className="font-semibold">Error:</p>
                    <p>{state.error}</p>
                </div>
            )}
        </div>

        <div className="lg:col-span-8 flex flex-col space-y-6 mt-6 lg:mt-0">
          {state.loadingState === LoadingState.ANALYZING_IMAGE && (
             <div className="flex flex-col items-center justify-center bg-white/10 backdrop-blur-md p-10 rounded-xl shadow-xl min-h-[300px]">
                <LoadingSpinner size="lg" message="Analyzing image and finding products..." />
             </div>
          )}
          
          {state.loadingState !== LoadingState.ANALYZING_IMAGE && (state.similarProducts.length > 0 || state.complementaryProducts.length > 0) && (
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl shadow-xl">
              <h2 className="text-2xl font-semibold mb-1 text-indigo-300">2. Discover Products</h2>
              {state.analyzedText && !state.analyzedText.startsWith("Error:") && <p className="text-sm text-gray-300 mb-4 italic">"{state.analyzedText}"</p>}
              
              <div className="mb-4 border-b border-gray-200/30">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                  <button
                    onClick={() => setState(prev => ({ ...prev, activeTab: 'similar' }))}
                    className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-lg ${
                      state.activeTab === 'similar'
                        ? 'border-indigo-400 text-indigo-300'
                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-300/50'
                    }`}
                  >
                    Similar Items ({state.similarProducts.length})
                  </button>
                  <button
                    onClick={() => setState(prev => ({ ...prev, activeTab: 'complementary' }))}
                    className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-lg ${
                      state.activeTab === 'complementary'
                        ? 'border-indigo-400 text-indigo-300'
                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-300/50'
                    }`}
                  >
                    Complementary ({state.complementaryProducts.length})
                  </button>
                </nav>
              </div>

              {productsToDisplay.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {productsToDisplay.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8">No {state.activeTab} products found for this image yet. Try the chat!</p>
              )}
            </div>
          )}

          {state.uploadedImage && state.currentChat && (
             <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl flex-grow min-h-[400px] lg:min-h-0">
                <ChatInterface
                    messages={state.chatMessages}
                    onSendMessage={handleSendMessage}
                    isLoading={state.loadingState === LoadingState.CHATTING}
                    initialPrompt={initialChatPrompt}
                />
             </div>
           )}

           {!state.uploadedImage && state.loadingState === LoadingState.IDLE && (
             <div className="flex flex-col items-center justify-center bg-white/10 backdrop-blur-md p-10 rounded-xl shadow-xl min-h-[300px] text-center">
                <i className="fas fa-search-plus fa-4x text-indigo-300 mb-4"></i>
                <h3 className="text-2xl font-semibold text-indigo-200 mb-2">Ready to Shop Smarter?</h3>
                <p className="text-gray-300">Upload an image to get started and discover products tailored to your style!</p>
             </div>
           )}
        </div>
      </main>

      <Modal isOpen={state.isCheckoutModalOpen} onClose={closeCheckoutModal} title="Checkout Simulation">
        <div className="text-gray-700">
          <p className="mb-4">This is a simulated checkout process.</p>
          <p className="mb-2"><strong>Items in cart (example):</strong></p>
          <ul className="list-disc list-inside mb-4">
            {(state.similarProducts.length > 0 || state.complementaryProducts.length > 0) ? 
              (state.similarProducts.slice(0,1).map(p => <li key={p.id}>{p.name} - {p.price}</li>)) : <li>No items selected</li>
            }
            {(state.complementaryProducts.length > 0) ? 
              (state.complementaryProducts.slice(0,1).map(p => <li key={p.id}>{p.name} - {p.price}</li>)) : null
            }
          </ul>
          <p className="font-semibold">Thank you for using ShopSmarter!</p>
          <button
            onClick={closeCheckoutModal}
            className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out"
          >
            Close
          </button>
        </div>
      </Modal>
      <footer className="text-center py-4 text-sm text-gray-400 bg-black/30">
        ShopSmarter AI &copy; {new Date().getFullYear()}. Powered by Gemini.
      </footer>
    </div>
  );
};

export default App;
