"""
部署脚本 - 用GitHub REST API上传文件到gh-pages分支
"""
import os
import base64
import json
import urllib.request
import urllib.error

# GitHub配置
OWNER = 'adam23330705'
REPO = 'scheduler-app'
BRANCH = 'gh-pages'
TOKEN = os.environ.get('GITHUB_TOKEN', '')

BASE_URL = f'https://api.github.com/repos/{OWNER}/{REPO}'

# 需要上传的文件列表（相对frontend的路径）
FILES = [
    'index.html',
    'manifest.json',
    'service-worker.js',
    'version.json',
    'character-config.json',
    'css/style.css',
    'js/app.js',
    'js/store.js',
    'js/character.js',
    'js/chat.js',
    'js/message.js',
    'js/moments.js',
    'js/task.js',
    'js/calendar.js',
    'js/pomodoro.js',
    'js/stats.js',
    'js/api.js',
    'js/supabase.min.js',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'avatars/boss.svg',
    'avatars/manager.svg',
    'avatars/assistant.svg',
    'avatars/hr.svg',
    'avatars/editor.svg',
]

FRONTEND_DIR = r'C:\Users\10418\WorkBuddy\Claw\scheduler-app\frontend'


def api_request(method, path, data=None):
    url = f'{BASE_URL}{path}'
    headers = {
        'Authorization': f'token {TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
    }
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f'  API Error {e.code}: {error_body}')
        return None


def get_file_sha(path):
    """获取文件SHA（用于更新）"""
    result = api_request('GET', f'/contents/{urllib.parse.quote(path)}?ref={BRANCH}')
    if result and 'sha' in result:
        return result['sha']
    return None


def upload_file(local_path, remote_path):
    """上传单个文件"""
    full_path = os.path.join(FRONTEND_DIR, local_path)
    if not os.path.exists(full_path):
        print(f'  SKIP (not found): {local_path}')
        return False

    with open(full_path, 'rb') as f:
        content = base64.b64encode(f.read()).decode('utf-8')

    sha = get_file_sha(remote_path)
    data = {
        'message': f'Update {remote_path}',
        'content': content,
        'branch': BRANCH,
    }
    if sha:
        data['sha'] = sha

    result = api_request('PUT', f'/contents/{urllib.parse.quote(remote_path)}', data)
    if result and 'content' in result:
        print(f'  OK: {remote_path}')
        return True
    else:
        print(f'  FAIL: {remote_path}')
        return False


def main():
    if not TOKEN:
        print('错误: 未设置 GITHUB_TOKEN 环境变量')
        print('请设置: set GITHUB_TOKEN=your_token')
        return

    print(f'部署到 {OWNER}/{REPO}:{BRANCH}')
    print(f'共 {len(FILES)} 个文件')
    print()

    success = 0
    failed = 0
    for file in FILES:
        print(f'上传: {file}')
        if upload_file(file, file):
            success += 1
        else:
            failed += 1

    print()
    print(f'完成: {success} 成功, {failed} 失败')


if __name__ == '__main__':
    main()
