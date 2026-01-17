import React from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    UserPlus,
    Edit,
    MessageSquare,
    Star,
    Clock,
    User,
    CheckCircle,
    AlertCircle
} from 'lucide-react';
import TicketStepper from './TicketStepper';

const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approaching: 'bg-blue-100 text-blue-800 border-blue-200',
    resolving: 'bg-purple-100 text-purple-800 border-purple-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    closed: 'bg-gray-100 text-gray-800 border-gray-200'
};

const STATUS_LABELS = {
    pending: 'Pending',
    approaching: 'Approaching',
    resolving: 'Resolving',
    completed: 'Completed',
    closed: 'Closed'
};

const TicketDetailsModal = ({ ticket, onClose, onAssign, onStatusUpdate, onAddComment }) => {
    if (!ticket) return null;

    return createPortal(
        <div
            className="modal-overlay"
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        >
            <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />
            <div
                className="modal-content animate-in zoom-in-95 duration-200"
                style={{ position: 'relative', zIndex: 10000, maxHeight: '85vh', width: '100%', maxWidth: '1000px', margin: '2rem', backgroundColor: 'white', borderRadius: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }}
            >
                {/* Header Container */}
                <div className="modal-header" style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 className="heading-font" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#111827' }}>Ticket Details</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <p style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>REF: {ticket.ticket_number}</p>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#d1d5db' }}></span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#6b7280' }}>
                                <Clock size={12} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{new Date(ticket.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ padding: '0.75rem', backgroundColor: '#f3f4f6', color: '#6b7280', borderRadius: '1rem', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s' }} className="hover:bg-gray-200">
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto', flex: 1 }}>
                    {/* Status Stepper */}
                    <div style={{ padding: '0 1rem' }}>
                        <TicketStepper status={ticket.status} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2.5rem' }}>
                        {/* Left Column: Details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                            {/* Title & Type */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '1.5rem', border: '1px solid #f3f4f6' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.05em' }}>Subject</label>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', lineHeight: 1.3 }}>{ticket.title}</h3>
                                </div>
                                <div style={{ display: 'flex', gap: '2rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                        <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.05em' }}>Category</label>
                                        <p style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                                            {ticket.category_name}
                                            {ticket.sub_category_name && <span style={{ color: '#6b7280', fontWeight: 500, fontSize: '0.875rem' }}> › {ticket.sub_category_name}</span>}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                        <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.05em' }}>Student</label>
                                        <p style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{ticket.student_name}</p>
                                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', fontFamily: 'monospace' }}>{ticket.admission_number}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.05em' }}>Detailed Description</label>
                                <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                                    <p style={{ color: '#374151', lineHeight: 1.7, fontWeight: 500, whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
                                        {ticket.description || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No detailed description provided.</span>}
                                    </p>
                                </div>
                            </div>

                            {/* Photo */}
                            {ticket.photo_url && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.05em' }}>Attachment</label>
                                    <div style={{ borderRadius: '1.5rem', overflow: 'hidden', border: '4px solid #f9fafb', boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.06)' }}>
                                        <img src={ticket.photo_url} alt="Ticket attachment" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', backgroundColor: '#f3f4f6' }} />
                                    </div>
                                </div>
                            )}

                            {/* Comments */}
                            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <MessageSquare size={20} className="text-gray-400" />
                                        Discussion History
                                    </h3>
                                </div>

                                {ticket.comments && ticket.comments.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {ticket.comments.map((comment) => (
                                            <div key={comment.id} style={{ display: 'flex', gap: '1rem' }}>
                                                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', backgroundColor: comment.is_internal ? '#fef3c7' : '#e0f2fe', color: comment.is_internal ? '#d97706' : '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.875rem', flexShrink: 0 }}>
                                                    {comment.user_name.charAt(0)}
                                                </div>
                                                <div style={{ flex: 1, backgroundColor: comment.is_internal ? '#fffbeb' : '#f0f9ff', padding: '1rem', borderRadius: '0 1rem 1rem 1rem', border: `1px solid ${comment.is_internal ? '#fde68a' : '#e0f2fe'}` }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                        <span style={{ fontWeight: 700, color: '#1f2937', fontSize: '0.875rem' }}>{comment.user_name}</span>
                                                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{new Date(comment.created_at).toLocaleString()}</span>
                                                    </div>
                                                    <p style={{ color: '#4b5563', fontSize: '0.875rem', lineHeight: 1.5 }}>{comment.comment_text}</p>
                                                    {comment.is_internal && <div style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', color: '#d97706', backgroundColor: '#fef3c7', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>Internal Note</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '1rem', border: '1px dashed #e5e7eb', color: '#9ca3af', fontSize: '0.875rem' }}>
                                        No comments yet. Start a discussion below.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Actions & Meta */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Current Status */}
                            <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'block' }}>Current Status</label>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span className={`status-badge ${STATUS_COLORS[ticket.status] || 'bg-gray-100'}`} style={{ padding: '0.5rem 1rem', borderRadius: '2rem', fontWeight: 700, fontSize: '0.875rem', display: 'inline-block' }}>
                                        {STATUS_LABELS[ticket.status] || ticket.status}
                                    </span>
                                    <button onClick={onStatusUpdate} style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', background: 'none', border: 'none' }}>Change</button>
                                </div>
                            </div>

                            {/* Assigned Staff */}
                            <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.05em' }}>Assigned Team</label>
                                    <button onClick={onAssign} style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', background: 'none', border: 'none' }}>
                                        <UserPlus size={14} /> Manage
                                    </button>
                                </div>
                                {ticket.assignments && ticket.assignments.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {ticket.assignments.map((assignment) => (
                                            <div key={assignment.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem' }}>
                                                <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: assignment.assigned_to_role === 'staff' ? '#f3e8ff' : '#eff6ff', color: assignment.assigned_to_role === 'staff' ? '#7e22ce' : '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem' }}>
                                                    {assignment.assigned_to_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1f2937' }}>{assignment.assigned_to_name}</p>
                                                    <p style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', textTransform: 'capitalize' }}>{assignment.assigned_to_role === 'staff' ? 'Manager' : 'Worker'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.75rem', border: '1px dashed #e5e7eb' }}>
                                        <User size={20} className="text-gray-300 mx-auto mb-2" />
                                        <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>No staff assigned</p>
                                    </div>
                                )}
                            </div>

                            {/* Feedback (if exists) */}
                            {ticket.feedback && (
                                <div style={{ padding: '1.5rem', backgroundColor: '#f0fdf4', borderRadius: '1.5rem', border: '1px solid #bbf7d0' }}>
                                    <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#15803d', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        <Star size={12} fill="currentColor" /> Student Feedback
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                        <span style={{ fontSize: '2rem', fontWeight: 900, color: '#166534', lineHeight: 1 }}>{ticket.feedback.rating}</span>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#15803d', opacity: 0.7 }}>/ 5.0</span>
                                    </div>
                                    {ticket.feedback.feedback_text && (
                                        <p style={{ fontSize: '0.875rem', color: '#14532d', fontStyle: 'italic', fontWeight: 500 }}>"{ticket.feedback.feedback_text}"</p>
                                    )}
                                </div>
                            )}

                            {/* Actions Panel */}
                            <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
                                <button
                                    onClick={onAddComment}
                                    style={{ width: '100%', padding: '1rem', backgroundColor: '#111827', color: 'white', borderRadius: '1rem', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', cursor: 'pointer', transition: 'transform 0.1s' }}
                                    className="hover:scale-[1.02] active:scale-95 shadow-lg"
                                >
                                    <MessageSquare size={18} />
                                    Add Response
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TicketDetailsModal;
