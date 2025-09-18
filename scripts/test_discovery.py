#!/usr/bin/env python3
"""
Lightweight discovery + invocation smoke-test for memory-mcp server.

Usage:
  python3 scripts/test_discovery.py --url http://localhost:3000

This script calls several discovery endpoints and attempts a basic tool invocation.
It exits with a non-zero code when a critical check fails (empty discovery or non-200 responses).
"""
import sys
import argparse
import requests


def get_json(url, path, method='GET', body=None):
    full = url.rstrip('/') + path
    try:
        if method == 'GET':
            r = requests.get(full, timeout=10)
        else:
            r = requests.post(full, json=body or {}, timeout=15)
        r.raise_for_status()
        return r.json(), r.status_code
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] {method} {full} -> {e}")
        return None, getattr(e.response, 'status_code', None)


def check_discovery(base_url):
    endpoints = [
        ('GET', '/tools/list'),
        ('GET', '/mcp/tools'),
        ('GET', '/sse/list-tools'),
        ('POST', '/tools/list'),
        ('POST', '/mcp/list-tools'),
    ]

    overall_ok = True
    discovered = None

    for method, path in endpoints:
        data, status = get_json(base_url, path if path.startswith('/') else '/' + path, method=method)
        print(f"{method} {path} -> status={status}")
        if data is None:
            overall_ok = False
            continue
        # prefer the canonical /tools/list JSON array
        if path == '/tools/list' and isinstance(data, list):
            discovered = data
        # some endpoints may return a wrapper object {'tools': [...]} — try to extract
        if isinstance(data, dict) and 'tools' in data and isinstance(data['tools'], list):
            discovered = data['tools']

    if discovered is None:
        print('[WARN] No discovery array found (tools list). Discovery may be empty or in an unexpected format.')
        overall_ok = False
    else:
        print(f'[OK] Discovered {len(discovered)} tools')

    return overall_ok, discovered


def call_examples(base_url, discovered):
    # Try calling a simple tool if available
    candidates = ['get-memories', 'save-memories', 'clear-memories']
    found = None
    if discovered:
        names = [t.get('name') if isinstance(t, dict) else t for t in discovered]
        for c in candidates:
            if c in names:
                found = c
                break

    if not found:
        print('[INFO] No known tool candidate found to call. Skipping invocation tests.')
        return True

    print(f'[INFO] Invoking tool {found} via canonical /tools/call (may require DB or args)')
    body = {'tool': found, 'args': {}}
    data, status = get_json(base_url, '/tools/call', method='POST', body=body)
    if data is None:
        print(f'[ERROR] /tools/call failed with status {status}')
        return False
    print(f'[OK] /tools/call returned status {status} and payload type {type(data)}')

    # Also try the MCP-path POST /mcp/:tool
    print(f'[INFO] Invoking tool {found} via /mcp/{found}')
    data2, status2 = get_json(base_url, f'/mcp/{found}', method='POST', body={})
    if data2 is None:
        print(f'[ERROR] /mcp/{found} failed with status {status2}')
        return False
    print(f'[OK] /mcp/{found} returned status {status2} and payload type {type(data2)}')

    return True


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--url', '-u', default='http://localhost:3000', help='Base URL for the server')
    args = p.parse_args()

    ok, discovered = check_discovery(args.url)
    if not ok:
        print('[FAIL] Discovery checks failed')

    ok2 = call_examples(args.url, discovered)

    if ok and ok2:
        print('[PASS] Discovery and invocation smoke tests passed')
        return 0
    print('[FAIL] Some checks failed')
    return 2


if __name__ == '__main__':
    sys.exit(main())
