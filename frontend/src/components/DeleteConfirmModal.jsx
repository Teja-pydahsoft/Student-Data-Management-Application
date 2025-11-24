import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, title, itemName, itemType }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dim background */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full transform transition-all">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="p-6">
          {/* Warning Icon */}
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
              <AlertTriangle size={32} className="text-red-600" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
            {title || 'Confirm Deletion'}
          </h3>

          {/* Warning Message */}
          <div className="mb-6 text-center">
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-semibold text-red-600">Warning:</span> This action will permanently delete all students under this selection.
            </p>
            <p className="text-sm text-gray-700 mb-2">
              This includes all linked {itemType === 'college' ? 'Courses, Branches, and Student records' : itemType === 'course' ? 'Branches and Student records' : 'Student records'}.
            </p>
            <p className="text-sm font-semibold text-red-600">
              This action cannot be undone.
            </p>
            {itemName && (
              <p className="text-sm text-gray-600 mt-3">
                <span className="font-medium">Item:</span> {itemName}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
            >
              Yes, Delete Everything
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;

