import React, { useState, useEffect } from 'react';
import { X, Upload, Plus, Trash2, Search, Save } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from './LoadingAnimation';

const ManagePreviousCollegesModal = ({ isOpen, onClose }) => {
    const [colleges, setColleges] = useState([]);
    const [loading, setLoading] = useState(false);
    const [itemsToShow, setItemsToShow] = useState(20);
    const [newCollegeName, setNewCollegeName] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Other');
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkList, setBulkList] = useState('');
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [filterCategory, setFilterCategory] = useState('All');

    useEffect(() => {
        if (isOpen) {
            fetchColleges();
        }
    }, [isOpen]);

    const fetchColleges = async () => {
        try {
            setLoading(true);
            const response = await api.get('/previous-colleges');
            if (response.data.success) {
                setColleges(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch colleges', error);
            toast.error('Failed to load colleges');
        } finally {
            setLoading(false);
        }
    };

    const handleAddSingle = async (e) => {
        e.preventDefault();
        if (!newCollegeName.trim()) return;

        try {
            setSaving(true);
            const response = await api.post('/previous-colleges', {
                name: newCollegeName,
                category: selectedCategory
            });
            if (response.data.success) {
                toast.success('College added successfully');
                setNewCollegeName('');
                fetchColleges();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add college');
        } finally {
            setSaving(false);
        }
    };

    const handleBulkUpload = async () => {
        if (!bulkFile && !bulkList.trim()) return;

        const formData = new FormData();
        formData.append('category', selectedCategory);

        if (bulkFile) {
            formData.append('file', bulkFile);
        } else {
            const names = bulkList.split(/\n|,/).map(n => n.trim()).filter(n => n);
            if (names.length === 0) return;
            formData.append('colleges', JSON.stringify(names));
        }

        try {
            setSaving(true);
            // Use standard multipart/form-data for file upload support
            const response = await api.post('/previous-colleges/bulk', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.success) {
                toast.success(response.data.message || 'Processed successfully');
                setBulkList('');
                setBulkFile(null);
                setIsBulkMode(false);
                fetchColleges();
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to upload colleges');
        } finally {
            setSaving(false);
        }
    };

    const filteredColleges = colleges.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = filterCategory === 'All' || c.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const displayedColleges = filteredColleges.slice(0, itemsToShow);

    const categories = ['10th/School', 'Inter/Junior College', 'Diploma College', 'UG College', 'Other'];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900">Manage Previous Colleges</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {/* Controls */}
                    <div className="mb-6 flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                            <div className="relative flex-1 w-full sm:w-auto">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search colleges..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            >
                                <option value="All">All Categories</option>
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <button
                                onClick={() => setIsBulkMode(!isBulkMode)}
                                className={`w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center justify-center gap-2 ${isBulkMode
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                <Upload size={16} />
                                {isBulkMode ? 'Cancel Bulk' : 'Bulk Upload'}
                            </button>
                        </div>
                    </div>

                    {/* Bulk Upload Section */}
                    {isBulkMode && (
                        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-4 duration-300">
                            <h4 className="text-sm font-semibold text-blue-900 mb-3">Bulk Import Colleges</h4>

                            <div className="mb-4">
                                <label className="block text-xs font-medium text-blue-800 mb-1">Target Category</label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                >
                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-medium text-blue-800 mb-1">Option 1: Upload Excel File</label>
                                    <div className="relative border-2 border-dashed border-blue-200 rounded-lg bg-white hover:bg-blue-50 transition-colors p-4 text-center cursor-pointer">
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls, .csv"
                                            onChange={(e) => {
                                                setBulkFile(e.target.files[0]);
                                                setBulkList('');
                                            }}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <Upload className="text-blue-400" size={20} />
                                            <span className="text-sm text-blue-700 font-medium">
                                                {bulkFile ? bulkFile.name : 'Click to Upload Excel'}
                                            </span>
                                            {!bulkFile && <span className="text-xs text-blue-400">.xlsx, .xls, or .csv</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center">
                                    <span className="text-blue-300 font-medium">- OR -</span>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-blue-800 mb-1">Option 2: Paste List</label>
                                    <textarea
                                        value={bulkList}
                                        onChange={(e) => {
                                            setBulkList(e.target.value);
                                            setBulkFile(null);
                                        }}
                                        className="w-full h-24 px-3 py-2 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                                        placeholder="Paste names here..."
                                        disabled={!!bulkFile}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={handleBulkUpload}
                                    disabled={saving || (!bulkList.trim() && !bulkFile)}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    {saving ? <LoadingAnimation width={16} height={16} color="#fff" /> : <Save size={16} />}
                                    Process Import
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Add Single Section */}
                    {!isBulkMode && (
                        <form onSubmit={handleAddSingle} className="mb-6 flex flex-col sm:flex-row gap-2">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full sm:w-40 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            >
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <input
                                type="text"
                                value={newCollegeName}
                                onChange={(e) => setNewCollegeName(e.target.value)}
                                placeholder="Add new college name..."
                                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                            <button
                                type="submit"
                                disabled={saving || !newCollegeName.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2 justify-center"
                            >
                                {saving ? <LoadingAnimation width={16} height={16} color="#fff" /> : <Plus size={16} />}
                                Add
                            </button>
                        </form>
                    )}

                    {/* List Section */}
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center text-xs font-semibold text-gray-500 uppercase">
                            <span>Name</span>
                            <span>Category</span>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                            {loading ? (
                                <div className="p-8 flex justify-center">
                                    <LoadingAnimation />
                                </div>
                            ) : displayedColleges.length > 0 ? (
                                displayedColleges.map((college) => (
                                    <div key={college.id} className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex justify-between items-center">
                                        <span>{college.name}</span>
                                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                                            {college.category || 'Other'}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-gray-500 text-sm">
                                    {search ? 'No colleges match your search' : 'No colleges added yet'}
                                </div>
                            )}

                            {filteredColleges.length > itemsToShow && (
                                <button
                                    onClick={() => setItemsToShow(prev => prev + 20)}
                                    className="w-full py-3 text-xs text-blue-600 font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Load More...
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagePreviousCollegesModal;
