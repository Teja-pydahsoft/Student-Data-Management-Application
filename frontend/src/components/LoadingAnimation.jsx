import React from 'react';
import Lottie from 'lottie-react';
import loadingAnimation from '../assets/loading-animation.json';

const LoadingAnimation = ({
  width = 64,
  height = 64,
  className = '',
  message = 'Loading...'
}) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div style={{ width, height }}>
        <Lottie
          animationData={loadingAnimation}
          loop={true}
          autoplay={true}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      {message && (
        <p className="mt-2 text-sm text-gray-600 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingAnimation;
