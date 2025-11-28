import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2, Upload } from 'lucide-react';
import api from '../config/api';
import toast, { Toaster } from 'react-hot-toast';
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

// Field category mappings
const BASIC_FIELDS = ['student_name', 'father_name', 'gender', 'dob', 'adhar_no', 'pin_no'];
const ACADEMIC_FIELDS = ['college', 'batch', 'course', 'branch', 'current_year', 'current_semester', 'stud_type', 'student_status', 'scholar_status', 'previous_college'];
const CONTACT_FIELDS = ['student_mobile', 'parent_mobile1', 'parent_mobile2'];
const ADDRESS_FIELDS = ['student_address', 'city_village', 'mandal_name', 'district'];
const ADDITIONAL_FIELDS = ['caste', 'certificates_status', 'remarks', 'student_photo'];

const categorizeField = (field) => {
  const key = field.key?.toLowerCase() || '';
  const label = field.label?.toLowerCase() || '';
  
  if (BASIC_FIELDS.some(f => key.includes(f) || label.includes(f.replace('_', ' ')))) return 'basic';
  if (ACADEMIC_FIELDS.some(f => key.includes(f) || label.includes(f.replace('_', ' ')))) return 'academic';
  if (CONTACT_FIELDS.some(f => key.includes(f) || label.includes(f.replace('_', ' ')))) return 'contact';
  if (ADDRESS_FIELDS.some(f => key.includes(f) || label.includes(f.replace('_', ' ')))) return 'address';
  if (ADDITIONAL_FIELDS.some(f => key.includes(f) || label.includes(f.replace('_', ' ')))) return 'additional';
  return 'other';
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
  const [fetchingForm, setFetchingForm] = useState(false);
  const [formCache, setFormCache] = useState(new Map());
  const [retryCount, setRetryCount] = useState(0);
  const [courseOptions, setCourseOptions] = useState([]);
  const [courseOptionsLoading, setCourseOptionsLoading] = useState(true);
  
  // Additional state for structured form
  const [colleges, setColleges] = useState([]);
  const [collegesLoading, setCollegesLoading] = useState(true);
  const [academicYears, setAcademicYears] = useState([]);
  const [academicYearsLoading, setAcademicYearsLoading] = useState(true);
  const [selectedCollegeId, setSelectedCollegeId] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Mobile browser detection - moved to component level
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  // Mobile detection for optimizations
  useEffect(() => {
    if (isMobile) {
      document.body.classList.add('mobile-optimized');
      // Prevent zoom on input focus for iOS
      if (isIOS) {
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }
      }
    }
  }, []);

  // Load all dropdown data in parallel for faster loading (using public endpoints)
  useEffect(() => {
    const loadAllData = async () => {
      try {
        // Fetch all data in parallel using Promise.allSettled - use public endpoints
        const [coursesRes, collegesRes, yearsRes] = await Promise.allSettled([
          api.get('/courses/options'),
          api.get('/colleges/public'),
          api.get('/academic-years/public')
        ]);

        // Process results
        if (coursesRes.status === 'fulfilled') {
          setCourseOptions(coursesRes.value.data.data || []);
        }
        if (collegesRes.status === 'fulfilled') {
          setColleges(collegesRes.value.data.data || []);
        }
        if (yearsRes.status === 'fulfilled') {
          setAcademicYears(yearsRes.value.data.data || []);
        }
      } catch (error) {
        // Silent fail - dropdowns will show text inputs as fallback
      } finally {
        setCourseOptionsLoading(false);
        setCollegesLoading(false);
        setAcademicYearsLoading(false);
      }
    };

    loadAllData();
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
        abortController.abort();
      }
    };
  }, [formId]); // Only depends on formId

  // Cleanup effect to clear cache on unmount
  useEffect(() => {
    return () => {
      setFormCache(new Map());
    };
  }, []);

  const fetchForm = async (abortController = null) => {
    // Check cache first
    const cachedForm = formCache.get(formId);
    if (cachedForm) {
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
      setLoading(false);
      return;
    }

    // Prevent multiple simultaneous requests
    if (fetchingForm) {
      return;
    }

    try {
      setFetchingForm(true);
      setError(null); // Clear any previous errors

      const response = await api.get(`/forms/public/${formId}`, {
        signal: abortController?.signal
      });

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
        return;
      }

      // Retry logic for network errors
      if (retryCount < 2 && (error.code === 'NETWORK_ERROR' || error.response?.status >= 500)) {
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

  const selectedYear = useMemo(() => {
    for (const label of yearFieldLabels) {
      const value = formData[label];
      if (value) {
        return Number(value) || 0;
      }
    }
    return 0;
  }, [yearFieldLabels, formData]);

  const semesterOptions = useMemo(() => {
    // Check if structure has per-year semester configuration
    if (activeStructure?.years && Array.isArray(activeStructure.years) && selectedYear > 0) {
      const yearConfig = activeStructure.years.find(y => y.yearNumber === selectedYear);
      if (yearConfig && yearConfig.semesters && Array.isArray(yearConfig.semesters)) {
        return yearConfig.semesters.map(sem => String(sem.semesterNumber));
      }
    }
    
    // Fallback to default semestersPerYear
    if (!activeStructure?.semestersPerYear) {
      return ['1', '2'];
    }
    return Array.from(
      { length: activeStructure.semestersPerYear },
      (_value, index) => String(index + 1)
    );
  }, [activeStructure, selectedYear, yearFieldLabels]);

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
    const commonClasses = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm';
    const fieldKey = field.key?.toLowerCase() || '';
    const fieldLabel = field.label?.toLowerCase() || '';

    // College dropdown
    if (fieldKey.includes('college') || fieldLabel.includes('college')) {
      if (collegesLoading) {
        return (
          <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 flex items-center gap-2 text-sm">
            <LoadingAnimation width={16} height={16} showMessage={false} variant="inline" />
            Loading colleges...
          </div>
        );
      }
      return (
        <select
          value={formData[field.label] || ''}
          onChange={(e) => {
            handleInputChange(field.label, e.target.value, field.type);
            // Find college ID for course filtering
            const college = colleges.find(c => c.name === e.target.value);
            setSelectedCollegeId(college?.id || null);
          }}
          className={commonClasses}
          required={field.required}
        >
          <option value="">Select College</option>
          {colleges.filter(c => c.isActive !== false).map((college) => (
            <option key={college.id} value={college.name}>
              {college.name}
            </option>
          ))}
        </select>
      );
    }

    // Batch/Academic Year dropdown
    if (fieldKey.includes('batch') || fieldLabel.includes('batch') || fieldLabel.includes('academic year')) {
      if (academicYearsLoading) {
        return (
          <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 flex items-center gap-2 text-sm">
            <LoadingAnimation width={16} height={16} showMessage={false} variant="inline" />
            Loading batches...
          </div>
        );
      }
      if (academicYears.length > 0) {
        return (
          <select
            value={formData[field.label] || ''}
            onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
            className={commonClasses}
            required={field.required}
          >
            <option value="">Select Batch</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.yearLabel}>
                {year.yearLabel}
              </option>
            ))}
          </select>
        );
      }
    }

    // Course dropdown
    if (matchesFieldIdentifier(field, COURSE_FIELD_IDENTIFIERS) && availableCourses.length > 0) {
      if (courseOptionsLoading) {
        return (
          <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 flex items-center gap-2 text-sm">
            <LoadingAnimation width={16} height={16} showMessage={false} variant="inline" />
            Loading courses...
          </div>
        );
      }
      return (
        <select
          value={formData[field.label] || ''}
          onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
          className={commonClasses}
          required={field.required}
        >
          <option value="">Select Course</option>
          {availableCourses.map((course) => (
            <option key={course.name} value={course.name}>
              {course.name}
            </option>
          ))}
        </select>
      );
    }

    // Branch dropdown
    if (matchesFieldIdentifier(field, BRANCH_FIELD_IDENTIFIERS)) {
      const availableBranches = selectedCourseOption 
        ? (selectedCourseOption.branches || []).filter((branch) => branch.isActive)
        : [];

      if (availableBranches.length === 0) {
        return (
          <input
            type="text"
            value={formData[field.label] || ''}
            onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
            className={commonClasses}
            placeholder={selectedCourseOption ? "No branches configured" : "Select a course first"}
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
            <option key={branch.name} value={branch.name}>
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

    // Gender dropdown
    if (fieldKey.includes('gender') || fieldLabel.includes('gender') || fieldLabel.includes('m/f')) {
      return (
        <select
          value={formData[field.label] || ''}
          onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
          className={commonClasses}
          required={field.required}
        >
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      );
    }

    // Student Type dropdown
    if (fieldKey.includes('stud_type') || fieldKey.includes('studtype') || fieldLabel.includes('student type')) {
      return (
        <select
          value={formData[field.label] || ''}
          onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
          className={commonClasses}
          required={field.required}
        >
          <option value="">Select Student Type</option>
          <option value="CONV">CONV</option>
          <option value="LATER">LATER</option>
          <option value="LSPOT">LSPOT</option>
          <option value="MANG">MANG</option>
        </select>
      );
    }

    // Student Status dropdown
    if (fieldKey.includes('student_status') || fieldLabel.includes('student status')) {
      return (
        <select
          value={formData[field.label] || ''}
          onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
          className={commonClasses}
          required={field.required}
        >
          <option value="">Select Status</option>
          <option value="Regular">Regular</option>
          <option value="Discontinued from the second year">Discontinued from the second year</option>
          <option value="Discontinued from the third year">Discontinued from the third year</option>
          <option value="Discontinued from the fourth year">Discontinued from the fourth year</option>
          <option value="Admission Cancelled">Admission Cancelled</option>
          <option value="Long Absent">Long Absent</option>
          <option value="Detained">Detained</option>
        </select>
      );
    }

    // Scholar Status dropdown
    if (fieldKey.includes('scholar_status') || fieldLabel.includes('scholar status')) {
      return (
        <select
          value={formData[field.label] || ''}
          onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
          className={commonClasses}
          required={field.required}
        >
          <option value="">Select Scholar Status</option>
          <option value="Eligible">Eligible</option>
          <option value="Not Eligible">Not Eligible</option>
        </select>
      );
    }

    // Caste dropdown
    if (fieldKey.includes('caste') || fieldLabel.includes('caste')) {
      return (
        <select
          value={formData[field.label] || ''}
          onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
          className={commonClasses}
          required={field.required}
        >
          <option value="">Select Caste</option>
          <option value="OC">OC</option>
          <option value="BC-A">BC-A</option>
          <option value="BC-B">BC-B</option>
          <option value="BC-C">BC-C</option>
          <option value="BC-D">BC-D</option>
          <option value="BC-E">BC-E</option>
          <option value="SC">SC</option>
          <option value="ST">ST</option>
          <option value="EWS">EWS</option>
          <option value="Other">Other</option>
        </select>
      );
    }

    // Certificates Status dropdown
    if (fieldKey.includes('certificate') || fieldLabel.includes('certificate')) {
      return (
        <select
          value={formData[field.label] || ''}
          onChange={(e) => handleInputChange(field.label, e.target.value, field.type)}
          className={commonClasses}
          required={field.required}
        >
          <option value="">Select Certificate Status</option>
          <option value="Submitted">Submitted</option>
          <option value="Pending">Pending</option>
          <option value="Partial">Partial</option>
          <option value="Originals Returned">Originals Returned</option>
          <option value="Not Required">Not Required</option>
        </select>
      );
    }

    // Photo upload with preview
    if (fieldKey.includes('photo') || fieldLabel.includes('photo')) {
      return (
        <div className="space-y-2">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-400 transition-colors bg-gray-50">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error('File size should be less than 5MB');
                    return;
                  }
                  handleFileChange(field.label, file);
                  // Create preview
                  const reader = new FileReader();
                  reader.onloadend = () => setPhotoPreview(reader.result);
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
              id="photo-upload-public"
            />
            <label htmlFor="photo-upload-public" className="cursor-pointer flex flex-col items-center gap-2">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg border-2 border-purple-300" />
              ) : (
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Upload className="w-6 h-6 text-purple-600" />
                </div>
              )}
              <p className="text-sm font-medium text-gray-700">
                {photoPreview ? 'Change Photo' : 'Upload Photo'}
              </p>
              <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
            </label>
          </div>
        </div>
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <LoadingAnimation
            width={32}
            height={32}
            message="Loading form..."
            variant="minimal"
          />
        </div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="text-red-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Form Not Found</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="text-sm text-gray-600">
            <p className="mb-2">Please try:</p>
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-4 px-4 sm:py-6 lg:py-8">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white p-6">
            <div className="flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Pydah DB Logo"
                className="h-14 w-auto object-contain bg-white/20 rounded-lg p-1"
                loading="lazy"
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold break-words">{form.form_name}</h1>
                {form.form_description && (
                  <p className="text-purple-100 text-sm mt-1">{form.form_description}</p>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-4 sm:p-6 lg:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Categorize fields */}
            {(() => {
              const enabledFields = form.form_fields.filter(field => field.isEnabled !== false);
              const basicFields = enabledFields.filter(f => categorizeField(f) === 'basic');
              const academicFields = enabledFields.filter(f => categorizeField(f) === 'academic');
              const contactFields = enabledFields.filter(f => categorizeField(f) === 'contact');
              const addressFields = enabledFields.filter(f => categorizeField(f) === 'address');
              const additionalFields = enabledFields.filter(f => categorizeField(f) === 'additional');
              const otherFields = enabledFields.filter(f => categorizeField(f) === 'other');

              return (
                <>
                  {/* Basic Information */}
                  {basicFields.length > 0 && (
                    <div className="border-b border-gray-200 pb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {basicFields.map((field, index) => (
                          <div key={index}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {renderField(field)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Academic Information */}
                  {academicFields.length > 0 && (
                    <div className="border-b border-gray-200 pb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        Academic Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {academicFields.map((field, index) => (
                          <div key={index}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {renderField(field)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contact Information */}
                  {contactFields.length > 0 && (
                    <div className="border-b border-gray-200 pb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        Contact Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {contactFields.map((field, index) => (
                          <div key={index}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {renderField(field)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Address Information */}
                  {addressFields.length > 0 && (
                    <div className="border-b border-gray-200 pb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        Address Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {addressFields.map((field, index) => (
                          <div key={index}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {renderField(field)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Information */}
                  {(additionalFields.length > 0 || otherFields.length > 0) && (
                    <div className="pb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        Additional Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...additionalFields, ...otherFields].map((field, index) => (
                          <div key={index} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {renderField(field)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-6 rounded-xl font-semibold shadow-md hover:from-purple-700 hover:to-indigo-700 hover:shadow-lg focus:ring-4 focus:ring-purple-200 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    <span>Submit for Approval</span>
                  </>
                )}
              </button>
            </div>
          </form>
          </div>
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          © 2025 Pydah Student Database Management System
        </p>
      </div>
    </div>
  );
};

export default PublicForm;
