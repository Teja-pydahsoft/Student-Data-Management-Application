import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../config/api';
import LoadingAnimation from '../components/LoadingAnimation';

const COURSE_FIELD_IDENTIFIERS = ['course', 'course name'];
const BRANCH_FIELD_IDENTIFIERS = ['branch', 'branch name'];
const YEAR_FIELD_IDENTIFIERS = ['current academic year', 'current year', 'year'];
const SEMESTER_FIELD_IDENTIFIERS = ['current semester', 'semester'];

const normalizeIdentifier = (value) =>
  value ? value.toString().toLowerCase().replace(/[_-]/g, ' ').trim() : '';

const matchesFieldIdentifier = (field, identifiers = []) => {
  const normalizedKey = normalizeIdentifier(field.key);
  const normalizedLabel = normalizeIdentifier(field.label);

  return identifiers.some((identifier) => {
    const normalizedIdentifier = identifier.toLowerCase();
    return (
      normalizedKey === normalizedIdentifier ||
      normalizedLabel === normalizedIdentifier ||
      normalizedLabel.includes(normalizedIdentifier) ||
      normalizedKey.includes(normalizedIdentifier)
    );
  });
};

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
  const [fetchingForm, setFetchingForm] = useState(false); // Prevent multiple simultaneous fetches
  const [formCache, setFormCache] = useState(new Map()); // Simple cache for form data
  const [retryCount, setRetryCount] = useState(0); // Track retry attempts
  const [courseOptions, setCourseOptions] = useState([]);
  const [courseOptionsLoading, setCourseOptionsLoading] = useState(true);

  // Mobile browser detection - moved to component level
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  // Separate useEffect for mobile detection - runs only once
  useEffect(() => {
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
    }
  }, []); // Empty dependency array - runs only once

  useEffect(() => {
    const loadCourseConfig = async () => {
      try {
        setCourseOptionsLoading(true);
        const response = await api.get('/courses/options');
        setCourseOptions(response.data.data || []);
      } catch (configError) {
        console.error('Failed to fetch course configuration', configError);
        // non-fatal for public form - just log toasts for admin environment
      } finally {
        setCourseOptionsLoading(false);
      }
    };

    loadCourseConfig();
  }, []);

  // Separate useEffect for form fetching - runs only when formId changes
  useEffect(() => {
    let abortController;

    if (formId) {
      // Create new abort controller for this request
      abortController = new AbortController();
      fetchForm(abortController);
    }

    // Cleanup function to abort request if component unmounts or formId changes
    return () => {
      if (abortController) {
        console.log('Aborting form fetch request');
        abortController.abort();
      }
    };
  }, [formId]); // Only depends on formId

  // Cleanup effect to clear cache on unmount
  useEffect(() => {
    return () => {
      // Clear cache when component unmounts to prevent memory leaks
      setFormCache(new Map());
      console.log('Form cache cleared on component unmount');
    };
  }, []);

  const fetchForm = async (abortController = null) => {
    // Check cache first
    const cachedForm = formCache.get(formId);
    if (cachedForm) {
      console.log('Using cached form data for ID:', formId);
      setForm(cachedForm);

      // Initialize form data for enabled fields only
      const initialData = {};
      const enabledFields = cachedForm.form_fields.filter(field => field.isEnabled !== false);
      enabledFields.forEach((field) => {
        initialData[field.label] = field.type === 'checkbox' ? [] : '';
      });
      setFormData(initialData);
      setLoading(false);
      return;
    }

    // Check if we already have the form data (avoid unnecessary fetch)
    if (form && form.form_id === formId && !loading) {
      console.log('Form already loaded, skipping fetch');
      setLoading(false);
      return;
    }

    // Prevent multiple simultaneous requests
    if (fetchingForm) {
      console.log('Form fetch already in progress, skipping duplicate request');
      return;
    }

    try {
      setFetchingForm(true);
      setError(null); // Clear any previous errors
      console.log('Fetching form with ID:', formId);

      const startTime = performance.now();
      const response = await api.get(`/forms/public/${formId}`, {
        signal: abortController?.signal
      });
      const endTime = performance.now();

      console.log(`Form fetched successfully in ${Math.round(endTime - startTime)}ms:`, response.data.data);

      // Reset retry count on successful fetch
      setRetryCount(0);

      // Cache the form data
      setFormCache(prev => new Map(prev).set(formId, response.data.data));
      setForm(response.data.data);

      // Initialize form data for enabled fields only
      const initialData = {};
      const enabledFields = response.data.data.form_fields.filter(field => field.isEnabled !== false);
      enabledFields.forEach((field) => {
        initialData[field.label] = field.type === 'checkbox' ? [] : '';
      });
      setFormData(initialData);

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Form fetch was aborted');
        return;
      }

      console.error(`Error fetching form (attempt ${retryCount + 1}):`, error);

      // Retry logic for network errors
      if (retryCount < 2 && (error.code === 'NETWORK_ERROR' || error.response?.status >= 500)) {
        console.log(`Retrying form fetch in 1 second... (attempt ${retryCount + 2})`);
        setRetryCount(prev => prev + 1);

        setTimeout(() => {
          if (!fetchingForm) {
            fetchForm(abortController);
          }
        }, 1000);
        return;
      }

      setError(error.response?.data?.message || 'Form not found or network error occurred');
    } finally {
      setFetchingForm(false);
      setLoading(false);
    }
  };

  const courseFieldLabels = useMemo(() => {
    if (!form?.form_fields) return [];
    return form.form_fields
      .filter((field) => matchesFieldIdentifier(field, COURSE_FIELD_IDENTIFIERS))
      .map((field) => field.label);
  }, [form]);

  const branchFieldLabels = useMemo(() => {
    if (!form?.form_fields) return [];
    return form.form_fields
      .filter((field) => matchesFieldIdentifier(field, BRANCH_FIELD_IDENTIFIERS))
      .map((field) => field.label);
  }, [form]);

  const availableCourses = useMemo(
    () => courseOptions.filter((course) => course?.isActive !== false),
    [courseOptions]
  );

  const yearFieldLabels = useMemo(() => {
    if (!form?.form_fields) return [];
    return form.form_fields
      .filter((field) => matchesFieldIdentifier(field, YEAR_FIELD_IDENTIFIERS))
      .map((field) => field.label);
  }, [form]);

  const semesterFieldLabels = useMemo(() => {
    if (!form?.form_fields) return [];
    return form.form_fields
      .filter((field) => matchesFieldIdentifier(field, SEMESTER_FIELD_IDENTIFIERS))
      .map((field) => field.label);
  }, [form]);

  const selectedCourseName = useMemo(() => {
    for (const label of courseFieldLabels) {
      const value = formData[label];
      if (value) {
        return value;
      }
    }
    return '';
  }, [courseFieldLabels, formData]);

  const selectedCourseOption = useMemo(() => {
    if (!selectedCourseName) return null;
    return (
      availableCourses.find(
        (course) => course.name?.toLowerCase() === selectedCourseName.toLowerCase()
      ) || null
    );
  }, [availableCourses, selectedCourseName]);

  const selectedBranchName = useMemo(() => {
    for (const label of branchFieldLabels) {
      const value = formData[label];
      if (value) {
        return value;
      }
    }
    return '';
  }, [branchFieldLabels, formData]);

  const selectedBranchOption = useMemo(() => {
    if (!selectedCourseOption || !selectedBranchName) return null;
    return (
      (selectedCourseOption.branches || []).find(
        (branch) => branch.name?.toLowerCase() === selectedBranchName.toLowerCase()
      ) || null
    );
  }, [selectedCourseOption, selectedBranchName]);

  const activeStructure = useMemo(() => {
    if (selectedBranchOption?.structure) {
      return selectedBranchOption.structure;
    }
    if (selectedCourseOption?.structure) {
      return selectedCourseOption.structure;
    }
    return null;
  }, [selectedBranchOption, selectedCourseOption]);

  const yearOptions = useMemo(() => {
    if (!activeStructure?.totalYears) {
      return ['1', '2', '3', '4'];
    }
    return Array.from(
      { length: activeStructure.totalYears },
      (_value, index) => String(index + 1)
    );
  }, [activeStructure]);

  const semesterOptions = useMemo(() => {
    if (!activeStructure?.semestersPerYear) {
      return ['1', '2'];
    }
    return Array.from(
      { length: activeStructure.semestersPerYear },
      (_value, index) => String(index + 1)
    );
  }, [activeStructure]);

  useEffect(() => {
    if (!activeStructure) return;

    const totalYears = Number(activeStructure.totalYears) || 0;
    const semestersPerYear = Number(activeStructure.semestersPerYear) || 0;

    setFormData((prev) => {
      let changed = false;
      const updated = { ...prev };

      yearFieldLabels.forEach((label) => {
        const value = prev[label];
        if (!value) {
          return;
        }
        const numericValue = Number(value);
        if (
          Number.isNaN(numericValue) ||
          numericValue < 1 ||
          (totalYears > 0 && numericValue > totalYears)
        ) {
          updated[label] = '';
          changed = true;
        }
      });

      semesterFieldLabels.forEach((label) => {
        const value = prev[label];
        if (!value) {
          return;
        }
        const numericValue = Number(value);
        if (
          Number.isNaN(numericValue) ||
          numericValue < 1 ||
          (semestersPerYear > 0 && numericValue > semestersPerYear)
        ) {
          updated[label] = '';
          changed = true;
        }
      });

      return changed ? updated : prev;
    });
  }, [activeStructure, yearFieldLabels, semesterFieldLabels]);

  const handleInputChange = (label, value, type) => {
    if (type === 'checkbox') {
      setFormData((prev) => {
        const currentValues = prev[label] || [];
        if (currentValues.includes(value)) {
          return {
            ...prev,
            [label]: currentValues.filter((v) => v !== value),
          };
        }
        return {
          ...prev,
          [label]: [...currentValues, value],
        };
      });
    } else {
      setFormData((prev) => {
        const updated = { ...prev, [label]: value };

        if (courseFieldLabels.includes(label)) {
          branchFieldLabels.forEach((branchLabel) => {
            updated[branchLabel] = '';
          });
          yearFieldLabels.forEach((yearLabel) => {
            updated[yearLabel] = '';
          });
          semesterFieldLabels.forEach((semesterLabel) => {
            updated[semesterLabel] = '';
          });
        }

        if (branchFieldLabels.includes(label)) {
          yearFieldLabels.forEach((yearLabel) => {
            updated[yearLabel] = '';
          });
          semesterFieldLabels.forEach((semesterLabel) => {
            updated[semesterLabel] = '';
          });
        }

        return updated;
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
        if (field.key.toLowerCase().includes('photo')) {
          // For photo fields, check if file is selected
          if (!fileData[field.label]) {
            return `${field.label} is required`;
          }
        } else {
          const value = formData[field.label];
          if (!value || (Array.isArray(value) && value.length === 0) || value.trim() === '') {
            return `${field.label} is required`;
          }
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
      // Create FormData for multipart submission
      const submissionData = new FormData();

      // Map form fields to database columns (exclude admission_no for students)
      // Only process enabled fields
      const enabledFields = form.form_fields.filter(field => field.isEnabled !== false);
      enabledFields.forEach((field) => {
        if (field.type === 'file' || field.key.toLowerCase().includes('photo')) {
          // Handle file uploads
          const file = fileData[field.label];
          if (file) {
            submissionData.append(field.key, file);
          }
        } else if (formData[field.label] !== undefined && formData[field.label] !== '' && field.key !== 'admission_no') {
          // Use the field key (database column name) as the key in submission data
          submissionData.append(field.key, formData[field.label]);
        }
      });

      // Don't send admission number - admin will assign it during approval
      await api.post(`/submissions/${formId}`, submissionData);
      setSubmitted(true);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const commonClasses = 'w-full px-4 py-3 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-base sm:text-sm';

    if (matchesFieldIdentifier(field, COURSE_FIELD_IDENTIFIERS) && availableCourses.length > 0) {
      return (
        <select
          value={formData[field.label] || ''}
          onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
          className={commonClasses}
          required={field.required}
        >
          <option value="">Select Course</option>
          {availableCourses.map((course) => (
            <option key={course.code || course.name} value={course.name}>
              {course.name}
            </option>
          ))}
        </select>
      );
    }

    if (matchesFieldIdentifier(field, BRANCH_FIELD_IDENTIFIERS) && selectedCourseOption) {
      const availableBranches = (selectedCourseOption.branches || []).filter(
        (branch) => branch.isActive
      );

      if (availableBranches.length === 0) {
        return (
          <input
            type="text"
            value={formData[field.label] || ''}
            onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
            className={commonClasses}
            placeholder="Enter branch"
            required={field.required}
          />
        );
      }

      return (
        <select
          value={formData[field.label] || ''}
          onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
          className={commonClasses}
          required={field.required}
        >
          <option value="">Select Branch</option>
          {availableBranches.map((branch) => (
            <option key={branch.code || branch.name} value={branch.name}>
              {branch.name}
            </option>
          ))}
        </select>
      );
    }

    if (matchesFieldIdentifier(field, YEAR_FIELD_IDENTIFIERS)) {
      return (
        <select
          value={formData[field.label] || ''}
          onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
          className={commonClasses}
          required={field.required}
        >
          <option value="">Select Year</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              Year {year}
            </option>
          ))}
        </select>
      );
    }

    if (matchesFieldIdentifier(field, SEMESTER_FIELD_IDENTIFIERS)) {
      return (
        <select
          value={formData[field.label] || ''}
          onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
          className={commonClasses}
          required={field.required}
        >
          <option value="">Select Semester</option>
          {semesterOptions.map((semester) => (
            <option key={semester} value={semester}>
              Semester {semester}
            </option>
          ))}
        </select>
      );
    }

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
              name={field.key}
              accept={field.accept || 'image/*'}
              capture={field.accept && field.accept.includes('image') ? 'camera' : undefined}
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
        // Special handling for photo fields that might be misconfigured as text
        if (field.key.toLowerCase().includes('photo')) {
          return (
            <div className="space-y-2">
              <input
                type="file"
                name={field.key}
                accept="image/*"
                capture="camera"
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
        }
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

  if (loading || fetchingForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <LoadingAnimation
            width={32}
            height={32}
            message={fetchingForm ? "Loading form..." : "Please wait..."}
            variant="minimal"
          />
        </div>
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
            <div className="mt-1">
              <strong>Performance:</strong> Fetching: {fetchingForm ? 'Yes' : 'No'} | Cached: {formCache.has(formId) ? 'Yes' : 'No'} | Retries: {retryCount}
            </div>
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
          <div className="mb-6 text-center">
            <img
              src="/logo.png"
              alt="Pydah DB Logo"
              className="h-16 w-auto max-w-full object-contain mx-auto mb-4"
              loading="lazy"
            />
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
      <Loader2 className="animate-spin text-blue-600" size={20} />
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
