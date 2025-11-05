import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  FileText,
  ClipboardList,
  CheckCircle,
  Clock,
  ArrowRight,
  Eye,
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';
import { formatDate } from '../utils/dateUtils';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentSubmissions();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/students/stats');
      setStats(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentSubmissions = async () => {
    try {
      const response = await api.get('/submissions');
      // Get the 10 most recent submissions
      const submissions = response.data.data || [];
      const sortedSubmissions = submissions
        .sort((a, b) => new Date(b.created_at || b.submitted_at) - new Date(a.created_at || a.submitted_at))
        .slice(0, 10);
      setRecentSubmissions(sortedSubmissions);
    } catch (error) {
      console.error('Failed to fetch recent submissions:', error);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const statCards = [
    {
      title: 'Total Students',
      value: stats?.totalStudents || 0,
      icon: Users,
      bgGradient: 'from-blue-600 to-blue-700',
    },
    {
      title: 'Total Forms',
      value: stats?.totalForms || 0,
      icon: FileText,
      bgGradient: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Pending Submissions',
      value: stats?.pendingSubmissions || 0,
      icon: Clock,
      bgGradient: 'from-blue-400 to-blue-500',
    },
    {
      title: 'Approved Today',
      value: stats?.approvedToday || 0,
      icon: CheckCircle,
      bgGradient: 'from-blue-700 to-blue-800',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-white to-gray-50">
        <div className="text-center space-y-4">
          <LoadingAnimation width={32} height={32} message="Loading dashboard..." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-white via-gray-50 to-blue-50 min-h-screen">
      <div>
          <h1 className="text-3xl font-bold text-gray-900 heading-font">Dashboard</h1>
          <p className="text-gray-600 mt-2 body-font">Overview of your student management system</p>
        </div>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="rounded-xl p-6 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-4xl font-extrabold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.bgGradient} shadow`}>
                  <Icon className="text-white" size={26} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/submissions"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group shadow-sm"
          >
            <div className="bg-blue-100 p-2 rounded-md group-hover:bg-blue-200 transition-colors">
              <ClipboardList className="text-blue-700" size={20} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Review Submissions</p>
              <p className="text-sm text-gray-600">
                {stats?.pendingSubmissions || 0} pending
              </p>
            </div>
          </Link>

          <Link
            to="/students"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-600 hover:bg-blue-50 transition-all duration-200 group shadow-sm"
          >
            <div className="bg-blue-100 p-2 rounded-md group-hover:bg-blue-200 transition-colors">
              <Users className="text-blue-700" size={20} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">View Students</p>
              <p className="text-sm text-gray-600">Manage database</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Submissions Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Recent Submissions</h2>
          <Link
            to="/submissions"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
          >
            View All
            <ArrowRight size={16} />
          </Link>
        </div>

        {loadingSubmissions ? (
          <div className="flex items-center justify-center py-12">
            <LoadingAnimation width={32} height={32} message="Loading submissions..." />
          </div>
        ) : recentSubmissions.length > 0 ? (
          <div className="space-y-3">
            {recentSubmissions.map((submission) => (
              <div
                key={submission.submission_id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {submission.form_name || 'Unknown Form'}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize flex-shrink-0 ${
                        submission.status === 'pending'
                          ? 'bg-blue-100 text-blue-800'
                          : submission.status === 'approved'
                          ? 'bg-blue-200 text-blue-900'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      {submission.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Admission:</span>
                      {submission.admission_number || 'N/A'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(submission.created_at || submission.submitted_at)}
                    </span>
                  </div>
                </div>
                <Link
                  to={`/submissions`}
                  className="ml-4 p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title="View Details"
                >
                  <Eye size={16} />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <ClipboardList className="mx-auto text-gray-400 mb-3" size={48} />
            <p className="text-gray-600 font-medium">No submissions yet</p>
            <p className="text-sm text-gray-500 mt-1">Submissions will appear here once received</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;