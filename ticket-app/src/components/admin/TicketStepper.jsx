import React from 'react';
import { CheckCircle } from 'lucide-react';

const TicketStepper = ({ status }) => {
    const steps = [
        { label: 'Submitted', value: 'pending' },
        { label: 'Assigned', value: 'approaching' },
        { label: 'In Progress', value: 'resolving' },
        { label: 'Resolved', value: 'completed' }
    ];

    const currentStepIndex = steps.findIndex(s => s.value === status) === -1
        ? (status === 'closed' ? 3 : 0)
        : steps.findIndex(s => s.value === status);

    return (
        <div className="relative flex items-center justify-between my-8 w-full max-w-3xl mx-auto">
            {/* Progress Bar Background */}
            <div className="absolute top-5 left-0 right-0 h-1 bg-blue-50 z-0"></div>
            {/* Active Progress Bar */}
            <div
                className="absolute top-5 left-0 h-1 bg-blue-600 z-0 transition-all duration-500 ease-in-out"
                style={{
                    width: `${(currentStepIndex / (steps.length - 1)) * 100}%`
                }}
            ></div>

            {steps.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                    <div key={index} className="flex flex-col items-center gap-2 z-10 flex-1">
                        <div
                            className={`
                                w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                                ${isCompleted ? 'bg-blue-600 text-white' : 'bg-blue-50 text-gray-400'}
                                ${isCurrent ? 'ring-4 ring-blue-100' : 'ring-4 ring-white'}
                            `}
                        >
                            {isCompleted ? <CheckCircle size={20} /> : <span className="text-xs font-bold">{index + 1}</span>}
                        </div>
                        <span
                            className={`
                                text-xs font-bold text-center transition-colors duration-300
                                ${isCompleted ? 'text-gray-900' : 'text-gray-400'}
                            `}
                        >
                            {step.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default TicketStepper;
