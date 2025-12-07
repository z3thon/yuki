'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useViewDataCache } from '@/lib/useViewDataCache';

interface Punch {
  id: string;
  employeeId?: string;
  employeeName?: string;
  clientId?: string;
  clientName?: string;
  projectIds?: string[];
  projectNames?: string[];
  invoiceId?: string;
  invoiceNumber?: string;
  punchInTime: string;
  punchOutTime?: string;
  duration?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Employee {
  id: string;
  name: string | null;
  email: string;
}

interface Client {
  id: string;
  name: string;
}

type SortField = 'employeeName' | 'clientName' | 'punchInTime' | 'punchOutTime' | 'duration' | 'status';
type SortDirection = 'asc' | 'desc';

const INITIAL_LIMIT = 50;
const LOAD_MORE_LIMIT = 50;

export default function TimeTrackingViewComponent() {
  const [selectedPunch, setSelectedPunch] = useState<Punch | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [sortField, setSortField] = useState<SortField>('punchInTime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [displayLimit, setDisplayLimit] = useState(INITIAL_LIMIT);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [viewingMemo, setViewingMemo] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  const [filters, setFilters] = useState({
    employeeId: '',
    clientId: '',
    invoiceId: '',
    startDate: '',
    endDate: '',
    status: '', // 'active' | 'completed' | ''
  });

  const getAuthToken = async (): Promise<string | null> => {
    const { getAuth } = await import('firebase/auth');
    const { auth } = await import('@/lib/firebase');
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  };

  // Fetch employees for filter dropdown (lazy load, don't block initial render)
  const fetchAllEmployees = useMemo(() => async () => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch('/api/hr/employees?limit=1000', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to fetch employees');
    }

    const data = await response.json();
    return { employees: data.employees || [] };
  }, []);

  const { data: allEmployeesData } = useViewDataCache<{ employees: Employee[] }>({
    viewId: 'employees-filter',
    cacheKey: 'all',
    fetchFn: fetchAllEmployees,
  });

  // Fetch clients for filter dropdown (lazy load, don't block initial render)
  const fetchAllClients = useMemo(() => async () => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch('/api/hr/clients', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) {
      // Clients endpoint might not exist, return empty array
      return { clients: [] };
    }

    const data = await response.json();
    return { clients: data.clients || [] };
  }, []);

  const { data: allClientsData } = useViewDataCache<{ clients: Client[] }>({
    viewId: 'clients-filter',
    cacheKey: 'all',
    fetchFn: fetchAllClients,
  });

  // Create cache key based on filters
  const cacheKey = useMemo(() => {
    const parts: string[] = [];
    if (filters.employeeId) parts.push(`employee:${filters.employeeId}`);
    if (filters.clientId) parts.push(`client:${filters.clientId}`);
    if (filters.invoiceId) parts.push(`invoice:${filters.invoiceId}`);
    if (filters.startDate) parts.push(`start:${filters.startDate}`);
    if (filters.endDate) parts.push(`end:${filters.endDate}`);
    if (filters.status) parts.push(`status:${filters.status}`);
    return parts.length > 0 ? parts.join('|') : undefined;
  }, [filters]);

  // Track if fetch is in progress to prevent multiple simultaneous calls
  const fetchInProgressRef = useRef(false);
  
  // Fetch punches with pagination - use useCallback to stabilize the function reference
  const fetchPunches = useCallback(async () => {
    if (fetchInProgressRef.current) {
      console.warn('⏸️ CLIENT: Fetch already in progress, skipping duplicate call');
      return { punches: [] };
    }
    
    fetchInProgressRef.current = true;
    console.log('🔵 CLIENT: fetchPunches called');
    const fetchStartTime = Date.now();
    
    try {
      const token = await getAuthToken();
      if (!token) {
        console.error('🔴 CLIENT: No auth token');
        fetchInProgressRef.current = false;
        throw new Error('Not authenticated');
      }
      console.log('✅ CLIENT: Got auth token');
      
      const params = new URLSearchParams();
      if (filters.employeeId) params.set('employee_id', filters.employeeId);
      if (filters.clientId) params.set('client_id', filters.clientId);
      if (filters.startDate) params.set('start_date', filters.startDate);
      if (filters.endDate) params.set('end_date', filters.endDate);
      params.set('limit', String(displayLimit));
      params.set('offset', '0');
      
      const url = `/api/hr/punches?${params.toString()}`;
      console.log(`🔵 CLIENT: Fetching ${url}`);
      console.log(`   Filters:`, { employeeId: filters.employeeId, clientId: filters.clientId, startDate: filters.startDate, endDate: filters.endDate });
      
      // Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('🔴 CLIENT: Fetch timeout after 30 seconds');
        controller.abort();
      }, 30000);
      
      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (error: any) {
        clearTimeout(timeoutId);
        fetchInProgressRef.current = false;
        if (error.name === 'AbortError') {
          throw new Error('Request timeout: Server did not respond within 30 seconds');
        }
        throw error;
      }
      
      console.log(`✅ CLIENT: Got response, status: ${response.status}, ok: ${response.ok}`);
      console.log(`⏱️ CLIENT: Fetch took ${Date.now() - fetchStartTime}ms`);
      
      if (!response.ok) {
        fetchInProgressRef.current = false;
        if (response.status === 403) {
          throw new Error('You do not have permission to view time tracking');
        } else {
          const data = await response.json();
          console.error('🔴 CLIENT: Error response:', data);
          throw new Error(data.error || 'Failed to fetch punches');
        }
      }

      const data = await response.json();
      console.log(`✅ CLIENT: Got ${data.punches?.length || 0} punches`);
      setHasMore(data.hasMore || false);
      fetchInProgressRef.current = false;
      return { punches: data.punches || [] };
    } catch (error: any) {
      fetchInProgressRef.current = false;
      console.error('🔴 CLIENT: fetchPunches error:', error);
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
      throw error;
    }
  }, [filters, displayLimit]);

  const { data, loading, error, refetch } = useViewDataCache<{ punches: Punch[] }>({
    viewId: 'time-tracking',
    cacheKey: `${cacheKey || 'all'}-limit-${displayLimit}`,
    fetchFn: fetchPunches,
  });

  // Employees/clients are now enriched server-side, so we only need them for filters
  const employeesForFilters = allEmployeesData?.employees || [];
  const clientsForFilters = allClientsData?.clients || [];

  // Calculate duration from punch in/out times
  const calculateDuration = (punchInTime: string, punchOutTime?: string): number | null => {
    if (!punchOutTime) return null;
    const inTime = new Date(punchInTime).getTime();
    const outTime = new Date(punchOutTime).getTime();
    const diffMinutes = Math.round((outTime - inTime) / (1000 * 60));
    return diffMinutes > 0 ? diffMinutes : null;
  };

  // Enrich punches with calculated duration (names are already included from API)
  const enrichedPunches = useMemo(() => {
    return (data?.punches || []).map(punch => {
      const duration = punch.duration || calculateDuration(punch.punchInTime, punch.punchOutTime);
      
      return {
        ...punch,
        // employeeName and clientName are already included from the API
        duration,
      };
    });
  }, [data?.punches]);

  // Filter by status
  const filteredPunches = useMemo(() => {
    let filtered = enrichedPunches;
    
    if (filters.status === 'active') {
      filtered = filtered.filter(p => !p.punchOutTime);
    } else if (filters.status === 'completed') {
      filtered = filtered.filter(p => p.punchOutTime);
    }

    if (filters.invoiceId) {
      filtered = filtered.filter(p => p.invoiceId === filters.invoiceId);
    }

    return filtered;
  }, [enrichedPunches, filters.status, filters.invoiceId]);

  // Sort punches
  const sortedPunches = useMemo(() => {
    const sorted = [...filteredPunches];
    
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'employeeName':
          aValue = a.employeeName || '';
          bValue = b.employeeName || '';
          break;
        case 'clientName':
          aValue = a.clientName || '';
          bValue = b.clientName || '';
          break;
        case 'punchInTime':
          aValue = new Date(a.punchInTime).getTime();
          bValue = new Date(b.punchInTime).getTime();
          break;
        case 'punchOutTime':
          aValue = a.punchOutTime ? new Date(a.punchOutTime).getTime() : 0;
          bValue = b.punchOutTime ? new Date(b.punchOutTime).getTime() : 0;
          break;
        case 'duration':
          aValue = a.duration || 0;
          bValue = b.duration || 0;
          break;
        case 'status':
          aValue = a.punchOutTime ? 1 : 0;
          bValue = b.punchOutTime ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredPunches, sortField, sortDirection]);

  // Reset display limit when filters change
  useEffect(() => {
    setDisplayLimit(INITIAL_LIMIT);
    setHasMore(true);
  }, [filters]);

  // Handle scroll for lazy loading
  const handleScroll = useCallback(() => {
    if (!tableContainerRef.current || loadingMore || !hasMore) return;
    
    const container = tableContainerRef.current;
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    
    // Load more when within 200px of bottom
    if (scrollBottom < 200) {
      setLoadingMore(true);
      setDisplayLimit(prev => prev + LOAD_MORE_LIMIT);
      setTimeout(() => setLoadingMore(false), 500);
    }
  }, [loadingMore, hasMore]);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handlePunchClick = async (punchId: string) => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(`/api/hr/punches/${punchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedPunch(data.punch);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Error fetching punch details:', err);
    }
  };

  const handleSave = async (punch: Punch) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch(`/api/hr/punches/${punch.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          punchInTime: punch.punchInTime,
          punchOutTime: punch.punchOutTime,
          notes: punch.notes,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          alert('You do not have permission to edit punches');
        } else {
          const data = await response.json();
          alert(data.error || 'Failed to update punch');
        }
        return;
      }

      setIsEditing(false);
      refetch();
      if (selectedPunch?.id === punch.id) {
        handlePunchClick(punch.id);
      }
    } catch (err) {
      console.error('Error updating punch:', err);
      alert('Failed to update punch');
    }
  };

  const handleExport = () => {
    const headers = ['Employee', 'Client', 'Punch In', 'Punch Out', 'Duration (hrs)', 'Status', 'Memo'];
    const rows = sortedPunches.map(p => [
      p.employeeName || '',
      p.clientName || '',
      formatDateTime(p.punchInTime),
      p.punchOutTime ? formatDateTime(p.punchOutTime) : '',
      p.duration ? (p.duration / 60).toFixed(2) : '',
      p.punchOutTime ? 'Completed' : 'Active',
      p.notes || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-tracking-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (minutes?: number | null) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-foreground/30">↕</span>;
    }
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  // Show loading only if we have no data AND we're loading
  // Don't block on employee/client data - punches should show even if names aren't loaded yet
  if (loading && !data?.punches) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground/50">Loading time tracking data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="glass-card p-6 border border-red-500/30">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Access Denied</h2>
          <p className="text-foreground/70">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold">Time Tracking</h1>
          <p className="text-foreground/50 mt-1">
            View and manage time punches
          </p>
        </div>
        {sortedPunches.length > 0 && (
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-accent-blue/20 text-accent-blue rounded-lg hover:bg-accent-blue/30 transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex-shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
              Employee
            </label>
            <select
              value={filters.employeeId}
              onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
              onFocus={() => setEmployeesFilterOpen(true)}
              className="w-full px-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
            >
              <option value="">All Employees</option>
              {employeesForFilters.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name || emp.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
              Client
            </label>
            <select
              value={filters.clientId}
              onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}
              onFocus={() => setClientsFilterOpen(true)}
              className="w-full px-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
            >
              <option value="">All Clients</option>
              {clientsForFilters.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
            />
          </div>
          <div>
            <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ employeeId: '', clientId: '', invoiceId: '', startDate: '', endDate: '', status: '' })}
              className="w-full px-3 py-2 bg-foreground/10 rounded-lg hover:bg-foreground/20 transition-colors text-sm"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table Container with Fixed Headers */}
      <div className="glass-card overflow-hidden flex-1 min-h-0 flex flex-col">
        <div 
          ref={tableContainerRef}
          className="overflow-auto flex-1"
        >
          <table className="w-full">
            <thead className="bg-background/90 backdrop-blur-sm border-b border-foreground/10 sticky top-0 z-10">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider cursor-pointer hover:bg-background/50 transition-colors"
                  onClick={() => handleSort('employeeName')}
                >
                  <div className="flex items-center gap-2">
                    Employee
                    <SortIcon field="employeeName" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider cursor-pointer hover:bg-background/50 transition-colors"
                  onClick={() => handleSort('clientName')}
                >
                  <div className="flex items-center gap-2">
                    Client
                    <SortIcon field="clientName" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider cursor-pointer hover:bg-background/50 transition-colors"
                  onClick={() => handleSort('punchInTime')}
                >
                  <div className="flex items-center gap-2">
                    Punch In
                    <SortIcon field="punchInTime" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider cursor-pointer hover:bg-background/50 transition-colors"
                  onClick={() => handleSort('punchOutTime')}
                >
                  <div className="flex items-center gap-2">
                    Punch Out
                    <SortIcon field="punchOutTime" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider cursor-pointer hover:bg-background/50 transition-colors"
                  onClick={() => handleSort('duration')}
                >
                  <div className="flex items-center gap-2">
                    Duration
                    <SortIcon field="duration" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider cursor-pointer hover:bg-background/50 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    <SortIcon field="status" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Memo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {sortedPunches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-foreground/50">
                    No punches found
                  </td>
                </tr>
              ) : (
                sortedPunches.map((punch) => (
                  <tr
                    key={punch.id}
                    onClick={() => handlePunchClick(punch.id)}
                    className={`
                      cursor-pointer transition-colors
                      ${selectedPunch?.id === punch.id
                        ? 'bg-accent-blue/10 border-l-4 border-l-accent-blue'
                        : 'hover:bg-background/30'
                      }
                    `}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{punch.employeeName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{punch.clientName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{formatDate(punch.punchInTime)}</div>
                      <div className="text-xs text-foreground/50">{formatTime(punch.punchInTime)}</div>
                    </td>
                    <td className="px-4 py-3">
                      {punch.punchOutTime ? (
                        <>
                          <div className="text-sm">{formatDate(punch.punchOutTime)}</div>
                          <div className="text-xs text-foreground/50">{formatTime(punch.punchOutTime)}</div>
                        </>
                      ) : (
                        <span className="text-foreground/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{formatDuration(punch.duration)}</div>
                    </td>
                    <td className="px-4 py-3">
                      {punch.punchOutTime ? (
                        <span className="px-2 py-1 text-xs bg-green-500/20 text-green-600 rounded-lg">
                          Completed
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-orange-500/20 text-orange-600 rounded-lg">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-foreground/70 max-w-xs truncate flex-1">
                          {punch.notes || '—'}
                        </div>
                        {punch.notes && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingMemo(punch.notes || null);
                            }}
                            className="p-1.5 text-foreground/50 hover:text-foreground/80 hover:bg-background/30 rounded transition-colors"
                            title="View full memo"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {loadingMore && (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-foreground/50">
                    Loading more...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      {sortedPunches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-shrink-0">
          <div className="glass-card p-2.5">
            <div className="text-xs text-foreground/50 uppercase tracking-wider">Total Punches</div>
            <div className="text-xl font-bold">{sortedPunches.length}</div>
          </div>
          <div className="glass-card p-2.5">
            <div className="text-xs text-foreground/50 uppercase tracking-wider">Active Punches</div>
            <div className="text-xl font-bold text-orange-600">
              {sortedPunches.filter(p => !p.punchOutTime).length}
            </div>
          </div>
          <div className="glass-card p-2.5">
            <div className="text-xs text-foreground/50 uppercase tracking-wider">Total Hours</div>
            <div className="text-xl font-bold text-accent-blue">
              {(sortedPunches.reduce((sum, p) => sum + (p.duration || 0), 0) / 60).toFixed(1)}h
            </div>
          </div>
        </div>
      )}

      {/* Memo View Modal */}
      {viewingMemo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewingMemo(null)}>
          <div className="glass-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Memo</h2>
              <button
                onClick={() => setViewingMemo(null)}
                className="px-3 py-1 text-sm bg-foreground/10 rounded-lg hover:bg-foreground/20 transition-colors"
              >
                Close
              </button>
            </div>
            <div className="text-sm text-foreground/70 whitespace-pre-wrap">
              {viewingMemo}
            </div>
          </div>
        </div>
      )}

      {/* Punch Details Modal/Sidebar */}
      {selectedPunch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPunch(null)}>
          <div className="glass-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Punch Details</h2>
              <div className="flex gap-2">
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 text-sm bg-accent-blue/20 text-accent-blue rounded-lg hover:bg-accent-blue/30 transition-colors"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => setSelectedPunch(null)}
                  className="px-3 py-1 text-sm bg-foreground/10 rounded-lg hover:bg-foreground/20 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {isEditing ? (
              <PunchEditForm
                punch={selectedPunch}
                onSave={handleSave}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-foreground/50 uppercase tracking-wider">Employee</label>
                  <p className="mt-1 font-medium">{selectedPunch.employeeName || selectedPunch.employeeId || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-xs text-foreground/50 uppercase tracking-wider">Client</label>
                  <p className="mt-1 font-medium">{selectedPunch.clientName || selectedPunch.clientId || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-xs text-foreground/50 uppercase tracking-wider">Punch In</label>
                  <p className="mt-1 font-medium">{formatDateTime(selectedPunch.punchInTime)}</p>
                </div>
                {selectedPunch.punchOutTime && (
                  <div>
                    <label className="text-xs text-foreground/50 uppercase tracking-wider">Punch Out</label>
                    <p className="mt-1 font-medium">{formatDateTime(selectedPunch.punchOutTime)}</p>
                  </div>
                )}
                {selectedPunch.duration && (
                  <div>
                    <label className="text-xs text-foreground/50 uppercase tracking-wider">Duration</label>
                    <p className="mt-1 font-medium">{formatDuration(selectedPunch.duration)}</p>
                  </div>
                )}
                {selectedPunch.notes && (
                  <div>
                    <label className="text-xs text-foreground/50 uppercase tracking-wider">Memo</label>
                    <p className="mt-1 text-sm text-foreground/70 whitespace-pre-wrap">{selectedPunch.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PunchEditForm({
  punch,
  onSave,
  onCancel,
}: {
  punch: Punch;
  onSave: (punch: Punch) => void;
  onCancel: () => void;
}) {
  const formatDateTimeLocal = (isoString: string) => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState({
    punchInTime: formatDateTimeLocal(punch.punchInTime),
    punchOutTime: punch.punchOutTime ? formatDateTimeLocal(punch.punchOutTime) : '',
    notes: punch.notes || '',
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...punch,
          punchInTime: new Date(formData.punchInTime).toISOString(),
          punchOutTime: formData.punchOutTime ? new Date(formData.punchOutTime).toISOString() : undefined,
          notes: formData.notes || undefined,
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
          Punch In
        </label>
        <input
          type="datetime-local"
          value={formData.punchInTime}
          onChange={(e) => setFormData({ ...formData, punchInTime: e.target.value })}
          className="w-full px-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
          required
        />
      </div>
      <div>
        <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
          Punch Out
        </label>
        <input
          type="datetime-local"
          value={formData.punchOutTime}
          onChange={(e) => setFormData({ ...formData, punchOutTime: e.target.value })}
          className="w-full px-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
        />
      </div>
      <div>
        <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
          Memo
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
          rows={3}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 transition-colors"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-foreground/10 rounded-lg hover:bg-foreground/20 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
