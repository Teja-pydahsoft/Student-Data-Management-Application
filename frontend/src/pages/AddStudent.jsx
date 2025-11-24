import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';

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
        setColleges(response.data.data || []);
      } catch (error) {
        console.error('Failed to load colleges', error);
        toast.error(error.response?.data?.message || 'Failed to load colleges');
      } finally {
        setCollegesLoading(false);
      }
    };

    loadColleges();
  }, []);

  useEffect(() => {
    const loadCourseConfig = async () => {
      try {
        setCourseOptionsLoading(true);
        const url = selectedCollegeId 
          ? `/courses?collegeId=${selectedCollegeId}&includeInactive=false`
          : '/courses/options';
        const response = await api.get(url);
        setCourseOptions(response.data.data || []);
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
    return (selectedCourse.branches || []).filter(
      (branch) => branch?.isActive !== false
    );
  }, [selectedCourse]);

  const selectedBranch = useMemo(
    () =>
      branchOptions.find(
        (branch) =>
          branch.name?.toLowerCase() === selectedBranchName.toLowerCase()
      ) || null,
    [branchOptions, selectedBranchName]
  );

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
    if (!activeStructure?.semestersPerYear) {
      return ['1', '2'];
    }
    return Array.from(
      { length: activeStructure.semestersPerYear },
      (_value, index) => String(index + 1)
    );
  }, [activeStructure]);

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
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStudentData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!studentData.student_name || !studentData.admission_no) {
      toast.error('Student name and admission number are required');
      return;
    }

    if (!studentData.college) {
      toast.error('Please select a college');
      return;
    }

    if (!studentData.current_year || !studentData.current_semester) {
      toast.error('Please select the current year and semester');
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.post('/students', {
        ...studentData,
        current_year: Number(studentData.current_year),
        current_semester: Number(studentData.current_semester)
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary heading-font">Add New Student</h1>
          <p className="text-text-secondary mt-2 body-font">Create a new student record</p>
        </div>
        <button
          onClick={() => navigate('/students')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-gradient-to-r from-indigo-600 to-purple-700 border border-transparent shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300"
        >
          <ArrowLeft size={18} />
          Back to Students
        </button>
      </div>

      <div className="bg-card-bg rounded-xl shadow-sm border border-border-light p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form sections */}
          <div className="border-b border-border-light pb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admission Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="admission_no"
                  value={studentData.admission_no}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-border-light rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-input-bg text-text-primary transition-all duration-200 hover:border-primary-300"
                  placeholder="Enter admission number"
                />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Father Name
                </label>
                <input
                  type="text"
                  name="father_name"
                  value={studentData.father_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  name="gender"
                  value={studentData.gender}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course {availableCourses.length > 0 && <span className="text-red-500">*</span>}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch
                </label>
                {availableCourses.length > 0 && branchOptions.length > 0 ? (
                  <select
                    value={selectedBranchName}
                    onChange={handleBranchSelect}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
                    placeholder={availableCourses.length > 0 ? 'No branches configured' : 'Enter branch'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Academic Year <span className="text-red-500">*</span>
                </label>
                <select
                  name="current_year"
                  value={studentData.current_year}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">Select Year</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      Year {year}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Semester <span className="text-red-500">*</span>
                </label>
                <select
                  name="current_semester"
                  value={studentData.current_semester}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                >
                  <option value="">Select Semester</option>
                  {semesterOptions.map((semester) => (
                    <option key={semester} value={semester}>
                      Semester {semester}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch
                </label>
                <input
                  type="text"
                  name="batch"
                  value={studentData.batch}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Type
                </label>
                <input
                  type="text"
                  name="stud_type"
                  value={studentData.stud_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Status
                </label>
                <input
                  type="text"
                  name="student_status"
                  value={studentData.student_status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scholar Status
                </label>
                <input
                  type="text"
                  name="scholar_status"
                  value={studentData.scholar_status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Previous College Name
                </label>
                <input
                  type="text"
                  name="previous_college"
                  value={studentData.previous_college}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          <div className="border-b border-border-light pb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              Contact Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Mobile Number
                </label>
                <input
                  type="tel"
                  name="student_mobile"
                  value={studentData.student_mobile}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Mobile Number 1
                </label>
                <input
                  type="tel"
                  name="parent_mobile1"
                  value={studentData.parent_mobile1}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          <div className="border-b border-border-light pb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              Personal Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="dob"
                  value={studentData.dob}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caste
                </label>
                <input
                  type="text"
                  name="caste"
                  value={studentData.caste}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          <div className="border-b border-border-light pb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              Additional Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certificates Status
                </label>
                <input
                  type="text"
                  name="certificates_status"
                  value={studentData.certificates_status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
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

                          // Upload file to server
                          const formData = new FormData();
                          formData.append('photo', file);
                          formData.append('admissionNumber', studentData.admission_no || 'temp');

                          const response = await api.post('/students/upload-photo', formData, {
                            headers: {
                              'Content-Type': 'multipart/form-data',
                            },
                          });

                          if (response.data.success) {
                            setStudentData(prev => ({
                              ...prev,
                              student_photo: response.data.data.filename
                            }));
                            toast.success('Photo uploaded successfully');
                          } else {
                            toast.error('Failed to upload photo');
                          }
                        } catch (error) {
                          console.error('Photo upload error:', error);
                          toast.error('Failed to upload photo');
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
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
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
                        <span className="text-sm font-medium">Photo uploaded successfully</span>
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        {studentData.student_photo}
                      </p>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                ></textarea>
              </div>
            </div>
          </div>

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