import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUserId } from '@/lib/auth-helpers';
import { getViews } from '@/lib/permission-tables';
import { queryFillout } from '@/lib/fillout';
import { AppId } from '@/types';

import { EMPLOYEES_TABLE_ID } from '@/lib/fillout-table-ids';

/**
 * GET /api/ai/view-data?viewId=employees&appId=hr
 * Get view metadata and sample data for AI context
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAuthAndGetUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const viewId = searchParams.get('viewId');
    const appId = searchParams.get('appId') as AppId | null;

    if (!viewId || !appId) {
      return NextResponse.json(
        { error: 'viewId and appId are required' },
        { status: 400 }
      );
    }

    // Get all views for the app to find the one matching viewId
    const views = await getViews(appId, userId);
    const view = views.find((v) => v.id === viewId);

    if (!view) {
      return NextResponse.json(
        { error: 'View not found' },
        { status: 404 }
      );
    }

    // Get sample data based on view type
    let sampleData: any[] = [];
    let dataDescription = '';

    switch (appId) {
      case 'hr':
        switch (viewId) {
          case 'employees':
            try {
              const response = await queryFillout({
                tableId: EMPLOYEES_TABLE_ID,
                limit: 10,
              });
              sampleData = response.records.map((r: any) => ({
                id: r.id,
                name: r.fields.name,
                email: r.fields.email,
                payRate: r.fields.pay_rate,
                employmentType: r.fields.employment_type,
              }));
              dataDescription = `Contains ${response.records.length} employee records with fields: name, email, pay_rate, employment_type, company_id, department_id, timezone_id, photo_url`;
            } catch (error) {
              console.error('Error fetching employees:', error);
            }
            break;
          case 'time-tracking':
            dataDescription = 'Contains time punch records with clock in/out times, employee references, and punch types';
            break;
          case 'punch-alterations':
            dataDescription = 'Contains time punch alteration requests that need approval';
            break;
          case 'pay-periods':
            dataDescription = 'Contains pay period summaries with hours worked and totals';
            break;
        }
        break;
    }

    return NextResponse.json({
      view: {
        id: view.id,
        name: view.name,
        description: view.description,
        appId: view.appId,
        config: view.config,
      },
      sampleData,
      dataDescription,
      totalRecords: sampleData.length,
    });
  } catch (error: any) {
    console.error('Error fetching view data:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
