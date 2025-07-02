import {readdirSync} from 'fs';
import {join} from 'path';

const fixtures: Record<string, any> = {};

// Load all .json files in this directory
readdirSync(__dirname)
    .filter(file => file.endsWith('.json'))
    .forEach((file) => {
        const name = file.replace('.json', '');
        fixtures[name] = require(join(__dirname, file));
    });

export default fixtures;