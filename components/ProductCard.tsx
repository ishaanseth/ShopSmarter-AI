
import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden transform hover:scale-105 transition-transform duration-200 ease-in-out flex flex-col h-full">
      <img 
        src={product.imageUrl || `https://picsum.photos/seed/${product.id}/300/200`} 
        alt={product.name} 
        className="w-full h-48 object-cover" 
        onError={(e) => (e.currentTarget.src = 'https://picsum.photos/300/200?grayscale')}
      />
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-lg font-semibold text-gray-800 mb-1 truncate" title={product.name}>{product.name}</h3>
        <p className="text-sm text-gray-600 mb-2 flex-grow min-h-[40px]">{product.description.substring(0, 100)}{product.description.length > 100 ? '...' : ''}</p>
        <div className="flex justify-between items-center mt-auto">
          <p className="text-md font-bold text-indigo-600">{product.price}</p>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{product.category}</span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
