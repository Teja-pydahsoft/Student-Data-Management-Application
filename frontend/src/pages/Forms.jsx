import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, QrCode, Eye, EyeOff, Download, Plus } from 'lucide-react';
import QRCodeComponent from 'react-qr-code';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';

const Forms = () => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const response = await api.get('/forms');
      setForms(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch forms');
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (formId, formName) => {
    if (!window.confirm(`Are you sure you want to delete "${formName}"?`)) {
      return;
    }

    try {
      await api.delete(`/forms/${formId}`);
      toast.success('Form deleted successfully');
      fetchForms();
    } catch (error) {
      toast.error('Failed to delete form');
    }
  };

  const handleToggleActive = async (formId, currentStatus) => {
    try {
      await api.put(`/forms/${formId}`, { isActive: !currentStatus });
      toast.success(`Form ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchForms();
    } catch (error) {
      toast.error('Failed to update form status');
    }
  };

  const handleShowQR = (form) => {
    setSelectedForm(form);
    setShowQRModal(true);
  };

  const downloadQRCode = () => {
    const svg = document.getElementById('qr-code-svg');
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      
      const downloadLink = document.createElement('a');
      downloadLink.download = `${selectedForm.form_name}-QR.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingAnimation
          size="lg"
          message="Loading forms..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Forms</h1>
          <p className="text-gray-600 mt-2">Manage student registration forms</p>
        </div>
        <Link
          to="/forms/new"
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={18} />
          Create Form
        </Link>
      </div>

      {forms.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="text-gray-400" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No forms available</h3>
            <p className="text-gray-600">Create your first student registration form to get started.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {forms.map((form) => (
            <div key={form.form_id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{form.form_name}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{form.form_description || 'No description'}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${form.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {form.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total Fields:</span>
                  <span className="font-medium text-gray-900">{form.form_fields?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Active Fields:</span>
                  <span className="font-medium text-green-600">
                    {form.form_fields?.filter(field => field.isEnabled !== false).length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Pending:</span>
                  <span className="font-medium text-yellow-600">{form.pending_count || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Approved:</span>
                  <span className="font-medium text-green-600">{form.approved_count || 0}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-500">
                    <div className="font-medium mb-1">Active Fields:</div>
                    <div className="space-y-1">
                      {form.form_fields
                        ?.filter(field => field.isEnabled !== false)
                        .map(field => (
                          <div key={field.id || field.label} className="flex items-center gap-2">
                            <span className="text-green-600">●</span>
                            <span>{field.label}</span>
                            {field.required && <span className="text-red-500 text-xs">*</span>}
                          </div>
                        )) || 'None'}
                    </div>
                    {form.form_fields?.filter(field => field.isEnabled === false).length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium mb-1 text-gray-400">Admin Fields:</div>
                        <div className="space-y-1">
                          {form.form_fields
                            ?.filter(field => field.isEnabled === false)
                            .map(field => (
                              <div key={field.id || field.label} className="flex items-center gap-2">
                                    <span className="text-gray-400">●</span>
                                    <span className="text-gray-400">{field.label} (Admin Only)</span>
                                  </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => handleShowQR(form)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors" title="View QR Code">
                  <QrCode size={16} />
                  QR
                </button>
                <Link to={`/forms/edit/${form.form_id}`} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Edit Form">
                  <Edit size={16} />
                  Edit
                </Link>
                <button onClick={() => handleToggleActive(form.form_id, form.is_active)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors" title={form.is_active ? 'Deactivate' : 'Activate'}>
                  {form.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button onClick={() => handleDelete(form.form_id, form.form_name)} className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Delete Form">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showQRModal && selectedForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{selectedForm.form_name}</h3>
            <div className="bg-white p-6 rounded-lg border-2 border-gray-200 mb-4 flex items-center justify-center">
              <QRCodeComponent id="qr-code-svg" value={`${window.location.origin}/form/${selectedForm.form_id}`} size={256} />
            </div>
            <p className="text-sm text-gray-600 mb-4 text-center">Scan this QR code to access the form</p>
            <div className="flex gap-3">
              <button onClick={downloadQRCode} className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
                <Download size={18} />
                Download
              </button>
              <button onClick={() => setShowQRModal(false)} className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Forms;
