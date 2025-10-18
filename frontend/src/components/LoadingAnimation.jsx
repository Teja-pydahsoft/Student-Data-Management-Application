import React from 'react';
import Lottie from 'lottie-react';
import loadingAnimation from '../assets/loading-animation.json';

const LoadingAnimation = ({
  width = 64,
  height = 64,
  className = '',
  message = 'Loading...',
  size = 'md', // xs, sm, md, lg, xl
  variant = 'default', // default, minimal, overlay, inline
  showMessage = true,
  centered = true
}) => {
  // Size configurations
  const sizeConfig = {
    xs: { width: 32, height: 32, textSize: 'text-xs' },
    sm: { width: 48, height: 48, textSize: 'text-sm' },
    md: { width: 64, height: 64, textSize: 'text-sm' },
    lg: { width: 80, height: 80, textSize: 'text-base' },
    xl: { width: 120, height: 120, textSize: 'text-lg' }
  };

  // Variant configurations
  const variantConfig = {
    default: 'flex flex-col items-center justify-center',
    minimal: 'flex items-center gap-2',
    overlay: 'fixed inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 z-50',
    inline: 'flex items-center gap-3'
  };

  const config = sizeConfig[size] || sizeConfig.md;
  const variantClass = variantConfig[variant] || variantConfig.default;

  return (
    <div className={`${centered ? variantClass : 'flex flex-col items-center justify-center'} ${className}`}>
      <div style={{ width: config.width, height: config.height }}>
        <Lottie
          animationData={loadingAnimation}
          loop={true}
          autoplay={true}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      {showMessage && message && (
        <p className={`mt-2 ${config.textSize} text-gray-600 animate-pulse`}>
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingAnimation;
