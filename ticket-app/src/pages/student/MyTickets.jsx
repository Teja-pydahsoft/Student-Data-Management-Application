import React, { useState } from 'react';
import { SkeletonBox } from '../../components/SkeletonLoader';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    Ticket,
    Plus,
    Eye,
    Clock,
    CheckCircle,
    X,
    MessageSquare,
    Star,
    Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../config/api';
import toast from 'react-hot-toast';
import '../../styles/student-pages.css';

const STATUS_CLASSES = {
    pending: 'status-pending',
    approaching: 'status-active',
    resolving: 'status-active',
    completed: 'status-completed',
    closed: 'status-pending'
};

const STATUS_LABELS = {
    pending: 'Pending',
    approaching: 'Approaching',
    resolving: 'Resolving',
    completed: 'Completed',
    closed: 'Closed'
};

const MyTickets = () => {
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackForm, setFeedbackForm] = useState({ rating: 5, feedback_text: '' });

    // Fetch student tickets
    const { data: ticketsData, isLoading } = useQuery({
        queryKey: ['student-tickets'],
        queryFn: async () => {
            const response = await api.get('/tickets/student');
            return response.data?.data || [];
        }
    });

    // Fetch ticket details
    const { data: ticketDetails } = useQuery({
        queryKey: ['ticket', selectedTicket?.id],
        queryFn: async () => {
            const response = await api.get(`/tickets/${selectedTicket.id}`);
            return response.data?.data;
        },
        enabled: !!selectedTicket
    });

    // Submit feedback mutation
    const feedbackMutation = useMutation({
        mutationFn: async ({ ticketId, data }) => {
            const response = await api.post(`/tickets/${ticketId}/feedback`, data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Feedback submitted successfully');
            setShowFeedbackModal(false);
            setFeedbackForm({ rating: 5, feedback_text: '' });
            setSelectedTicket(null);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to submit feedback');
        }
    });

    const tickets = ticketsData || [];
    const ticket = ticketDetails || selectedTicket;

    const handleFeedbackSubmit = () => {
        if (!feedbackForm.rating) {
            toast.error('Please provide a rating');
            return;
        }
        feedbackMutation.mutate({
            ticketId: selectedTicket.id,
            data: feedbackForm
        });
    };

    if (isLoading) {
        return (
            <div className="student-page-container animate-pulse">
                <div className="flex-between">
                    <div className="page-header">
                        <SkeletonBox height="h-8" width="w-48" />
                        <SkeletonBox height="h-4" width="w-64" />
                    </div>
                    <SkeletonBox height="h-10" width="w-40" />
                </div>
                <div className="flex-col" style={{ gap: '1rem' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="ticket-item">
                            <SkeletonBox height="h-16" width="w-full" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="student-page-container animate-fade-in-up">
            {/* Header Section */}
            <div className="flex-col md:flex-row flex-between pb-2 border-b border-gray-100" style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '1rem', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div className="page-header" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#2563eb', marginBottom: '0.25rem' }}>
                        <Ticket size={16} />
                        <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.2em' }}>Support Center</span>
                    </div>
                    <h1 className="page-title">
                        My Tickets
                    </h1>
                    <p className="page-subtitle">
                        Track and manage your assistance requests
                    </p>
                </div>
                <Link
                    to="/student/raise-ticket"
                    className="btn-primary"
                >
                    <Plus size={20} />
                    <span>Raise New Ticket</span>
                </Link>
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                {tickets.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="empty-state"
                    >
                        <div className="relative z-10 max-w-md mx-auto">
                            <div className="empty-state-icon">
                                <Ticket className="text-blue-600" size={48} color="#2563eb" />
                            </div>
                            <h3 className="heading-font" style={{ fontSize: '1.875rem', fontWeight: 900, color: '#111827', marginBottom: '1rem' }}>
                                No Active Tickets
                            </h3>
                            <p className="body-font" style={{ color: '#6b7280', marginBottom: '2.5rem', fontWeight: 500, lineHeight: 1.6 }}>
                                Everything looks good! You haven't raised any complaints or assistance requests yet.
                            </p>
                            <Link
                                to="/student/raise-ticket"
                                className="btn-secondary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 2rem' }}
                            >
                                <Sparkles size={20} color="#60a5fa" />
                                <span>Create Your First Ticket</span>
                                <Plus size={20} />
                            </Link>
                        </div>
                    </motion.div>
                ) : (
                    <div className="flex-col" style={{ gap: '1.25rem' }}>
                        {tickets.map((ticket, index) => (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                key={ticket.id}
                                className="ticket-item"
                                style={{ position: 'relative', overflow: 'hidden' }}
                            >
                                <div className="flex-start" style={{ width: '100%', gap: '1.5rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                    <div style={{ flex: 1 }}>
                                        <div className="flex-start" style={{ gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                            <h3 className="heading-font" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{ticket.title}</h3>
                                            <span className={`status-badge ${STATUS_CLASSES[ticket.status] || 'status-pending'}`}>
                                                {STATUS_LABELS[ticket.status] || ticket.status}
                                            </span>
                                        </div>

                                        <div className="flex-start" style={{ gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #f3f4f6' }}>
                                                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>ID:</span>
                                                <code style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>{ticket.ticket_number}</code>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #f3f4f6' }}>
                                                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Type:</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>{ticket.category_name}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #f3f4f6' }}>
                                                <Clock size={12} color="#9ca3af" />
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563' }}>{new Date(ticket.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>

                                        {ticket.description && (
                                            <p style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.5, fontStyle: 'italic', maxWidth: '40rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{ticket.description}"</p>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', alignSelf: 'center' }}>
                                        <button
                                            onClick={() => setSelectedTicket(ticket)}
                                            style={{ padding: '0.75rem', color: '#2563eb', backgroundColor: '#eff6ff', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                                            title="View Details"
                                        >
                                            <Eye size={22} />
                                        </button>

                                        {ticket.status === 'completed' && !ticket.feedback && (
                                            <button
                                                onClick={() => {
                                                    setSelectedTicket(ticket);
                                                    setShowFeedbackModal(true);
                                                }}
                                                className="btn-primary"
                                                style={{ backgroundColor: '#16a34a', background: 'none', backgroundColor: '#16a34a', boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.3)' }}
                                            >
                                                <MessageSquare size={18} />
                                                Feedback
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>

            {/* Modal Section */}
            {selectedTicket && !showFeedbackModal && (
                <TicketDetailsModal
                    ticket={selectedTicket}
                    onClose={() => setSelectedTicket(null)}
                    onFeedback={() => {
                        if (selectedTicket.status === 'completed' && !selectedTicket.feedback) {
                            setShowFeedbackModal(true);
                        }
                    }}
                />
            )}

            {showFeedbackModal && selectedTicket && (
                <FeedbackModal
                    ticket={selectedTicket}
                    form={feedbackForm}
                    setForm={setFeedbackForm}
                    onClose={() => {
                        setShowFeedbackModal(false);
                        setSelectedTicket(null);
                    }}
                    onSubmit={handleFeedbackSubmit}
                    loading={feedbackMutation.isPending}
                />
            )}
        </div>
    );
};

// Ticket Details Modal
const TicketDetailsModal = ({ ticket, onClose, onFeedback }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="modal-content"
            >
                {/* Header Container */}
                <div className="modal-header">
                    <div>
                        <h2 className="heading-font" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#111827' }}>Ticket Details</h2>
                        <p style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.125rem' }}>Reference: {ticket.ticket_number}</p>
                    </div>
                    <button onClick={onClose} style={{ padding: '0.75rem', backgroundColor: '#f3f4f6', color: '#6b7280', borderRadius: '1rem', border: 'none', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {/* Status Ribbon */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div className={`status-badge ${STATUS_CLASSES[ticket.status] || 'status-pending'}`} style={{ fontSize: '0.75rem', padding: '0.5rem 1.5rem' }}>
                            {STATUS_LABELS[ticket.status] || ticket.status}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9ca3af', fontSize: '0.875rem', fontWeight: 500 }}>
                            <Clock size={16} />
                            <span>Created {new Date(ticket.created_at).toLocaleString()}</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.05em' }}>Category & Type</label>
                                <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                                    {ticket.category_name}
                                    {ticket.sub_category_name && <span style={{ color: '#2563eb', marginLeft: '0.5rem' }}>› {ticket.sub_category_name}</span>}
                                </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.05em' }}>Subject</label>
                                <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', lineHeight: 1.25 }}>{ticket.title}</p>
                            </div>
                        </div>

                        {ticket.photo_url && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.05em' }}>Evidence / Attachment</label>
                                <div style={{ borderRadius: '1.5rem', overflow: 'hidden', border: '4px solid #f9fafb', boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.06)' }}>
                                    <img
                                        src={ticket.photo_url}
                                        alt="Ticket attachment"
                                        style={{ width: '100%', height: '12rem', objectFit: 'cover' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.05em' }}>Detailed Description</label>
                        <div style={{ padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '1.5rem', border: '1px solid #f3f4f6' }}>
                            <p style={{ color: '#374151', lineHeight: 1.6, fontWeight: 500, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>"{ticket.description}"</p>
                        </div>
                    </div>

                    {/* Feedback Display if exists */}
                    {ticket.feedback && (
                        <div style={{ padding: '2rem', backgroundColor: '#f0fdf4', borderRadius: '2rem', border: '1px solid #bbf7d0', position: 'relative', overflow: 'hidden' }}>
                            <h4 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#14532d', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <MessageSquare size={20} />
                                Your Feedback
                            </h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            size={20}
                                            className={star <= ticket.feedback.rating ? "text-green-600" : "text-green-200"}
                                            fill={star <= ticket.feedback.rating ? "currentColor" : "none"}
                                        />
                                    ))}
                                </div>
                                <span style={{ fontWeight: 900, color: '#15803d', marginLeft: '0.5rem', fontSize: '1.25rem' }}>{ticket.feedback.rating}/5</span>
                            </div>
                            {ticket.feedback.feedback_text && (
                                <p style={{ color: '#166534', fontWeight: 500, lineHeight: 1.6, fontStyle: 'italic' }}>"{ticket.feedback.feedback_text}"</p>
                            )}
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div style={{ paddingTop: '2rem', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {ticket.status === 'completed' && !ticket.feedback && (
                                <button
                                    onClick={onFeedback}
                                    className="btn-primary"
                                    style={{ backgroundColor: '#16a34a', background: 'none', backgroundColor: '#16a34a', paddingLeft: '2rem', paddingRight: '2rem' }}
                                >
                                    <Star size={18} />
                                    Rate Resolution
                                </button>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="btn-secondary"
                        >
                            Close Details
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

// Feedback Modal
const FeedbackModal = ({ ticket, form, setForm, onClose, onSubmit, loading }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="modal-overlay"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="modal-content"
                style={{ maxWidth: '28rem', borderRadius: '2.5rem', overflow: 'hidden' }}
            >
                <div style={{ padding: '2rem', borderBottom: '1px solid #f9fafb', textAlign: 'center' }}>
                    <div style={{ width: '4rem', height: '4rem', backgroundColor: '#f0fdf4', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                        <CheckCircle className="text-green-600" size={32} color="#16a34a" />
                    </div>
                    <h2 className="heading-font" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#111827' }}>Rate Resolution</h2>
                    <p style={{ color: '#6b7280', fontWeight: 500, marginTop: '0.25rem' }}>How was your experience with Ticket #{ticket.ticket_number}?</p>
                </div>

                <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div style={{ textAlign: 'center' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Select Rating</label>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                            {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                    key={rating}
                                    type="button"
                                    onClick={() => setForm({ ...form, rating })}
                                    style={{ background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer', transform: form.rating >= rating ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.2s' }}
                                >
                                    <Star
                                        size={40}
                                        color={form.rating >= rating ? '#facc15' : '#d1d5db'}
                                        fill={form.rating >= rating ? '#facc15' : 'none'}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#9ca3af', letterSpacing: '0.05em', paddingLeft: '0.25rem' }}>Detailed Feedback</label>
                        <textarea
                            value={form.feedback_text}
                            onChange={(e) => setForm({ ...form, feedback_text: e.target.value })}
                            className="form-textarea"
                            rows={4}
                            placeholder="Tell us what we did great or how we can improve..."
                            style={{ resize: 'none' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
                        <button
                            onClick={onSubmit}
                            disabled={loading || !form.rating}
                            className="btn-primary"
                            style={{ width: '100%', padding: '1rem', fontSize: '1.125rem' }}
                        >
                            {loading ? 'Submitting...' : 'Submit Feedback'}
                        </button>
                        <button
                            onClick={onClose}
                            style={{ width: '100%', padding: '0.75rem', color: '#6b7280', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            Maybe Later
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default MyTickets;
