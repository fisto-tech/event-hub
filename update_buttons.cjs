const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, 'src', 'components');

const pattern = /(<button[^>]*?)className="([^"]*)"([^>]*>)(\s*(?:Cancel|Close)\s*<\/button>)/gi;

function updateClass(match, prefix, className, suffix, text) {
    className = className.replace(/hover:bg-[\w-]+/g, '');
    className = className.replace(/hover:text-[\w-]+/g, '');
    className = className.replace(/hover:border-[\w-]+/g, '');
    className = className.replace(/transition-colors/g, '');
    className = className.replace(/\s+/g, ' ').trim();
    
    className += ' hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors';
    
    return `${prefix}className="${className}"${suffix}${text}`;
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);
        if (stat.isDirectory()) {
            walk(filepath);
        } else if (filepath.endsWith('.jsx')) {
            let content = fs.readFileSync(filepath, 'utf-8');
            let newContent = content.replace(pattern, updateClass);
            if (newContent !== content) {
                fs.writeFileSync(filepath, newContent, 'utf-8');
                console.log('Updated ' + filepath);
            }
        }
    }
}

walk(directory);
