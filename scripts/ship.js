#!/usr/bin/env node

import {execSync} from 'child_process';
import {readFileSync, writeFileSync} from 'fs';
import {createInterface} from 'readline';

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

function exec(command, options = {}) {
    try {
        return execSync(command, {encoding: 'utf8', stdio: 'pipe', ...options}).trim();
    } catch (error) {
        console.error(`❌ Command failed: ${command}`);
        console.error(error.message);
        process.exit(1);
    }
}

function getCurrentBranch() {
    return exec('git branch --show-current');
}

function getRemoteName() {
    return process.env.GHOST_UPSTREAM || 'origin';
}

function getCurrentVersion() {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    return packageJson.version;
}

function bumpVersion(currentVersion, bumpType) {
    const parts = currentVersion.split('.').map(Number);
    let [major, minor, patch] = parts;

    switch (bumpType) {
    case 'major':
        major += 1;
        minor = 0;
        patch = 0;
        break;
    case 'minor':
        minor += 1;
        patch = 0;
        break;
    case 'patch':
        patch += 1;
        break;
    default:
        throw new Error(`Invalid bump type: ${bumpType}`);
    }

    return `${major}.${minor}.${patch}`;
}

function updatePackageVersion(newVersion) {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    packageJson.version = newVersion;
    writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
}

function promptVersion() {
    return new Promise((resolve) => {
        console.log('\nSelect version bump type:');
        console.log('  - patch (0.0.X)');
        console.log('  - minor (0.X.0)');
        console.log('  - major (X.0.0)');
    
        rl.question('Enter bump type (patch/minor/major) [patch]: ', (answer) => {
            const normalizedAnswer = answer.toLowerCase().trim() || 'patch';
            const validTypes = ['patch', 'minor', 'major'];
      
            if (!validTypes.includes(normalizedAnswer)) {
                console.log('❌ Invalid choice. Please enter "patch", "minor", or "major".');
                resolve(promptVersion());
            } else {
                rl.close();
                resolve(normalizedAnswer);
            }
        });
    });
}

async function main() {
    console.log('🚢 Starting ship process...\n');

    const remoteName = getRemoteName();
    console.log(`🔗 Using remote: ${remoteName}`);

    // 1. Ensure we're on main branch
    const currentBranch = getCurrentBranch();
    if (currentBranch !== 'main') {
        console.error(`❌ You must be on the main branch. Currently on: ${currentBranch}`);
        process.exit(1);
    }
    console.log('✅ On main branch');

    // 2. Ensure main is up to date
    console.log('📡 Checking latest changes...');
    
    const localCommit = exec('git rev-parse HEAD');
    const remoteCommit = exec(`git ls-remote ${remoteName} refs/heads/main`).split('\t')[0];
  
    if (localCommit !== remoteCommit) {
        console.error(`❌ Your main branch is not up to date with ${remoteName}/main`);
        console.error(`Run: git pull ${remoteName} main`);
        process.exit(1);
    }
    console.log('✅ Main branch is up to date');

    // 3. Check for uncommitted changes
    const status = exec('git status --porcelain');
    if (status) {
        console.error('❌ You have uncommitted changes. Please commit or stash them first.');
        process.exit(1);
    }
    console.log('✅ Working directory is clean');

    // 4. Get current version and prompt for bump type
    const currentVersion = getCurrentVersion();
    console.log(`📦 Current version: ${currentVersion}`);
  
    const bumpType = await promptVersion();
    const newVersion = bumpVersion(currentVersion, bumpType);
    console.log(`🎯 New version will be: ${newVersion}`);

    // 5. Create release branch
    const branchName = `release/v${newVersion}`;
    console.log(`🌿 Creating branch: ${branchName}`);
    exec(`git checkout -b ${branchName}`);

    // 6. Update package.json version
    console.log('📝 Updating package.json version...');
    updatePackageVersion(newVersion);

    // 7. Commit the version bump
    console.log('💾 Committing version bump...');
    exec('git add package.json');
    exec(`git commit -m "Bump version to ${newVersion}"`);

    // 8. Push the branch
    console.log('⬆️  Pushing release branch...');
    exec(`git push ${remoteName} ${branchName}`);

    // 9. Switch back to main
    exec('git checkout main');

    console.log('\n🎉 Ship process complete!');
    console.log('\nNext steps:');
    console.log(`1. Create a Pull Request from ${branchName} to main`);
    console.log('2. Once merged, the deployment will automatically:');
    console.log('   - Deploy to staging');
    console.log('   - Create a tag and GitHub release');
    console.log('   - Deploy to production');
    console.log(`\nPR URL: https://github.com/TryGhost/TrafficAnalytics/pull/new/${branchName}`);
}

main().catch(console.error);