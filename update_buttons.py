import os
import re

directory = r'd:\2025-projects\Event-App-src\EventApp\src\components'

def update_class(match):
    prefix = match.group(1)
    class_name = match.group(2)
    suffix = match.group(3)
    text = match.group(4)
    
    # Remove existing hover backgrounds
    class_name = re.sub(r'hover:bg-[\w-]+', '', class_name)
    # Remove existing hover text colors
    class_name = re.sub(r'hover:text-[\w-]+', '', class_name)
    # Remove existing hover borders
    class_name = re.sub(r'hover:border-[\w-]+', '', class_name)
    # Remove existing transition
    class_name = re.sub(r'transition-colors', '', class_name)
    
    # Clean up multiple spaces
    class_name = re.sub(r'\s+', ' ', class_name).strip()
    
    # Add new classes
    class_name += ' hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors'
    
    return f'{prefix}className="{class_name}"{suffix}>{text}'

pattern = re.compile(r'(<button[^>]*?)className="([^"]*)"([^>]*>)(\s*(?:Cancel|Close)\s*</button>)', re.IGNORECASE)

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.jsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = pattern.sub(update_class, content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'Updated {filepath}')
