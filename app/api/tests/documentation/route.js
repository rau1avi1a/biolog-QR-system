// app/api/tests/documentation/route.js - API Documentation Generator
import { NextResponse } from 'next/server';
import db from '@/db';
import { jwtVerify } from 'jose';

// Helper to get authenticated user (for testing authenticated endpoints)
async function getAuthUser(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;
    
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    
    await db.connect();
    const user = await db.models.User.findById(payload.userId).select('-password');
    
    return user ? { 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    } : null;
  } catch (error) {
    return null;
  }
}

// Helper to generate sample data structure documentation
function analyzeDataStructure(data, maxDepth = 3, currentDepth = 0) {
  if (currentDepth >= maxDepth) return '[...deep object...]';
  
  if (data === null) return 'null';
  if (data === undefined) return 'undefined';
  
  if (Array.isArray(data)) {
    if (data.length === 0) return '[]';
    return [analyzeDataStructure(data[0], maxDepth, currentDepth + 1)];
  }
  
  if (typeof data === 'object') {
    const result = {};
    const keys = Object.keys(data);
    
    // Limit number of keys shown for readability
    const maxKeys = 10;
    const keysToShow = keys.slice(0, maxKeys);
    
    for (const key of keysToShow) {
      result[key] = analyzeDataStructure(data[key], maxDepth, currentDepth + 1);
    }
    
    if (keys.length > maxKeys) {
      result['...'] = `${keys.length - maxKeys} more properties`;
    }
    
    return result;
  }
  
  // For primitive types, show the type and example value
  if (typeof data === 'string') return `"${data.length > 50 ? data.substring(0, 50) + '...' : data}"`;
  if (typeof data === 'number') return data;
  if (typeof data === 'boolean') return data;
  
  return String(data);
}

// Test endpoint configurations
const endpointTests = [
  // === FILES ===
  {
    group: 'Files',
    tests: [
      {
        name: 'List Files (Root)',
        method: 'GET',
        path: '/api/files',
        description: 'Get all files in root folder'
      },
      {
        name: 'List Files (Specific Folder)',
        method: 'GET', 
        path: '/api/files?folderId=FOLDER_ID',
        description: 'Get files in specific folder',
        requiresData: 'folder'
      },
      {
        name: 'Get Single File',
        method: 'GET',
        path: '/api/files?id=FILE_ID',
        description: 'Get specific file details',
        requiresData: 'file'
      },
      {
        name: 'Get File with PDF',
        method: 'GET',
        path: '/api/files?id=FILE_ID&action=with-pdf',
        description: 'Get file with PDF data included',
        requiresData: 'file'
      },
      {
        name: 'Search Files',
        method: 'GET',
        path: '/api/files?search=QUERY',
        description: 'Search files by name'
      },
      {
        name: 'Get File Batches',
        method: 'GET',
        path: '/api/files?id=FILE_ID&action=batches',
        description: 'Get batches associated with file',
        requiresData: 'file'
      }
    ]
  },
  
  // === FOLDERS ===
  {
    group: 'Folders',
    tests: [
      {
        name: 'List Root Folders',
        method: 'GET',
        path: '/api/folders',
        description: 'Get all root-level folders'
      },
      {
        name: 'List Subfolders',
        method: 'GET',
        path: '/api/folders?parentId=FOLDER_ID',
        description: 'Get folders within specific parent',
        requiresData: 'folder'
      },
      {
        name: 'Get Single Folder',
        method: 'GET',
        path: '/api/folders?id=FOLDER_ID',
        description: 'Get specific folder details',
        requiresData: 'folder'
      },
      {
        name: 'Get Folder Tree',
        method: 'GET',
        path: '/api/folders?id=FOLDER_ID&action=tree',
        description: 'Get folder with path/breadcrumbs',
        requiresData: 'folder'
      },
      {
        name: 'Get Folder Children',
        method: 'GET',
        path: '/api/folders?id=FOLDER_ID&action=children',
        description: 'Get folder with immediate children',
        requiresData: 'folder'
      }
    ]
  },
  
  // === BATCHES ===
  {
    group: 'Batches',
    tests: [
      {
        name: 'List All Batches',
        method: 'GET',
        path: '/api/batches',
        description: 'Get all batches with pagination'
      },
      {
        name: 'List Batches by Status',
        method: 'GET',
        path: '/api/batches?status=Review',
        description: 'Get batches filtered by status'
      },
      {
        name: 'List Batches by File',
        method: 'GET',
        path: '/api/batches?fileId=FILE_ID',
        description: 'Get batches for specific file',
        requiresData: 'file'
      },
      {
        name: 'Get Single Batch',
        method: 'GET',
        path: '/api/batches?id=BATCH_ID',
        description: 'Get specific batch details',
        requiresData: 'batch'
      },
      {
        name: 'Get Batch Work Order Status',
        method: 'GET',
        path: '/api/batches?id=BATCH_ID&action=workorder-status',
        description: 'Get work order status for batch',
        requiresData: 'batch'
      }
    ]
  },
  
  // === ITEMS ===
  {
    group: 'Items',
    tests: [
      {
        name: 'Search Items (No Filter)',
        method: 'GET',
        path: '/api/items',
        description: 'Get all items'
      },
      {
        name: 'Search Items by Type',
        method: 'GET',
        path: '/api/items?type=chemical',
        description: 'Get items filtered by type'
      },
      {
        name: 'Search Items by Query',
        method: 'GET',
        path: '/api/items?search=water',
        description: 'Search items by name/description'
      },
      {
        name: 'Search Items by Type and Query',
        method: 'GET',
        path: '/api/items?type=solution&search=buffer',
        description: 'Search with both type and text filter'
      },
      {
        name: 'Get Single Item',
        method: 'GET',
        path: '/api/items?id=ITEM_ID',
        description: 'Get specific item details',
        requiresData: 'item'
      },
      {
        name: 'Get Item with Lots',
        method: 'GET',
        path: '/api/items?id=ITEM_ID&action=with-lots',
        description: 'Get item with lot information',
        requiresData: 'item'
      },
      {
        name: 'Get Item Lots',
        method: 'GET',
        path: '/api/items?id=ITEM_ID&action=lots',
        description: 'Get lots for specific item',
        requiresData: 'item'
      },
      {
        name: 'Get Item Transactions',
        method: 'GET',
        path: '/api/items?id=ITEM_ID&action=transactions',
        description: 'Get transaction history for item',
        requiresData: 'item'
      },
      {
        name: 'Get Item Stats',
        method: 'GET',
        path: '/api/items?id=ITEM_ID&action=stats',
        description: 'Get statistics for item',
        requiresData: 'item'
      }
    ]
  },
  
  // === NETSUITE ===
  {
    group: 'NetSuite',
    tests: [
      {
        name: 'NetSuite Health Check',
        method: 'GET',
        path: '/api/netsuite?action=health',
        description: 'Check NetSuite connection status',
        requiresAuth: true
      },
      {
        name: 'NetSuite Test Connection',
        method: 'GET',
        path: '/api/netsuite?action=test',
        description: 'Test NetSuite connection',
        requiresAuth: true
      },
      {
        name: 'NetSuite Setup Info',
        method: 'GET',
        path: '/api/netsuite?action=setup',
        description: 'Get NetSuite configuration status',
        requiresAuth: true
      },
      {
        name: 'Search NetSuite Items',
        method: 'GET',
        path: '/api/netsuite?action=search&q=assembly',
        description: 'Search NetSuite assembly items',
        requiresAuth: true
      },
      {
        name: 'Get NetSuite Units',
        method: 'GET',
        path: '/api/netsuite?action=units',
        description: 'Get all NetSuite units',
        requiresAuth: true
      },
      {
        name: 'Get NetSuite Units by Type',
        method: 'GET',
        path: '/api/netsuite?action=units&type=weight',
        description: 'Get NetSuite units filtered by type',
        requiresAuth: true
      },
      {
        name: 'Get NetSuite Mappings',
        method: 'GET',
        path: '/api/netsuite?action=mapping',
        description: 'Get item mappings between local and NetSuite',
        requiresAuth: true
      }
    ]
  },
  
  // === AUTH ===
  {
    group: 'Authentication',
    tests: [
      {
        name: 'Get Current User',
        method: 'GET',
        path: '/api/auth?action=me',
        description: 'Get currently authenticated user',
        requiresAuth: true
      },
      {
        name: 'List All Users',
        method: 'GET',
        path: '/api/auth?action=users',
        description: 'Get all users (admin only)',
        requiresAuth: true,
        requiresAdmin: true
      }
    ]
  },
  
  // === UPLOAD ===
  {
    group: 'Upload',
    tests: [
      {
        name: 'Upload Format Info (Solution)',
        method: 'GET',
        path: '/api/upload?type=solution',
        description: 'Get expected format for solution upload'
      },
      {
        name: 'Upload Format Info (Product)',
        method: 'GET',
        path: '/api/upload?type=product',
        description: 'Get expected format for product upload'
      }
    ]
  }
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // json or markdown
    const groupFilter = searchParams.get('group'); // Filter by specific group
    
    await db.connect();
    
    // Get sample data IDs for tests that require them
    const sampleData = await getSampleDataIds();
    
    // Get authenticated user for auth-required tests
    const user = await getAuthUser(request);
    
    const documentation = {
      title: 'API Documentation - Data Structure Reference',
      generated: new Date().toISOString(),
      standardFormat: {
        success: 'boolean - indicates if the operation was successful',
        data: 'any - the actual response data (structure varies by endpoint)',
        error: 'string|null - error message if success is false, null if successful'
      },
      groups: []
    };
    
    // Test each group of endpoints
    for (const group of endpointTests) {
      if (groupFilter && group.group !== groupFilter) continue;
      
      const groupDoc = {
        group: group.group,
        endpoints: []
      };
      
      for (const test of group.tests) {
        try {
          // Skip auth-required tests if no user
          if (test.requiresAuth && !user) {
            groupDoc.endpoints.push({
              name: test.name,
              method: test.method,
              path: test.path,
              description: test.description,
              status: 'skipped',
              reason: 'No authentication available'
            });
            continue;
          }
          
          // Skip admin-required tests if not admin
          if (test.requiresAdmin && (!user || user.role !== 'admin')) {
            groupDoc.endpoints.push({
              name: test.name,
              method: test.method,
              path: test.path,
              description: test.description,
              status: 'skipped',
              reason: 'Admin access required'
            });
            continue;
          }
          
          // Replace placeholders with actual IDs
          let testPath = test.path;
          if (test.requiresData) {
            const sampleId = sampleData[test.requiresData];
            if (!sampleId) {
              groupDoc.endpoints.push({
                name: test.name,
                method: test.method,
                path: test.path,
                description: test.description,
                status: 'skipped',
                reason: `No sample ${test.requiresData} available`
              });
              continue;
            }
            testPath = testPath.replace(`${test.requiresData.toUpperCase()}_ID`, sampleId);
          }
          
          // Make the actual API call
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'http://localhost:3000';
          
          const response = await fetch(`${baseUrl}${testPath}`, {
            method: test.method,
            headers: {
              'Cookie': request.headers.get('Cookie') || ''
            }
          });
          
          const result = await response.json();
          
          // Analyze the response structure
          const endpointDoc = {
            name: test.name,
            method: test.method,
            path: testPath,
            description: test.description,
            status: response.ok ? 'success' : 'error',
            httpStatus: response.status,
            responseFormat: {
              success: result.success,
              dataStructure: result.success ? analyzeDataStructure(result.data) : null,
              error: result.error
            }
          };
          
          // Add sample response for reference
          if (result.success && result.data) {
            endpointDoc.sampleResponse = {
              success: result.success,
              data: analyzeDataStructure(result.data, 2), // Shallow analysis for samples
              error: result.error
            };
          }
          
          groupDoc.endpoints.push(endpointDoc);
          
        } catch (error) {
          groupDoc.endpoints.push({
            name: test.name,
            method: test.method,
            path: test.path,
            description: test.description,
            status: 'error',
            error: error.message
          });
        }
      }
      
      documentation.groups.push(groupDoc);
    }
    
    // Return JSON or Markdown format
    if (format === 'markdown') {
      const markdown = generateMarkdownDocumentation(documentation);
      return new NextResponse(markdown, {
        headers: { 'Content-Type': 'text/markdown' }
      });
    }
    
    return NextResponse.json({
      success: true,
      data: documentation,
      error: null
    });
    
  } catch (error) {
    console.error('Documentation generation error:', error);
    return NextResponse.json({
      success: false,
      data: null,
      error: error.message
    }, { status: 500 });
  }
}

// Helper to get sample data IDs for testing
async function getSampleDataIds() {
  const sampleData = {};
  
  try {
    // Get sample file
    const files = await db.models.File.find().limit(1).lean();
    if (files.length > 0) sampleData.file = files[0]._id.toString();
    
    // Get sample folder
    const folders = await db.models.Folder.find().limit(1).lean();
    if (folders.length > 0) sampleData.folder = folders[0]._id.toString();
    
    // Get sample batch
    const batches = await db.models.Batch.find().limit(1).lean();
    if (batches.length > 0) sampleData.batch = batches[0]._id.toString();
    
    // Get sample item
    const items = await db.models.Item.find().limit(1).lean();
    if (items.length > 0) sampleData.item = items[0]._id.toString();
    
  } catch (error) {
    console.error('Error getting sample data:', error);
  }
  
  return sampleData;
}

// Helper to generate Markdown documentation
function generateMarkdownDocumentation(doc) {
  let markdown = `# ${doc.title}\n\n`;
  markdown += `*Generated: ${doc.generated}*\n\n`;
  
  markdown += `## Standard Response Format\n\n`;
  markdown += `All API endpoints return responses in this standardized format:\n\n`;
  markdown += `\`\`\`json\n`;
  markdown += `{\n`;
  markdown += `  "success": ${doc.standardFormat.success},\n`;
  markdown += `  "data": ${doc.standardFormat.data},\n`;
  markdown += `  "error": ${doc.standardFormat.error}\n`;
  markdown += `}\n`;
  markdown += `\`\`\`\n\n`;
  
  for (const group of doc.groups) {
    markdown += `## ${group.group}\n\n`;
    
    for (const endpoint of group.endpoints) {
      markdown += `### ${endpoint.name}\n\n`;
      markdown += `**${endpoint.method}** \`${endpoint.path}\`\n\n`;
      markdown += `${endpoint.description}\n\n`;
      
      if (endpoint.status === 'success') {
        markdown += `**Status:** ✅ Success (${endpoint.httpStatus})\n\n`;
        
        if (endpoint.responseFormat.dataStructure) {
          markdown += `**Data Structure:**\n`;
          markdown += `\`\`\`json\n`;
          markdown += JSON.stringify(endpoint.responseFormat.dataStructure, null, 2);
          markdown += `\n\`\`\`\n\n`;
        }
        
        if (endpoint.sampleResponse) {
          markdown += `**Sample Response:**\n`;
          markdown += `\`\`\`json\n`;
          markdown += JSON.stringify(endpoint.sampleResponse, null, 2);
          markdown += `\n\`\`\`\n\n`;
        }
      } else if (endpoint.status === 'skipped') {
        markdown += `**Status:** ⏭️ Skipped - ${endpoint.reason}\n\n`;
      } else {
        markdown += `**Status:** ❌ Error - ${endpoint.error || 'Unknown error'}\n\n`;
      }
      
      markdown += `---\n\n`;
    }
  }
  
  return markdown;
}