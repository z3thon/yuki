import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { hasAppAccess } from '@/lib/permissions';
import { queryFillout } from '@/lib/fillout';
import { CLIENTS_TABLE_ID } from '@/lib/fillout-table-ids';

/**
 * GET /api/hr/clients
 * Get all active clients
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuthAndGetUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check app access
    const hasAccess = await hasAppAccess(user.uid, 'hr');
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to HR app' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const clientIdsParam = searchParams.get('client_ids'); // Comma-separated list of IDs
    
    // Build filters
    const filters: Record<string, any> = {
      is_active: { eq: true },
    };
    
    // Add client IDs filter (for fetching specific clients)
    if (clientIdsParam) {
      const ids = clientIdsParam.split(',').filter(Boolean);
      if (ids.length > 0) {
        filters.id = { in: ids };
      }
    }

    // Get clients - filter by is_active if possible
    const clientsResponse = await queryFillout({
      tableId: CLIENTS_TABLE_ID,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      limit: 1000,
    });

    const clients = clientsResponse.records.map((record: any) => ({
      id: record.id,
      name: record.fields.Name || record.fields.name || `Client ${record.id}`,
      isActive: record.fields.is_active !== false, // Default to true if not set
      contactInfo: record.fields.contact_info || null,
      invoicePeriodType: record.fields.invoice_period_type || null,
      invoicePeriodDays: record.fields.invoice_period_days || null,
      createdAt: record.fields.created_at || record.createdTime,
      updatedAt: record.fields.updated_at || record.createdTime,
    }));

    return NextResponse.json({ clients });
  } catch (error: any) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
