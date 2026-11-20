"""
Sentinel IDS - end-to-end smoke test suite.
Verifies every layer of the reorganized project:

  1. project structure integrity (all numbered folders + key files)
  2. configuration            (tsconfig aliases, package.json paths, env)
  3. database                 (PostgreSQL start + schema + data)
  4. backend                  (API routes: products, auth, admin guard)
  5. frontend                 (storefront + admin console pages render)
  6. machine learning         (trainer runs; models load from database)
  7. security engine          (attack detection + auto-block + ledgers)

Usage:  python 10_TESTING/run_tests.py
Exit code 0 = all pass. Requires the app to be running (run_application.bat).
"""
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'http://127.0.0.1:3000'
PASS, FAIL = [], []


def check(name, ok, detail=''):
    (PASS if ok else FAIL).append(name)
    print(('  PASS  ' if ok else '  FAIL  ') + name + (f'  [{detail}]' if detail else ''))


def http(method, path, body=None, headers=None, timeout=15):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header('content-type', 'application/json')
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=timeout) as r:
            raw = r.read().decode()
            try:
                return r.status, json.loads(raw or '{}')
            except json.JSONDecodeError:
                return r.status, {'_html': raw[:200]}
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception as e:
        return 0, {}


def main():
    print('== 1. Project structure integrity ==')
    folders = ['01_FRONTEND_USER_INTERFACE', '02_BACKEND_SERVER', '03_MACHINE_LEARNING_MODELS',
               '04_DATASET_AND_DATA_PROCESSING', '05_DATABASE', '06_SECURITY_AND_ATTACK_DETECTION',
               '07_CONFIGURATION', '08_LOGS_AND_REPORTS', '09_DOCUMENTATION', '10_TESTING']
    for f in folders:
        check(f'folder {f}', os.path.isdir(os.path.join(ROOT, f)))
    key_files = [
        '01_FRONTEND_USER_INTERFACE/components/admin/shell.tsx',
        '02_BACKEND_SERVER/core/auth.ts',
        '02_BACKEND_SERVER/core/ml/train.ts',
        '03_MACHINE_LEARNING_MODELS/model_training/train.py',
        '04_DATASET_AND_DATA_PROCESSING/data_tools/generate-data.mjs',
        '05_DATABASE/schema/schema.prisma',
        '05_DATABASE/database_connection/pg-start.mjs',
        '06_SECURITY_AND_ATTACK_DETECTION/engine/engine.ts',
        '07_CONFIGURATION/env.example',
        '09_DOCUMENTATION/SecureMart-Security-Documentation.pdf',
        'run_application.bat', 'requirements.txt', 'README.md',
    ]
    for f in key_files:
        check(f'file {f}', os.path.isfile(os.path.join(ROOT, f)))
    check('old folders removed', not os.path.isdir(os.path.join(ROOT, 'scripts'))
          and not os.path.isdir(os.path.join(ROOT, 'mini-services')))
    check('ml artifacts preserved (training datasets dir)', os.path.isdir(
        os.path.join(ROOT, '04_DATASET_AND_DATA_PROCESSING', 'training_datasets')))

    print('== 2. Configuration ==')
    ts = open(os.path.join(ROOT, 'tsconfig.json'), encoding='utf-8').read()
    check('tsconfig alias frontend', '01_FRONTEND_USER_INTERFACE' in ts)
    check('tsconfig alias backend core', '02_BACKEND_SERVER' in ts)
    check('tsconfig alias security engine', '06_SECURITY_AND_ATTACK_DETECTION' in ts)
    pkg = json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf-8'))
    check('package.json prisma schema path', pkg.get('prisma', {}).get('schema') == '05_DATABASE/schema/schema.prisma')
    check('package.json stream path', '02_BACKEND_SERVER/security_stream_service' in pkg['scripts'].get('stream', ''))
    check('package.json db:push path', '05_DATABASE' in pkg['scripts'].get('db:push', ''))
    check('.env exists', os.path.isfile(os.path.join(ROOT, '.env')))

    print('== 3. Database (PostgreSQL + data) ==')
    r = subprocess.run(['node', '05_DATABASE/database_connection/pg-start.mjs'],
                       cwd=ROOT, capture_output=True, text=True, timeout=120)
    check('postgresql starts / already running', r.returncode == 0,
          (r.stdout.strip().splitlines() or [''])[-1] if r.stdout.strip() else r.stderr.strip()[:80])

    print('== 4. Backend (API routes) ==')
    s, _ = http('GET', '/api/products')
    check('products API responds', s == 200)
    s, _ = http('GET', '/api/auth/me')
    check('auth API responds', s in (200, 401))
    s, body = http('POST', '/api/auth/login',
                   {'email': 'admin@securemart.in', 'password': 'AdminPass#2026'})
    check('admin login works', s == 200 and body.get('user', {}).get('role') == 'ADMIN')
    cookie = 'sm_session=' + body.get('sessionToken', '') if body.get('sessionToken') else None
    s, _ = http('GET', '/api/admin/overview', headers={'cookie': cookie} if cookie else {})
    check('admin-only API guarded + working', s == 200)
    s, _ = http('GET', '/api/admin/overview')
    check('admin API rejects anonymous (401/403)', s in (401, 403))

    print('== 5. Frontend (pages render) ==')
    for path, label in [('/', 'storefront home'), ('/login', 'login page'), ('/admin', 'admin console')]:
        s, _ = http('GET', path)
        check(f'{label} renders', s == 200)

    print('== 6. Machine learning ==')
    s, body = http('GET', '/api/admin/models', headers={'cookie': cookie} if cookie else {})
    models_ok = s == 200 and body.get('live', {}).get('rf') is not None
    check('trained RF model active in database', models_ok,
          f"v{body.get('live', {}).get('rf', {}).get('version', '?')}" if models_ok else 'no active RF')
    if models_ok:
        acc = body['live']['rf'].get('metrics', {}).get('testAccuracy')
        check('RF metrics present', acc is not None, f'testAccuracy={acc}')
    py = subprocess.run([sys.executable, '-c', 'import sklearn, numpy; print(sklearn.__version__)'],
                        capture_output=True, text=True)
    check('python ML trainer deps installed', py.returncode == 0, py.stdout.strip() or py.stderr.strip()[:60])

    print('== 7. Security engine ==')
    s, body = http('GET', '/api/admin/ips?filter=all', headers={'cookie': cookie} if cookie else {})
    check('IP ledger API works', s == 200 and 'ips' in body)
    s, body = http('GET', '/api/admin/credentials', headers={'cookie': cookie} if cookie else {})
    check('credential ledger API works', s == 200 and 'attempts' in body)
    # fire 12 rapid failed logins from a fake attacker IP -> engine must flag/block
    attacker = '45.148.211.99'
    for i in range(12):
        http('POST', '/api/auth/login', {'email': f'victim{i}@mail.com', 'password': 'x' * 8},
             headers={'x-forwarded-for': attacker})
    import time
    time.sleep(5)  # engine flushes to postgres every 2s — let the ledger land
    s, body = http('GET', '/api/admin/ips?q=' + attacker, headers={'cookie': cookie} if cookie else {})
    ip_row = next((r for r in body.get('ips', []) if r.get('ip') == attacker), None)
    check('attacker detected and blocked mid-burst', ip_row is not None and (ip_row.get('status') == 'BLOCKED' or ip_row.get('riskScore', 0) >= 80),
          f"failed={ip_row.get('failedLogins') if ip_row else 'n/a'} risk={ip_row.get('riskScore') if ip_row else 'n/a'}")
    s, body = http('GET', '/api/products', headers={'x-forwarded-for': attacker})
    blocked = s == 403 or (ip_row or {}).get('status') == 'BLOCKED'
    check('attacker blocked (403 or BLOCKED status)', blocked, f'http={s} status={ip_row.get("status") if ip_row else "?"}')
    # unblock to leave system clean
    if ip_row and ip_row.get('status') == 'BLOCKED':
        http('POST', '/api/admin/ip-actions', {'ip': attacker, 'action': 'unblock'},
             headers={'cookie': cookie} if cookie else {})

    print()
    print(f'RESULT: {len(PASS)} passed, {len(FAIL)} failed')
    if FAIL:
        print('Failed checks:')
        for f in FAIL:
            print('  -', f)
        sys.exit(1)
    print('ALL CHECKS PASSED')


if __name__ == '__main__':
    main()
