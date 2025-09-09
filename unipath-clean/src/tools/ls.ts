/**
 * List Directory Tool
 */

import { Tool, ToolResult } from './base';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export class LsTool extends Tool {
  name = 'ls';
  description = 'List files and directories';
  
  async execute(args: any): Promise<ToolResult> {
    try {
      const path = args.path || '.';
      const detailed = args.detailed || false;
      
      const items = await readdir(path);
      
      if (detailed) {
        const details = await Promise.all(
          items.map(async (item) => {
            const fullPath = join(path, item);
            const stats = await stat(fullPath);
            return {
              name: item,
              type: stats.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              modified: stats.mtime
            };
          })
        );
        
        return {
          success: true,
          output: JSON.stringify(details, null, 2)
        };
      }
      
      return {
        success: true,
        output: items.join('\n')
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}