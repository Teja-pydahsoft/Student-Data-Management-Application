import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';

const AttendanceSettingsModal = ({ isOpen, onClose, onSettingsChange }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [excludedCourses, setExcludedCourses] = useState([]);
    const [excludedStudents, setExcludedStudents] = useState([]);

    // Inputs for adding new entries
    const [newCourse, setNewCourse] = useState('');
    const [newStudent, setNewStudent] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchSettings();
        }
    }, [isOpen]);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/settings/attendance');
            if (res.data.success) {
                setExcludedCourses(res.data.data.excludedCourses || []);
                setExcludedStudents(res.data.data.excludedStudents || []);
            }
        } catch (error) {
            console.error('Failed to fetch attendance settings:', error);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await api.put('/settings/attendance', {
                excludedCourses,
                excludedStudents
            });
            toast.success('Settings saved successfully');
            if (onSettingsChange) {
                onSettingsChange();
            }
            onClose();
        } catch (error) {
            console.error('Failed to save attendance settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const addCourse = () => {
        if (!newCourse.trim()) return;
        if (excludedCourses.includes(newCourse.trim())) {
            toast.error('Course already excluded');
            return;
        }
        setExcludedCourses([...excludedCourses, newCourse.trim()]);
        setNewCourse('');
    };

    const removeCourse = (course) => {
        setExcludedCourses(excludedCourses.filter(c => c !== course));
    };

    const addStudent = () => {
        if (!newStudent.trim()) return;
        const admissionNo = newStudent.trim().toUpperCase();
        if (excludedStudents.includes(admissionNo)) {
            toast.error('Student already excluded');
            return;
        }
        setExcludedStudents([...excludedStudents, admissionNo]);
        setNewStudent('');
    };

    const removeStudent = (admissionNo) => {
        setExcludedStudents(excludedStudents.filter(s => s !== admissionNo));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-800">Attendance Configuration</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                    ) : (
                        <>
                            {/* Excluded Courses Section */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-1">Excluded Courses</h3>
                                    <p className="text-xs text-gray-500">Students in these courses will be hidden from the attendance list.</p>
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newCourse}
                                        onChange={(e) => setNewCourse(e.target.value)}
                                        placeholder="Enter course name (e.g. M.Tech)"
                                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && addCourse()}
                                    />
                                    <button
                                        onClick={addCourse}
                                        disabled={!newCourse.trim()}
                                        className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <Plus size={16} /> Add
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-2 min-h-[40px] p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    {excludedCourses.length === 0 ? (
                                        <span className="text-sm text-gray-400 italic">No courses excluded</span>
                                    ) : (
                                        excludedCourses.map((course) => (
                                            <span
                                                key={course}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700 shadow-sm group"
                                            >
                                                {course}
                                                <button
                                                    onClick={() => removeCourse(course)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Excluded Students Section */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-1">Excluded Students</h3>
                                    <p className="text-xs text-gray-500">Add Admission Numbers of students to exclude individually.</p>
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newStudent}
                                        onChange={(e) => setNewStudent(e.target.value)}
                                        placeholder="Enter Admission No (e.g. 21521A0501)"
                                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase"
                                        onKeyDown={(e) => e.key === 'Enter' && addStudent()}
                                    />
                                    <button
                                        onClick={addStudent}
                                        disabled={!newStudent.trim()}
                                        className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <Plus size={16} /> Add
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-2 min-h-[40px] p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    {excludedStudents.length === 0 ? (
                                        <span className="text-sm text-gray-400 italic">No students excluded</span>
                                    ) : (
                                        excludedStudents.map((student) => (
                                            <span
                                                key={student}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700 shadow-sm"
                                            >
                                                {student}
                                                <button
                                                    onClick={() => removeStudent(student)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || saving}
                        className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-all flex items-center gap-2 shadow-sm"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Configuration
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AttendanceSettingsModal;
