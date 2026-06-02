import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';

const Dashboard = ({ currentUser }) => {
  const [data, setData] = useState({
    totalRegistrations: 0,
    activeExpos: 0,
    upcomingFollowups: 0,
    recentActivity: []
  });

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const uid = currentUser?.id ? `?user_id=${currentUser.id}` : '';
        const role = currentUser?.role ? `&role=${encodeURIComponent(currentUser.role)}` : '';
        const result = await fetchApi(`dashboard.php${uid}${role}`);
        if (result.status === 'success') {
          setData(result.data);
        }
      } catch (error) {
        console.error('Failed to load dashboard', error);
      }
    };
    loadDashboard();
  }, [currentUser?.id, currentUser?.role]);

  const stats = [
    { label: 'Total Customers', value: data.totalRegistrations, icon: 'ph-users', color: 'bg-crm-primaryLighter text-crm-primary' },
    { label: 'Active Expos', value: data.activeExpos, icon: 'ph-calendar-star', color: 'bg-emerald-100 text-emerald-800' },
    { label: 'Upcoming Follow-ups', value: data.upcomingFollowups, icon: 'ph-clock-counter-clockwise', color: 'bg-amber-100 text-amber-800' },
    { label: 'Missed Follow-ups', value: '0', icon: 'ph-warning-circle', color: 'bg-red-100 text-red-800' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
            <div>
              <p className="text-sm font-normal text-gray-500 uppercase tracking-wider mb-1">{stat.label}</p>
              <h3 className="text-4xl font-medium text-crm-primary">{stat.value}</h3>
            </div>
            <div className={`h-14 w-14 rounded-full flex items-center justify-center border border-transparent ${stat.color}`}>
              <i className={`ph-fill ${stat.icon} text-3xl`}></i>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-96">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-medium text-crm-primary text-lg">Recent Registrations</h3>
            <button className="text-sm font-normal text-crm-primary hover:text-crm-primaryDark transition-colors">View All</button>
          </div>
          {data.recentActivity && data.recentActivity.length > 0 ? (
            <div className="flex-1 overflow-y-auto">
              <ul className="divide-y divide-gray-100">
                {data.recentActivity.map((activity, idx) => (
                  <li key={idx} className="p-4 hover:bg-crm-primaryLighter transition-colors">
                    <p className="text-crm-textDark font-normal text-sm">{activity.company_name}</p>
                    <p className="text-gray-500 text-xs">{activity.customer_name} • {activity.linked_expo || 'Direct Entry'}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <i className="ph ph-empty text-5xl mb-3 text-gray-400"></i>
              <p className="font-normal text-gray-600">No recent registrations</p>
              <p className="text-sm mt-1 text-gray-400">New customers will appear here</p>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-96">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-medium text-crm-primary text-lg">Upcoming Follow-up List</h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <i className="ph ph-calendar-blank text-5xl mb-3 text-gray-400"></i>
            <p className="font-normal text-gray-600">You are all caught up!</p>
            <p className="text-sm mt-1 text-gray-400">No pending follow-ups for today.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
