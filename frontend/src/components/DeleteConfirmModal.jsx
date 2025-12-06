import React from 'react';
import { X, AlertTriangle, Users, ChevronDown, ChevronUp } from 'lucide-react';

const DeleteConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  itemName, 
  itemType,
  affectedStudents = [],
  totalStudentCount = 0,
  hasMoreStudents = false,
  isLoadingStudents = false
}) => {
  const [showStudentList, setShowStudentList] = React.useState(true);

  if (!isOpen) return null;

  const hasStudents = totalStudentCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Dim background */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg sm:rounded-xl shadow-2xl max-w-lg w-full transform transition-all max-h-[90vh] flex flex-col my-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 sm:top-4 right-3 sm:right-4 p-2 text-gray-400 hover:text-gray-600 active:text-gray-700 transition-colors rounded-lg hover:bg-gray-100 active:bg-gray-200 z-10 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          {/* Warning Icon */}
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-red-100">
              <AlertTriangle size={24} className="text-red-600 sm:w-8 sm:h-8" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 text-center mb-2">
            {title || 'Confirm Deletion'}
          </h3>

          {/* Warning Message */}
          <div className="mb-4 text-center">
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

          {/* Affected Students Section */}
          {isLoadingStudents ? (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600">Loading affected students...</span>
              </div>
            </div>
          ) : hasStudents ? (
            <div className="mb-4">
              {/* Student count header */}
              <button
                onClick={() => setShowStudentList(!showStudentList)}
                className="w-full flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 active:bg-red-200 transition-colors touch-manipulation min-h-[44px]"
              >
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-red-600" />
                  <span className="text-sm font-semibold text-red-800">
                    {totalStudentCount} Student{totalStudentCount !== 1 ? 's' : ''} will be deleted
                  </span>
                </div>
                {showStudentList ? (
                  <ChevronUp size={18} className="text-red-600" />
                ) : (
                  <ChevronDown size={18} className="text-red-600" />
                )}
              </button>

              {/* Student list */}
              {showStudentList && affectedStudents.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                  {/* Mobile Card View */}
                  <div className="sm:hidden space-y-2 p-2">
                    {affectedStudents.map((student, index) => (
                      <div key={student.admission_number || index} className="p-2 bg-gray-50 rounded border border-gray-200">
                        <p className="text-xs font-medium text-gray-900 truncate" title={student.student_name}>
                          {student.student_name}
                        </p>
                        <p className="text-xs text-gray-600 font-mono">{student.admission_number}</p>
                        <p className="text-xs text-gray-500">{student.batch || '-'}</p>
                      </div>
                    ))}
                    {hasMoreStudents && (
                      <div className="px-2 py-2 text-center text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded">
                        ... and {totalStudentCount - affectedStudents.length} more students
                      </div>
                    )}
                  </div>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Admission No</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Batch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {affectedStudents.map((student, index) => (
                          <tr key={student.admission_number || index} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700 font-mono">{student.admission_number}</td>
                            <td className="px-3 py-2 text-gray-900 truncate max-w-[150px]" title={student.student_name}>
                              {student.student_name}
                            </td>
                            <td className="px-3 py-2 text-gray-600">{student.batch || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {hasMoreStudents && (
                      <div className="px-3 py-2 text-center text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
                        ... and {totalStudentCount - affectedStudents.length} more students
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800 text-center">
                ✓ No students will be affected by this deletion
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoadingStudents}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 active:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
            >
              {hasStudents ? `Delete ${totalStudentCount} Student${totalStudentCount !== 1 ? 's' : ''}` : 'Yes, Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
