import { App, AppId } from '@/types';

export const APPS: Record<AppId, App> = {
  hr: {
    id: 'hr',
    name: 'HR',
    description: 'Human Resources - Employee management, time tracking, and payroll',
    color: '#2563eb', // Blue
    icon: '👥',
    available: true,
  },
  crm: {
    id: 'crm',
    name: 'CRM',
    description: 'Customer Relationship Management - Client and project management',
    color: '#7c3aed', // Purple
    icon: '🤝',
    available: false, // Coming soon
  },
  billing: {
    id: 'billing',
    name: 'Billing',
    description: 'Billing & Invoicing - Client invoices and time card management',
    color: '#db2777', // Pink
    icon: '💰',
    available: false, // Coming soon
  },
};

export function getApp(appId: AppId): App {
  return APPS[appId];
}

export function getAvailableApps(): App[] {
  return Object.values(APPS);
}

