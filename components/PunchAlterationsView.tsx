'use client';

import { useState, useEffect, useMemo } from 'react';
import { useViewDataCache } from '@/lib/useViewDataCache';

interface Alteration {
  id: string;
  punchId?: string;
  punchDetails?: {
    id: string;
    employeeId?: string;
    punchInTime: string;
    punchOutTime?: string;
    punchInTimezoneIana?: string | null;
    punchOutTimezoneIana?: string | null;
  };
  employeeName?: string | null;
  requestedAt: string;
  newPunchInTime?: string | null;
  newPunchOutTime?: string | null;
  newPunchInTimezoneIana?: string | null;
  newPunchOutTimezoneIana?: string | null;
  newPunchInTimezoneName?: string | null;
  newPunchOutTimezoneName?: string | null;
  newMemo?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
  previousDuration?: number | null; // Duration in minutes
  newDuration?: number | null; // Duration in minutes
}

export default function PunchAlterationsViewComponent() {
  const [selectedAlteration, setSelectedAlteration] = useState<Alteration | null>(null);
  const [selectedAlterationIds, setSelectedAlterationIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // Create cache key based on status filter
  const cacheKey = useMemo(() => {
    return `status:${statusFilter}`;
  }, [statusFilter]);

  // Fetch alterations with caching
  const fetchAlterations = useMemo(() => async () => {
      const token = await getAuthToken();
      if (!token) {
      throw new Error('Not authenticated');
      }
      
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      
      const response = await fetch(`/api/hr/alterations?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 403) {
        throw new Error('You do not have permission to view punch alterations');
        } else {
          const data = await response.json();
        throw new Error(data.error || 'Failed to fetch alterations');
        }
      }

      const data = await response.json();
    return { alterations: data.alterations || [] };
  }, [statusFilter]);

  const { data, loading, error, refetch } = useViewDataCache<{ alterations: Alteration[] }>({
    viewId: 'punch-alterations',
    cacheKey,
    fetchFn: fetchAlterations,
  });

  const alterations = data?.alterations || [];

  const getAuthToken = async (): Promise<string | null> => {
    const { getAuth } = await import('firebase/auth');
    const { auth } = await import('@/lib/firebase');
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  };

  const handleApprove = async (alterationId: string) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch(`/api/hr/alterations/${alterationId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewNotes }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          alert('You do not have permission to approve alterations');
        } else {
          const data = await response.json();
          alert(data.error || 'Failed to approve alteration');
        }
        return;
      }

      setReviewNotes('');
      setSelectedAlterationIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(alterationId);
        return newSet;
      });
      refetch();
      setSelectedAlteration(null);
    } catch (err) {
      console.error('Error approving alteration:', err);
      alert('Failed to approve alteration');
    }
  };

  const handleDecline = async (alterationId: string) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch(`/api/hr/alterations/${alterationId}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewNotes }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          alert('You do not have permission to decline alterations');
        } else {
          const data = await response.json();
          alert(data.error || 'Failed to decline alteration');
        }
        return;
      }

      setReviewNotes('');
      refetch();
      setSelectedAlteration(null);
    } catch (err) {
      console.error('Error declining alteration:', err);
      alert('Failed to decline alteration');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedAlterationIds.size === 0) {
      alert('Please select at least one alteration to approve');
      return;
    }

    if (!confirm(`Are you sure you want to approve ${selectedAlterationIds.size} alteration(s)?`)) {
      return;
    }

    setIsBulkApproving(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch('/api/hr/alterations/bulk-approve', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alterationIds: Array.from(selectedAlterationIds),
          reviewNotes,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          alert('You do not have permission to approve alterations');
        } else {
          const data = await response.json();
          alert(data.error || 'Failed to approve alterations');
        }
        return;
      }

      const data = await response.json();
      if (data.failed > 0) {
        alert(`Approved ${data.approved} alteration(s), but ${data.failed} failed. Check console for details.`);
        console.error('Failed alterations:', data.results.failed);
      } else {
        alert(`Successfully approved ${data.approved} alteration(s)`);
      }

      setReviewNotes('');
      setSelectedAlterationIds(new Set());
      setSelectedAlteration(null);
      refetch();
    } catch (err) {
      console.error('Error bulk approving alterations:', err);
      alert('Failed to approve alterations');
    } finally {
      setIsBulkApproving(false);
    }
  };

  const toggleAlterationSelection = (alterationId: string) => {
    const newSelection = new Set(selectedAlterationIds);
    if (newSelection.has(alterationId)) {
      newSelection.delete(alterationId);
    } else {
      newSelection.add(alterationId);
    }
    setSelectedAlterationIds(newSelection);
  };

  const toggleSelectAll = () => {
    const pendingAlterations = alterations.filter(a => a.status === 'pending');
    if (selectedAlterationIds.size === pendingAlterations.length) {
      setSelectedAlterationIds(new Set());
    } else {
      setSelectedAlterationIds(new Set(pendingAlterations.map(a => a.id)));
    }
  };

  // Format date/time with timezone abbreviation
  const formatDateTime = (dateString: string, timezoneIana?: string | null, timezoneDisplayName?: string | null) => {
    const date = new Date(dateString);
    
    // Use provided timezone - if not provided, we can't display correctly
    // Don't fall back to device timezone as that would be wrong
    const timeZone = timezoneIana || undefined;
    
    // If no timezone provided, log warning and try to use display name for abbreviation
    if (!timeZone && !timezoneDisplayName) {
      console.warn('formatDateTime: No timezone IANA or display name provided for date:', dateString);
    }
    
    // Format date and time
    const dateTimeStr = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...(timeZone && { timeZone }), // Only include timeZone if provided
    });
    
    // Get timezone abbreviation - prioritize IANA name, fall back to display name
    const timeZoneAbbr = getTimezoneAbbreviation(
      date, 
      timeZone || '', 
      timezoneDisplayName
    );
    
    return `${dateTimeStr} ${timeZoneAbbr}`;
  };

  // Get timezone abbreviation (e.g., "MT", "CT", "ET", "CST", "GST")
  // Can use display name as fallback if IANA name doesn't resolve correctly
  const getTimezoneAbbreviation = (date: Date, timeZone: string, displayName?: string | null): string => {
    try {
      // First priority: Use display name if IANA name is missing or invalid
      if (displayName && (!timeZone || timeZone === '' || timeZone === 'UTC')) {
        const nameUpper = displayName.toUpperCase();
        if (nameUpper.includes('CHINA')) {
          return 'CST';
        }
        if (nameUpper.includes('DUBAI') || nameUpper.includes('GULF')) {
          return 'GST';
        }
        // Extract from display name: "China Time Standard Time" -> "CST"
        const words = displayName.split(/\s+/);
        if (words.length >= 3) {
          // Take first letter of first 3 words
          return words[0].substring(0, 1).toUpperCase() + 
                 words[1].substring(0, 1).toUpperCase() + 
                 words[2].substring(0, 1).toUpperCase();
        }
        if (words.length >= 2) {
          return words[0].substring(0, 1).toUpperCase() + words[1].substring(0, 1).toUpperCase();
        }
      }
      
      // Second priority: Direct IANA name mapping (most reliable)
      if (timeZone && timeZone !== '' && timeZone !== 'UTC') {
        // Direct IANA name mapping
        const timezoneMap: Record<string, string> = {
          'Asia/Shanghai': 'CST',
          'Asia/Dubai': 'GST',
          'Asia/Beijing': 'CST',
          'Asia/Hong_Kong': 'HKT',
          'Asia/Tokyo': 'JST',
          'Asia/Seoul': 'KST',
          'Asia/Singapore': 'SGT',
          'Asia/Mumbai': 'IST',
          'Asia/Kolkata': 'IST',
          'Asia/Delhi': 'IST',
          'Asia/Bangkok': 'ICT',
          'Asia/Jakarta': 'WIB',
          'Asia/Manila': 'PHT',
        };
        
        if (timezoneMap[timeZone]) {
          return timezoneMap[timeZone];
        }
        
        // Handle Asia timezones by city name
        if (timeZone.includes('Asia/')) {
          const city = timeZone.split('/')[1];
          const asiaCityMap: Record<string, string> = {
            'Shanghai': 'CST', 'Beijing': 'CST', 'Chongqing': 'CST', 'Hong_Kong': 'HKT',
            'Dubai': 'GST', 'Abu_Dhabi': 'GST', 'Muscat': 'GST',
            'Tokyo': 'JST', 'Seoul': 'KST', 'Singapore': 'SGT',
            'Mumbai': 'IST', 'Kolkata': 'IST', 'Delhi': 'IST',
            'Bangkok': 'ICT', 'Jakarta': 'WIB', 'Manila': 'PHT',
          };
          if (asiaCityMap[city]) {
            return asiaCityMap[city];
          }
        }
        
        // Handle America timezones
        if (timeZone.includes('America/')) {
          const city = timeZone.split('/')[1];
          const cityMap: Record<string, string> = {
            'Denver': 'MT', 'Phoenix': 'MT', 'Boise': 'MT',
            'Chicago': 'CT', 'Dallas': 'CT', 'Houston': 'CT', 'Minneapolis': 'CT',
            'New_York': 'ET', 'Detroit': 'ET', 'Indianapolis': 'ET', 'Miami': 'ET',
            'Los_Angeles': 'PT', 'Seattle': 'PT', 'San_Francisco': 'PT',
            'Anchorage': 'AKT', 'Juneau': 'AKT',
            'Honolulu': 'HT',
          };
          return cityMap[city] || city.substring(0, 2).toUpperCase();
        }
        
        // Try Intl.DateTimeFormat as last resort for IANA names
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            timeZoneName: 'short',
          });
          
          const parts = formatter.formatToParts(date);
          const timeZoneNamePart = parts.find(part => part.type === 'timeZoneName');
          
          if (timeZoneNamePart) {
            const abbr = timeZoneNamePart.value.toUpperCase();
            
            // Map common abbreviations
            const abbrMap: Record<string, string> = {
              'EST': 'ET', 'EDT': 'ET', 'CST': 'CST', 'CDT': 'CT',
              'MST': 'MT', 'MDT': 'MT', 'PST': 'PT', 'PDT': 'PT',
              'AKST': 'AKT', 'AKDT': 'AKT', 'HST': 'HT', 'HDT': 'HT',
              'GMT': 'GMT', 'UTC': 'UTC',
              'GST': 'GST', // Gulf Standard Time
            };
            
            if (abbrMap[abbr]) {
              return abbrMap[abbr];
            }
            
            // For Asia timezones, preserve longer abbreviations
            if (abbr.includes('CST') || abbr.includes('CHINA')) {
              return 'CST';
            }
            if (abbr.includes('GST') || abbr.includes('GULF') || abbr.includes('DUBAI')) {
              return 'GST';
            }
            
            // Clean up and return
            const cleaned = abbr.replace(/[+-\d]/g, '').replace(/[DST]/g, '');
            if (cleaned.length >= 2) {
              return cleaned.substring(0, Math.min(cleaned.length, 3));
            }
            return abbr.substring(0, Math.min(abbr.length, 3));
          }
        } catch (err) {
          // Intl failed, continue to fallback
        }
      }
      
      // Final fallback: Use display name if available
      if (displayName) {
        const nameUpper = displayName.toUpperCase();
        if (nameUpper.includes('CHINA')) {
          return 'CST';
        }
        if (nameUpper.includes('DUBAI') || nameUpper.includes('GULF')) {
          return 'GST';
        }
      }
      
      return 'UTC';
    } catch (err) {
      console.error('Error getting timezone abbreviation:', err, { timeZone, displayName });
      return 'UTC';
    }
  };

  const formatDuration = (minutes?: number | null) => {
    if (minutes === null || minutes === undefined) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground/50">Loading alterations...</div>
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

  const pendingCount = alterations.filter(a => a.status === 'pending').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Punch Alterations</h1>
          <p className="text-foreground/50 mt-1">
            Approve or decline time alteration requests
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="px-4 py-2 bg-orange-500/20 text-orange-600 rounded-lg">
            {pendingCount} Pending
          </div>
        )}
      </div>

      {/* Status Filter */}
      <div className="glass-card p-4">
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setSelectedAlterationIds(new Set());
                setSelectedAlteration(null);
              }}
              className={`
                px-4 py-2 rounded-lg transition-colors capitalize
                ${statusFilter === status
                  ? 'bg-accent-blue text-white'
                  : 'bg-foreground/5 hover:bg-foreground/10'
                }
              `}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {statusFilter === 'pending' && alterations.filter(a => a.status === 'pending').length > 0 && (
        <div className="glass-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedAlterationIds.size === alterations.filter(a => a.status === 'pending').length && alterations.filter(a => a.status === 'pending').length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-foreground/20"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-sm text-foreground/70">
                Select All ({alterations.filter(a => a.status === 'pending').length})
              </span>
            </label>
            {selectedAlterationIds.size > 0 && (
              <span className="text-sm font-medium text-accent-blue">
                {selectedAlterationIds.size} selected
              </span>
            )}
          </div>
          {selectedAlterationIds.size > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={isBulkApproving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBulkApproving ? 'Approving...' : `Approve ${selectedAlterationIds.size}`}
            </button>
          )}
        </div>
      )}

      {/* Alterations List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {alterations.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-foreground/50">No {statusFilter} alterations found</p>
            </div>
          ) : (
            alterations.map((alteration) => (
              <div
                key={alteration.id}
                className={`
                  glass-card p-4 transition-all
                  ${selectedAlteration?.id === alteration.id
                    ? 'border-2 border-accent-blue/50'
                    : 'hover:border-foreground/20'
                  }
                  ${alteration.status === 'pending' ? 'cursor-pointer' : ''}
                `}
                onClick={() => alteration.status === 'pending' && setSelectedAlteration(alteration)}
              >
                <div className="flex items-start gap-3">
                  {alteration.status === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selectedAlterationIds.has(alteration.id)}
                      onChange={() => toggleAlterationSelection(alteration.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-4 h-4 rounded border-foreground/20"
                    />
                  )}
                  <div className="flex-1 space-y-2">
                    {/* Header Row */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {alteration.employeeName || 'Unknown Employee'}
                      </span>
                      <span
                        className={`
                          px-2 py-1 text-xs rounded-lg
                          ${alteration.status === 'pending'
                            ? 'bg-orange-500/20 text-orange-600'
                            : alteration.status === 'approved'
                            ? 'bg-green-500/20 text-green-600'
                            : 'bg-red-500/20 text-red-600'
                          }
                        `}
                      >
                        {alteration.status}
                      </span>
                    </div>

                    {/* Previous Times */}
                    {alteration.punchDetails && (
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-foreground/50">Previous:</span>
                          <div className="mt-0.5 space-y-0.5">
                            <div>
                              <span className="text-foreground/50">In:</span>{' '}
                              <span className="font-mono">{formatDateTime(alteration.punchDetails.punchInTime, alteration.punchDetails.punchInTimezoneIana)}</span>
                            </div>
                            {alteration.punchDetails.punchOutTime && (
                              <div>
                                <span className="text-foreground/50">Out:</span>{' '}
                                <span className="font-mono">{formatDateTime(alteration.punchDetails.punchOutTime, alteration.punchDetails.punchOutTimezoneIana || alteration.punchDetails.punchInTimezoneIana)}</span>
                              </div>
                            )}
                            {alteration.previousDuration !== null && alteration.previousDuration !== undefined && (
                              <div className="font-medium mt-1">
                                <span className="text-foreground/50">Total:</span>{' '}
                                {formatDuration(alteration.previousDuration)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* New Times */}
                        {(alteration.newPunchInTime || alteration.newPunchOutTime) && (
                          <div>
                            <span className="text-foreground/50">New:</span>
                            <div className="mt-0.5 space-y-0.5">
                              {alteration.newPunchInTime && (
                                <div>
                                  <span className="text-foreground/50">In:</span>{' '}
                                  <span className="font-mono font-medium text-accent-blue">
                                    {formatDateTime(alteration.newPunchInTime, alteration.newPunchInTimezoneIana, alteration.newPunchInTimezoneName)}
                                  </span>
                                </div>
                              )}
                              {alteration.newPunchOutTime && (
                                <div>
                                  <span className="text-foreground/50">Out:</span>{' '}
                                  <span className="font-mono font-medium text-accent-blue">
                                    {formatDateTime(alteration.newPunchOutTime, alteration.newPunchOutTimezoneIana, alteration.newPunchOutTimezoneName)}
                                  </span>
                                </div>
                              )}
                              {alteration.newDuration !== null && alteration.newDuration !== undefined && (
                                <div className="font-medium mt-1 text-accent-blue">
                                  <span className="text-foreground/50">Total:</span>{' '}
                                  {formatDuration(alteration.newDuration)}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reason and Requested Date */}
                    <div className="text-xs text-foreground/50 pt-1 border-t border-foreground/10">
                      <div>Requested: {formatDateTime(alteration.requestedAt)}</div>
                      {alteration.reason && (
                        <div className="mt-1">
                          <span className="text-foreground/50">Reason:</span> {alteration.reason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Alteration Details */}
        {selectedAlteration && selectedAlteration.status === 'pending' && (
          <div className="lg:col-span-1">
            <div className="glass-card p-6 sticky top-6">
              <h2 className="text-xl font-semibold mb-4">Review Alteration</h2>
              
              <div className="space-y-4 mb-4">
                {/* Employee Name */}
                <div>
                  <label className="text-xs text-foreground/50 uppercase tracking-wider">
                    Employee
                  </label>
                  <p className="mt-1 text-sm font-medium">
                    {selectedAlteration.employeeName || 'Unknown'}
                  </p>
                </div>

                {/* Previous Times */}
                {selectedAlteration.punchDetails && (
                  <div className="border-t border-foreground/10 pt-4">
                    <label className="text-xs text-foreground/50 uppercase tracking-wider mb-2 block">
                      Previous Times
                    </label>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="text-foreground/50">In:</span>{' '}
                        {formatDateTime(selectedAlteration.punchDetails.punchInTime, selectedAlteration.punchDetails.punchInTimezoneIana)}
                      </p>
                      {selectedAlteration.punchDetails.punchOutTime && (
                        <p className="text-sm">
                          <span className="text-foreground/50">Out:</span>{' '}
                          {formatDateTime(selectedAlteration.punchDetails.punchOutTime, selectedAlteration.punchDetails.punchOutTimezoneIana || selectedAlteration.punchDetails.punchInTimezoneIana)}
                        </p>
                      )}
                      {selectedAlteration.previousDuration !== null && selectedAlteration.previousDuration !== undefined && (
                        <p className="text-sm font-medium mt-2">
                          <span className="text-foreground/50">Total:</span>{' '}
                          {formatDuration(selectedAlteration.previousDuration)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* New Times */}
                {(selectedAlteration.newPunchInTime || selectedAlteration.newPunchOutTime) && (
                  <div className="border-t border-foreground/10 pt-4">
                    <label className="text-xs text-foreground/50 uppercase tracking-wider mb-2 block">
                      New Times
                    </label>
                    <div className="space-y-1">
                      {selectedAlteration.newPunchInTime && (
                        <p className="text-sm font-medium">
                          <span className="text-foreground/50">In:</span>{' '}
                          {formatDateTime(selectedAlteration.newPunchInTime, selectedAlteration.newPunchInTimezoneIana, selectedAlteration.newPunchInTimezoneName)}
                        </p>
                      )}
                      {selectedAlteration.newPunchOutTime && (
                        <p className="text-sm font-medium">
                          <span className="text-foreground/50">Out:</span>{' '}
                          {formatDateTime(selectedAlteration.newPunchOutTime, selectedAlteration.newPunchOutTimezoneIana, selectedAlteration.newPunchOutTimezoneName)}
                        </p>
                      )}
                      {selectedAlteration.newDuration !== null && selectedAlteration.newDuration !== undefined && (
                        <p className="text-sm font-medium mt-2 text-accent-blue">
                          <span className="text-foreground/50">Total:</span>{' '}
                          {formatDuration(selectedAlteration.newDuration)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {selectedAlteration.reason && (
                  <div className="border-t border-foreground/10 pt-4">
                    <label className="text-xs text-foreground/50 uppercase tracking-wider">
                      Reason
                    </label>
                    <p className="mt-1 text-sm">{selectedAlteration.reason}</p>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
                  Review Notes
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add review notes..."
                  className="w-full px-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(selectedAlteration.id)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDecline(selectedAlteration.id)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedAlteration && selectedAlteration.status !== 'pending' && (
          <div className="lg:col-span-1">
            <div className="glass-card p-6 sticky top-6">
              <h2 className="text-xl font-semibold mb-4">Alteration Details</h2>
              <div className="space-y-4">
                {/* Employee Name */}
                <div>
                  <label className="text-xs text-foreground/50 uppercase tracking-wider">
                    Employee
                  </label>
                  <p className="mt-1 text-sm font-medium">
                    {selectedAlteration.employeeName || 'Unknown'}
                  </p>
                </div>

                {/* Previous Times */}
                {selectedAlteration.punchDetails && (
                  <div className="border-t border-foreground/10 pt-4">
                    <label className="text-xs text-foreground/50 uppercase tracking-wider mb-2 block">
                      Previous Times
                    </label>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="text-foreground/50">In:</span>{' '}
                        {formatDateTime(selectedAlteration.punchDetails.punchInTime, selectedAlteration.punchDetails.punchInTimezoneIana)}
                      </p>
                      {selectedAlteration.punchDetails.punchOutTime && (
                        <p className="text-sm">
                          <span className="text-foreground/50">Out:</span>{' '}
                          {formatDateTime(selectedAlteration.punchDetails.punchOutTime, selectedAlteration.punchDetails.punchOutTimezoneIana || selectedAlteration.punchDetails.punchInTimezoneIana)}
                        </p>
                      )}
                      {selectedAlteration.previousDuration !== null && selectedAlteration.previousDuration !== undefined && (
                        <p className="text-sm font-medium mt-2">
                          <span className="text-foreground/50">Total:</span>{' '}
                          {formatDuration(selectedAlteration.previousDuration)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* New Times */}
                {(selectedAlteration.newPunchInTime || selectedAlteration.newPunchOutTime) && (
                  <div className="border-t border-foreground/10 pt-4">
                    <label className="text-xs text-foreground/50 uppercase tracking-wider mb-2 block">
                      New Times
                    </label>
                    <div className="space-y-1">
                      {selectedAlteration.newPunchInTime && (
                        <p className="text-sm font-medium">
                          <span className="text-foreground/50">In:</span>{' '}
                          {formatDateTime(selectedAlteration.newPunchInTime, selectedAlteration.newPunchInTimezoneIana, selectedAlteration.newPunchInTimezoneName)}
                        </p>
                      )}
                      {selectedAlteration.newPunchOutTime && (
                        <p className="text-sm font-medium">
                          <span className="text-foreground/50">Out:</span>{' '}
                          {formatDateTime(selectedAlteration.newPunchOutTime, selectedAlteration.newPunchOutTimezoneIana, selectedAlteration.newPunchOutTimezoneName)}
                        </p>
                      )}
                      {selectedAlteration.newDuration !== null && selectedAlteration.newDuration !== undefined && (
                        <p className="text-sm font-medium mt-2 text-accent-blue">
                          <span className="text-foreground/50">Total:</span>{' '}
                          {formatDuration(selectedAlteration.newDuration)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t border-foreground/10 pt-4">
                  <label className="text-xs text-foreground/50 uppercase tracking-wider">
                    Status
                  </label>
                  <p className="mt-1 capitalize">{selectedAlteration.status}</p>
                </div>
                {selectedAlteration.reviewedAt && (
                  <div>
                    <label className="text-xs text-foreground/50 uppercase tracking-wider">
                      Reviewed At
                    </label>
                    <p className="mt-1 text-sm">
                      {formatDateTime(selectedAlteration.reviewedAt)}
                    </p>
                  </div>
                )}
                {selectedAlteration.reviewNotes && (
                  <div>
                    <label className="text-xs text-foreground/50 uppercase tracking-wider">
                      Review Notes
                    </label>
                    <p className="mt-1 text-sm">{selectedAlteration.reviewNotes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

