from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import time
import os
import re

SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'generated_files', 'screenshots')


def ensure_dirs():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)


def get_driver(headless=False):
    options = Options()
    if headless:
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option('excludeSwitches', ['enable-automation'])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument('--start-maximized')
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver


def google_search(query: str) -> dict:
    ensure_dirs()
    driver = None
    steps = []
    try:
        steps.append({'label': 'Opening Chrome browser', 'status': 'done'})
        driver = get_driver(headless=False)

        steps.append({'label': 'Navigating to Google', 'status': 'done'})
        driver.get('https://www.google.com')
        time.sleep(2)

        # Handle cookie consent
        try:
            accept_btn = driver.find_element(By.XPATH, "//button[contains(., 'Accept') or contains(., 'I agree')]")
            accept_btn.click()
            time.sleep(0.5)
        except:
            pass

        steps.append({'label': f'Searching for: {query}', 'status': 'done'})
        search_box = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.NAME, 'q'))
        )
        search_box.clear()
        search_box.send_keys(query)
        search_box.send_keys(Keys.RETURN)
        time.sleep(3)

        # Screenshot
        screenshot_path = os.path.join(SCREENSHOTS_DIR, f'search_{int(time.time())}.png')
        driver.save_screenshot(screenshot_path)
        steps.append({'label': 'Screenshot captured', 'status': 'done'})

        # Scrape results
        steps.append({'label': 'Extracting search results', 'status': 'done'})
        results = []
        result_divs = driver.find_elements(By.CSS_SELECTOR, 'div.g')[:8]

        for div in result_divs:
            try:
                title_el = div.find_element(By.CSS_SELECTOR, 'h3')
                title = title_el.text.strip()
                try:
                    link_el = div.find_element(By.CSS_SELECTOR, 'a')
                    link = link_el.get_attribute('href')
                except:
                    link = ''
                try:
                    snippet_el = div.find_element(By.CSS_SELECTOR, 'div.VwiC3b, span.aCOpRe, div[data-sncf]')
                    snippet = snippet_el.text.strip()
                except:
                    snippet = ''
                if title:
                    results.append({'title': title, 'link': link, 'snippet': snippet})
            except:
                continue

        time.sleep(1)
        driver.quit()

        return {
            'success': True,
            'query': query,
            'results': results[:6],
            'screenshot': screenshot_path,
            'steps': steps,
        }

    except Exception as e:
        if driver:
            try: driver.quit()
            except: pass
        return {'success': False, 'error': str(e), 'steps': steps, 'results': []}


def open_website(url: str) -> dict:
    ensure_dirs()
    driver = None
    steps = []
    try:
        if not url.startswith('http'):
            url = 'https://' + url

        steps.append({'label': 'Opening Chrome', 'status': 'done'})
        driver = get_driver(headless=False)

        steps.append({'label': f'Navigating to {url}', 'status': 'done'})
        driver.get(url)
        time.sleep(3)

        screenshot_path = os.path.join(SCREENSHOTS_DIR, f'site_{int(time.time())}.png')
        driver.save_screenshot(screenshot_path)
        steps.append({'label': 'Screenshot captured', 'status': 'done'})

        title = driver.title
        current_url = driver.current_url
        driver.quit()

        return {'success': True, 'url': current_url, 'title': title, 'screenshot': screenshot_path, 'steps': steps}

    except Exception as e:
        if driver:
            try: driver.quit()
            except: pass
        return {'success': False, 'error': str(e), 'steps': steps}


def youtube_search(query: str) -> dict:
    ensure_dirs()
    driver = None
    steps = []
    try:
        steps.append({'label': 'Opening Chrome', 'status': 'done'})
        driver = get_driver(headless=False)

        steps.append({'label': f'Searching YouTube for: {query}', 'status': 'done'})
        search_query = query.replace(' ', '+')
        driver.get(f'https://www.youtube.com/results?search_query={search_query}')
        time.sleep(3)

        screenshot_path = os.path.join(SCREENSHOTS_DIR, f'youtube_{int(time.time())}.png')
        driver.save_screenshot(screenshot_path)

        videos = []
        video_elements = driver.find_elements(By.CSS_SELECTOR, 'ytd-video-renderer')[:5]
        for el in video_elements:
            try:
                title = el.find_element(By.CSS_SELECTOR, '#video-title').text.strip()
                link = el.find_element(By.CSS_SELECTOR, '#video-title').get_attribute('href')
                videos.append({'title': title, 'link': link})
            except:
                continue

        steps.append({'label': f'Found {len(videos)} videos', 'status': 'done'})
        driver.quit()

        return {'success': True, 'query': query, 'videos': videos, 'screenshot': screenshot_path, 'steps': steps}

    except Exception as e:
        if driver:
            try: driver.quit()
            except: pass
        return {'success': False, 'error': str(e), 'steps': steps}


def parse_browser_command(user_message: str) -> dict:
    msg = user_message.lower().strip()

    # YouTube
    if 'youtube' in msg:
        # Remove common words to get the query
        query = re.sub(r'(search|open|go to|find|look up|on|in|youtube|for|videos?)', '', msg, flags=re.IGNORECASE).strip()
        query = query.strip(' -:')
        if not query:
            query = 'trending videos'
        return {'action': 'youtube', 'query': query}

    # Open specific URL
    url_match = re.search(r'(?:open|go to|visit|navigate to)\s+((?:https?://)?[\w.-]+\.\w{2,})', msg, re.IGNORECASE)
    if url_match:
        return {'action': 'open', 'url': url_match.group(1)}

    # Google search — extract actual query
    # Remove trigger words to get the real search query
    query = msg
    trigger_phrases = [
        'search google for', 'google search for', 'search on google for',
        'search google', 'google for', 'search for', 'google search',
        'find on google', 'look up', 'find information about',
        'search', 'google', 'find',
    ]
    for phrase in trigger_phrases:
        if query.startswith(phrase):
            query = query[len(phrase):].strip()
            break

    query = query.strip(' -:')
    if not query:
        query = user_message

    return {'action': 'search', 'query': query}


def execute_browser_command(user_message: str) -> dict:
    command = parse_browser_command(user_message)

    if command['action'] == 'youtube':
        result = youtube_search(command['query'])
        if result['success']:
            videos_text = '\n'.join([f"- [{v['title']}]({v['link']})" for v in result.get('videos', [])])
            result['summary'] = f"**YouTube Search:** {command['query']}\n\n**Top Videos:**\n{videos_text}"
        return result

    elif command['action'] == 'open':
        result = open_website(command['url'])
        if result['success']:
            result['summary'] = f"**Opened:** {result['url']}\n**Page title:** {result['title']}"
        return result

    else:
        result = google_search(command['query'])
        if result['success']:
            if result['results']:
                results_text = '\n\n'.join([
                    f"**{i+1}. {r['title']}**\n{r['snippet']}\n[Link]({r['link']})"
                    for i, r in enumerate(result.get('results', []))
                ])
            else:
                results_text = 'No results extracted — but Chrome opened and searched successfully.'
            result['summary'] = f"**Google Search:** `{command['query']}`\n\n{results_text}"
        return result