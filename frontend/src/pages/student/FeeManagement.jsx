import React, { useEffect, useState, useMemo } from 'react';
import { CreditCard, Clock, CheckCircle, AlertCircle, FileText, ArrowDownLeft, ArrowUpRight, Filter, Bus, BookOpen, Zap } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../config/api';

const FeeManagement = () => {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [feeData, setFeeData] = useState(null);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState('All');
    const [paymentLoading, setPaymentLoading] = useState(false);

    // Load Razorpay Script
    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const fetchFeeDetails = async () => {
        if (!user?.admission_number) return;

        try {
            setLoading(true);
            const response = await api.get(`/fees/students/${user.admission_number}/details`);

            if (response.data.success) {
                setFeeData(response.data);
            } else {
                setError('Failed to load fee details');
            }
        } catch (err) {
            console.error('Error fetching fee details:', err);
            setError('Unable to fetch fee information. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeeDetails();
    }, [user]);

    const handlePayment = async (amountToPay, feeItem = null) => {
        if (amountToPay <= 0) return;

        try {
            setPaymentLoading(true);
            const resScript = await loadRazorpayScript();

            if (!resScript) {
                alert('Razorpay SDK failed to load. Are you online?');
                return;
            }

            // 1. Create Order
            const orderResponse = await api.post('/payments/create-order', {
                studentId: user?.admission_number,
                amount: amountToPay,
                feeHeadId: feeItem?.feeHead?._id,
                studentYear: feeItem?.studentYear,
                semester: feeItem?.semester,
                remarks: feeItem ? `Payment for ${feeItem.feeHead?.name}` : 'General Fee Payment'
            });

            if (!orderResponse.data.success) {
                alert(orderResponse.data.message || 'Failed to initialize payment');
                return;
            }

            const { order, key_id, studentDetails } = orderResponse.data;

            // 2. Open Razorpay Checkout
            const options = {
                key: key_id,
                amount: order.amount,
                currency: order.currency,
                name: 'Pydah Group',
                description: feeItem ? `Payment for ${feeItem.feeHead?.name}` : 'Fee Payment',
                order_id: order.id,
                handler: async (response) => {
                    try {
                        setPaymentLoading(true);
                        // 3. Verify Payment
                        const verifyRes = await api.post('/payments/verify', {
                            ...response,
                            studentId: user?.admission_number,
                            amount: amountToPay,
                            feeHeadId: feeItem?.feeHead?._id,
                            studentYear: feeItem?.studentYear,
                            semester: feeItem?.semester,
                            remarks: feeItem ? `Online Payment: ${feeItem.feeHead?.name}` : 'Online Lumpsum Payment'
                        });

                        if (verifyRes.data.success) {
                            alert('Payment successful!');
                            fetchFeeDetails(); // Refresh data
                        } else {
                            alert('Payment verification failed.');
                        }
                    } catch (err) {
                        console.error('Verification error:', err);
                        alert('Something went wrong during verification.');
                    } finally {
                        setPaymentLoading(false);
                    }
                },
                prefill: {
                    name: studentDetails.name,
                    email: studentDetails.email || '',
                    contact: studentDetails.contact || ''
                },
                theme: {
                    color: '#4F46E5' // Indigo
                }
            };

            const paymentObject = new window.Razorpay(options);
            paymentObject.open();

        } catch (err) {
            console.error('Payment error:', err);
            alert('Failed to initiate payment. Please try again.');
        } finally {
            setPaymentLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount || 0);
    };

    const { summary, fees, transactions } = feeData || {};
    const dueAmount = summary?.dueAmount || 0;
    const isPaid = dueAmount <= 0;

    // Filter Logic
    const uniqueYears = useMemo(() => {
        if (!fees) return [];
        const years = [...new Set(fees.map(f => f.studentYear))];
        return years.sort((a, b) => a - b);
    }, [fees]);

    const filteredFees = useMemo(() => {
        if (selectedYear === 'All') return fees;
        return fees?.filter(f => f.studentYear.toString() === selectedYear.toString());
    }, [fees, selectedYear]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <div className="bg-red-50 text-red-600 p-4 rounded-xl inline-block mb-4">
                    <AlertCircle size={32} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Something went wrong</h3>
                <p className="text-gray-500 mt-2">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up pb-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                        Fee Management
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Track your fee dues and payment history
                    </p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Total Due */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all duration-300">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Due</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">
                                {formatCurrency(dueAmount)}
                            </h3>
                            {isPaid ? (
                                <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                    <CheckCircle size={12} /> No Dues
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                    <AlertCircle size={12} /> Payment Pending
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className={`p-3 rounded-xl ${isPaid ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                                <AlertCircle size={24} />
                            </div>
                            {!isPaid && (
                                <button
                                    onClick={() => handlePayment(dueAmount)}
                                    disabled={paymentLoading}
                                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {paymentLoading ? 'Processing...' : 'Pay Total Due'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Paid Amount */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all duration-300">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Paid</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">
                                {formatCurrency(summary?.totalPaid)}
                            </h3>
                            <p className="text-xs text-gray-400 mt-2">
                                Last payment: {transactions && transactions.length > 0
                                    ? new Date(transactions[transactions.length - 1].paymentDate).toLocaleDateString()
                                    : 'N/A'}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-green-50 text-green-500">
                            <CheckCircle size={24} />
                        </div>
                    </div>
                </div>

                {/* Total Fee */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all duration-300">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Fee</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">
                                {formatCurrency(summary?.totalFee)}
                            </h3>
                            <p className="text-xs text-gray-400 mt-2">
                                Total Applicable Fees
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-50 text-blue-500">
                            <CreditCard size={24} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Fee Breakdown */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                    <div className="p-6 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-gray-900">Fee Breakdown</h2>
                            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                                {filterValuesCount(filteredFees)} Items
                            </span>
                        </div>

                        {/* Year Filter */}
                        <div className="flex items-center gap-2">
                            <Filter size={16} className="text-gray-400" />
                            <select
                                className="text-sm border-none bg-gray-50 rounded-lg px-3 py-1.5 font-medium text-gray-600 focus:ring-0 cursor-pointer hover:bg-gray-100 transition-colors"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                            >
                                <option value="All">All Years</option>
                                {uniqueYears.map(year => (
                                    <option key={year} value={year}>Year {year}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50/50">
                                <tr className="text-left text-xs font-medium text-gray-500">
                                    <th className="px-6 py-4 uppercase tracking-wider">Fee Head</th>
                                    <th className="px-6 py-4 uppercase tracking-wider">Year/Sem</th>
                                    <th className="px-6 py-4 uppercase tracking-wider text-right">Amount</th>
                                    <th className="px-6 py-4 uppercase tracking-wider text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredFees && filteredFees.length > 0 ? (
                                    filteredFees.map((inv, index) => (
                                        <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                                        <FileText size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{inv.feeHead?.name || 'Tuition Fee'}</p>
                                                        <p className="text-xs text-gray-500 line-clamp-1">{inv.remarks || 'Standard Fee'}</p>
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {inv.isStructure ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                                                    <BookOpen size={10} /> Academic
                                                                </span>
                                                            ) : (
                                                                // Check if it's a Transport fee
                                                                (inv.feeHead?.name?.toLowerCase().includes('transport') || inv.feeHead?.name?.toLowerCase().includes('bus')) ? (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700">
                                                                        <Bus size={10} /> Transport
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                                                                        <Zap size={10} /> Individual
                                                                    </span>
                                                                )
                                                            )}
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                                                Year {inv.studentYear}
                                                            </span>
                                                            {inv.semester && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                                                    Sem {inv.semester}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                Year {inv.studentYear} {inv.semester ? `- Sem ${inv.semester}` : ''}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-900">
                                                {formatCurrency(inv.amount)}
                                            </td>
                                            <td className="px-6 py-4 text-center space-y-2">
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100 block w-fit mx-auto">
                                                    Applied
                                                </span>
                                                <button
                                                    onClick={() => handlePayment(inv.amount, inv)}
                                                    disabled={paymentLoading}
                                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 disabled:opacity-50"
                                                >
                                                    Pay Now
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                            No fee records found for the selected year.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Transaction History */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-fit">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
                    </div>
                    <div className="p-2 overflow-y-auto max-h-[500px]">
                        {transactions && transactions.length > 0 ? (
                            transactions.map((tx, index) => (
                                <div key={index} className="p-4 hover:bg-gray-50 rounded-xl transition-colors border-b border-gray-50 last:border-0 relative group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${tx.transactionType === 'DEBIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                {tx.transactionType === 'DEBIT' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900 text-sm">
                                                    {tx.feeHead?.name
                                                        ? `${tx.feeHead.name} - ${tx.transactionType === 'DEBIT' ? 'Payment' : 'Adjustment'}`
                                                        : (tx.transactionType === 'DEBIT' ? 'Payment Received' : 'Fee Adjustment')
                                                    }
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded uppercase tracking-wide">
                                                        {tx.paymentMode || 'Unknown'}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        #{tx.receiptNumber || 'Ref N/A'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold text-sm ${tx.transactionType === 'DEBIT' ? 'text-green-600' : 'text-red-600'}`}>
                                                {tx.transactionType === 'DEBIT' ? '+' : '-'}{formatCurrency(tx.amount)}
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                {new Date(tx.paymentDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    {tx.remarks && (
                                        <p className="text-xs text-gray-500 mt-2 ml-11 bg-gray-50 p-2 rounded border border-gray-100 italic">
                                            "{tx.remarks}"
                                        </p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <div className="p-3 bg-gray-50 rounded-full inline-block mb-3 text-gray-400">
                                    <Clock size={24} />
                                </div>
                                <p className="text-gray-500 text-sm">No transactions yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper for count
const filterValuesCount = (arr) => arr ? arr.length : 0;

export default FeeManagement;
