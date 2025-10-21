import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  FileText,
  ClipboardList,
  CheckCircle,
  TrendingUp,
  Clock
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';

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
      color: 'bg-primary',
      bgColor: 'bg-accent/10',
      textColor: 'text-primary',
    },
    {
      title: 'Total Forms',
      value: stats?.totalForms || 0,
      icon: FileText,
      color: 'bg-success',
      bgColor: 'bg-success/10',
      textColor: 'text-success',
    },
    {
      title: 'Pending Submissions',
      value: stats?.pendingSubmissions || 0,
      icon: Clock,
      color: 'bg-warning',
      bgColor: 'bg-warning/10',
      textColor: 'text-warning',
    },
    {
      title: 'Approved Today',
      value: stats?.approvedToday || 0,
      icon: CheckCircle,
      color: 'bg-info',
      bgColor: 'bg-info/10',
      textColor: 'text-info',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6">
          <LoadingAnimation
            width={120}
            height={120}
            message="Loading dashboard..."
          />
          <div className="space-y-2">
            <p className="text-lg font-medium text-text-primary">Loading Dashboard</p>
            <p className="text-sm text-text-secondary">Please wait while we fetch your statistics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary heading-font">Dashboard</h1>
        <p className="text-text-secondary mt-2 body-font">
          Welcome back! Here's an overview of your system.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-card-bg rounded-xl shadow-sm border border-border-light p-6 card-hover"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-secondary mb-1 body-font">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-text-primary heading-font">
                    {stat.value}
                  </p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <Icon className={stat.textColor} size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-card-bg rounded-xl shadow-sm border border-border-light p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4 heading-font">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <Link
            to="/submissions"
            className="flex items-center gap-3 p-4 border-2 border-dashed border-border-light rounded-lg hover:border-accent hover:bg-accent/5 transition-colors group"
          >
            <div className="bg-warning/10 p-2 rounded-lg group-hover:bg-warning/20 transition-colors">
              <ClipboardList className="text-warning" size={20} />
            </div>
            <div>
              <p className="font-medium text-text-primary">Review Submissions</p>
              <p className="text-sm text-text-secondary">
                {stats?.pendingSubmissions || 0} pending
              </p>
            </div>
          </Link>

          <Link
            to="/students"
            className="flex items-center gap-3 p-4 border-2 border-dashed border-border-light rounded-lg hover:border-primary hover:bg-primary/5 transition-colors group"
          >
            <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
              <Users className="text-primary" size={20} />
            </div>
            <div>
              <p className="font-medium text-text-primary">View Students</p>
              <p className="text-sm text-text-secondary">Manage database</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Submissions */}
      {stats?.recentSubmissions && stats.recentSubmissions.length > 0 && (
        <div className="bg-card-bg rounded-xl shadow-sm border border-border-light p-6">
          <h2 className="text-xl font-bold text-text-primary mb-4 heading-font">
            Recent Submissions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-light">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-heading-dark">
                    Form Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-heading-dark">
                    Admission Number
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-heading-dark">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-heading-dark">
                    Submitted At
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSubmissions.map((submission) => (
                  <tr
                    key={submission.submission_id}
                    className="border-b border-border-lighter hover:bg-accent/5 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-text-primary">
                      {submission.form_name}
                    </td>
                    <td className="py-3 px-4 text-sm text-text-secondary">
                      {submission.admission_number || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          submission.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : submission.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {submission.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-text-secondary">
                      {new Date(submission.submitted_at).toLocaleString()}
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
