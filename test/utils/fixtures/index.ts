import {readdirSync, statSync} from 'fs';
import {join} from 'path';

/**
 * Loads all JSON fixtures from a directory with hierarchy.
 * 
 * Usage:
 *
 * ```ts
 * import fixtures from './fixtures';
 *
 * expect(fixtures.headers.defaultValidRequestHeaders).toEqual({...});
 * ```
 *
 * @param dirPath - The path to the directory to load fixtures from.
 * @returns An object containing all the fixtures.
 */
const loadFixturesFromDirectoryWithHierarchy = (dirPath: string): Record<string, any> => {
    const fixtures: Record<string, any> = {};
    
    readdirSync(dirPath).forEach((item) => {
        const itemPath = join(dirPath, item);
        const stats = statSync(itemPath);
        
        if (stats.isDirectory()) {
            // Recursively load fixtures from subdirectories
            const subFixtures = loadFixturesFromDirectoryWithHierarchy(itemPath);
            
            // Convert directory name to camelCase (e.g., 'page-hits' -> 'pageHits')
            const dirName = item.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            fixtures[dirName] = subFixtures;
        } else if (item.endsWith('.json')) {
            const name = item.replace('.json', '');
            fixtures[name] = require(itemPath);
        }
    });
    
    return fixtures;
};

const fixtures = loadFixturesFromDirectoryWithHierarchy(__dirname);

export default fixtures;