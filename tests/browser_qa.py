"""Real browser smoke test. Requires Python + playwright and Chromium.

Run a static server in the repository, then:
  python tests/browser_qa.py --url http://127.0.0.1:8080/ --output test-results/browser
The script uses imaginary names, isolated browser contexts and no remote writes.
"""
import argparse
import json
import os
import uuid
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, expect


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default=os.environ.get('OPENTREE_URL', 'http://127.0.0.1:8080/'))
    parser.add_argument('--output', default=os.environ.get('OPENTREE_EVIDENCE', 'test-results/browser'))
    args = parser.parse_args()
    base = args.url.split('#', 1)[0]
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    passed, errors, external = [], [], []
    report = {'url': base, 'checks': passed, 'page_errors': errors, 'external_requests': external}

    def check(name, condition=True):
        if not condition:
            raise AssertionError(name)
        passed.append(name)

    def watch(page):
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: external.append(r.url) if urlsplit(r.url).scheme in ('http', 'https') and urlsplit(r.url).netloc != urlsplit(base).netloc else None)
        return page

    def no_overflow(page, name):
        check(name, page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))

    with sync_playwright() as p:
        browser = p.chromium.launch()
        owner = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True, permissions=['clipboard-read', 'clipboard-write'])
        page = watch(owner.new_page())
        try:
            page.goto(base)
            expect(page.locator('.hero')).to_be_visible()
            no_overflow(page, 'desktop home fits viewport')
            page.screenshot(path=str(out/'home-desktop.png'), full_page=True)
            page.get_by_role('button', name='开启提示音').click()
            expect(page.get_by_role('button', name='关闭提示音')).to_have_attribute('aria-pressed', 'true')
            page.get_by_role('button', name='关闭提示音').click()
            check('sound toggle responds to real clicks')

            page.get_by_role('link', name='种下我的树', exact=False).first.click()
            page.get_by_placeholder('你的昵称', exact=True).fill('测试小鹿')
            page.get_by_role('button', name='头像 🦌', exact=True).click()
            page.get_by_role('button', name='开始选答案', exact=False).click()
            # A missing owner answer must not silently choose the first option.
            page.get_by_role('button', name='下一题', exact=False).click()
            expect(page.locator('#form-error')).to_contain_text('选一个')
            check('owner must actively choose an answer')
            question_options = []
            for i in range(10):
                expect(page.locator('#question-title')).to_be_visible()
                if i == 0:
                    page.locator('#question-title').fill('这个冬天，我最想做什么？')
                question_options.append(page.locator('input[name^="option-"]').evaluate_all('(els) => els.map(e=>e.value)'))
                page.get_by_role('radio', name=f'选择选项{i % 4 + 1}作为我的答案', exact=True).check()
                page.locator('#question-form button[type="submit"]').click()
            expect(page.locator('#tree-share-url')).to_be_visible()
            invite = page.locator('#tree-share-url').input_value()
            manage_url = page.url
            tree_id = manage_url.split('#manage=', 1)[1]
            check('custom 10-question tree created through real UI')
            page.locator('#copy-tree').click()
            check('copy invitation returns full URL', page.evaluate('navigator.clipboard.readText()') == invite)
            page.screenshot(path=str(out/'owner-empty-desktop.png'), full_page=True)

            guest = browser.new_context(viewport={'width': 390, 'height': 844}, permissions=['clipboard-read', 'clipboard-write'])
            friend = watch(guest.new_page())
            friend.goto(invite)
            expect(friend.locator('#visitor-name')).to_be_visible()
            no_overflow(friend, 'mobile invitation fits viewport')
            friend.screenshot(path=str(out/'invite-mobile.png'), full_page=True)
            friend.locator('#visitor-name').fill('测试小熊')
            friend.get_by_role('button', name='开始爬树', exact=False).click()
            answers = []
            for i in range(10):
                expect(friend.locator('.choice')).to_have_count(2)
                buttons = friend.locator('.choice').all()
                target = next(b for b in buttons if (int(b.get_attribute('data-answer')) == i % 4) == (i < 7))
                answers.append(int(target.get_attribute('data-answer')))
                target.click()
                if i == 0:
                    friend.screenshot(path=str(out/'quiz-mobile.png'), full_page=True)
                friend.locator('#next-quiz').click()
            expect(friend.locator('.score-big')).to_contain_text('7')
            friend.locator('#friend-message').fill('这个冬天，也要一起吃火锅！')
            friend.locator('#message-form button[type="submit"]').click()
            expect(friend.locator('#receipt-url')).to_be_visible()
            receipt = friend.locator('#receipt-url').input_value()
            friend.locator('#copy-receipt').click()
            check('copy receipt returns full URL', friend.evaluate('navigator.clipboard.readText()') == receipt)
            check('visitor completes 10 binary questions and receives 7/10')
            check('guest is not granted owner storage', friend.evaluate("localStorage.getItem('opentree.trees.v1')") is None)
            no_overflow(friend, 'mobile result fits viewport')
            friend.screenshot(path=str(out/'result-mobile.png'), full_page=True)

            # Paste the receipt through the owner's actual import form.
            page.locator('#receipt-input').fill(receipt)
            page.get_by_role('button', name='导入成绩', exact=True).click()
            expect(page.locator('.friend-list')).to_contain_text('测试小熊')
            expect(page.locator('.friend-list')).to_contain_text('这个冬天，也要一起吃火锅！')
            expect(page.locator('.friend-score')).to_contain_text('7')
            check('receipt imports friend score and message into owner tree')
            updated_invite = page.locator('#tree-share-url').input_value()
            check('updated share link carries the new snapshot', updated_invite != invite)
            page.screenshot(path=str(out/'owner-result-desktop.png'), full_page=True)
            page.reload()
            expect(page.locator('.friend-list')).to_contain_text('测试小熊')
            check('owner tree survives reload')
            page.goto(receipt)
            expect(page.locator('#accept-receipt')).to_be_visible()
            page.locator('#accept-receipt').click()
            expect(page.locator('.friend-list li')).to_have_count(1)
            check('opening receipt requires confirmation and duplicate import is idempotent')

            friend.goto(updated_invite)
            expect(friend.locator('.friend-list')).to_contain_text('测试小熊')
            check('new isolated visitor sees updated link snapshot')
            friend.goto(invite)
            expect(friend.locator('.friend-list')).to_have_count(0)
            check('old invitation remains an explicit old snapshot')

            # Browser history routes return to the existing owner tree.
            page.locator('header a[href="#my"]').click()
            expect(page.locator('.saved-card')).to_have_count(1)
            page.go_back()
            expect(page.locator('#tree-share-url')).to_be_visible()
            check('browser Back restores owner management route')
            page.get_by_text('备份与管理', exact=True).click()
            with page.expect_download() as download_info:
                page.locator('#export-tree').click()
            backup_path = out/'test-tree-backup.json'
            download_info.value.save_as(backup_path)
            backup = json.loads(backup_path.read_text('utf-8'))
            check('backup contains original tree and imported result', backup['id'] == tree_id and len(backup['results']) == 1)

            restored = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)
            recovery = watch(restored.new_page())
            recovery.goto(base+'#my')
            recovery.locator('#restore-file').set_input_files(backup_path)
            expect(recovery.locator('#tree-share-url')).to_be_visible()
            expect(recovery.locator('.friend-list')).to_contain_text('测试小熊')
            check('backup restores owner tree into a fresh browser context')
            no_overflow(recovery, 'mobile management fits viewport')
            recovery.screenshot(path=str(out/'owner-result-mobile.png'), full_page=True)

            capacity = json.loads(json.dumps(backup))
            capacity['results'] = []
            for i in range(100):
                score = i % 11
                r = {**backup['results'][0], 'id': str(uuid.uuid4()), 'name':f'第{i+1:03d}位测试朋友长名字', 'score':score}
                r['answers'] = [q['answer'] if n < score else (q['answer']+1) % len(q['options']) for n, q in enumerate(capacity['questions'])]
                capacity['results'].append(r)
            capacity_path = out/'capacity-backup.json'
            capacity_path.write_text(json.dumps(capacity, ensure_ascii=False), 'utf-8')
            # A separate owner context imports the entire fixture via the actual file input.
            crowded_context = browser.new_context(viewport={'width':390, 'height':844})
            crowded = watch(crowded_context.new_page())
            crowded.goto(base+'#my')
            crowded.locator('#restore-file').set_input_files(capacity_path)
            expect(crowded.locator('.friend-list li')).to_have_count(100)
            expect(crowded.locator('.ornament')).to_have_count(12)
            expect(crowded.locator('.grow-label')).to_contain_text('完整成绩见名单')
            check('100-result tree preserves full list and limits visible ornaments to 12')
            crowded.locator('.tree-panel').screenshot(path=str(out/'tree-capacity-mobile.png'))
            capacity_invite = crowded.locator('#tree-share-url').input_value()
            friend.goto(capacity_invite)
            friend.locator('#visitor-name').fill('新来的满分朋友')
            friend.get_by_role('button', name='开始爬树', exact=False).click()
            for q in capacity['questions']:
                friend.locator(f'.choice[data-answer="{q["answer"]}"]').click()
                friend.locator('#next-quiz').click()
            expect(friend.locator('.ornament.current')).to_be_visible()
            expect(friend.locator('.ornament.current')).to_contain_text('新来的满分朋友')
            expect(friend.locator('.ornament')).to_have_count(12)
            check('current visitor stays visible even when the tree already has 100 results')
            crowded_context.close()

            friend.goto(base+'#play=d1.invalid')
            expect(friend.get_by_role('heading', name='这次没有打开')).to_be_visible()
            check('malformed share link shows a recoverable error')
            friend.get_by_role('link', name='回到首页', exact=True).click()
            expect(friend.locator('.hero')).to_be_visible()
            no_overflow(friend, 'mobile home fits viewport')
            friend.screenshot(path=str(out/'home-mobile.png'), full_page=True)

            # Malicious data is valid game text but must remain text in all UI contexts.
            malicious = {**backup, 'name':'<svg/onload=x=1>', 'mood':'<b>hello</b>'}
            code = friend.evaluate("async t => (await import('./lib.js')).encodeTree(t)", malicious)
            friend.goto(base+'#play='+code)
            expect(friend.locator('#visitor-name')).to_be_visible()
            expect(friend.locator('h1')).to_contain_text('<svg/onload=x=1>')
            check('malicious nickname remains literal text', friend.locator('svg[onload]').count() == 0 and friend.evaluate('window.x') is None)
            check('no unhandled JavaScript errors', not errors)
            check('no external ads, trackers or runtime requests', not external)
            report['status'] = 'passed'
        except Exception as exc:
            report['status'] = 'failed'
            report['failure'] = str(exc)
            page.screenshot(path=str(out/'failure-desktop.png'), full_page=True)
            raise
        finally:
            report['browser'] = browser.version
            (out/'browser-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), 'utf-8')
            browser.close()
    print(json.dumps({'status':report['status'], 'checks':len(passed), 'report':str(out/'browser-report.json')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
