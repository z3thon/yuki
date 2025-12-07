import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { queryFillout } from '@/lib/fillout';
import { PAY_PERIOD_TEMPLATES_TABLE_ID } from '@/lib/fillout-table-ids';

/**
 * GET /api/hr/departments/[id]/templates
 * Get pay period templates for a specific department
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Get templates for this department
    // Note: Fillout API filtering by linked_record fields is unreliable, so we fetch all and filter client-side
    const templatesResponse = await queryFillout({
      tableId: PAY_PERIOD_TEMPLATES_TABLE_ID,
      limit: 1000, // Fetch all templates, filter client-side
    });

    // Filter by department_id client-side (more reliable)
    // Fillout API returns fields by their internal name (snake_case), just like pay-periods route
    const templates = templatesResponse.records
      .filter((record: any) => {
        const deptField = record.fields?.department_id;
        if (!deptField) return false;
        
        // Handle array format (linked records are arrays in Fillout)
        if (Array.isArray(deptField)) {
          return deptField.some((deptId: string) => String(deptId).trim() === String(id).trim());
        }
        return String(deptField).trim() === String(id).trim();
      })
      .filter((record: any) => {
        // Only active templates
        const isActive = record.fields?.is_active ?? true;
        return isActive !== false;
      })
      .sort((a: any, b: any) => {
        // Sort by period_number ascending
        const numA = a.fields?.period_number ?? 0;
        const numB = b.fields?.period_number ?? 0;
        return numA - numB;
      });

    // Debug: Log raw field values before mapping
    console.log('🔍 Raw template records before mapping:');
    templates.forEach((record: any, index: number) => {
      console.log(`  Template ${index + 1}:`, {
        id: record.id,
        period_number: record.fields?.period_number,
        start_day: record.fields?.start_day,
        end_day: record.fields?.end_day,
        allFields: Object.keys(record.fields || {}),
        rawFields: record.fields,
      });
    });

    const formattedTemplates = templates.map((record: any) => {
      const fields = record.fields || {};
      
      // Use field names directly (snake_case) - same as pay-periods route uses start_date, end_date
      const template = {
        id: record.id,
        periodNumber: fields.period_number ?? 0,
        startDay: fields.start_day ?? null,
        endDay: fields.end_day ?? null,
        payoutDay: fields.payout_day ?? '',
        payoutMonthOffset: fields.payout_month_offset ?? 0,
        isActive: fields.is_active !== false,
      };
      
      console.log(`✅ Mapped template ${template.periodNumber}:`, template);
      return template;
    });

    return NextResponse.json({ templates: formattedTemplates });
  } catch (error: any) {
    console.error('Error fetching department templates:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

