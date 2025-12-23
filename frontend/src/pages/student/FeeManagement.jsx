import React from 'react';
import { CreditCard, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const FeeManagement = () => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                        Fee Management
                    </h1>
                    <p className="text-gray-500 mt-1">
                        View and manage your tuition and other fees
                    </p>
                </div>
            </div>

            {/* Placeholder Content Area */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Summary Cards Placeholders */}
                {[
                    { label: 'Total Due', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
                    { label: 'Paid Amount', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
                    { label: 'Upcoming', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' }
                ].map((item, index) => (
                    <div key={index} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{item.label}</p>
                                <div className="h-8 w-32 bg-gray-100 rounded-lg mt-2 animate-pulse"></div>
                            </div>
                            <div className={`p-3 rounded-xl ${item.bg} ${item.color}`}>
                                <item.icon size={20} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Placeholder */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center py-16">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="text-indigo-600" size={32} />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Fee Payment Module
                </h2>
                <p className="text-gray-500 max-w-md mx-auto mb-8">
                    The fee management system is currently being set up. Soon you will be able to view your fee structure, payment history, and make payments online.
                </p>
                <button className="px-6 py-2.5 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-not-allowed">
                    Coming Soon
                </button>
            </div>
        </div>
    );
};

export default FeeManagement;
