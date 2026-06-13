import React, { useState, useEffect } from 'react';
import { fetchApi } from '../utils/api';
import { showToast } from '../utils/toast';
import LoadingSpinner from './common/LoadingSpinner';

const MasterDataAllocation = ({ currentUser }) => {
  const [expos, setExpos] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leads, setLeads] = useState([]);
  
  const [selectedExpo, setSelectedExpo] = useState('');
  const [selectedFromEmployee, setSelectedFromEmployee] = useState('');
  const [selectedToEmployee, setSelectedToEmployee] = useState('');
  
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [expoRes, userRes, leadsRes] = await Promise.all([
          fetchApi('expos.php'),
          fetchApi('users.php'),
          fetchApi('customers.php') // Admin fetches all leads
        ]);

        if (expoRes.status === 'success') setExpos(expoRes.data || []);
        if (userRes.status === 'success') {
          // Users might contain super_admin, admin, employee
          setEmployees(userRes.data || []);
        }
        if (leadsRes.status === 'success') setLeads(leadsRes.data || []);
      } catch (e) {
        showToast('Failed to load initial data', 'error');
      }
    };
    fetchData();
  }, []);

  // Filter available "From Employees" based on selected expo
  const availableFromEmployees = Array.from(new Set(
    leads
      .filter(l => selectedExpo ? String(l.expo_id) === String(selectedExpo) : true)
      .map(l => l.created_by)
      .filter(Boolean)
  )).map(id => employees.find(e => String(e.id) === String(id))).filter(Boolean);

  // Available "To Employees" (exclude the selected From Employee)
  const availableToEmployees = employees.filter(e => String(e.id) !== String(selectedFromEmployee));

  // Leads matching filters
  const filteredLeads = leads.filter(l => {
    const matchExpo = selectedExpo ? String(l.expo_id) === String(selectedExpo) : true;
    const matchFrom = selectedFromEmployee ? String(l.created_by) === String(selectedFromEmployee) : true;
    return matchExpo && matchFrom;
  });

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)));
    } else {
      setSelectedLeadIds(new Set());
    }
  };

  const handleSelectOne = (id, checked) => {
    const newSet = new Set(selectedLeadIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedLeadIds(newSet);
  };

  const handleAllocate = async () => {
    if (selectedLeadIds.size === 0) {
      showToast('Please select at least one lead', 'warning');
      return;
    }
    if (!selectedToEmployee) {
      showToast('Please select an employee to allocate to', 'warning');
      return;
    }

    setIsAllocating(true);
    try {
      const res = await fetchApi('allocate_leads.php', {
        method: 'POST',
        body: JSON.stringify({
          customerIds: Array.from(selectedLeadIds),
          toEmployeeId: selectedToEmployee,
          fromEmployeeId: selectedFromEmployee
        })
      });

      if (res.status === 'success') {
        showToast(`Allocated ${selectedLeadIds.size} leads successfully`, 'success');
        
        // Refresh leads
        const newLeadsRes = await fetchApi('customers.php');
        if (newLeadsRes.status === 'success') setLeads(newLeadsRes.data || []);
        
        setSelectedLeadIds(new Set());
      } else {
        showToast(res.message || 'Failed to allocate', 'error');
      }
    } catch (e) {
      showToast('An error occurred during allocation', 'error');
    } finally {
      setIsAllocating(false);
    }
  };

  const isAllSelected = filteredLeads.length > 0 && selectedLeadIds.size === filteredLeads.length;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-wrap items-end gap-4 shrink-0">
        
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5 tracking-wider">From Expo</label>
          <select 
            value={selectedExpo} 
            onChange={e => {
              setSelectedExpo(e.target.value);
              setSelectedLeadIds(new Set());
              setCurrentPage(1);
            }} 
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all"
          >
            <option value="">Select Expo</option>
            {expos.map(e => <option key={e.id} value={e.id}>{e.expo_name}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5 tracking-wider">From Employee</label>
          <select 
            value={selectedFromEmployee} 
            onChange={e => {
              setSelectedFromEmployee(e.target.value);
              setSelectedLeadIds(new Set());
              setCurrentPage(1);
            }} 
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all"
          >
            <option value="">Select Employee</option>
            {availableFromEmployees.map(e => <option key={e.id} value={e.id}>{e.name || e.username}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Assign To</label>
          <select 
            value={selectedToEmployee} 
            onChange={e => setSelectedToEmployee(e.target.value)} 
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-[#00b5e2] focus:ring-1 focus:ring-[#00b5e2]/20 transition-all"
          >
            <option value="">Select Employee</option>
            {availableToEmployees.map(e => <option key={e.id} value={e.id}>{e.name || e.username} ({e.role})</option>)}
          </select>
        </div>

        <div className="min-w-[150px]">
          <button
            onClick={handleAllocate}
            disabled={isAllocating || selectedLeadIds.size === 0 || !selectedToEmployee}
            className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              isAllocating || selectedLeadIds.size === 0 || !selectedToEmployee
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[#00b5e2] text-white hover:bg-[#00a0c9] shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
            }`}
          >
            {isAllocating ? <LoadingSpinner size="sm" /> : <i className="ph-bold ph-arrows-left-right text-lg"></i>}
            Allocate ({selectedLeadIds.size})
          </button>
        </div>

      </div>

      <div className="p-3 bg-white border-b border-gray-100 flex items-center justify-between shrink-0">
        <span className="text-sm font-bold text-[#00b5e2] bg-[#00b5e2]/10 px-4 py-1.5 rounded-full border border-[#00b5e2]/20">
          Total Results: {filteredLeads.length} leads
        </span>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[900px]">
          <thead className="bg-[#00b5e2] text-white sticky top-0 z-10">
            <tr>
              <th className="py-3.5 px-4 font-semibold text-[13px] w-12 text-center border-r border-white/20">
                <input 
                  type="checkbox" 
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="rounded border-white/30 text-[#00b5e2] focus:ring-white cursor-pointer w-4 h-4"
                />
              </th>
              <th className="py-3.5 px-4 font-semibold text-[13px] border-r border-white/20 w-16 text-center">S.No</th>
              <th className="py-3.5 px-4 font-semibold text-[13px] border-r border-white/20">Company Name</th>
              <th className="py-3.5 px-4 font-semibold text-[13px] border-r border-white/20">Contact Person</th>
              <th className="py-3.5 px-4 font-semibold text-[13px] border-r border-white/20">Employee Name</th>
              <th className="py-3.5 px-4 font-semibold text-[13px] border-r border-white/20">City</th>
              <th className="py-3.5 px-4 font-semibold text-[13px] border-r border-white/20">Mobile No</th>
              <th className="py-3.5 px-4 font-semibold text-[13px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLeads.length > 0 ? (
              paginatedLeads.map((lead, idx) => {
                const isSelected = selectedLeadIds.has(lead.id);
                const emp = employees.find(e => String(e.id) === String(lead.created_by));
                const employeeName = emp ? (emp.name || emp.username) : '-';
                return (
                  <tr 
                    key={lead.id} 
                    className={`border-b border-gray-100 transition-colors hover:bg-gray-50/50 ${isSelected ? 'bg-blue-50/30' : ''}`}
                  >
                    <td className="py-3 px-4 text-center border-r border-gray-100">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                        className="rounded border-gray-300 text-[#00b5e2] focus:ring-[#00b5e2] cursor-pointer w-4 h-4"
                      />
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-medium">{((currentPage - 1) * itemsPerPage) + idx + 1}</td>
                    <td className="py-3 px-4 font-medium text-gray-800">{lead.company_name || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{lead.customer_name || '-'}</td>
                    <td className="py-3 px-4 text-gray-600 font-medium">{employeeName}</td>
                    <td className="py-3 px-4 text-gray-600">{lead.city || '-'}</td>
                    <td className="py-3 px-4 font-medium text-gray-700">{lead.phone_1 || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider bg-gray-100 text-gray-600">
                        {lead.status || 'pending'}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="py-12 text-center text-gray-400">
                  <i className="ph ph-magnifying-glass text-4xl mb-2 text-gray-300"></i>
                  <p>No leads found for the selected filters.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-white shrink-0">
        <div className="text-[13px] font-bold text-gray-800">
          Showing {filteredLeads.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredLeads.length)} of {filteredLeads.length} records
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 disabled:opacity-50 flex items-center justify-center transition-colors bg-white"
            >
              <i className="ph-bold ph-caret-left"></i>
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                // Show standard subset of pages to avoid rendering 100 buttons
                if (
                  page === 1 || 
                  page === totalPages || 
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded flex items-center justify-center text-[13px] font-bold transition-colors ${
                        currentPage === page
                          ? 'bg-[#00b5e2] text-white border border-[#00b5e2]'
                          : 'border border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  page === currentPage - 2 || 
                  page === currentPage + 2
                ) {
                  return <span key={page} className="text-gray-400 px-1">...</span>;
                }
                return null;
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 disabled:opacity-50 flex items-center justify-center transition-colors bg-white"
            >
              <i className="ph-bold ph-caret-right"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MasterDataAllocation;
