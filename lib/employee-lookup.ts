import { queryFillout } from './fillout';

import { EMPLOYEES_TABLE_ID } from './fillout-table-ids';

/**
 * Find employee record by Firebase UID (via email matching)
 * Since Firebase Auth uses email, we match Employee.email to Firebase user email
 */
export async function findEmployeeByEmail(email: string): Promise<string | null> {
  try {
    const response = await queryFillout({
      tableId: EMPLOYEES_TABLE_ID,
      filters: {
        email: { eq: email.toLowerCase().trim() },
      },
      limit: 1,
    });

    if (response.records && response.records.length > 0) {
      return response.records[0].id;
    }

    return null;
  } catch (error) {
    console.error('Error finding employee by email:', error);
    return null;
  }
}

/**
 * Find employee record by employee ID
 */
export async function getEmployeeById(employeeId: string) {
  try {
    const { getFilloutRecord } = await import('./fillout');
    return await getFilloutRecord(EMPLOYEES_TABLE_ID, employeeId);
  } catch (error) {
    console.error('Error getting employee:', error);
    return null;
  }
}

/**
 * Get employee ID for a Firebase user
 * Tries to match by email from Firebase Auth token
 */
export async function getEmployeeIdForUser(firebaseEmail: string): Promise<string | null> {
  return findEmployeeByEmail(firebaseEmail);
}

