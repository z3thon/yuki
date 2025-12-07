'use client';

import { useState, useEffect, useMemo } from 'react';
import { useViewDataCache } from '@/lib/useViewDataCache';

interface Department {
  id: string;
  name: string;
  companyId: string;
  payPeriodType: string | null;
  payPeriodStartDays: string | null;
  payPeriodEndDays: string | null;
  payoutDays: string | null;
  payPeriodMemo: string | null;
  allowMemoChangesWithoutApproval: boolean;
}

interface PayPeriodTemplate {
  id: string;
  periodNumber: number;
  startDay: number;
  endDay: number;
  payoutDay: string; // "last" or number string
  payoutMonthOffset: number; // 0 = same month, 1 = next month
  isActive: boolean;
}

interface PayPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  payoutDate: string | null;
  periodType: string | null;
  totalHours?: number; // Optional - loaded lazily
  timeCardCount?: number; // Optional - loaded lazily
  relevance?: 'current' | 'upcoming' | 'past'; // Optional for backward compatibility
}

interface PayPeriodTotals {
  id: string;
  totalHours: number;
  timeCardCount: number;
  employeeHours?: EmployeeHours[]; // Cached employee hours
}

interface EmployeeHours {
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  totalHours: number;
  timeCardCount: number;
  timeCards: Array<{
    id: string;
    clientId: string | null;
    totalHours: number;
  }>;
}

export default function PayPeriodsViewComponent() {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState<string | null>(null);
  const [employeeHours, setEmployeeHours] = useState<EmployeeHours[]>([]);
  const [loadingEmployeeHours, setLoadingEmployeeHours] = useState(false);
  const [payPeriodLimit, setPayPeriodLimit] = useState(5); // Start with 5 periods
  const [loadingMore, setLoadingMore] = useState(false);
  const [departmentTemplates, setDepartmentTemplates] = useState<PayPeriodTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingTotals, setLoadingTotals] = useState<Set<string>>(new Set());
  const [payPeriodTotals, setPayPeriodTotals] = useState<Map<string, PayPeriodTotals>>(new Map());
  const [refreshingEmployeeHours, setRefreshingEmployeeHours] = useState(false);

  // Fetch departments
  const fetchDepartments = useMemo(() => async () => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch('/api/hr/departments', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to fetch departments');
    }

    const data = await response.json();
    return { departments: data.departments || [] };
  }, []);

  const { data: departmentsData, loading: departmentsLoading } = useViewDataCache<{ departments: Department[] }>({
    viewId: 'departments',
    cacheKey: 'all',
    fetchFn: fetchDepartments,
  });

  const departments = departmentsData?.departments || [];

  // Auto-select first department if available
  useEffect(() => {
    if (departments.length > 0 && !selectedDepartmentId) {
      setSelectedDepartmentId(departments[0].id);
    }
  }, [departments, selectedDepartmentId]);

  // Clear totals and employee hours cache when department changes
  useEffect(() => {
    setPayPeriodTotals(new Map());
    setLoadingTotals(new Set());
    setEmployeeHours([]);
    setSelectedPayPeriodId(null);
  }, [selectedDepartmentId]);

  // Fetch pay period templates when department is selected
  useEffect(() => {
    if (!selectedDepartmentId) {
      setDepartmentTemplates([]);
      return;
    }

    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        // Use inline auth token fetch to avoid duplicate getAuthToken definition
        const { getAuth } = await import('firebase/auth');
        const { auth } = await import('@/lib/firebase');
        const user = auth.currentUser;
        if (!user) {
          throw new Error('Not authenticated');
        }
        const token = await user.getIdToken();

        const response = await fetch(`/api/hr/departments/${selectedDepartmentId}/templates`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch templates');
        }

        const data = await response.json();
        console.log('📋 Templates fetched:', {
          count: data.templates?.length || 0,
          templates: data.templates,
        });
        setDepartmentTemplates(data.templates || []);
      } catch (error: any) {
        console.error('❌ Error fetching department templates:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          selectedDepartmentId,
        });
        setDepartmentTemplates([]);
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, [selectedDepartmentId]);

  // Fetch pay periods for selected department
  const fetchPayPeriods = useMemo(() => async () => {
    if (!selectedDepartmentId) {
      console.log('⚠️ No selectedDepartmentId - returning empty');
      return { payPeriods: [] };
    }

    console.log('Fetching pay periods for department:', selectedDepartmentId);

    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const params = new URLSearchParams();
    params.set('department_id', selectedDepartmentId);
    params.set('limit', payPeriodLimit.toString());
    // Don't calculate totals here - load them lazily after cards are displayed
    // This makes the initial load instant
    
    const url = `/api/hr/pay-periods?${params.toString()}`;
    console.log('Fetching from URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || `Failed to fetch pay periods (${response.status})` };
      }
      console.error('Pay periods API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        errorText,
      });
      // Don't throw error - return empty array to preserve existing data
      // The error will be shown via payPeriodsError state
      return { payPeriods: [] };
    }

    const data = await response.json();
    console.log('Pay periods response:', { 
      count: data.payPeriods?.length, 
      payPeriods: data.payPeriods,
      firstPayPeriod: data.payPeriods?.[0],
    });
    return { payPeriods: data.payPeriods || [] };
  }, [selectedDepartmentId, payPeriodLimit]);

  const { data: payPeriodsData, loading: payPeriodsLoading, error: payPeriodsError } = useViewDataCache<{ payPeriods: PayPeriod[] }>({
    viewId: 'pay-periods',
    cacheKey: selectedDepartmentId ? `${selectedDepartmentId}_${payPeriodLimit}` : 'none',
    fetchFn: fetchPayPeriods,
    enabled: !!selectedDepartmentId,
  });

  // Log errors for debugging
  useEffect(() => {
    if (payPeriodsError) {
      console.error('Pay periods fetch error:', payPeriodsError);
    }
  }, [payPeriodsError]);

  const payPeriods = payPeriodsData?.payPeriods || [];
  
  // Fetch totals lazily after pay periods are loaded
  useEffect(() => {
    if (payPeriods.length === 0 || payPeriodsLoading) {
      return;
    }

    // Get pay period IDs that don't have totals yet
    const payPeriodIdsToLoad = payPeriods
      .filter(pp => !payPeriodTotals.has(pp.id) && !loadingTotals.has(pp.id))
      .map(pp => pp.id);

    if (payPeriodIdsToLoad.length === 0) {
      return;
    }

    const fetchTotals = async () => {
      // Mark as loading
      setLoadingTotals(prev => {
        const next = new Set(prev);
        payPeriodIdsToLoad.forEach(id => next.add(id));
        return next;
      });

      try {
        const token = await getAuthToken();
        if (!token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch('/api/hr/pay-periods/totals', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            payPeriodIds: payPeriodIdsToLoad,
            includeEmployeeHours: true, // Cache employee hours along with totals
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch totals');
        }

        const data = await response.json();
        const totals = data.totals || [];

        // Update totals map (includes cached employee hours)
        setPayPeriodTotals(prev => {
          const next = new Map(prev);
          totals.forEach((total: PayPeriodTotals) => {
            next.set(total.id, total);
          });
          return next;
        });
        
        // If a pay period is currently selected and we just loaded its data, update employee hours immediately
        if (selectedPayPeriodId && totals.some((t: PayPeriodTotals) => t.id === selectedPayPeriodId)) {
          const selectedTotal = totals.find((t: PayPeriodTotals) => t.id === selectedPayPeriodId);
          if (selectedTotal?.employeeHours) {
            setEmployeeHours(selectedTotal.employeeHours);
            setLoadingEmployeeHours(false);
          }
        }
      } catch (error: any) {
        console.error('Error fetching pay period totals:', error);
      } finally {
        // Remove from loading set
        setLoadingTotals(prev => {
          const next = new Set(prev);
          payPeriodIdsToLoad.forEach(id => next.delete(id));
          return next;
        });
      }
    };

    fetchTotals();
  }, [payPeriods, payPeriodsLoading, payPeriodTotals, loadingTotals]);

  // Debug logging
  useEffect(() => {
    console.log('PayPeriodsView state:', {
      payPeriodsData,
      payPeriodsCount: payPeriods.length,
      payPeriodsLoading,
      payPeriodsError,
      selectedDepartmentId,
    });
  }, [payPeriodsData, payPeriods.length, payPeriodsLoading, payPeriodsError, selectedDepartmentId]);

  // Prevent clearing selected pay period if it still exists in the list
  useEffect(() => {
    if (selectedPayPeriodId && payPeriods.length > 0) {
      const payPeriodExists = payPeriods.some(pp => pp.id === selectedPayPeriodId);
      if (!payPeriodExists) {
        // Selected pay period no longer in list (maybe due to limit change), clear selection
        setSelectedPayPeriodId(null);
        setEmployeeHours([]);
      }
    }
  }, [payPeriods, selectedPayPeriodId]);

  // Determine current and previous pay periods
  // Use the relevance field from API (more reliable than client-side calculation)
  const { currentPayPeriod, previousPayPeriod } = useMemo(() => {
    // Use API's relevance field if available
    const currentPeriod = payPeriods.find(pp => pp.relevance === 'current') || null;
    
    // Find previous period - the most recent past period
    // Previous is the most recent past period (relevance === 'past')
    const pastPeriods = payPeriods.filter(pp => pp.relevance === 'past');
    const previousPeriod = pastPeriods.length > 0 
      ? pastPeriods.sort((a, b) => {
          // Sort past periods by start date descending (most recent first)
          const dateA = new Date(a.startDate).getTime();
          const dateB = new Date(b.startDate).getTime();
          return dateB - dateA;
        })[0] // Get the most recent past period
      : null;

    return { 
      currentPayPeriod: currentPeriod, 
      previousPayPeriod: previousPeriod 
    };
  }, [payPeriods]);

  // Load employee hours when pay period is selected (use cache if available)
  useEffect(() => {
    if (!selectedPayPeriodId) {
      setEmployeeHours([]);
      return;
    }

    // Check if we have cached employee hours for this pay period
    const cachedTotal = payPeriodTotals.get(selectedPayPeriodId);
    if (cachedTotal?.employeeHours) {
      console.log(`✅ Using cached employee hours for pay period ${selectedPayPeriodId}`);
      setEmployeeHours(cachedTotal.employeeHours);
      setLoadingEmployeeHours(false);
      return;
    }

    // If not cached, fetch from API
    const fetchEmployeeHours = async () => {
      setLoadingEmployeeHours(true);
      try {
        const token = await getAuthToken();
        if (!token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(`/api/hr/pay-periods/${selectedPayPeriodId}/employees`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch employee hours');
        }

        const data = await response.json();
        setEmployeeHours(data.employeeHours || []);
      } catch (error: any) {
        console.error('Error fetching employee hours:', error);
        setEmployeeHours([]);
      } finally {
        setLoadingEmployeeHours(false);
      }
    };

    fetchEmployeeHours();
  }, [selectedPayPeriodId, payPeriodTotals]);

  // Refresh employee hours manually
  const handleRefreshEmployeeHours = async () => {
    if (!selectedPayPeriodId) return;

    setRefreshingEmployeeHours(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/hr/pay-periods/${selectedPayPeriodId}/employees`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to refresh employee hours');
      }

      const data = await response.json();
      setEmployeeHours(data.employeeHours || []);
      
      // Update cache
      setPayPeriodTotals(prev => {
        const next = new Map(prev);
        const existing = next.get(selectedPayPeriodId);
        if (existing) {
          next.set(selectedPayPeriodId, {
            ...existing,
            employeeHours: data.employeeHours || [],
          });
        }
        return next;
      });
    } catch (error: any) {
      console.error('Error refreshing employee hours:', error);
    } finally {
      setRefreshingEmployeeHours(false);
    }
  };

  const getAuthToken = async (): Promise<string | null> => {
    const { getAuth } = await import('firebase/auth');
    const { auth } = await import('@/lib/firebase');
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    try {
      // Parse date string as local date (not UTC)
      // Fillout returns dates as "YYYY-MM-DD" format, which should be treated as local dates
      let date: Date;
      
      if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
        // Parse YYYY-MM-DD format as local date
        const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
        date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
      } else {
        // Fallback to standard Date parsing for other formats
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return dateString; // Return original if invalid
      }
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Use user's timezone
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateTimeString: string) => {
    try {
      // Parse date string appropriately based on format
      let date: Date;
      
      if (typeof dateTimeString === 'string' && dateTimeString.match(/^\d{4}-\d{2}-\d{2}/)) {
        // If it's just a date (YYYY-MM-DD), parse as local date
        if (dateTimeString.length === 10) {
          const [year, month, day] = dateTimeString.split('-').map(Number);
          date = new Date(year, month - 1, day);
        } else {
          // If it includes time, parse normally (may be ISO format)
          date = new Date(dateTimeString);
        }
      } else {
        date = new Date(dateTimeString);
      }
      
      if (isNaN(date.getTime())) {
        return dateTimeString; // Return original if invalid
      }
      
      // Format as YYYY-MM-DD HH:MM with timezone abbreviation
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      // Get timezone abbreviation (e.g., EST, CST, PST)
      const timeZone = Intl.DateTimeFormat('en-US', { 
        timeZoneName: 'short',
        timeZone: 'America/Chicago', // Default to Central Time
      }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value || 'CT';
      
      return `${year}-${month}-${day} ${hours}:${minutes} ${timeZone}`;
    } catch {
      return dateTimeString;
    }
  };

  const formatHours = (hours: number) => {
    return `${hours.toFixed(2)} hrs`;
  };

  const selectedDepartment = departments.find(d => d.id === selectedDepartmentId);
  const selectedPayPeriod = payPeriods.find(pp => pp.id === selectedPayPeriodId);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      setPayPeriodLimit(prev => prev + 5); // Load 5 more periods
    } finally {
      setLoadingMore(false);
    }
  };

  const handleExportCSV = () => {
    if (!selectedPayPeriodId || employeeHours.length === 0 || !selectedPayPeriod) {
      return;
    }

    const headers = ['Employee Name', 'Email', 'Total Hours', 'Time Cards'];
    const rows = employeeHours.map(eh => [
      eh.employeeName,
      eh.employeeEmail || '',
      eh.totalHours.toFixed(2),
      eh.timeCardCount.toString(),
    ]);

    const csv = [
      `Department: ${selectedDepartment?.name || 'Unknown'}`,
      `Pay Period: ${selectedPayPeriod.name} (${formatDate(selectedPayPeriod.startDate)} - ${formatDate(selectedPayPeriod.endDate)})`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = selectedPayPeriod.startDate;
    a.download = `pay-period-${selectedDepartment?.name?.replace(/\s+/g, '-') || 'unknown'}-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (departmentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground/50">Loading departments...</div>
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="p-6">
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-2">No Departments Found</h2>
          <p className="text-foreground/70">Please create a department first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pay Periods</h1>
          {selectedDepartment && (
            <p className="text-lg font-semibold text-foreground/80 mt-1">
              {selectedDepartment.name}
            </p>
          )}
        </div>
        {selectedPayPeriodId && employeeHours.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-accent-blue/20 text-accent-blue rounded-lg hover:bg-accent-blue/30 transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Department Selector */}
      <div className="glass-card p-4">
        <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-2">
          Department
        </label>
        <select
          value={selectedDepartmentId || ''}
          onChange={(e) => {
            setSelectedDepartmentId(e.target.value);
            setSelectedPayPeriodId(null);
            setEmployeeHours([]);
            setPayPeriodLimit(5); // Reset to initial limit when changing departments
          }}
          className="w-full px-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
        >
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      {/* Department Settings - Using Templates */}
      {selectedDepartment && (
        <div className="glass-card p-3">
          {loadingTemplates ? (
            <div className="text-sm text-foreground/50">Loading templates...</div>
          ) : departmentTemplates.length > 0 ? (
            // Show templates if available
            <div className="space-y-2">
              {selectedDepartment.payPeriodType && (
                <div className="text-sm mb-2">
                  <span className="text-foreground/50">Pay Period Type: </span>
                  <span className="font-medium">{selectedDepartment.payPeriodType}</span>
                </div>
              )}
              <div className="space-y-1">
                {departmentTemplates.map((template) => {
                  // Format date range - handle month-spanning periods
                  const isMonthSpanning = template.endDay < template.startDay;
                  const dateRange = isMonthSpanning 
                    ? `Days ${template.startDay}-${template.endDay} (spans months)`
                    : `Days ${template.startDay}-${template.endDay}`;
                  
                  // Format payout day
                  const payoutDisplay = template.payoutDay === 'last' ? 'Last day' : `Day ${template.payoutDay}`;
                  
                  return (
                    <div key={template.id} className="text-xs bg-accent-blue/5 rounded px-2 py-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">Period {template.periodNumber}:</span>
                        <span className="text-foreground/70">{dateRange}</span>
                        <span className="text-foreground/50">•</span>
                        <span className="text-foreground/70">Payout: {payoutDisplay}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // Fallback to legacy fields only if templates failed to load
            // This should rarely happen - templates should always be available
            <div className="space-y-2">
              <div className="text-xs text-yellow-600/70 mb-2">
                ⚠️ Templates not loaded, showing legacy fields
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {selectedDepartment.payPeriodType && (
                  <div className="flex items-center gap-2">
                    <span className="text-foreground/50">Type:</span>
                    <span className="font-medium">{selectedDepartment.payPeriodType}</span>
                  </div>
                )}
                {selectedDepartment.payPeriodStartDays && (
                  <div className="flex items-center gap-2">
                    <span className="text-foreground/50">Starts:</span>
                    <span className="font-medium">{selectedDepartment.payPeriodStartDays}</span>
                  </div>
                )}
                {selectedDepartment.payPeriodEndDays && (
                  <div className="flex items-center gap-2">
                    <span className="text-foreground/50">Ends:</span>
                    <span className="font-medium">{selectedDepartment.payPeriodEndDays}</span>
                  </div>
                )}
                {selectedDepartment.payoutDays && (
                  <div className="flex items-center gap-2">
                    <span className="text-foreground/50">Payout:</span>
                    <span className="font-medium">{selectedDepartment.payoutDays}</span>
                  </div>
                )}
                {!selectedDepartment.payPeriodType && !selectedDepartment.payPeriodStartDays && (
                  <span className="text-foreground/50">No pay period settings configured</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pay Periods Horizontal List */}
      {payPeriodsLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-foreground/50">Loading pay periods...</div>
        </div>
      ) : payPeriodsError ? (
        <div className="glass-card p-6 border border-red-500/30">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading Pay Periods</h2>
          <p className="text-foreground/70">{payPeriodsError}</p>
        </div>
      ) : payPeriods.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-foreground/50">No pay periods found for this department</p>
        </div>
      ) : (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4">Pay Periods</h2>
          <div className="overflow-x-auto">
            <div className="flex gap-3 pb-4" style={{ minWidth: 'max-content' }}>
              {payPeriods.map((payPeriod) => {
                const isCurrent = currentPayPeriod?.id === payPeriod.id;
                const isPrevious = previousPayPeriod?.id === payPeriod.id;
                const isSelected = selectedPayPeriodId === payPeriod.id;
                const isLoadingTotals = loadingTotals.has(payPeriod.id);
                const totals = payPeriodTotals.get(payPeriod.id);
                const totalHours = totals?.totalHours ?? payPeriod.totalHours ?? 0;
                const timeCardCount = totals?.timeCardCount ?? payPeriod.timeCardCount ?? 0;

                return (
                  <button
                    key={payPeriod.id}
                    onClick={() => setSelectedPayPeriodId(payPeriod.id)}
                    className={`
                      flex-shrink-0 px-4 py-3 rounded-lg border-2 transition-all cursor-pointer
                      ${isSelected
                        ? 'border-accent-blue/50 bg-accent-blue/10'
                        : isCurrent
                        ? 'border-green-500/50 bg-green-500/10'
                        : isPrevious
                        ? 'border-yellow-500/50 bg-yellow-500/10'
                        : 'border-foreground/10 hover:border-foreground/20'
                      }
                    `}
                    style={{ minWidth: '200px' }}
                  >
                    <div className="text-left">
                      {isCurrent && (
                        <span className="text-xs font-semibold text-green-600 mb-1 block">
                          CURRENT
                        </span>
                      )}
                      {isPrevious && !isCurrent && (
                        <span className="text-xs font-semibold text-yellow-600 mb-1 block">
                          PREVIOUS
                        </span>
                      )}
                      <div className="font-semibold mb-1">
                        {formatDate(payPeriod.startDate)} - {formatDate(payPeriod.endDate)}
                      </div>
                      <div className="text-sm font-medium mt-2 flex items-center gap-2">
                        {isLoadingTotals ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-foreground/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-foreground/50">Loading...</span>
                          </>
                        ) : (
                          formatHours(totalHours || 0)
                        )}
                      </div>
                      <div className="text-xs text-foreground/50 flex items-center gap-2">
                        {isLoadingTotals ? (
                          <>
                            <svg className="animate-spin h-3 w-3 text-foreground/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            {timeCardCount} time card{timeCardCount !== 1 ? 's' : ''}
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {payPeriods.length >= payPeriodLimit && (
            <div className="mt-4 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 bg-accent-blue/20 text-accent-blue rounded-lg hover:bg-accent-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? 'Loading...' : 'Load More Pay Periods'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Employee Hours */}
      {selectedPayPeriodId && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Employee Hours
              {selectedPayPeriod && (
                <span className="text-sm font-normal text-foreground/60 ml-2">
                  - {formatDate(selectedPayPeriod.startDate)} - {formatDate(selectedPayPeriod.endDate)}
                </span>
              )}
            </h2>
            <button
              onClick={handleRefreshEmployeeHours}
              disabled={refreshingEmployeeHours}
              className="px-3 py-1.5 text-sm bg-accent-blue/20 text-accent-blue rounded-lg hover:bg-accent-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Refresh employee hours data"
            >
              {refreshingEmployeeHours ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          </div>
          {loadingEmployeeHours ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-foreground/50">Loading employee hours...</div>
            </div>
          ) : employeeHours.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-foreground/50">No employee hours found for this pay period</p>
            </div>
          ) : (
            <div className="space-y-3">
              {employeeHours.map((eh) => (
                <div
                  key={eh.employeeId}
                  className="p-4 bg-background/30 rounded-lg border border-foreground/10"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{eh.employeeName}</h3>
                      {eh.employeeEmail && (
                        <p className="text-sm text-foreground/50">{eh.employeeEmail}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{formatHours(eh.totalHours)}</div>
                      <p className="text-xs text-foreground/50">
                        {eh.timeCardCount} time card{eh.timeCardCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-foreground/10">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">
                    {formatHours(employeeHours.reduce((sum, eh) => sum + eh.totalHours, 0))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
