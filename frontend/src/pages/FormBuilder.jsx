import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Trash2 } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';

// Predefined database fields based on actual database schema (25 fields), in a logical order for the UI
const DATABASE_FIELDS = [
  // Student Info
  { key: 'student_name', label: 'Student Name', type: 'text', required: true },
  { key: 'gender', label: 'M/F', type: 'select', options: ['M', 'F', 'Other'], required: false },
  { key: 'dob', label: 'DOB (DD-MM-YYYY)', type: 'date', required: false },
  { key: 'adhar_no', label: 'ADHAR No', type: 'text', required: false },
  { key: 'caste', label: 'Caste', type: 'text', required: false },
  { key: 'father_name', label: 'Father Name', type: 'text', required: false },

  // Academic Info
  { key: 'pin_no', label: 'Pin No', type: 'text', required: false },
  { key: 'roll_number', label: 'Roll Number', type: 'text', required: false },
  { key: 'batch', label: 'Batch', type: 'text', required: false },
  { key: 'branch', label: 'Branch', type: 'text', required: false },
  { key: 'stud_type', label: 'StudType', type: 'text', required: false },
  { key: 'admission_date', label: 'Admission Date', type: 'date', required: false },
  { key: 'previous_college', label: 'Previous College', type: 'text', required: false },

  // Contact Info
  { key: 'student_mobile', label: 'Student Mobile', type: 'tel', required: false },
  { key: 'parent_mobile1', label: 'Parent Mobile 1', type: 'tel', required: false },
  { key: 'parent_mobile2', label: 'Parent Mobile 2', type: 'tel', required: false },
  { key: 'student_address', label: 'Student Address', type: 'textarea', required: false },
  { key: 'city_village', label: 'City/Village', type: 'text', required: false },
  { key: 'mandal_name', label: 'Mandal Name', type: 'text', required: false },
  { key: 'district', label: 'District', type: 'text', required: false },

  // Status & Docs
  { key: 'student_status', label: 'Student Status', type: 'text', required: false },
  { key: 'scholar_status', label: 'Scholar Status', type: 'text', required: false },
  { key: 'certificates_status', label: 'Certificate Status', type: 'text', required: false },
  { key: 'student_photo', label: 'Student Photo', type: 'text', required: false },

  // Other
  { key: 'remarks', label: 'Remarks', type: 'textarea', required: false },
];

const FormBuilder = () => {
  const navigate = useNavigate();
  const { formId } = useParams();
  const isEditMode = !!formId;

  const [formData, setFormData] = useState({
    formName: '',
    formDescription: '',
    formFields: [],
  });
  const [customFields, setCustomFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      fetchForm();
    }
  }, [formId]);

  const fetchForm = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/forms/${formId}`);
      const form = response.data.data;

      // Convert old form structure to new database field structure
      let convertedFields = form.form_fields || [];

      // Check if this is an old form (fields don't have 'key' property)
      const hasOldStructure = convertedFields.length > 0 && (
        !convertedFields[0].key ||
        (convertedFields[0].key && convertedFields[0].label && convertedFields[0].label.includes("Student's full name"))
      );

      console.log('Form structure check:', {
        totalFields: convertedFields.length,
        firstField: convertedFields[0],
        hasOldStructure,
        sampleField: convertedFields[0] ? {
          hasKey: !!convertedFields[0].key,
          hasId: !!convertedFields[0].id,
          hasType: !!convertedFields[0].type,
          label: convertedFields[0].label
        } : null
      });

      if (hasOldStructure) {
        console.log('Converting old form structure:', convertedFields);
        convertedFields = convertOldFormToNewStructure(convertedFields);
        console.log('Converted fields:', convertedFields);
      }

      // Filter out fields that are not in the predefined DATABASE_FIELDS list to prevent issues with old forms
      const validKeys = DATABASE_FIELDS.map(f => f.key);
      const filteredFields = convertedFields.filter(field => validKeys.includes(field.key));

      // Ensure all fields have proper structure
      const validatedFields = filteredFields.map(field => {
        if (!field.id) field.id = Date.now().toString() + Math.random();
        if (!field.key) field.key = field.label.toLowerCase().replace(/\s+/g, '_');
        if (!field.type) field.type = 'text';
        if (!field.placeholder) field.placeholder = `Enter ${field.label}`;
        return field;
      });

      // Separate custom fields from predefined ones
      const predefinedKeys = DATABASE_FIELDS.map(f => f.key);
      const predefinedFields = validatedFields.filter(f => predefinedKeys.includes(f.key));
      const loadedCustomFields = validatedFields.filter(f => !predefinedKeys.includes(f.key));

      setFormData({
        formName: form.form_name,
        formDescription: form.form_description || '',
        formFields: predefinedFields,
      });
      setCustomFields(loadedCustomFields);
    } catch (error) {
      toast.error('Failed to fetch form');
      navigate('/forms');
    } finally {
      setLoading(false);
    }
  };

  // Convert old dynamic form structure to new database field structure
  const convertOldFormToNewStructure = (oldFields) => {
    const fieldMapping = {
      "Student's full name": { key: 'student_name', label: 'Student Name' },
      "Date of birth": { key: 'dob', label: 'DOB (Date of Birth - DD-MM-YYYY)' },
      "sex": { key: 'gender', label: 'M/F' },
      "Current address": { key: 'student_address', label: 'Student Address (D.no, Str name, Village, Mandal, Dist)' },
      "Contact information(Mobile number)": { key: 'student_mobile', label: 'Student Mobile Number' },
      "Parent/Guardian details(Name)": { key: 'father_name', label: 'Father Name' },
      "Parent Phone number": { key: 'parent_mobile1', label: 'Parent Mobile Number 1' },
      "Admission category": { key: 'stud_type', label: 'StudType' },
      "Student Category": { key: 'student_status', label: 'Student Status' },
    };

    return oldFields.map(oldField => {
      const mapping = fieldMapping[oldField.label];
      if (mapping) {
        // Use the mapped database field
        const fieldConfig = DATABASE_FIELDS.find(field => field.key === mapping.key);
        return {
          id: oldField.id || Date.now().toString(),
          key: mapping.key,
          label: fieldConfig.label,
          type: fieldConfig.type,
          required: oldField.required || false,
          placeholder: oldField.placeholder || `Enter ${fieldConfig.label}`,
          options: fieldConfig.options || oldField.options || [],
        };
      } else {
        // For unmapped fields, try to find a suitable database field
        const fieldConfig = DATABASE_FIELDS.find(field =>
          field.label.toLowerCase().includes(oldField.label.toLowerCase()) ||
          oldField.label.toLowerCase().includes(field.label.toLowerCase())
        );

        if (fieldConfig) {
          return {
            id: oldField.id || Date.now().toString(),
            key: fieldConfig.key,
            label: fieldConfig.label,
            type: fieldConfig.type,
            required: oldField.required || false,
            placeholder: oldField.placeholder || `Enter ${fieldConfig.label}`,
            options: fieldConfig.options || oldField.options || [],
          };
        } else {
          // Keep as-is but add a key if possible
          return {
            id: oldField.id || Date.now().toString(),
            key: oldField.label.toLowerCase().replace(/\s+/g, '_'),
            label: oldField.label,
            type: oldField.type,
            required: oldField.required || false,
            placeholder: oldField.placeholder || '',
            options: oldField.options || [],
          };
        }
      }
    });
  };

  const addField = (fieldKey) => {
    if (!fieldKey) return;

    // Check if field is already added
    const fieldExists = formData.formFields.some(field => field.key === fieldKey);
    if (fieldExists) {
      toast.error('Field already added to form');
      return;
    }

    const fieldConfig = DATABASE_FIELDS.find(field => field.key === fieldKey);
    if (!fieldConfig) return;

    const newField = {
      id: Date.now().toString(),
      key: fieldConfig.key,
      label: fieldConfig.label,
      type: fieldConfig.type,
      required: fieldConfig.required,
      placeholder: `Enter ${fieldConfig.label}`,
      options: fieldConfig.options || [],
    };

    setFormData({
      ...formData,
      formFields: [...formData.formFields, newField],
    });
  };

  const addCustomField = () => {
    const newCustomField = {
      id: `custom-${Date.now()}`,
      key: `custom_${customFields.length + 1}`,
      label: '',
      type: 'text',
      required: false,
      placeholder: '',
      isCustom: true,
    };
    setCustomFields([...customFields, newCustomField]);
  };

  const updateCustomField = (index, field, value) => {
    const updatedCustomFields = [...customFields];
    updatedCustomFields[index] = { ...updatedCustomFields[index], [field]: value };
    setCustomFields(updatedCustomFields);
  };

  const removeCustomField = (index) => {
    const updatedCustomFields = customFields.filter((_, i) => i !== index);
    setCustomFields(updatedCustomFields);
  };

  const updateFieldLabel = (index, newLabel) => {
    const updatedFields = [...formData.formFields];
    updatedFields[index] = { ...updatedFields[index], label: newLabel };
    setFormData({ ...formData, formFields: updatedFields });
  };

  const updateFieldRequired = (index, required) => {
    const updatedFields = [...formData.formFields];
    updatedFields[index] = { ...updatedFields[index], required };
    setFormData({ ...formData, formFields: updatedFields });
  };

  const updateField = (index, field, value) => {
    const updatedFields = [...formData.formFields];
    updatedFields[index] = { ...updatedFields[index], [field]: value };
    setFormData({ ...formData, formFields: updatedFields });
  };

  const removeField = (index) => {
    const updatedFields = formData.formFields.filter((_, i) => i !== index);
    setFormData({ ...formData, formFields: updatedFields });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.formName.trim()) {
      toast.error('Form name is required');
      return;
    }

    const allFields = [...formData.formFields, ...customFields];

    if (allFields.length === 0) {
      toast.error('Please add at least one field');
      return;
    }

    for (let i = 0; i < allFields.length; i++) {
      if (!allFields[i].label.trim()) {
        toast.error(`Field ${i + 1} label is required`);
        return;
      }
    }

    const submissionData = {
      formName: formData.formName,
      formDescription: formData.formDescription,
      formFields: allFields,
    };

    setSaving(true);
    try {
      if (isEditMode) {
        await api.put(`/forms/${formId}`, submissionData);
        toast.success('Form updated successfully');
      } else {
        await api.post('/forms', submissionData);
        toast.success('Form created successfully');
      }
      navigate('/forms');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/forms')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit Form' : 'Create New Form'}</h1>
          <p className="text-gray-600 mt-1">Build your custom form with dynamic fields</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Form Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Form Name *</label>
              <input type="text" value={formData.formName} onChange={(e) => setFormData({ ...formData, formName: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="Enter form name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea value={formData.formDescription} onChange={(e) => setFormData({ ...formData, formDescription: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" rows="3" placeholder="Enter form description" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Form Fields</h2>
              <p className="text-sm text-gray-600 mt-1">Manage database fields for your form</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {formData.formFields.length}/25 fields added
              </span>
            </div>
          </div>

          {/* Available Fields to Add - Always Visible */}
          <div className="mb-8 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              🗂️ Add Database Fields ({DATABASE_FIELDS.length - formData.formFields.length} available)
            </label>
            <select
              onChange={(e) => { addField(e.target.value); e.target.value = ''; }}
              className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white shadow-sm text-gray-700 font-medium"
            >
              <option value="">➕ Select a field to add...</option>
              {DATABASE_FIELDS.filter(field => !formData.formFields.some(f => f.key === field.key)).map((field) => (
                <option key={field.key} value={field.key} className="py-2">
                  {field.label} ({field.type}) {field.required ? ' - Required' : ''}
                </option>
              ))}
            </select>
            {DATABASE_FIELDS.filter(field => !formData.formFields.some(f => f.key === field.key)).length === 0 && (
              <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                <span className="text-green-500">✅</span>
                All database fields have been added to the form!
              </p>
            )}
          </div>

          {/* Available Database Fields Overview */}
          <div className="mb-8 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              📋 Database Fields Overview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {DATABASE_FIELDS.map((field) => {
                const isAdded = formData.formFields.some(f => f.key === field.key);
                return (
                  <div
                    key={field.key}
                    className={`p-3 rounded-lg border-2 text-sm transition-all ${
                      isAdded
                        ? 'bg-green-100 border-green-300 text-green-800'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer'
                    }`}
                    onClick={() => !isAdded && addField(field.key)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{field.label}</span>
                      {isAdded && <span className="text-green-600 text-xs">✓</span>}
                    </div>
                    <div className="text-xs mt-1 opacity-75">
                      {field.type} {field.required && <span className="text-red-500">*</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Fields Section */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Custom Fields
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Add your own fields to the form.
                </p>
              </div>
              <button
                type="button"
                onClick={addCustomField}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                Add Custom Field
              </button>
            </div>
            <div className="space-y-4">
              {customFields.map((field, index) => (
                <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Custom Field {index + 1}</span>
                    <button type="button" onClick={() => removeCustomField(index)} className="text-red-600 hover:text-red-700 p-1">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateCustomField(index, 'label', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Field Label"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => updateCustomField(index, 'type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="text">Text</option>
                      <option value="textarea">Textarea</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                    <input
                      type="text"
                      value={field.placeholder}
                      onChange={(e) => updateCustomField(index, 'placeholder', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Placeholder"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Fields */}
          {formData.formFields.length === 0 && customFields.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100">
              <div className="max-w-md mx-auto">
                <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-3xl">📝</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Building Your Form</h3>
                <p className="text-gray-600 mb-6">Click on any field above to add it to your form, or use the dropdown at the top.</p>
                <div className="text-sm text-gray-500">
                  💡 Tip: You can add up to 25 database fields to create a comprehensive student form
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {formData.formFields
                .slice() // Create a shallow copy to avoid mutating the original array
                .sort((a, b) => {
                  const indexA = DATABASE_FIELDS.findIndex(f => f.key === a.key);
                  const indexB = DATABASE_FIELDS.findIndex(f => f.key === b.key);
                  return indexA - indexB;
                })
                .map((field, index) => (
                <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">Field {index + 1}</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {field.key}
                      </span>
                      {field.required && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          Required
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={() => removeField(index)} className="text-red-600 hover:text-red-700 p-1">
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateFieldLabel(index, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
                      <div className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700">
                        {field.type}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
                    <input
                      type="text"
                      value={field.placeholder || ''}
                      onChange={(e) => updateField(index, 'placeholder', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      placeholder="Placeholder text"
                    />
                  </div>

                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id={`required-${index}`}
                      checked={field.required}
                      onChange={(e) => updateFieldRequired(index, e.target.checked)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <label htmlFor={`required-${index}`} className="ml-2 text-sm text-gray-700">
                      Required field
                    </label>
                  </div>

                  {/* Show predefined options for select/radio/checkbox fields */}
                  {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && field.options && field.options.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Available Options</label>
                      <div className="space-y-1">
                        {field.options.map((option, optIndex) => (
                          <div key={optIndex} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                            {option}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Save size={20} />
            {saving ? 'Saving...' : isEditMode ? 'Update Form' : 'Create Form'}
          </button>
          <button type="button" onClick={() => navigate('/forms')} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormBuilder;
