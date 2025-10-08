import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../config/api';

const PublicForm = () => {
  const { formId } = useParams();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({});
  const [admissionNumber, setAdmissionNumber] = useState('');

  useEffect(() => {
    fetchForm();
  }, [formId]);

  const fetchForm = async () => {
    try {
      const response = await api.get(`/forms/public/${formId}`);
      setForm(response.data.data);
      
      // Initialize form data
      const initialData = {};
      response.data.data.form_fields.forEach((field) => {
        initialData[field.label] = field.type === 'checkbox' ? [] : '';
      });
      setFormData(initialData);
    } catch (error) {
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

  const validateForm = () => {
    for (const field of form.form_fields) {
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
      await api.post(`/submissions/${formId}`, {
        admissionNumber: admissionNumber.trim() || null,
        formData,
      });
      setSubmitted(true);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const commonClasses = 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none';

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
          <p className="text-gray-600">{error}</p>
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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{form.form_name}</h1>
            {form.form_description && (
              <p className="text-gray-600">{form.form_description}</p>
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
                {form.form_fields.map((field, index) => (
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
                className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Submitting...
                  </>
                ) : (
                  'Submit Form'
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          © 2025 Student Database Management System
        </p>
      </div>
    </div>
  );
};

export default PublicForm;
