import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  FileText,
  ClipboardList,
  CheckCircle,
  Clock,
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';
import { formatDate } from '../utils/dateUtils';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
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

  const statCards = [
    {
      title: 'Total Students',
      value: stats?.totalStudents || 0,
      icon: Users,
      bgGradient: 'from-indigo-500 to-blue-600',
    },
    {
      title: 'Total Forms',
      value: stats?.totalForms || 0,
      icon: FileText,
      bgGradient: 'from-emerald-500 to-green-600',
    },
    {
      title: 'Pending Submissions',
      value: stats?.pendingSubmissions || 0,
      icon: Clock,
      bgGradient: 'from-amber-400 to-orange-500',
    },
    {
      title: 'Approved Today',
      value: stats?.approvedToday || 0,
      icon: CheckCircle,
      bgGradient: 'from-cyan-500 to-sky-600',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center space-y-6">
          <LoadingAnimation width={120} height={120} message="Loading dashboard..." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-gray-50 via-white to-gray-100 min-h-screen">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="rounded-2xl p-6 bg-white/80 backdrop-blur-lg border border-gray-200 shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                  <p className="text-4xl font-extrabold text-gray-800 mt-1">{stat.value}</p>
                </div>
                <div
                  className={`p-3 rounded-xl bg-gradient-to-br ${stat.bgGradient} shadow-md`}
                >
                  <Icon className="text-white" size={26} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/submissions"
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all duration-300 group shadow-sm hover:shadow-md"
          >
            <div className="bg-indigo-100 p-2 rounded-lg group-hover:bg-indigo-200 transition-colors">
              <ClipboardList className="text-indigo-600" size={20} />
            </div>
            <div>
              <p className="font-semibold text-gray-800">Review Submissions</p>
              <p className="text-sm text-gray-500">
                {stats?.pendingSubmissions || 0} pending
              </p>
            </div>
          </Link>

          <Link
            to="/students"
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all duration-300 group shadow-sm hover:shadow-md"
          >
            <div className="bg-green-100 p-2 rounded-lg group-hover:bg-green-200 transition-colors">
              <Users className="text-green-600" size={20} />
            </div>
            <div>
              <p className="font-semibold text-gray-800">View Students</p>
              <p className="text-sm text-gray-500">Manage database</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Submissions */}
      {stats?.recentSubmissions && stats.recentSubmissions.length > 0 && (
        <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Recent Submissions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-700">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold">Form Name</th>
                  <th className="text-left py-3 px-4 font-semibold">Admission Number</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 font-semibold">Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSubmissions.map((submission) => (
                  <tr
                    key={submission.submission_id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">{submission.form_name}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {submission.admission_number || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          submission.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : submission.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {submission.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {formatDate(submission.submitted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
