import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../config/api';
import LoadingAnimation from '../components/LoadingAnimation';

const PublicForm = () => {
  const { formId } = useParams();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({});
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [fileData, setFileData] = useState({});

  // Mobile browser detection - moved to component level
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  useEffect(() => {
    fetchForm();

    // Log mobile browser detection for debugging
    if (isMobile) {
      console.log('Mobile browser detected:', {
        userAgent: navigator.userAgent,
        isIOS,
        isAndroid,
        formId,
        url: window.location.href,
        origin: window.location.origin,
        pathname: window.location.pathname
      });

      // Add mobile-specific optimizations
      document.body.classList.add('mobile-optimized');

      // Prevent zoom on input focus for iOS
      if (isIOS) {
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }
      }

      // Test URL accessibility for mobile browsers
      try {
        // Verify the URL is accessible
        const testUrl = `${window.location.origin}${window.location.pathname}`;
        console.log('Testing URL accessibility:', testUrl);

        // Add a small delay to ensure the page is fully loaded
        setTimeout(() => {
          if (window.location.href !== testUrl) {
            console.warn('URL mismatch detected:', { expected: testUrl, actual: window.location.href });
          }

          // Test if the form is properly loaded
          if (form && form.form_id) {
            console.log('Form loaded successfully:', {
              formId: form.form_id,
              formName: form.form_name,
              fieldCount: form.form_fields?.length || 0
            });
          }
        }, 1000);
      } catch (error) {
        console.error('Error testing URL accessibility:', error);
      }
    }
  }, [formId, form]);

  const fetchForm = async () => {
    try {
      console.log('Fetching form with ID:', formId);
      const response = await api.get(`/forms/public/${formId}`);
      console.log('Form fetched successfully:', response.data.data);

      setForm(response.data.data);

      // Initialize form data for enabled fields only
      const initialData = {};
      const enabledFields = response.data.data.form_fields.filter(field => field.isEnabled !== false);
      enabledFields.forEach((field) => {
        initialData[field.label] = field.type === 'checkbox' ? [] : '';
      });
      setFormData(initialData);
    } catch (error) {
      console.error('Error fetching form:', error);
      setError(error.response?.data?.message || 'Form not found');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (label, value, type) => {
    if (type === 'checkbox') {
      const currentValues = formData[label] || [];
      if (currentValues.includes(value)) {
        setFormData({
          ...formData,
          [label]: currentValues.filter((v) => v !== value),
        });
      } else {
        setFormData({
          ...formData,
          [label]: [...currentValues, value],
        });
      }
    } else {
      setFormData({
        ...formData,
        [label]: value,
      });
    }
  };

  const handleFileChange = (label, file) => {
    setFileData({
      ...fileData,
      [label]: file,
    });
  };

  const validateForm = () => {
    // Only validate enabled fields
    const enabledFields = form.form_fields.filter(field => field.isEnabled !== false);
    for (const field of enabledFields) {
      if (field.required) {
        const value = formData[field.label];
        if (!value || (Array.isArray(value) && value.length === 0) || value.trim() === '') {
          return `${field.label} is required`;
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Convert form data to database field mapping
      const submissionData = {};

      // Map form fields to database columns (exclude admission_no for students)
      // Only process enabled fields
      const enabledFields = form.form_fields.filter(field => field.isEnabled !== false);
      enabledFields.forEach((field) => {
        if (field.type === 'file') {
          // Handle file uploads separately
          const file = fileData[field.label];
          if (file) {
            submissionData[field.key] = file.name; // Store filename for now
          }
        } else if (formData[field.label] !== undefined && formData[field.label] !== '' && field.key !== 'admission_no') {
          // Use the field key (database column name) as the key in submission data
          submissionData[field.key] = formData[field.label];
        }
      });

      // Don't send admission number - admin will assign it during approval
      await api.post(`/submissions/${formId}`, {
        formData: submissionData,
      });
      setSubmitted(true);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const commonClasses = 'w-full px-4 py-3 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-base sm:text-sm';

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={formData[field.label] || ''}
            onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
            className={commonClasses}
            placeholder={field.placeholder}
            rows="4"
            required={field.required}
          />
        );

      case 'select':
        return (
          <select
            value={formData[field.label] || ''}
            onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
            className={commonClasses}
            required={field.required}
          >
            <option value="">Select an option</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.label}
                  value={option}
                  checked={formData[field.label] === option}
                  onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  required={field.required}
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  value={option}
                  checked={(formData[field.label] || []).includes(option)}
                  onChange={(e) => handleInputChange(field.label, option, field.type)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'file':
        return (
          <div className="space-y-2">
            <input
              type="file"
              accept={field.accept || 'image/*'}
              onChange={(e) => handleFileChange(field.label, e.target.files[0])}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none file:mr-4 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              required={field.required}
            />
            {fileData[field.label] && (
              <p className="text-sm text-green-600">
                Selected: {fileData[field.label].name}
              </p>
            )}
          </div>
        );

      default:
        return (
          <input
            type={field.type}
            value={formData[field.label] || ''}
            onChange={(e) => {
              const value = e.target.value;
              // For tel/phone fields, limit to 10 digits
              if (field.type === 'tel') {
                const digitsOnly = value.replace(/\D/g, '');
                if (digitsOnly.length <= 10) {
                  handleInputChange(field.label, digitsOnly, field.type);
                }
              } else {
                handleInputChange(field.label, value, field.type);
              }
            }}
            onKeyPress={(e) => {
              // For tel/phone number fields, only allow numbers
              if (field.type === 'tel' && !/\d/.test(e.key)) {
                e.preventDefault();
              }
            }}
            pattern={field.type === 'tel' ? '[0-9]{10}' : undefined}
            maxLength={field.type === 'tel' ? 10 : undefined}
            className={commonClasses}
            placeholder={field.placeholder}
            required={field.required}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <LoadingAnimation
          size="xl"
          message="Loading form..."
          variant="overlay"
        />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="text-red-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Form Not Found</h2>
          <p className="text-gray-600 mb-4">{error}</p>

          {/* Debug information for troubleshooting */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-left bg-gray-50 rounded-lg p-4 mb-4 text-xs">
              <p className="font-medium mb-2">Troubleshooting Information:</p>
              <p><strong>Form ID:</strong> {formId}</p>
              <p><strong>API URL:</strong> /forms/public/{formId}</p>
              <p><strong>Full URL:</strong> {window.location.href}</p>
              <p><strong>Mobile:</strong> {isMobile ? 'Yes' : 'No'}</p>
              {isMobile && (
                <p><strong>Platform:</strong> {isIOS ? 'iOS' : isAndroid ? 'Android' : 'Unknown'}</p>
              )}
            </div>
          )}

          {/* Alternative access methods */}
          <div className="text-sm text-gray-600">
            <p className="mb-2">If this problem persists, try:</p>
            <ul className="text-left space-y-1">
              <li>• Check your internet connection</li>
              <li>• Refresh the page</li>
              <li>• Contact the administrator</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Submission Successful!</h2>
          <p className="text-gray-600 mb-6">
            Your form has been submitted successfully. It is now pending admin approval.
          </p>
          <p className="text-sm text-gray-500">
            You will be notified once your submission is reviewed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-4 px-4 sm:py-8">
      <div className="max-w-2xl mx-auto">
        {/* Debug info for development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
            <strong>Debug Info:</strong> Form ID: {formId} | URL: {window.location.href} | Mobile: {isMobile ? 'Yes' : 'No'}
            {isMobile && (
              <div className="mt-1">
                <strong>Mobile Details:</strong> iOS: {isIOS ? 'Yes' : 'No'} | Android: {isAndroid ? 'Yes' : 'No'}
              </div>
            )}
          </div>
        )}

        {/* Mobile-specific instructions */}
        {isMobile && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Mobile Access Instructions:</p>
                <p>If the form doesn't load properly, try refreshing the page or check your internet connection.</p>
              </div>
            </div>
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 break-words">{form.form_name}</h1>
            {form.form_description && (
              <p className="text-gray-600 text-sm sm:text-base">{form.form_description}</p>
            )}
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Form Fields</h3>
              <div className="space-y-5">
                {form.form_fields
                  .filter(field => field.isEnabled !== false) // Only show enabled fields
                  .map((field, index) => (
                    <div key={index}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
             <button
  type="submit"
  disabled={submitting}
  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-4 sm:py-3.5 px-6 rounded-xl font-semibold shadow-md hover:from-cyan-600 hover:to-blue-700 hover:shadow-lg focus:ring-4 focus:ring-cyan-200 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] relative overflow-hidden group text-base sm:text-sm min-h-[48px]"
>
  {/* Shine effect */}
  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

  {submitting ? (
    <>
      <Loader2 className="animate-spin" size={20} />
      <span className="text-sm font-medium">Submitting...</span>
    </>
  ) : (
    <span className="text-sm font-medium">Submit Form</span>
  )}
</button>

            </div>
          </form>
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          © 2025 Pydah Student Database Management System
        </p>
      </div>
    </div>
  );
};

export default PublicForm;
