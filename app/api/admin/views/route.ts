import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { getViews, createView, updateView } from '@/lib/permission-tables';
import { getEmployeeIdForUser } from '@/lib/employee-lookup';
import { AppId } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify auth
    const user = await verifyAuthAndGetUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const appId = request.nextUrl.searchParams.get('appId') as AppId | null;
    const employeeId = request.nextUrl.searchParams.get('employeeId');
    
    try {
      const views = await getViews(appId || undefined, user.uid);
      
      // Filter by employeeId if provided
      const filteredViews = employeeId 
        ? views.filter(view => view.employeeId === employeeId)
        : views;
      
      return NextResponse.json({ views: filteredViews });
    } catch (filloutError: any) {
      console.error('Error fetching views from Fillout:', filloutError);
      // Return empty array instead of error - views might not be set up yet
      return NextResponse.json({ views: [] });
    }
  } catch (error: any) {
    console.error('Error in GET /api/admin/views:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', details: error.stack },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify auth
    const user = await verifyAuthAndGetUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Try to find employee ID for the user
    let employeeId: string | null = null;
    if (user.email) {
      employeeId = await getEmployeeIdForUser(user.email);
    }
    
    const view = await createView({
      appId: body.appId,
      name: body.name,
      description: body.description,
      isDefault: body.isDefault || false,
      isCustom: body.isCustom !== false, // Default to true
      createdBy: user.uid,
      employeeId: employeeId || body.employeeId || undefined,
      sharedWith: body.sharedWith || [],
      config: body.config || { type: 'table' },
    });
    
    return NextResponse.json({ view });
  } catch (error: any) {
    console.error('Error creating view:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // SECURITY: Verify auth
    const user = await verifyAuthAndGetUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const viewId = body.viewId;
    
    if (!viewId) {
      return NextResponse.json(
        { error: 'viewId required' },
        { status: 400 }
      );
    }

    // TODO: Check if user owns the view or has permission to edit
    
    await updateView(viewId, {
      name: body.name,
      description: body.description,
      isDefault: body.isDefault,
      isCustom: body.isCustom,
      employeeId: body.employeeId,
      sharedWith: body.sharedWith,
      config: body.config,
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating view:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

