"""
fix-frontmatter.py — Repair broken frontmatter in content files.
Uses PyYAML to parse each file; rebuilds clean YAML frontmatter.
Run with: uv run --with pyyaml build/fix-frontmatter.py
"""
import subprocess, re, os, glob, sys
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cats = ['characters','vocab','grammar','religion','philosophy','history']
n = 0
errors = 0

FM_SPLITTER = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)

def get_git_meta(cat, filename):
    result = subprocess.run(
        ['git', 'show', f'HEAD:pages/{cat}/{filename}'],
        capture_output=True, cwd=ROOT
    )
    if result.returncode != 0:
        return None
    html = result.stdout.decode('utf-8', errors='replace')
    m = re.search(r'<meta name="description" content="([^"]+)">', html)
    return m.group(1) if m else None


for cat in cats:
    for md_path in sorted(glob.glob(os.path.join(ROOT, 'content', cat, '*.md'))):
        filename = os.path.basename(md_path).replace('.md', '.html')
        raw = open(md_path, encoding='utf-8').read()

        fm_match = FM_SPLITTER.match(raw)
        if not fm_match:
            print(f'  SKIP (no frontmatter): {cat}/{os.path.basename(md_path)}')
            continue

        fm_text = fm_match.group(1)
        body = raw[fm_match.end():]

        try:
            fm = yaml.safe_load(fm_text)
        except yaml.YAMLError as e:
            print(f'  PARSE ERROR: {cat}/{os.path.basename(md_path)}: {e}')
            errors += 1
            # Try to recover by stripping metaDesc and re-parsing
            fm_text_clean = re.sub(r'^metaDesc:.*$', '', fm_text, flags=re.MULTILINE)
            fm_text_clean = re.sub(r'\n{3,}', '\n\n', fm_text_clean)
            try:
                fm = yaml.safe_load(fm_text_clean)
            except:
                print(f'  UNRECOVERABLE: {cat}/{os.path.basename(md_path)}')
                continue

        if not isinstance(fm, dict):
            print(f'  SKIP (not a dict): {cat}/{os.path.basename(md_path)}')
            continue

        # Get the correct metaDesc from git
        correct_meta = get_git_meta(cat, filename)
        if correct_meta:
            fm['metaDesc'] = correct_meta
        elif 'metaDesc' in fm and isinstance(fm['metaDesc'], str) and '\n' in str(fm.get('desc','')):
            # desc was a multiline block — metaDesc may have swallowed part of it
            del fm['metaDesc']

        # Rebuild clean YAML
        new_fm = yaml.dump(fm, allow_unicode=True, default_flow_style=False, sort_keys=False)
        new_raw = f'---\n{new_fm}---\n{body}'

        if new_raw == raw:
            continue

        open(md_path, 'w', encoding='utf-8').write(new_raw)
        print(f'  ✓ {cat}/{os.path.basename(md_path)}')
        n += 1

print(f'\n{n} fixed, {errors} parse errors encountered and recovered.')
