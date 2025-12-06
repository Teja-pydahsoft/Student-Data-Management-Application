import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload, FileText } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';

// Dropdown options for student fields
const STUDENT_TYPE_OPTIONS = ['CONV', 'LATER', 'LSPOT', 'MANG'];
const STUDENT_STATUS_OPTIONS = [
  'Regular',
  'Discontinued from the second year',
  'Discontinued from the third year',
  'Discontinued from the fourth year',
  'Admission Cancelled',
  'Long Absent',
  'Detained'
];
const SCHOLAR_STATUS_OPTIONS = ['Eligible', 'Not Eligible'];
const CASTE_OPTIONS = ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS', 'Other'];
const CERTIFICATES_STATUS_OPTIONS = ['Submitted', 'Pending', 'Partial', 'Originals Returned', 'Not Required'];

const AddStudent = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [colleges, setColleges] = useState([]);
  const [collegesLoading, setCollegesLoading] = useState(true);
  const [selectedCollegeId, setSelectedCollegeId] = useState(null);
  const [courseOptions, setCourseOptions] = useState([]);
  const [courseOptionsLoading, setCourseOptionsLoading] = useState(true);
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [selectedBranchName, setSelectedBranchName] = useState('');
  const [academicYears, setAcademicYears] = useState([]);
  const [academicYearsLoading, setAcademicYearsLoading] = useState(true);
  const [admissionNumberLoading, setAdmissionNumberLoading] = useState(false);
  const [isAdmissionNumberManual, setIsAdmissionNumberManual] = useState(false);
  
  // Document upload state
  const [enableDocumentUpload, setEnableDocumentUpload] = useState(false);
  const [documentRequirements, setDocumentRequirements] = useState([]);
  const [documentFiles, setDocumentFiles] = useState({});
  const [documentRequirementsLoading, setDocumentRequirementsLoading] = useState(false);
  
  const [studentData, setStudentData] = useState({
    pin_no: '',
    current_year: '1',
    current_semester: '1',
    batch: '',
    college: '',
    course: '',
    branch: '',
    stud_type: '',
    student_name: '',
    student_status: '',
    scholar_status: '',
    student_mobile: '',
    parent_mobile1: '',
    parent_mobile2: '',
    caste: '',
    gender: '',
    father_name: '',
    dob: '',
    adhar_no: '',
    admission_no: '',
    student_address: '',
    city_village: '',
    mandal_name: '',
    district: '',
    previous_college: '',
    certificates_status: '',
    student_photo: '',
    remarks: ''
  });

  useEffect(() => {
    const loadColleges = async () => {
      try {
        setCollegesLoading(true);
        const response = await api.get('/colleges');
        const collegeData = response.data.data || [];
        setColleges(collegeData);
        
        // Auto-select college if only one is available (for scoped users)
        if (collegeData.length === 1) {
          const singleCollege = collegeData[0];
          setSelectedCollegeId(singleCollege.id);
          setStudentData((prev) => ({
            ...prev,
            college: singleCollege.name
          }));
        }
      } catch (error) {
        console.error('Failed to load colleges', error);
        toast.error(error.response?.data?.message || 'Failed to load colleges');
      } finally {
        setCollegesLoading(false);
      }
    };

    const loadAcademicYears = async () => {
      try {
        setAcademicYearsLoading(true);
        const response = await api.get('/academic-years/active');
        setAcademicYears(response.data.data || []);
      } catch (error) {
        console.error('Failed to load academic years', error);
        // Don't show error - might not have the table yet
      } finally {
        setAcademicYearsLoading(false);
      }
    };

    loadColleges();
    loadAcademicYears();
  }, []);

  // Determine course type (UG or PG) based on course name
  const courseType = useMemo(() => {
    if (!studentData.course) return null;
    const courseNameLower = studentData.course.toLowerCase();
    if (courseNameLower.includes('pg') || courseNameLower.includes('post graduate') || courseNameLower.includes('m.tech') || courseNameLower.includes('mtech')) {
      return 'PG';
    }
    return 'UG';
  }, [studentData.course]);

  // Fetch document requirements when course type changes and upload is enabled
  useEffect(() => {
    if (!courseType || !enableDocumentUpload) {
      setDocumentRequirements([]);
      return;
    }

    const fetchDocumentRequirements = async () => {
      try {
        setDocumentRequirementsLoading(true);
        const stages = courseType === 'PG' ? ['10th', 'Inter', 'Diploma', 'UG'] : ['10th', 'Inter', 'Diploma'];
        const allRequirements = [];
        
        for (const stage of stages) {
          try {
            const response = await api.get(`/settings/documents/${courseType}/${stage}`);
            if (response.data.success && response.data.data) {
              allRequirements.push(response.data.data);
            }
          } catch (error) {
            console.log(`No requirements for ${courseType}/${stage}`);
          }
        }
        
        setDocumentRequirements(allRequirements);
      } catch (error) {
        console.error('Error fetching document requirements:', error);
      } finally {
        setDocumentRequirementsLoading(false);
      }
    };

    fetchDocumentRequirements();
  }, [courseType, enableDocumentUpload]);

  const handleDocumentFileChange = (documentName, file) => {
    setDocumentFiles({
      ...documentFiles,
      [documentName]: file,
    });
  };

  useEffect(() => {
    const loadCourseConfig = async () => {
      try {
        setCourseOptionsLoading(true);
        // Always use the scoped /courses endpoint to respect user's assigned scope
        const url = selectedCollegeId 
          ? `/courses?collegeId=${selectedCollegeId}&includeInactive=false`
          : '/courses?includeInactive=false';
        const response = await api.get(url);
        const courseData = response.data.data || [];
        setCourseOptions(courseData);
        
        // Auto-select course if only one is available (for scoped users)
        const activeCourses = courseData.filter((course) => course?.isActive !== false);
        if (activeCourses.length === 1) {
          const singleCourse = activeCourses[0];
          setSelectedCourseName(singleCourse.name);
          setStudentData((prev) => ({
            ...prev,
            course: singleCourse.name
          }));
          
          // Also auto-select branch if only one is available
          const activeBranches = (singleCourse.branches || []).filter((b) => b?.isActive !== false);
          if (activeBranches.length === 1) {
            const singleBranch = activeBranches[0];
            setSelectedBranchName(singleBranch.name);
            setStudentData((prev) => ({
              ...prev,
              branch: singleBranch.name
            }));
          }
        }
      } catch (error) {
        console.error('Failed to load course configuration', error);
        toast.error(error.response?.data?.message || 'Failed to load course configuration');
      } finally {
        setCourseOptionsLoading(false);
      }
    };

    loadCourseConfig();
  }, [selectedCollegeId]);

  const availableCourses = useMemo(
    () => courseOptions.filter((course) => course?.isActive !== false),
    [courseOptions]
  );

  const selectedCourse = useMemo(() => {
    if (!selectedCourseName) return null;
    return (
      availableCourses.find(
        (course) => course.name?.toLowerCase() === selectedCourseName.toLowerCase()
      ) || null
    );
  }, [availableCourses, selectedCourseName]);

  const branchOptions = useMemo(() => {
    if (!selectedCourse) return [];
    let branches = (selectedCourse.branches || []).filter(
      (branch) => branch?.isActive !== false
    );
    
    // Always deduplicate branches by name to avoid showing duplicates
    const branchMap = new Map();
    
    if (studentData.batch) {
      // If batch is selected, filter and prefer batch-specific branches
      const matchingBranches = branches.filter(
        (branch) => branch.academicYearLabel === studentData.batch || !branch.academicYearLabel
      );
      
      matchingBranches.forEach(branch => {
        const existing = branchMap.get(branch.name);
        // Prefer batch-specific branch over generic one
        if (!existing || branch.academicYearLabel === studentData.batch) {
          branchMap.set(branch.name, branch);
        }
      });
    } else {
      // If no batch selected, just deduplicate by name (show unique branch names)
      branches.forEach(branch => {
        if (!branchMap.has(branch.name)) {
          branchMap.set(branch.name, branch);
        }
      });
    }
    
    return Array.from(branchMap.values());
  }, [selectedCourse, studentData.batch]);

  const selectedBranch = useMemo(
    () =>
      branchOptions.find(
        (branch) =>
          branch.name?.toLowerCase() === selectedBranchName.toLowerCase()
      ) || null,
    [branchOptions, selectedBranchName]
  );

  // Auto-select branch if only one is available (for scoped users)
  useEffect(() => {
    if (branchOptions.length === 1 && !selectedBranchName) {
      const singleBranch = branchOptions[0];
      setSelectedBranchName(singleBranch.name);
      setStudentData((prev) => ({
        ...prev,
        branch: singleBranch.name
      }));
    }
  }, [branchOptions, selectedBranchName]);

  const activeStructure = useMemo(() => {
    if (selectedBranch?.structure) return selectedBranch.structure;
    if (selectedCourse?.structure) return selectedCourse.structure;
    return null;
  }, [selectedBranch, selectedCourse]);

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
    // Get selected year
    const selectedYear = Number(studentData.current_year) || 0;
    
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
  }, [activeStructure, studentData.current_year]);

  // Reset branch selection when batch changes (as branches are filtered by batch)
  useEffect(() => {
    if (selectedBranchName && branchOptions.length > 0) {
      const branchStillValid = branchOptions.some(
        (branch) => branch.name?.toLowerCase() === selectedBranchName.toLowerCase()
      );
      if (!branchStillValid) {
        setSelectedBranchName('');
        setStudentData((prev) => ({ ...prev, branch: '' }));
      }
    }
    
    // Auto-select first branch if only one option available for this batch
    if (!selectedBranchName && branchOptions.length === 1) {
      setSelectedBranchName(branchOptions[0].name);
    }
  }, [studentData.batch, branchOptions, selectedBranchName]);

  useEffect(() => {
    if (!selectedCourse) {
      if (selectedCourseName) {
        setSelectedCourseName('');
      }
      if (studentData.course !== '') {
        setStudentData((prev) => ({ ...prev, course: '' }));
      }
      if (selectedBranchName) {
        setSelectedBranchName('');
      }
      return;
    }

    setStudentData((prev) =>
      prev.course === selectedCourse.name
        ? prev
        : { ...prev, course: selectedCourse.name }
    );

    if (
      selectedBranchName &&
      !branchOptions.some(
        (branch) =>
          branch.name?.toLowerCase() === selectedBranchName.toLowerCase()
      )
    ) {
      setSelectedBranchName('');
    }

    if (!selectedBranchName && branchOptions.length === 1) {
      setSelectedBranchName(branchOptions[0].name);
    }
  }, [selectedCourse, branchOptions, selectedCourseName, selectedBranchName, studentData.course]);

  useEffect(() => {
    if (selectedBranch) {
      setStudentData((prev) =>
        prev.branch === selectedBranch.name
          ? prev
          : { ...prev, branch: selectedBranch.name }
      );
    } else if (studentData.branch) {
      setStudentData((prev) =>
        prev.branch === ''
          ? prev
          : { ...prev, branch: '' }
      );
    }
  }, [selectedBranch, studentData.branch]);

  // Auto-generate admission number when batch changes
  useEffect(() => {
    const generateAdmissionNumber = async () => {
      // Don't generate if no batch selected or if user manually entered an admission number
      if (!studentData.batch || isAdmissionNumberManual) {
        return;
      }

      try {
        setAdmissionNumberLoading(true);
        const response = await api.post('/submissions/generate-admission-series', {
          academicYear: studentData.batch
        });

        if (response.data.success && response.data.data.admissionNumbers?.[0]) {
          const generatedNumber = response.data.data.admissionNumbers[0];
          setStudentData((prev) => ({
            ...prev,
            admission_no: generatedNumber
          }));
        }
      } catch (error) {
        console.error('Failed to generate admission number:', error);
        // Don't show error toast - just let user enter manually if API fails
      } finally {
        setAdmissionNumberLoading(false);
      }
    };

    generateAdmissionNumber();
  }, [studentData.batch, isAdmissionNumberManual]);

  // Auto-calculate current year based on batch year
  useEffect(() => {
    if (!studentData.batch || !activeStructure) {
      return;
    }

    const batchYear = parseInt(studentData.batch, 10);
    const currentCalendarYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    
    // Calculate which academic year the student should be in
    // Assuming academic year starts in June
    let calculatedYear = currentCalendarYear - batchYear + 1;
    if (currentMonth < 6) {
      // Before June, student is still in the previous academic year
      calculatedYear = calculatedYear - 1;
    }
    
    const totalYears = Number(activeStructure.totalYears) || 4;
    const semestersPerYear = Number(activeStructure.semestersPerYear) || 2;
    
    // Clamp to valid range
    calculatedYear = Math.max(1, Math.min(calculatedYear, totalYears));
    
    // Calculate current semester (default to 1 for first half, 2 for second half of academic year)
    let calculatedSemester = 1;
    if (currentMonth >= 6 && currentMonth <= 11) {
      calculatedSemester = 1; // First semester (June - November)
    } else {
      calculatedSemester = Math.min(2, semestersPerYear); // Second semester (December - May)
    }

    setStudentData((prev) => {
      const shouldUpdate = 
        prev.current_year !== String(calculatedYear) || 
        prev.current_semester !== String(calculatedSemester);
      
      if (shouldUpdate) {
        return {
          ...prev,
          current_year: String(calculatedYear),
          current_semester: String(calculatedSemester)
        };
      }
      return prev;
    });
  }, [studentData.batch, activeStructure]);

  useEffect(() => {
    if (!activeStructure) {
      return;
    }

    const totalYears = Number(activeStructure.totalYears) || 0;
    const semestersPerYear = Number(activeStructure.semestersPerYear) || 0;

    setStudentData((prev) => {
      const updated = { ...prev };
      let changed = false;

      if (totalYears > 0) {
        const currentYear = Number(prev.current_year) || 1;
        if (currentYear < 1 || currentYear > totalYears) {
          updated.current_year = String(Math.min(Math.max(1, currentYear), totalYears));
          changed = true;
        }
      }

      if (semestersPerYear > 0) {
        const currentSemester = Number(prev.current_semester) || 1;
        if (currentSemester < 1 || currentSemester > semestersPerYear) {
          updated.current_semester = String(
            Math.min(Math.max(1, currentSemester), semestersPerYear)
          );
          changed = true;
        }
      }

      return changed ? updated : prev;
    });
  }, [activeStructure]);

  const handleCollegeSelect = (event) => {
    const value = event.target.value;
    const collegeId = value ? parseInt(value, 10) : null;
    setSelectedCollegeId(collegeId);
    const selectedCollege = colleges.find(c => c.id === collegeId);
    setStudentData((prev) => ({
      ...prev,
      college: selectedCollege ? selectedCollege.name : '',
      course: '',
      branch: ''
    }));
    setSelectedCourseName('');
    setSelectedBranchName('');
  };

  const handleCourseSelect = (event) => {
    const value = event.target.value;
    setSelectedCourseName(value);
    setSelectedBranchName('');
    setStudentData((prev) => ({
      ...prev,
      course: value || '',
      branch: ''
    }));
  };

  const handleBranchSelect = (event) => {
    const value = event.target.value;
    setSelectedBranchName(value);
    // Directly update studentData.branch (don't rely only on useEffect)
    setStudentData((prev) => ({
      ...prev,
      branch: value || ''
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Track if user manually changes admission number
    if (name === 'admission_no' && value) {
      setIsAdmissionNumberManual(true);
    }
    
    // If batch changes, reset the manual flag to allow auto-generation
    if (name === 'batch') {
      setIsAdmissionNumberManual(false);
    }
    
    setStudentData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Comprehensive validation for all required fields
    const requiredFields = [
      { field: 'admission_no', label: 'Admission Number' },
      { field: 'student_name', label: 'Student Name' },
      { field: 'father_name', label: 'Father Name' },
      { field: 'gender', label: 'Gender' },
      { field: 'college', label: 'College' },
      { field: 'course', label: 'Course' },
      { field: 'branch', label: 'Branch' },
      { field: 'current_year', label: 'Current Year' },
      { field: 'current_semester', label: 'Current Semester' },
      { field: 'batch', label: 'Batch' },
      { field: 'stud_type', label: 'Student Type' },
      { field: 'student_status', label: 'Student Status' },
      { field: 'scholar_status', label: 'Scholar Status' },
      { field: 'student_mobile', label: 'Student Mobile' },
      { field: 'parent_mobile1', label: 'Parent Mobile 1' },
      { field: 'caste', label: 'Caste' },
      { field: 'dob', label: 'Date of Birth' },
      { field: 'certificates_status', label: 'Certificates Status' }
    ];

    const missingFields = requiredFields.filter(({ field }) => !studentData[field] || !studentData[field].toString().trim());
    
    if (missingFields.length > 0) {
      const fieldNames = missingFields.slice(0, 3).map(f => f.label).join(', ');
      const moreCount = missingFields.length > 3 ? ` and ${missingFields.length - 3} more` : '';
      toast.error(`Please fill in required fields: ${fieldNames}${moreCount}`);
      return;
    }

    // Validate batch exists in academic years
    if (academicYears.length > 0) {
      const batchExists = academicYears.some(y => y.yearLabel === studentData.batch);
      if (!batchExists) {
        toast.error('Selected batch year is not available. Please select a valid batch.');
        return;
      }
    }

    // Check document upload status and set certificates_status accordingly
    let finalCertificatesStatus = studentData.certificates_status;
    if (enableDocumentUpload && documentRequirements.length > 0) {
      let allDocumentsUploaded = true;
      for (const req of documentRequirements) {
        if (!req.is_enabled || !req.required_documents) continue;
        for (const docName of req.required_documents) {
          if (!documentFiles[docName]) {
            allDocumentsUploaded = false;
            break;
          }
        }
        if (!allDocumentsUploaded) break;
      }
      
      // Auto-set certificates_status based on document upload completion
      if (!allDocumentsUploaded) {
        finalCertificatesStatus = 'Pending';
      } else if (!finalCertificatesStatus || finalCertificatesStatus === 'Pending') {
        finalCertificatesStatus = 'Submitted';
      }
    }
    
    try {
      setLoading(true);
      
      // Create FormData for multipart submission (to handle file uploads)
      const formData = new FormData();
      
      // Add all student data fields
      Object.entries({
        ...studentData,
        certificates_status: finalCertificatesStatus,
        current_year: Number(studentData.current_year),
        current_semester: Number(studentData.current_semester)
      }).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          formData.append(key, value);
        }
      });
      
      // Add document files if document upload is enabled
      if (enableDocumentUpload) {
        Object.entries(documentFiles).forEach(([docName, file]) => {
          if (file) {
            formData.append(`document_${docName.replace(/\s+/g, '_')}`, file);
          }
        });
      }
      
      const response = await api.post('/students', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        toast.success('Student added successfully');
        navigate('/students', { state: { newStudent: response.data.data } });
      } else {
        toast.error(response.data.message || 'Failed to add student');
      }
    } catch (error) {
      console.error('Error adding student:', error);
      toast.error(error.response?.data?.message || 'Failed to add student');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6">
          <LoadingAnimation
            width={32}
            height={32}
            message="Loading add student form..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary heading-font">Add New Student</h1>
          <p className="text-sm sm:text-base text-text-secondary mt-1 sm:mt-2 body-font">Create a new student record</p>
        </div>
        <button
          onClick={() => navigate('/students')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-white font-medium bg-gradient-to-r from-indigo-600 to-purple-700 border border-transparent shadow-md hover:shadow-lg active:scale-95 transition-all duration-300 touch-manipulation min-h-[44px]"
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline">Back to Students</span>
          <span className="sm:hidden">Back</span>
        </button>
      </div>

      <div className="bg-card-bg rounded-lg sm:rounded-xl shadow-sm border border-border-light p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form sections */}
          <div className="border-b border-border-light pb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              Basic Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admission Number <span className="text-red-500">*</span>
                  {admissionNumberLoading && (
                    <span className="ml-2 text-xs text-primary-600">(Auto-generating...)</span>
                  )}
                  {!admissionNumberLoading && studentData.admission_no && !isAdmissionNumberManual && (
                    <span className="ml-2 text-xs text-green-600">(Auto-generated)</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="admission_no"
                    value={studentData.admission_no}
                    onChange={handleChange}
                    required
                    disabled={admissionNumberLoading}
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base sm:text-sm border border-border-light rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-input-bg text-text-primary transition-all duration-200 hover:border-primary-300 touch-manipulation min-h-[44px] ${admissionNumberLoading ? 'bg-gray-100' : ''}`}
                    placeholder={admissionNumberLoading ? 'Generating...' : 'Enter admission number or select batch to auto-generate'}
                  />
                  {admissionNumberLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <LoadingAnimation width={16} height={16} showMessage={false} variant="inline" />
                    </div>
                  )}
                </div>
                {!isAdmissionNumberManual && studentData.batch && (
                  <p className="mt-1 text-xs text-gray-500">
                    Format: {studentData.batch.match(/\d{4}/)?.[0] || studentData.batch}XXXX (e.g., {studentData.batch.match(/\d{4}/)?.[0] || studentData.batch}0001)
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PIN Number
                </label>
                <input
                  type="text"
                  name="pin_no"
                  value={studentData.pin_no}
                  onChange={handleChange}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="student_name"
                  value={studentData.student_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Father Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="father_name"
                  value={studentData.father_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  name="gender"
                  value={studentData.gender}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                >
                  <option value="">Select Gender</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-b border-border-light pb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              Academic Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* 1. College */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  College <span className="text-red-500">*</span>
                </label>
                {collegesLoading ? (
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 flex items-center gap-2">
                    <LoadingAnimation width={16} height={16} showMessage={false} variant="inline" />
                    Loading colleges...
                  </div>
                ) : (
                  <select
                    value={selectedCollegeId || ''}
                    onChange={handleCollegeSelect}
                    required
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                  >
                    <option value="">Select College</option>
                    {colleges.filter(c => c.isActive !== false).map((college) => (
                      <option key={college.id} value={college.id}>
                        {college.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. Batch (Academic Year) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch (Academic Year) <span className="text-red-500">*</span>
                </label>
                {academicYearsLoading ? (
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 flex items-center gap-2">
                    <LoadingAnimation width={16} height={16} showMessage={false} variant="inline" />
                    Loading batches...
                  </div>
                ) : academicYears.length > 0 ? (
                  <select
                    name="batch"
                    value={studentData.batch}
                    onChange={handleChange}
                    required
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                  >
                    <option value="">Select Batch</option>
                    {academicYears.map((year) => (
                      <option key={year.id} value={year.yearLabel}>
                        {year.yearLabel}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="batch"
                    value={studentData.batch}
                    onChange={handleChange}
                    placeholder="Enter batch year"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                  />
                )}
              </div>

              {/* 3. Course */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course <span className="text-red-500">*</span>
                </label>
                {courseOptionsLoading ? (
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 flex items-center gap-2">
                    <LoadingAnimation width={16} height={16} showMessage={false} variant="inline" />
                    Loading courses...
                  </div>
                ) : availableCourses.length > 0 ? (
                  <select
                    value={selectedCourseName}
                    onChange={handleCourseSelect}
                    required
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                  >
                    <option value="">Select Course</option>
                    {availableCourses.map((course) => (
                      <option key={course.name} value={course.name}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="course"
                    value={studentData.course}
                    onChange={handleChange}
                    placeholder="Enter course"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                  />
                )}
              </div>

              {/* 4. Branch */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch <span className="text-red-500">*</span>
                </label>
                {availableCourses.length > 0 && branchOptions.length > 0 ? (
                  <select
                    value={selectedBranchName}
                    onChange={handleBranchSelect}
                    required
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                  >
                    <option value="">Select Branch</option>
                    {branchOptions.map((branch) => (
                      <option key={branch.name} value={branch.name}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="branch"
                    value={studentData.branch}
                    onChange={handleChange}
                    required
                    placeholder={availableCourses.length > 0 ? 'No branches configured' : 'Enter branch'}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                  />
                )}
              </div>

              {/* 5. Current Academic Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Academic Year <span className="text-red-500">*</span>
                </label>
                <select
                  name="current_year"
                  value={studentData.current_year}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                >
                  <option value="">Select Year</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      Year {year}
                    </option>
                  ))}
                </select>
              </div>

              {/* 6. Current Semester */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Semester <span className="text-red-500">*</span>
                </label>
                <select
                  name="current_semester"
                  value={studentData.current_semester}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                >
                  <option value="">Select Semester</option>
                  {semesterOptions.map((semester) => (
                    <option key={semester} value={semester}>
                      Semester {semester}
                    </option>
                  ))}
                </select>
              </div>

              {/* 7. Student Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="stud_type"
                  value={studentData.stud_type}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                >
                  <option value="">Select Student Type</option>
                  {STUDENT_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* 8. Student Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="student_status"
                  value={studentData.student_status}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                >
                  <option value="">Select Status</option>
                  {STUDENT_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {/* 9. Scholar Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scholar Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="scholar_status"
                  value={studentData.scholar_status}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                >
                  <option value="">Select Scholar Status</option>
                  {SCHOLAR_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {/* 10. Previous College Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Previous College Name
                </label>
                <input
                  type="text"
                  name="previous_college"
                  value={studentData.previous_college}
                  onChange={handleChange}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                />
              </div>
            </div>
          </div>

          <div className="border-b border-border-light pb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              Contact Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="student_mobile"
                  value={studentData.student_mobile}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Mobile Number 1 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="parent_mobile1"
                  value={studentData.parent_mobile1}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Mobile Number 2
                </label>
                <input
                  type="tel"
                  name="parent_mobile2"
                  value={studentData.parent_mobile2}
                  onChange={handleChange}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                />
              </div>
            </div>
          </div>

          <div className="border-b border-border-light pb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              Personal Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="dob"
                  value={studentData.dob}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adhar Number
                </label>
                <input
                  type="text"
                  name="adhar_no"
                  value={studentData.adhar_no}
                  onChange={handleChange}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caste <span className="text-red-500">*</span>
                </label>
                <select
                  name="caste"
                  value={studentData.caste}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                >
                  <option value="">Select Caste</option>
                  {CASTE_OPTIONS.map((caste) => (
                    <option key={caste} value={caste}>
                      {caste}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="border-b border-border-light pb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              Address Information
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Address
                </label>
                <textarea
                  name="student_address"
                  value={studentData.student_address}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                ></textarea>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City/Village Name
                </label>
                <input
                  type="text"
                  name="city_village"
                  value={studentData.city_village}
                  onChange={handleChange}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mandal Name
                </label>
                <input
                  type="text"
                  name="mandal_name"
                  value={studentData.mandal_name}
                  onChange={handleChange}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  District
                </label>
                <input
                  type="text"
                  name="district"
                  value={studentData.district}
                  onChange={handleChange}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                />
              </div>
            </div>
          </div>

          <div className="border-b border-border-light pb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              Additional Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certificates Status <span className="text-red-500">*</span>
                  {enableDocumentUpload && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Auto-set based on document upload)
                    </span>
                  )}
                </label>
                <select
                  name="certificates_status"
                  value={studentData.certificates_status}
                  onChange={handleChange}
                  required
                  disabled={enableDocumentUpload && documentRequirements.length > 0}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none ${enableDocumentUpload && documentRequirements.length > 0 ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select Certificate Status</option>
                  {CERTIFICATES_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                {enableDocumentUpload && documentRequirements.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Status will be set to "Pending" if documents are incomplete, "Submitted" when all documents are uploaded.
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Student Photo
                </label>
                <div className="border-2 border-dashed border-border-light rounded-lg p-6 text-center hover:border-primary-400 transition-colors bg-input-bg">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        try {
                          // Validate file type
                          if (!file.type.startsWith('image/')) {
                            toast.error('Please select a valid image file');
                            return;
                          }

                          // Validate file size (5MB limit)
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error('File size should be less than 5MB');
                            return;
                          }

                          // Convert to base64 and store locally (will be sent with student creation)
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const base64Data = reader.result;
                            setStudentData(prev => ({
                              ...prev,
                              student_photo: base64Data
                            }));
                            toast.success('Photo selected successfully');
                          };
                          reader.onerror = () => {
                            toast.error('Failed to read photo file');
                          };
                          reader.readAsDataURL(file);
                        } catch (error) {
                          console.error('Photo selection error:', error);
                          toast.error('Failed to select photo');
                        }
                      }
                    }}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    {studentData.student_photo && studentData.student_photo.startsWith('data:') ? (
                      <img 
                        src={studentData.student_photo} 
                        alt="Student preview" 
                        className="w-24 h-24 object-cover rounded-lg border-2 border-primary-300"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-sm font-medium text-text-primary">
                        {studentData.student_photo ? 'Change Photo' : 'Upload Photo'}
                      </p>
                      <p className="text-xs text-text-secondary mt-1">
                        PNG, JPG up to 5MB
                      </p>
                    </div>
                  </label>
                  {studentData.student_photo && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 text-green-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm font-medium">Photo selected - will be saved with student</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  name="remarks"
                  value={studentData.remarks}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none touch-manipulation min-h-[44px]"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Document Upload Section */}
          {studentData.course && (
            <div className="border-b border-border-light pb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary mb-2 flex items-center gap-2">
                    <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                    Document Uploads
                  </h2>
                  <p className="text-sm text-gray-500">
                    Upload required documents based on course selection.
                  </p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">Upload Documents?</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={enableDocumentUpload}
                      onChange={(e) => setEnableDocumentUpload(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                  </div>
                </label>
              </div>

              {enableDocumentUpload && courseType && (
                <div className="space-y-4">
                  {documentRequirementsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <LoadingAnimation width={24} height={24} message="Loading document requirements..." />
                    </div>
                  ) : documentRequirements.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                      <p className="text-sm text-gray-600">
                        No document requirements configured for {courseType} courses.
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Please configure document requirements in Settings → Registration Form → Document Requirements.
                      </p>
                    </div>
                  ) : (
                    documentRequirements.map((req, reqIndex) => {
                      if (!req.is_enabled || !req.required_documents || req.required_documents.length === 0) {
                        return null;
                      }
                      
                      return (
                        <div key={reqIndex} className="rounded-lg border border-gray-200 bg-white p-4">
                          <h4 className="text-base font-semibold text-gray-900 mb-3">
                            {req.academic_stage} Documents
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {req.required_documents.map((docName, docIndex) => (
                              <div key={docIndex}>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  {docName}
                                  <span className="text-red-500 ml-1">*</span>
                                </label>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-teal-400 transition-colors bg-gray-50">
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (file) {
                                        if (file.size > 10 * 1024 * 1024) {
                                          toast.error(`${docName} file size should be less than 10MB`);
                                          return;
                                        }
                                        handleDocumentFileChange(docName, file);
                                      }
                                    }}
                                    className="hidden"
                                    id={`doc-add-${reqIndex}-${docIndex}`}
                                  />
                                  <label
                                    htmlFor={`doc-add-${reqIndex}-${docIndex}`}
                                    className="cursor-pointer flex flex-col items-center gap-2"
                                  >
                                    <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                                      <Upload className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <p className="text-xs font-medium text-gray-700">
                                      {documentFiles[docName] ? 'Change File' : 'Upload File'}
                                    </p>
                                    <p className="text-xs text-gray-500">PDF, JPG, PNG up to 10MB</p>
                                  </label>
                                  {documentFiles[docName] && (
                                    <p className="text-xs text-teal-600 mt-2 text-center">
                                      Selected: {documentFiles[docName].name}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-6">
            <button
  type="submit"
  disabled={loading}
  className="flex items-center gap-2 bg-gradient-to-r from-gray-800 via-gray-900 to-black text-white px-8 py-4 rounded-xl font-semibold
             hover:from-gray-900 hover:via-black hover:to-gray-800 focus:ring-4 focus:ring-gray-400/40 transition-all duration-300
             disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-2xl transform hover:scale-105 active:scale-95"
>
  {loading ? (
    <>
      <LoadingAnimation width={16} height={16} variant="inline" showMessage={false} />
      Saving...
    </>
  ) : (
    <>
      <Save size={18} />
      Save Student
    </>
  )}
</button>

          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStudent;