'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRefreshView } from './Layout';
import { useViewDataCache } from '@/lib/useViewDataCache';
import { useViewCache } from './ViewCacheContext';

interface Employee {
  id: string;
  name: string;
  email: string;
  companyId?: string;
  departmentId?: string;
  photoUrl?: string;
  payRate?: number;
  employmentType?: string;
  timezoneId?: string;
  createdAt: string;
  updatedAt: string;
}

interface Department {
  id: string;
  name: string;
}

export default function EmployeesViewComponent() {
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPayRate, setIsEditingPayRate] = useState(false);
  const refreshContext = useRefreshView();
  const cache = useViewCache();

  // Create cache key based on search filter
  const cacheKey = useMemo(() => {
    return search ? `search:${search}` : undefined;
  }, [search]);

  // Fetch employees with caching
  const fetchEmployees = useMemo(() => async () => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    
    const response = await fetch(`/api/hr/employees?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('You do not have permission to view employees');
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch employees');
      }
    }

    const data = await response.json();
    return { employees: data.employees || [] };
  }, [search]);

  const { data, loading, error, refetch } = useViewDataCache<{ employees: Employee[] }>({
    viewId: 'employees',
    cacheKey,
    fetchFn: fetchEmployees,
  });

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

  const { data: departmentsData } = useViewDataCache<{ departments: Department[] }>({
    viewId: 'departments',
    cacheKey: 'all',
    fetchFn: fetchDepartments,
  });

  const employees = data?.employees || [];
  const departments = departmentsData?.departments || [];
  
  // Debug: Log first employee to see what data we're getting
  useEffect(() => {
    if (employees.length > 0) {
      console.log('First employee in list:', employees[0]);
      console.log('Employee name:', employees[0].name);
      console.log('Employee email:', employees[0].email);
    }
  }, [employees]);
  
  // Create department map for quick lookup
  const departmentMap = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach(dept => {
      map.set(dept.id, dept.name);
    });
    return map;
  }, [departments]);

  // Register refresh callback
  useEffect(() => {
    if (refreshContext) {
      const refreshCallback = () => {
        refetch();
        // If we have a selected employee, refresh their details too
        if (selectedEmployee) {
          // Use a small delay to ensure refetch completes first
          setTimeout(async () => {
            try {
              const token = await getAuthToken();
              if (!token) return;

              const response = await fetch(`/api/hr/employees/${selectedEmployee.id}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });
              if (response.ok) {
                const data = await response.json();
                setSelectedEmployee(data.employee);
                setIsEditing(false);
                setIsEditingPayRate(false);
              }
            } catch (err) {
              console.error('Error refreshing employee details:', err);
            }
          }, 300);
        }
      };
      const unregister = refreshContext.registerRefreshCallback(refreshCallback);
      return unregister;
    }
  }, [refreshContext, selectedEmployee, refetch]);

  const getAuthToken = async (): Promise<string | null> => {
    // Import Firebase client-side
    const { getAuth } = await import('firebase/auth');
    const { auth } = await import('@/lib/firebase');
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  };

  const handleEmployeeClick = async (employeeId: string) => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(`/api/hr/employees/${employeeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedEmployee(data.employee);
        setIsEditing(false);
        setIsEditingPayRate(false);
      }
    } catch (err) {
      console.error('Error fetching employee details:', err);
    }
  };

  const handleSave = async (employee: Employee & { payRateStartDate?: string }) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        alert('Not authenticated');
        return;
      }

      const payload: any = { ...employee };
      if (employee.payRateStartDate) {
        payload.payRateStartDate = employee.payRateStartDate;
      }

      const response = await fetch(`/api/hr/employees/${employee.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 403) {
          alert('You do not have permission to edit employees');
        } else {
          const data = await response.json();
          alert(data.error || 'Failed to update employee');
        }
        return;
      }

      // Optimistically update the cache
      const cachedEmployees = cache.getCache<{ employees: Employee[] }>('employees', cacheKey);
      if (cachedEmployees?.data?.employees) {
        const updatedEmployees = cachedEmployees.data.employees.map(emp => 
          emp.id === employee.id 
            ? { ...emp, payRate: employee.payRate }
            : emp
        );
        cache.setCache('employees', { employees: updatedEmployees }, cacheKey);
      }

      // Update selected employee if it matches
      if (selectedEmployee?.id === employee.id) {
        setSelectedEmployee({ ...selectedEmployee, payRate: employee.payRate });
      }

      setIsEditing(false);
      setIsEditingPayRate(false);
      
      // Refetch to get fresh data (will update cache in background)
      refetch();
      
      // Refresh selected employee details
      if (selectedEmployee?.id === employee.id) {
        handleEmployeeClick(employee.id);
      }
    } catch (err) {
      console.error('Error updating employee:', err);
      alert('Failed to update employee');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground/50">Loading employees...</div>
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-foreground/50 mt-1">
            Manage employee information and access
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4">
        <input
          type="text"
          placeholder="Search employees by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
        />
      </div>

      {/* Employees List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="lg:col-span-2 space-y-3">
          {employees.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-foreground/50">No employees found</p>
            </div>
          ) : (
            employees.map((employee) => (
              <div
                key={employee.id}
                onClick={() => handleEmployeeClick(employee.id)}
                className={`
                  glass-card p-4 cursor-pointer transition-all
                  ${selectedEmployee?.id === employee.id
                    ? 'border-2 border-accent-blue/50'
                    : 'hover:border-foreground/20'
                  }
                `}
              >
                <div className="flex items-center gap-4">
                  {employee.photoUrl ? (
                    <img
                      src={employee.photoUrl}
                      alt={employee.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-accent-blue/20 flex items-center justify-center">
                      <span className="text-accent-blue font-semibold">
                        {employee.name?.charAt(0)?.toUpperCase() || employee.email?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold">
                      {employee.name && employee.name.trim() && employee.name !== employee.email
                        ? employee.name
                        : employee.email || 'Unknown'}
                    </h3>
                    <p className="text-sm text-foreground/50">{employee.email || 'No email'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {employee.payRate && (
                        <p className="text-xs text-foreground/40">
                          ${employee.payRate.toFixed(2)}/hr
                        </p>
                      )}
                      {employee.departmentId && departmentMap.has(employee.departmentId) && (
                        <>
                          {employee.payRate && <span className="text-foreground/20">•</span>}
                          <p className="text-xs text-foreground/40">
                            {departmentMap.get(employee.departmentId)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Employee Details */}
        {selectedEmployee && (
          <div className="lg:col-span-1">
            <div className="glass-card p-6 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Employee Details</h2>
                {!isEditing && !isEditingPayRate && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditingPayRate(true)}
                      className="px-3 py-1 text-sm bg-green-500/20 text-green-600 rounded-lg hover:bg-green-500/30 transition-colors"
                      title="Update Pay Rate"
                    >
                      💰 Pay Rate
                    </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 text-sm bg-accent-blue/20 text-accent-blue rounded-lg hover:bg-accent-blue/30 transition-colors"
                  >
                      Edit All
                  </button>
                  </div>
                )}
              </div>

              {isEditingPayRate ? (
                <PayRateEditForm
                  employee={selectedEmployee}
                  onSave={async (payRate, startDate) => {
                    await handleSave({ ...selectedEmployee, payRate, payRateStartDate: startDate });
                    setIsEditingPayRate(false);
                  }}
                  onCancel={() => setIsEditingPayRate(false)}
                />
              ) : isEditing ? (
                <EmployeeEditForm
                  employee={selectedEmployee}
                  onSave={handleSave}
                  onCancel={() => setIsEditing(false)}
                />
              ) : (
                <EmployeeDetailsView employee={selectedEmployee} departmentMap={departmentMap} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeeDetailsView({ 
  employee, 
  departmentMap 
}: { 
  employee: Employee;
  departmentMap: Map<string, string>;
}) {
  const departmentName = employee.departmentId 
    ? departmentMap.get(employee.departmentId) 
    : null;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-foreground/50 uppercase tracking-wider">
          Name
        </label>
        <p className="mt-1 font-medium">{employee.name}</p>
      </div>
      <div>
        <label className="text-xs text-foreground/50 uppercase tracking-wider">
          Email
        </label>
        <p className="mt-1">{employee.email}</p>
      </div>
      {departmentName && (
        <div>
          <label className="text-xs text-foreground/50 uppercase tracking-wider">
            Department
          </label>
          <p className="mt-1">{departmentName}</p>
        </div>
      )}
      <div className="border-t border-foreground/10 pt-4">
          <label className="text-xs text-foreground/50 uppercase tracking-wider">
            Pay Rate
          </label>
        <p className="mt-1 text-lg font-semibold text-accent-blue">
          {employee.payRate ? `$${employee.payRate.toFixed(2)}/hr` : 'Not set'}
        </p>
        </div>
      {employee.employmentType && (
        <div>
          <label className="text-xs text-foreground/50 uppercase tracking-wider">
            Employment Type
          </label>
          <p className="mt-1 capitalize">{employee.employmentType}</p>
        </div>
      )}
    </div>
  );
}

function PayRateEditForm({
  employee,
  onSave,
  onCancel,
}: {
  employee: Employee;
  onSave: (payRate: number, startDate?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [payRate, setPayRate] = useState<string>(employee.payRate?.toString() || '');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(payRate);
    if (isNaN(rate) || rate < 0) {
      alert('Please enter a valid pay rate');
      return;
    }
    if (!startDate) {
      alert('Please select a start date');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(rate, startDate);
    } catch (error) {
      console.error('Error saving pay rate:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">💰</span>
          <h3 className="font-semibold text-green-600">Update Pay Rate</h3>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Employee: <span className="text-green-600">{employee.name || employee.email || 'Unknown'}</span>
          </p>
          <p className="text-sm text-foreground/70">
            Current rate: {employee.payRate ? `$${employee.payRate.toFixed(2)}/hr` : 'Not set'}
          </p>
        </div>
      </div>

      <div>
        <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
          New Pay Rate ($/hr)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={payRate}
            onChange={(e) => setPayRate(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-green-500/50"
            placeholder="0.00"
            autoFocus
            required
          />
        </div>
        <p className="text-xs text-foreground/40 mt-1">
          Enter the hourly pay rate
        </p>
      </div>

      <div>
        <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
          Effective Start Date
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full px-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-green-500/50"
          required
        />
        <p className="text-xs text-foreground/40 mt-1">
          The previous pay rate will end on this date
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Pay Rate'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 px-4 py-2 bg-foreground/10 rounded-lg hover:bg-foreground/20 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EmployeeEditForm({
  employee,
  onSave,
  onCancel,
}: {
  employee: Employee;
  onSave: (employee: Employee) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(employee);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(formData);
      }}
      className="space-y-4"
    >
      <div>
        <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
          Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
          required
        />
      </div>
      <div>
        <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
          Email
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
          required
        />
      </div>
      <div>
        <label className="text-xs text-foreground/50 uppercase tracking-wider block mb-1">
          Pay Rate ($/hr)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50">$</span>
        <input
          type="number"
          step="0.01"
            min="0"
          value={formData.payRate || ''}
          onChange={(e) =>
              setFormData({ ...formData, payRate: parseFloat(e.target.value) || undefined })
          }
            className="w-full pl-8 pr-3 py-2 bg-background/50 rounded-lg border border-foreground/10 focus:outline-none focus:border-accent-blue/50"
            placeholder="0.00"
        />
        </div>
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

