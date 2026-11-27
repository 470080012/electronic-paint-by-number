#!/usr/bin/env python3
"""Build the upload ZIP from the reviewed static runtime only."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
import hashlib
root = Path(__file__).resolve().parent.parent
source = root / '源文件'
allowed = {'.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.woff', '.woff2', '.gif'}
files = sorted(p for p in source.rglob('*') if p.is_file() and not p.name.startswith('.'))
assert (source / 'index.html').exists()
assert len([p for p in files if p.suffix == '.html']) == 1
assert all(p.suffix in allowed for p in files)
assert not any('node_modules' in p.parts or p.suffix == '.map' for p in files)
manifest = json.loads((source / 'mini_tool.json').read_text())
assert set(manifest) == {'is_high_consumption_scene'} and type(manifest['is_high_consumption_scene']) is bool
output = root / '上传包' / '数字油画工作室-核心原型.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    for file in files:
        archive.write(file, file.relative_to(source).as_posix())
assert output.stat().st_size < 10 * 1024 * 1024
report = {'zip': output.name, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'files': [str(f.relative_to(source)) for f in files], 'rootIndex': True, 'highConsumption': manifest['is_high_consumption_scene']}
(root / '检查报告' / '打包清单.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))
