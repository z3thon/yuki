import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { verifyAuthAndGetUserId } from '@/lib/auth-helpers';
import { checkPermission } from '@/lib/permissions';
import { getViews } from '@/lib/permission-tables';
import { queryFillout, createFilloutRecord, updateFilloutRecord, deleteFilloutRecord } from '@/lib/fillout';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Table IDs
import { EMPLOYEES_TABLE_ID } from '@/lib/fillout-table-ids';

if (!ANTHROPIC_API_KEY) {
  console.warn('ANTHROPIC_API_KEY not set - AI chat will not work');
}

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Action {
  type: 'update' | 'create' | 'delete';
  resource: string;
  resourceId?: string;
  description: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!anthropic) {
      return NextResponse.json(
        { error: 'AI service not configured. Please set ANTHROPIC_API_KEY.' },
        { status: 503 }
      );
    }

    const userId = await verifyAuthAndGetUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, appId, viewId, conversationHistory, mentionedViews: providedMentionedViews } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Extract @mentioned views from message (use provided or extract from message)
    const mentionedViews = providedMentionedViews || extractMentionedViews(message);

    // Get current view context
    const context = await getViewContext(appId, viewId, userId, mentionedViews);

    // Get available views for the app
    const availableViews = await getViews(appId, userId);

    // Build system prompt with view information
    const systemPrompt = buildSystemPrompt(appId, viewId, context, availableViews, mentionedViews);

    // Prepare conversation history
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...(conversationHistory || []).map((msg: ChatMessage) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: message,
      },
    ];

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: messages as Anthropic.MessageParam[],
      tools: [
        {
          name: 'update_employee',
          description: 'Update an employee record. Use this when the user wants to modify employee information like name, email, pay rate, etc.',
          input_schema: {
            type: 'object',
            properties: {
              employeeId: {
                type: 'string',
                description: 'The ID of the employee to update',
              },
              fields: {
                type: 'object',
                description: 'Fields to update (use database field names: name, email, pay_rate, employment_type, etc.)',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  pay_rate: { type: 'number' },
                  employment_type: { type: 'string' },
                  company_id: { type: 'array', items: { type: 'string' } },
                  department_id: { type: 'array', items: { type: 'string' } },
                  timezone_id: { type: 'array', items: { type: 'string' } },
                  photo_url: { type: 'string' },
                },
              },
            },
            required: ['employeeId', 'fields'],
          },
        },
        {
          name: 'create_employee',
          description: 'Create a new employee record. Use this when the user wants to add a new employee.',
          input_schema: {
            type: 'object',
            properties: {
              fields: {
                type: 'object',
                description: 'Employee fields (use database field names)',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  pay_rate: { type: 'number' },
                  employment_type: { type: 'string' },
                  company_id: { type: 'array', items: { type: 'string' } },
                  department_id: { type: 'array', items: { type: 'string' } },
                  timezone_id: { type: 'array', items: { type: 'string' } },
                  photo_url: { type: 'string' },
                },
                required: ['name', 'email'],
              },
            },
            required: ['fields'],
          },
        },
        {
          name: 'query_employees',
          description: 'Query/search employees. Use this when the user wants to see or find employees.',
          input_schema: {
            type: 'object',
            properties: {
              search: {
                type: 'string',
                description: 'Search term to filter employees by name',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 10)',
              },
            },
          },
        },
      ],
    });

    // Process tool calls
    const actions: Action[] = [];
    let finalResponse = '';
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    // First pass: collect text and execute tools
    if (response.content) {
      for (const content of response.content) {
        if (content.type === 'text') {
          finalResponse += content.text;
        } else if (content.type === 'tool_use') {
          try {
            const toolResult = await executeTool(content.name, content.input, userId, appId);
            actions.push(...toolResult.actions);
            
            // Add tool result for Claude to process
            toolResults.push({
              type: 'tool_result',
              tool_use_id: content.id,
              content: toolResult.message,
            });
          } catch (error: any) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: content.id,
              content: `Error: ${error.message}`,
              is_error: true,
            });
          }
        }
      }
    }

    // If there are tool results, send them back to Claude for a final response
    if (toolResults.length > 0) {
      const finalMessages: Anthropic.MessageParam[] = [
        ...messages,
        {
          role: 'assistant',
          content: response.content,
        },
        {
          role: 'user',
          content: toolResults,
        },
      ];

      const finalResponse_obj = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: finalMessages,
      });

      // Extract final text response
      if (finalResponse_obj.content) {
        for (const content of finalResponse_obj.content) {
          if (content.type === 'text') {
            finalResponse = content.text;
          }
        }
      }
    }

    return NextResponse.json({
      response: finalResponse || 'Done!',
      actions: actions.length > 0 ? actions : undefined,
    });
  } catch (error: any) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Extract @mentioned views from message
function extractMentionedViews(message: string): string[] {
  const mentions: string[] = [];
  const mentionRegex = /@(\w+)/g;
  let match;
  while ((match = mentionRegex.exec(message)) !== null) {
    mentions.push(match[1]);
  }
  return [...new Set(mentions)]; // Remove duplicates
}

async function getViewContext(
  appId: string,
  viewId: string | undefined,
  userId: string,
  mentionedViews: string[] = []
): Promise<any> {
  const context: any = {
    appId,
    viewId,
    availableResources: [],
    mentionedViewsData: [],
  };

  // Get context for current view
  if (appId === 'hr' && viewId === 'employees') {
    try {
      const response = await queryFillout({
        tableId: EMPLOYEES_TABLE_ID,
        limit: 5,
      });
      context.availableResources = response.records.map((r: any) => ({
        id: r.id,
        name: r.fields.name,
        email: r.fields.email,
      }));
    } catch (error) {
      console.error('Error fetching context:', error);
    }
  }

  // Get context for mentioned views
  if (mentionedViews.length > 0) {
    try {
      const views = await getViews(appId as any, userId);
      for (const mentionedViewId of mentionedViews) {
        const view = views.find((v) => v.id === mentionedViewId);
        if (view) {
          // Fetch sample data for mentioned view
          let sampleData: any[] = [];
          let dataDescription = '';

          if (appId === 'hr') {
            switch (mentionedViewId) {
              case 'employees':
                const response = await queryFillout({
                  tableId: EMPLOYEES_TABLE_ID,
                  limit: 10,
                });
                sampleData = response.records.map((r: any) => ({
                  id: r.id,
                  name: r.fields.name,
                  email: r.fields.email,
                  payRate: r.fields.pay_rate,
                }));
                dataDescription = `Contains employee records with fields: name, email, pay_rate, employment_type, company_id, department_id`;
                break;
            }
          }

          context.mentionedViewsData.push({
            id: view.id,
            name: view.name,
            description: view.description,
            sampleData,
            dataDescription,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching mentioned views context:', error);
    }
  }

  return context;
}

function buildSystemPrompt(
  appId: string,
  viewId: string | undefined,
  context: any,
  availableViews: any[],
  mentionedViews: string[] = []
): string {
  let prompt = `You are an AI assistant for the Yuki admin console. You help users manage their ${appId} application data.

Current Context:
- App: ${appId}
- Current View: ${viewId || 'none'}
`;

  // Add available views information
  if (availableViews.length > 0) {
    prompt += `\nAvailable Views in ${appId} app:\n`;
    availableViews.forEach((view) => {
      prompt += `- @${view.id} (${view.name})${view.description ? `: ${view.description}` : ''}\n`;
    });
    prompt += `\nUsers can mention views using @viewId (e.g., @employees). When a view is mentioned, you have access to its data and context.\n`;
  }

  // Add mentioned views context
  if (context.mentionedViewsData && context.mentionedViewsData.length > 0) {
    prompt += `\n=== Mentioned Views Context ===\n`;
    context.mentionedViewsData.forEach((viewData: any) => {
      prompt += `\nView: @${viewData.id} (${viewData.name})\n`;
      if (viewData.description) {
        prompt += `Description: ${viewData.description}\n`;
      }
      if (viewData.dataDescription) {
        prompt += `Data: ${viewData.dataDescription}\n`;
      }
      if (viewData.sampleData && viewData.sampleData.length > 0) {
        prompt += `Sample records:\n`;
        viewData.sampleData.slice(0, 5).forEach((record: any) => {
          prompt += `  - ${JSON.stringify(record)}\n`;
        });
      }
    });
  }

  // Add current view resources
  if (context.availableResources && context.availableResources.length > 0) {
    prompt += `\nCurrent View Resources:\n`;
    context.availableResources.forEach((resource: any) => {
      prompt += `- ${resource.name} (ID: ${resource.id})\n`;
    });
  }

  prompt += `
Guidelines:
1. Be helpful, concise, and professional
2. When updating data, use the appropriate tool functions
3. Always confirm what you're doing before making changes
4. If you need to find an employee by name, use query_employees first to get their ID
5. Use database field names (pay_rate, not payRate; company_id as array, etc.)
6. After performing actions, summarize what was done
7. When users mention views with @viewId, reference that view's data and context in your response
8. You can mention views in your responses using @viewId format to help users understand which views you're referencing

Database Schema Notes:
- Employee fields: name, email, pay_rate (number), employment_type, company_id (array), department_id (array), timezone_id (array), photo_url
- When updating, only include fields that are being changed
`;

  return prompt;
}

async function executeTool(
  toolName: string,
  input: any,
  userId: string,
  appId: string
): Promise<{ actions: Action[]; message: string }> {
  const actions: Action[] = [];
  let message = '';

  try {
    switch (toolName) {
      case 'update_employee': {
        const { employeeId, fields } = input;

        // Check permission
        const canWrite = await checkPermission({
          userId,
          appId: appId as 'hr' | 'crm' | 'billing',
          viewId: 'employees',
          resourceType: 'employee',
          resourceId: employeeId,
          action: 'write',
        });

        if (!canWrite) {
          throw new Error('You do not have permission to update this employee');
        }

        // Update employee
        await updateFilloutRecord(EMPLOYEES_TABLE_ID, employeeId, fields);

        const fieldDescriptions = Object.entries(fields)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join(', ');

        actions.push({
          type: 'update',
          resource: 'employee',
          resourceId: employeeId,
          description: `Updated employee ${employeeId}: ${fieldDescriptions}`,
        });

        message = `✅ Successfully updated employee. Changes: ${fieldDescriptions}`;
        break;
      }

      case 'create_employee': {
        const { fields } = input;

        // Check permission
        const canWrite = await checkPermission({
          userId,
          appId: appId as 'hr' | 'crm' | 'billing',
          viewId: 'employees',
          resourceType: 'employee',
          action: 'write',
        });

        if (!canWrite) {
          throw new Error('You do not have permission to create employees');
        }

        // Create employee
        const result = await createFilloutRecord(EMPLOYEES_TABLE_ID, fields);

        actions.push({
          type: 'create',
          resource: 'employee',
          resourceId: result.id,
          description: `Created new employee: ${fields.name} (${fields.email})`,
        });

        message = `✅ Successfully created new employee: ${fields.name}`;
        break;
      }

      case 'query_employees': {
        const { search, limit = 10 } = input;
        const filters: any = {};
        
        if (search) {
          filters.name = { contains: search };
        }

        const response = await queryFillout({
          tableId: EMPLOYEES_TABLE_ID,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          limit,
        });

        const employees = response.records.map((r: any) => ({
          id: r.id,
          name: r.fields.name,
          email: r.fields.email,
          payRate: r.fields.pay_rate,
        }));

        message = `Found ${employees.length} employee(s):\n${employees.map((e: any) => `- ${e.name} (${e.email}) - ID: ${e.id}`).join('\n')}`;
        break;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error: any) {
    throw new Error(`Tool execution error: ${error.message}`);
  }

  return { actions, message };
}
