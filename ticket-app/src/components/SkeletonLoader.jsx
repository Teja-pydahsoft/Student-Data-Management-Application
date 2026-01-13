import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export const SkeletonBox = ({
    width,
    height,
    className,
    rounded = 'rounded'
}) => {
    return (
        <div
            className={twMerge(
                clsx(
                    'animate-pulse bg-gray-200',
                    width || 'w-full',
                    height || 'h-4',
                    rounded,
                    className
                )
            )}
        />
    );
};

export const SkeletonCircle = ({ size = 10, className }) => {
    return (
        <div
            className={twMerge(
                clsx(
                    'animate-pulse bg-gray-200 rounded-full',
                    `w-${size} h-${size}`,
                    className
                )
            )}
        />
    );
};
