import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'tel', label: 'Phone Number' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkbox', label: 'Checkboxes' },
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
      setFormData({
        formName: form.form_name,
        formDescription: form.form_description || '',
        formFields: form.form_fields || [],
      });
    } catch (error) {
      toast.error('Failed to fetch form');
      navigate('/forms');
    } finally {
      setLoading(false);
    }
  };

  const addField = (insertAtIndex = null) => {
    const newField = {
      id: Date.now().toString(),
      label: '',
      type: 'text',
      required: false,
      placeholder: '',
      options: [],
    };

    if (insertAtIndex !== null) {
      // Insert at specific position
      const updatedFields = [...formData.formFields];
      updatedFields.splice(insertAtIndex + 1, 0, newField);
      setFormData({ ...formData, formFields: updatedFields });
    } else {
      // Add at end
      setFormData({
        ...formData,
        formFields: [...formData.formFields, newField],
      });
    }
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

  const addOption = (fieldIndex) => {
    const updatedFields = [...formData.formFields];
    if (!updatedFields[fieldIndex].options) {
      updatedFields[fieldIndex].options = [];
    }
    updatedFields[fieldIndex].options.push('');
    setFormData({ ...formData, formFields: updatedFields });
  };

  const updateOption = (fieldIndex, optionIndex, value) => {
    const updatedFields = [...formData.formFields];
    updatedFields[fieldIndex].options[optionIndex] = value;
    setFormData({ ...formData, formFields: updatedFields });
  };

  const removeOption = (fieldIndex, optionIndex) => {
    const updatedFields = [...formData.formFields];
    updatedFields[fieldIndex].options = updatedFields[fieldIndex].options.filter((_, i) => i !== optionIndex);
    setFormData({ ...formData, formFields: updatedFields });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.formName.trim()) {
      toast.error('Form name is required');
      return;
    }

    if (formData.formFields.length === 0) {
      toast.error('Please add at least one field');
      return;
    }

    for (let i = 0; i < formData.formFields.length; i++) {
      if (!formData.formFields[i].label.trim()) {
        toast.error(`Field ${i + 1} label is required`);
        return;
      }
    }

    setSaving(true);
    try {
      if (isEditMode) {
        await api.put(`/forms/${formId}`, formData);
        toast.success('Form updated successfully');
      } else {
        await api.post('/forms', formData);
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
    <div className="max-w-4xl mx-auto space-y-6">
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Form Fields</h2>
            <button type="button" onClick={addField} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
              <Plus size={18} />
              Add Field
            </button>
          </div>

          {formData.formFields.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-600 mb-4">No fields added yet</p>
              <button type="button" onClick={addField} className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
                <Plus size={18} />
                Add Your First Field
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {formData.formFields.map((field, index) => (
                <React.Fragment key={field.id}>
                  <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Field {index + 1}</span>
                      <button type="button" onClick={() => removeField(index)} className="text-red-600 hover:text-red-700 p-1">
                        <Trash2 size={18} />
                      </button>
                    </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Label *</label>
                      <input type="text" value={field.label} onChange={(e) => updateField(index, 'label', e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="Field label" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                      <select value={field.type} onChange={(e) => updateField(index, 'type', e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                        {FIELD_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder</label>
                    <input type="text" value={field.placeholder || ''} onChange={(e) => updateField(index, 'placeholder', e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="Placeholder text" />
                  </div>

                  <div className="flex items-center">
                    <input type="checkbox" id={`required-${index}`} checked={field.required} onChange={(e) => updateField(index, 'required', e.target.checked)} className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                    <label htmlFor={`required-${index}`} className="ml-2 text-sm text-gray-700">Required field</label>
                  </div>

                  {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Options</label>
                      <div className="space-y-2">
                        {field.options?.map((option, optIndex) => (
                          <div key={optIndex} className="flex gap-2">
                            <input type="text" value={option} onChange={(e) => updateOption(index, optIndex, e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder={`Option ${optIndex + 1}`} />
                            <button type="button" onClick={() => removeOption(index, optIndex)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addOption(index)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                          + Add Option
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Insert Field Button - appears after each field */}
                <div className="flex justify-center py-2">
                  <button
                    type="button"
                    onClick={() => addField(index)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-full transition-colors"
                    title="Insert field below"
                  >
                    <Plus size={14} />
                    Add Field Below
                  </button>
                </div>
              </React.Fragment>
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
