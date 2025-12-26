import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Ticket,
  Upload,
  X,
  AlertCircle,
  CheckCircle,
  Camera
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';

import { SkeletonBox } from '../../components/SkeletonLoader';

const RaiseTicket = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    category_id: '',
    sub_category_id: '',
    title: '',
    description: '',
    photo: null
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const queryClient = useQueryClient();

  // Fetch active categories
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['complaint-categories-active'],
    queryFn: async () => {
      const response = await api.get('/complaint-categories/active');
      return response.data?.data || [];
    }
  });

  // Create ticket mutation
  const createMutation = useMutation({
    mutationFn: async (formDataToSend) => {
      const formDataObj = new FormData();
      formDataObj.append('category_id', formDataToSend.category_id);
      if (formDataToSend.sub_category_id) {
        formDataObj.append('sub_category_id', formDataToSend.sub_category_id);
      }
      formDataObj.append('title', formDataToSend.title);
      formDataObj.append('description', formDataToSend.description);
      if (formDataToSend.photo) {
        formDataObj.append('photo', formDataToSend.photo);
      }

      const response = await api.post('/tickets', formDataObj, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Ticket raised successfully!');
      queryClient.invalidateQueries(['tickets']);
      navigate('/student/my-tickets');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to raise ticket');
    }
  });

  const categories = categoriesData || [];
  const selectedCategory = categories.find(cat => cat.id === parseInt(formData.category_id));

  const handleCategoryChange = (categoryId) => {
    setFormData({
      ...formData,
      category_id: categoryId,
      sub_category_id: '' // Reset sub-category when main category changes
    });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo size must be less than 5MB');
        return;
      }
      setFormData({ ...formData, photo: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setFormData({ ...formData, photo: null });
    setPhotoPreview(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.category_id) {
      toast.error('Please select a complaint category');
      return;
    }

    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    createMutation.mutate(formData);
  };

  if (categoriesLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6 animate-pulse">
        <div className="space-y-2">
          <SkeletonBox height="h-8" width="w-48" />
          <SkeletonBox height="h-4" width="w-72" />
        </div>
        <div className="bg-white rounded-lg border p-6 space-y-6">
          <div className="space-y-2">
            <SkeletonBox height="h-4" width="w-32" />
            <SkeletonBox height="h-10" width="w-full" className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <SkeletonBox height="h-4" width="w-24" />
            <SkeletonBox height="h-10" width="w-full" className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <SkeletonBox height="h-4" width="w-32" />
            <SkeletonBox height="h-32" width="w-full" className="rounded-lg" />
            <SkeletonBox height="h-3" width="w-full" />
          </div>
          <SkeletonBox height="h-20" width="w-full" className="rounded-lg" />
          <div className="flex gap-4 pt-4 border-t">
            <SkeletonBox height="h-12" width="w-full" className="rounded-lg" />
            <SkeletonBox height="h-12" width="w-32" className="rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Raise a Complaint</h1>
        <p className="text-gray-600 mt-1">Submit your complaint and we'll help resolve it</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-6">
        {/* Category Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Complaint Category <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.category_id}
            onChange={(e) => handleCategoryChange(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {selectedCategory?.description && (
            <p className="mt-2 text-sm text-gray-500">{selectedCategory.description}</p>
          )}
        </div>

        {/* Sub-Category Selection (if available) */}
        {selectedCategory && selectedCategory.has_sub_categories && selectedCategory.sub_categories.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sub-Category <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <select
              value={formData.sub_category_id}
              onChange={(e) => setFormData({ ...formData, sub_category_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a sub-category (optional)</option>
              {selectedCategory.sub_categories.map((subCategory) => (
                <option key={subCategory.id} value={subCategory.id}>
                  {subCategory.name}
                </option>
              ))}
            </select>
            {formData.sub_category_id && selectedCategory.sub_categories.find(sc => sc.id === parseInt(formData.sub_category_id))?.description && (
              <p className="mt-2 text-sm text-gray-500">
                {selectedCategory.sub_categories.find(sc => sc.id === parseInt(formData.sub_category_id))?.description}
              </p>
            )}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            placeholder="Brief description of your complaint"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            rows={6}
            placeholder="Please provide detailed information about your complaint..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-2 text-sm text-gray-500">
            Provide as much detail as possible to help us resolve your complaint quickly.
          </p>
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Photo <span className="text-gray-400 text-xs">(Optional)</span>
          </label>
          {!photoPreview ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                id="photo-upload"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <label htmlFor="photo-upload" className="cursor-pointer">
                <Camera className="mx-auto text-gray-400 mb-2" size={32} />
                <p className="text-sm text-gray-600 mb-1">Click to upload a photo</p>
                <p className="text-xs text-gray-400">PNG, JPG, GIF up to 5MB</p>
              </label>
            </div>
          ) : (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Preview"
                className="w-full max-h-64 object-contain rounded-lg border"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
              >
                <X size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex items-center gap-4 pt-4 border-t">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <Ticket size={20} />
                Submit Complaint
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/student/my-tickets')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">What happens next?</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Your complaint will be reviewed by the administration</li>
              <li>You'll receive updates on the status of your ticket</li>
              <li>You can track your complaint in "My Tickets"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RaiseTicket;

