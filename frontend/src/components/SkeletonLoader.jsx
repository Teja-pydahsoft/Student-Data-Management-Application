import React from 'react';

// Skeleton loader component for modern loading states
export const SkeletonBox = ({ className = '', height = 'h-4', width = 'w-full' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${height} ${width} ${className}`} />
);

export const SkeletonCard = () => (
  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-3 mb-3">
      <SkeletonBox height="h-10" width="w-10" className="rounded-full" />
      <div className="flex-1 space-y-2">
        <SkeletonBox height="h-4" width="w-3/4" />
        <SkeletonBox height="h-3" width="w-1/2" />
      </div>
    </div>
    <div className="space-y-2">
      <SkeletonBox height="h-3" />
      <SkeletonBox height="h-3" width="w-5/6" />
    </div>
  </div>
);

export const SkeletonList = ({ count = 3 }) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200">
        <SkeletonBox height="h-2" width="w-2" className="rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonBox height="h-4" width="w-1/3" />
          <SkeletonBox height="h-3" width="w-1/4" />
        </div>
        <SkeletonBox height="h-4" width="w-16" />
      </div>
    ))}
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <div className="space-y-2">
    {/* Header */}
    <div className="flex gap-4 pb-2 border-b border-gray-200">
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonBox key={i} height="h-4" width="w-24" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div key={rowIdx} className="flex gap-4 py-3">
        {Array.from({ length: cols }).map((_, colIdx) => (
          <SkeletonBox key={colIdx} height="h-4" width="w-24" />
        ))}
      </div>
    ))}
  </div>
);

