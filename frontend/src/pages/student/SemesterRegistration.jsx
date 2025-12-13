import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User,
    Phone,
    ShieldCheck,
    ArrowRight,
    CheckCircle,
    Loader2,
    Smartphone
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import api from '../../config/api';

const SemesterRegistration = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // Step 1 State: Verification
    const [verificationState, setVerificationState] = useState({
        studentMobile: '',
        parentMobile: '',
        studentOtpSent: false,
        parentOtpSent: false,
        studentOtp: '',
        parentOtp: '',
        studentVerified: false,
        parentVerified: false
    });

    const [studentData, setStudentData] = useState(null);

    // Fetch student details on mount
    useEffect(() => {
        const fetchStudentDetails = async () => {
            try {
                if (!user?.admission_number) return;

                const response = await api.get(`/students/${user.admission_number}`);

                if (response.data.success) {
                    const student = response.data.data;
                    setStudentData(student);
                    setVerificationState(prev => ({
                        ...prev,
                        studentMobile: student.student_mobile || '',
                        parentMobile: student.parent_mobile1 || student.parent_mobile2 || ''
                    }));
                }
            } catch (error) {
                console.error('Error fetching student details:', error);
                toast.error('Failed to load student contact details');
            } finally {
                setInitialLoading(false);
            }
        };

        fetchStudentDetails();
    }, [user]);

    const handleSendOTP = async (type) => {
        const mobile = type === 'student' ? verificationState.studentMobile : verificationState.parentMobile;

        if (!mobile || mobile.length < 10) {
            toast.error(`Invalid ${type} mobile number found. Please contact admin.`);
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/students/otp/send', {
                admissionNumber: user.admission_number,
                mobileNumber: mobile,
                year: studentData?.current_year || 'N/A',
                semester: studentData?.current_semester || 'N/A',
                type: type.charAt(0).toUpperCase() + type.slice(1) // 'Student' or 'Parent'
            });

            if (response.data.success) {
                if (type === 'student') {
                    setVerificationState(prev => ({ ...prev, studentOtpSent: true }));
                } else {
                    setVerificationState(prev => ({ ...prev, parentOtpSent: true }));
                }
                toast.success(`OTP sent to ${mobile.replace(/\d(?=\d{4})/g, "*")}`);
            } else {
                toast.error(response.data.message || 'Failed to send OTP');
            }
        } catch (error) {
            console.error('Send OTP error:', error);
            toast.error(error.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (type) => {
        const otp = type === 'student' ? verificationState.studentOtp : verificationState.parentOtp;
        const mobile = type === 'student' ? verificationState.studentMobile : verificationState.parentMobile;

        if (!otp || otp.length !== 6) {
            toast.error('Please enter a valid 6-digit OTP');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/students/otp/verify', {
                admissionNumber: user.admission_number,
                mobileNumber: mobile,
                otp: otp
            });

            if (response.data.success) {
                if (type === 'student') {
                    setVerificationState(prev => ({ ...prev, studentVerified: true }));
                } else {
                    setVerificationState(prev => ({ ...prev, parentVerified: true }));
                }
                toast.success(`${type === 'student' ? 'Student' : 'Parent'} mobile verified successfully!`);
            } else {
                toast.error(response.data.message || 'Invalid OTP');
            }
        } catch (error) {
            console.error('Verify OTP error:', error);
            toast.error(error.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleNextStep = () => {
        setCurrentStep(prev => prev + 1);
    };

    const steps = [
        { id: 1, title: 'Verification', icon: ShieldCheck },
        { id: 2, title: 'Certificates', icon: FileText },
        { id: 3, title: 'Course Selection', icon: BookOpen },
        { id: 4, title: 'Electives', icon: CheckCircle },
        { id: 5, title: 'Preview', icon: FileText },
        { id: 6, title: 'Confirmation', icon: CheckCircle }
    ];

    // Placeholder icons
    function BookOpen() { return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> }
    function FileText() { return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> }


    if (initialLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 heading-font">Semester Registration</h1>
                <p className="text-gray-500">Complete the following steps to register for your next semester.</p>
            </div>

            {/* Stepper */}
            <div className="mb-8">
                <div className="flex items-center justify-between relative">
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 -z-10"></div>
                    {steps.map((step) => (
                        <div key={step.id} className="flex flex-col items-center bg-gray-50 px-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${currentStep >= step.id
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-gray-300 text-gray-400'
                                }`}>
                                <step.icon size={20} />
                            </div>
                            <span className={`text-xs mt-2 font-medium ${currentStep >= step.id ? 'text-blue-600' : 'text-gray-400'}`}>
                                {step.title}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Step Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                {/* Step 1: Verification */}
                {currentStep === 1 && (
                    <div className="p-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <ShieldCheck className="text-blue-600" />
                            Step 1: Verify Information
                        </h2>

                        <div className="space-y-8">
                            {/* Student Mobile Verification */}
                            <div className="border border-gray-200 rounded-lg p-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Student Verification</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">Registered Student Mobile</label>
                                        <div className="relative">
                                            <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                value={verificationState.studentMobile}
                                                readOnly
                                                className="w-full pl-10 pr-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-500 cursor-not-allowed"
                                                placeholder="Loading data..."
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        {!verificationState.studentOtpSent ? (
                                            <button
                                                onClick={() => handleSendOTP('student')}
                                                disabled={loading || !verificationState.studentMobile || verificationState.studentVerified}
                                                className={`w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${verificationState.studentVerified
                                                    ? 'bg-green-100 text-green-700 cursor-default'
                                                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                                                    }`}
                                            >
                                                {verificationState.studentVerified ? (
                                                    <><CheckCircle size={18} /> Verified</>
                                                ) : (
                                                    <>{loading ? <Loader2 className="animate-spin" size={18} /> : 'Send OTP'}</>
                                                )}
                                            </button>
                                        ) : !verificationState.studentVerified ? (
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    value={verificationState.studentOtp}
                                                    onChange={(e) => setVerificationState(prev => ({ ...prev, studentOtp: e.target.value }))}
                                                    className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-center tracking-widest"
                                                    placeholder="OTP"
                                                />
                                                <button
                                                    onClick={() => handleVerifyOTP('student')}
                                                    disabled={loading}
                                                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                                                >
                                                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Verify'}
                                                </button>
                                                <button
                                                    onClick={() => setVerificationState(prev => ({ ...prev, studentOtpSent: false, studentOtp: '' }))}
                                                    className="px-2 text-gray-500 hover:text-gray-700"
                                                >
                                                    Resend
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-full py-2 bg-green-100 text-green-700 rounded-lg font-medium flex items-center justify-center gap-2">
                                                <CheckCircle size={18} /> Verified
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Parent Mobile Verification */}
                            <div className="border border-gray-200 rounded-lg p-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Parent Verification</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">Registered Parent Mobile</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                value={verificationState.parentMobile}
                                                readOnly
                                                className="w-full pl-10 pr-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-500 cursor-not-allowed"
                                                placeholder="Loading data..."
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        {!verificationState.parentOtpSent ? (
                                            <button
                                                onClick={() => handleSendOTP('parent')}
                                                disabled={loading || !verificationState.parentMobile || verificationState.parentVerified}
                                                className={`w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${verificationState.parentVerified
                                                    ? 'bg-green-100 text-green-700 cursor-default'
                                                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                                                    }`}
                                            >
                                                {verificationState.parentVerified ? (
                                                    <><CheckCircle size={18} /> Verified</>
                                                ) : (
                                                    <>{loading ? <Loader2 className="animate-spin" size={18} /> : 'Send OTP'}</>
                                                )}
                                            </button>
                                        ) : !verificationState.parentVerified ? (
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    value={verificationState.parentOtp}
                                                    onChange={(e) => setVerificationState(prev => ({ ...prev, parentOtp: e.target.value }))}
                                                    className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-center tracking-widest"
                                                    placeholder="OTP"
                                                />
                                                <button
                                                    onClick={() => handleVerifyOTP('parent')}
                                                    disabled={loading}
                                                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                                                >
                                                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Verify'}
                                                </button>
                                                <button
                                                    onClick={() => setVerificationState(prev => ({ ...prev, parentOtpSent: false, parentOtp: '' }))}
                                                    className="px-2 text-gray-500 hover:text-gray-700"
                                                >
                                                    Resend
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-full py-2 bg-green-100 text-green-700 rounded-lg font-medium flex items-center justify-center gap-2">
                                                <CheckCircle size={18} /> Verified
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={handleNextStep}
                                disabled={!verificationState.studentVerified || !verificationState.parentVerified}
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all cursor-pointer ${verificationState.studentVerified && verificationState.parentVerified
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                Next Step
                                <ArrowRight size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Certificates */}
                {currentStep === 2 && (
                    <div className="p-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <FileText className="text-blue-600" />
                            Step 2: Certificate Verification
                        </h2>

                        <div className="space-y-6">
                            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Status Check</h3>

                                {loading ? (
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Loader2 className="animate-spin" size={18} /> Checking status...
                                    </div>
                                ) : (
                                    <div>
                                        <div className={`flex items-center gap-2 text-lg font-medium mb-4 ${(studentData?.certificates_status || 'Pending').toLowerCase().includes('verified')
                                            ? 'text-green-700'
                                            : 'text-yellow-700'
                                            }`}>
                                            {(studentData?.certificates_status || 'Pending').toLowerCase().includes('verified')
                                                ? <CheckCircle size={24} />
                                                : <div className="p-1 bg-yellow-100 rounded-full"><ShieldCheck size={20} /></div>
                                            }
                                            Certificate Status: {studentData?.certificates_status || 'Pending'}
                                        </div>

                                        {!(studentData?.certificates_status || 'Pending').toLowerCase().includes('verified') && (
                                            <div className="bg-white p-5 rounded-lg border border-yellow-200">
                                                <p className="text-gray-800 font-medium mb-3">Action Required:</p>
                                                <p className="text-gray-600 text-sm mb-3">
                                                    Your certificates have not been verified yet. Please submit the following original documents to the administration office for verification:
                                                </p>
                                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700 font-medium">
                                                    <li className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div> SSC / 10th Class Certificate
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div> Intermediate / Diploma Certificate
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div> Transfer Certificate (TC)
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div> Study Certificates (VI to X)
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div> Aadhar Card
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div> Passport Size Photos
                                                    </li>
                                                </ul>
                                                <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">
                                                    Note: You can proceed with course selection, but your registration will be provisional until certificates are verified.
                                                </div>
                                            </div>
                                        )}

                                        {(studentData?.certificates_status || '').toLowerCase().includes('verified') && (
                                            <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-green-800 text-sm">
                                                All required certificates have been verified. You may proceed.
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-between pt-4">
                                    <button
                                        onClick={() => setCurrentStep(1)}
                                        className="px-6 py-2 text-gray-600 font-medium hover:text-gray-900"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleNextStep}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 transition-transform active:scale-95"
                                    >
                                        Next Step <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep > 2 && (
                    <div className="p-12 text-center">
                        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <BookOpen size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>
                        <p className="text-gray-500">Step {currentStep} is under development.</p>
                        <div className="flex justify-center gap-4 mt-6">
                            <button
                                onClick={() => setCurrentStep(prev => prev - 1)}
                                className="text-gray-600 font-medium hover:underline"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => setCurrentStep(1)}
                                className="text-blue-600 font-medium hover:underline"
                            >
                                Back to Start
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SemesterRegistration;

