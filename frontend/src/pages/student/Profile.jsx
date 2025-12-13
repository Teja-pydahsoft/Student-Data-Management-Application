import React, { useEffect, useState } from 'react';
import api from '../../config/api';
import { User, Mail, Phone, MapPin, Calendar, Book, Hash } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { toast } from 'react-hot-toast';

const Profile = () => {
    const { user } = useAuthStore();
    const [studentData, setStudentData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get(`/students/${user.admission_number}`);

                if (response.data.success) {
                    setStudentData(response.data.data);
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
                toast.error('Failed to load profile details');
            } finally {
                setLoading(false);
            }
        };

        if (user?.admission_number) {
            fetchProfile();
        }
    }, [user]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Use fetched data or fallback to auth user data (which is minimal)
    const displayData = studentData || user;

    // Helper to safely get data
    const get = (path, fallback = 'N/A') => {
        if (!displayData) return fallback;
        return displayData[path] || fallback;
    };

    // Helper to get nested student_data fields safely (Case-Insensitive)
    const getStudentData = (key, fallback = 'N/A') => {
        if (!displayData || !displayData.student_data) return fallback;

        const dataKeys = Object.keys(displayData.student_data);
        const foundKey = dataKeys.find(k => k.toLowerCase() === key.toLowerCase());

        const val = foundKey ? displayData.student_data[foundKey] : undefined;
        return val !== undefined && val !== null && val !== '' ? val : fallback;
    };

    const getCertificateStatus = () => {
        const status = displayData.certificates_status || getStudentData('Certificates Status') || 'Pending';
        return status;
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-blue-600 h-32"></div>
                <div className="px-6 pb-6">
                    <div className="relative flex items-end -mt-16 mb-6">
                        <div className="h-32 w-32 rounded-full border-4 border-white bg-white overflow-hidden shadow-md flex items-center justify-center">
                            {displayData.student_photo ? (
                                <img
                                    src={displayData.student_photo}
                                    alt={displayData.student_name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <User size={64} className="text-gray-300" />
                            )}
                        </div>
                        <div className="ml-6 mb-1">
                            <h1 className="text-2xl font-bold text-gray-900 break-words">{displayData.student_name || user.name}</h1>
                            <p className="text-gray-600 font-medium">{displayData.admission_number || user.admission_number}</p>
                            <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getCertificateStatus().toLowerCase().includes('verified')
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                }`}>
                                Certificate Status: {getCertificateStatus()}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Personal Information */}
                        <div className="md:col-span-1">
                            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                                <User size={20} className="text-blue-600" /> Personal Information
                            </h3>
                            <dl className="space-y-3">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Father's Name</dt>
                                    <dd className="text-gray-900 font-medium">{displayData.father_name || getStudentData('Father Name')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Gender</dt>
                                    <dd className="text-gray-900">{displayData.gender || getStudentData('Gender') || getStudentData('M/F')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                                    <dd className="text-gray-900">{displayData.dob || getStudentData('DOB') || getStudentData('Date of Birth')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Caste/Category</dt>
                                    <dd className="text-gray-900">{displayData.caste || getStudentData('Caste')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Aadhar Number</dt>
                                    <dd className="text-gray-900">{displayData.adhar_no || getStudentData('Adhar No') || getStudentData('Aadhar Number')}</dd>
                                </div>
                            </dl>
                        </div>

                        {/* Contact Information */}
                        <div className="md:col-span-1">
                            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                                <Phone size={20} className="text-green-600" /> Contact Information
                            </h3>
                            <dl className="space-y-3">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Student Mobile</dt>
                                    <dd className="text-gray-900">{displayData.student_mobile || getStudentData('Student Mobile number')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Parent Mobile 1</dt>
                                    <dd className="text-gray-900">{displayData.parent_mobile1 || getStudentData('Parent Mobile Number 1')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Parent Mobile 2</dt>
                                    <dd className="text-gray-900">{displayData.parent_mobile2 || getStudentData('Parent Mobile Number 2', 'N/A')}</dd>
                                </div>
                            </dl>
                        </div>

                        {/* Academic Information */}
                        <div className="md:col-span-1">
                            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                                <Book size={20} className="text-purple-600" /> Academic Information
                            </h3>
                            <dl className="space-y-3">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">College</dt>
                                    <dd className="text-gray-900">{displayData.college || getStudentData('College')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Course</dt>
                                    <dd className="text-gray-900">{displayData.course || getStudentData('Course')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Branch</dt>
                                    <dd className="text-gray-900">{displayData.branch || getStudentData('Branch')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Current Year</dt>
                                    <dd className="text-gray-900">{displayData.current_year || getStudentData('Year')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Current Semester</dt>
                                    <dd className="text-gray-900">{displayData.current_semester || getStudentData('Semister')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Batch</dt>
                                    <dd className="text-gray-900">{displayData.batch || getStudentData('Batch')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Student Type</dt>
                                    <dd className="text-gray-900">{displayData.stud_type || getStudentData('StudType')}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>

                    {/* Address & Other Details */}
                    <div className="mt-8">
                        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                            <MapPin size={20} className="text-red-600" /> Address & Other Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <dl className="space-y-3">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Full Address</dt>
                                    <dd className="text-gray-900">{displayData.student_address || getStudentData('Student Address')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">City/Village</dt>
                                    <dd className="text-gray-900">{displayData.city_village || getStudentData('City') || getStudentData('Village')}</dd>
                                </div>
                            </dl>
                            <dl className="space-y-3">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Mandal</dt>
                                    <dd className="text-gray-900">{displayData.mandal_name || getStudentData('Mandal')}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">District</dt>
                                    <dd className="text-gray-900">{displayData.district || getStudentData('District')}</dd>
                                </div>
                            </dl>
                            <dl className="space-y-3">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Certificate Status</dt>
                                    <dd className={`font-medium ${getCertificateStatus().toLowerCase().includes('verified')
                                        ? 'text-green-600'
                                        : 'text-yellow-600'
                                        }`}>{getCertificateStatus()}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;

