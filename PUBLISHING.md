# Publishing natty-sched to npm

## Pre-publish Checklist

✅ Package name: `natty-sched`
✅ All tests passing (26 + 67 + 14 tests)
✅ README.md complete with examples
✅ LICENSE file (MIT)
✅ .npmignore configured
✅ Package size: 16.5 kB (reasonable)

## Steps to Publish

### 1. Login to npm (first time only)
```bash
npm login
```

### 2. Verify package contents
```bash
npm pack --dry-run
```

### 3. Test the package locally (optional)
```bash
npm pack
# Creates natty-sched-1.0.0.tgz
# Test in another project: npm install /path/to/natty-sched-1.0.0.tgz
```

### 4. Publish to npm
```bash
npm publish
```

### 5. Verify publication
```bash
npm info natty-sched
```

## After Publishing

Users can install with:
```bash
npm install natty-sched
```

Usage:
```javascript
const { parse, getNextScheduledTime } = require('natty-sched');

const schedule = parse('Every 3 days at 9am');
const nextRun = getNextScheduledTime(schedule);
console.log(nextRun);
```

## Version Updates

When making updates:
```bash
npm version patch  # 1.0.0 -> 1.0.1 (bug fixes)
npm version minor  # 1.0.0 -> 1.1.0 (new features)
npm version major  # 1.0.0 -> 2.0.0 (breaking changes)
npm publish
```

## Optional: Add to package.json

If you want to add repository info, update package.json:
```json
{
  "author": "Your Name <your.email@example.com>",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/natty-sched.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/natty-sched/issues"
  },
  "homepage": "https://github.com/yourusername/natty-sched#readme"
}
```
