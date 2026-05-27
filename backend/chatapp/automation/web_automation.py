"""
ZeroTrace Advanced Web Automation
Fill forms, login to websites, download files, monitor changes, scrape data.
"""

import os
import re
import time
import requests
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

DOWNLOADS_DIR = str(Path.home() / 'Downloads')


def get_driver(headless: bool = False, download_dir: str = None) -> webdriver.Chrome:
    """Create Chrome WebDriver with options."""
    options = Options()
    if headless:
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')

    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option('excludeSwitches', ['enable-automation'])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument('--start-maximized')

    if download_dir:
        prefs = {
            'download.default_directory': download_dir,
            'download.prompt_for_download': False,
        }
        options.add_experimental_option('prefs', prefs)

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver


# ─── Fill web form ────────────────────────────────────────────────────────────

def fill_web_form(url: str, form_data: dict) -> dict:
    """
    Fill and submit a web form.
    form_data: {field_name_or_id: value}
    """
    driver = None
    steps = []
    try:
        steps.append({'label': f'Opening {url}', 'status': 'done'})
        driver = get_driver()
        driver.get(url)
        time.sleep(2)

        filled = []
        for field, value in form_data.items():
            try:
                # Try multiple selectors
                element = None
                for selector in [
                    (By.NAME, field),
                    (By.ID, field),
                    (By.CSS_SELECTOR, f'input[placeholder*="{field}"]'),
                    (By.XPATH, f'//input[@placeholder="{field}"]'),
                    (By.XPATH, f'//label[contains(text(),"{field}")]/following-sibling::input'),
                ]:
                    try:
                        element = WebDriverWait(driver, 3).until(EC.presence_of_element_located(selector))
                        break
                    except:
                        continue

                if element:
                    tag = element.tag_name
                    input_type = element.get_attribute('type')

                    if tag == 'select':
                        Select(element).select_by_visible_text(value)
                    elif input_type in ['checkbox', 'radio']:
                        if value and not element.is_selected():
                            element.click()
                    else:
                        element.clear()
                        element.send_keys(value)

                    filled.append(field)
            except Exception as e:
                pass

        steps.append({'label': f'Filled {len(filled)} fields', 'status': 'done'})

        # Take screenshot
        screenshot_path = str(Path(__file__).parent.parent.parent / 'generated_files' / 'screenshots' / f'form_{int(time.time())}.png')
        driver.save_screenshot(screenshot_path)

        time.sleep(1)
        driver.quit()

        return {
            'success': True,
            'filled_fields': filled,
            'screenshot': screenshot_path,
            'steps': steps,
            'summary': f"✅ **Form filled!**\n\n**URL:** {url}\n**Fields filled:** {', '.join(filled)}",
        }

    except Exception as e:
        if driver:
            try: driver.quit()
            except: pass
        return {'success': False, 'error': str(e), 'steps': steps}


# ─── Download file from website ───────────────────────────────────────────────

def download_file_from_url(url: str, filename: str = None) -> dict:
    """Download a file from a URL to Downloads folder."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()

        if not filename:
            filename = url.split('/')[-1] or f'download_{int(time.time())}'

        save_path = os.path.join(DOWNLOADS_DIR, filename)

        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        size_kb = round(os.path.getsize(save_path) / 1024, 1)

        return {
            'success': True,
            'filename': filename,
            'path': save_path,
            'size_kb': size_kb,
            'summary': f"✅ **File downloaded!**\n\n**File:** `{filename}`\n**Size:** {size_kb} KB\n**Saved to:** Downloads folder",
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


# ─── Monitor website for changes ──────────────────────────────────────────────

def get_website_content(url: str) -> str:
    """Get text content of a webpage."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        for tag in soup(['script', 'style', 'nav', 'footer']):
            tag.decompose()
        return soup.get_text(separator=' ', strip=True)[:5000]
    except Exception as e:
        return ''


def check_website_changes(url: str, keywords: list = None) -> dict:
    """Check if a website has changed or contains specific keywords."""
    try:
        content = get_website_content(url)

        found_keywords = []
        if keywords:
            for kw in keywords:
                if kw.lower() in content.lower():
                    found_keywords.append(kw)

        return {
            'success': True,
            'url': url,
            'content_length': len(content),
            'keywords_found': found_keywords,
            'content_preview': content[:500],
            'summary': f"🌐 **Website checked!**\n\n**URL:** {url}\n**Keywords found:** {', '.join(found_keywords) or 'None'}\n**Content preview:** {content[:200]}...",
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


# ─── Scrape website data ──────────────────────────────────────────────────────

def scrape_website_data(url: str, data_type: str = 'text') -> dict:
    """
    Scrape structured data from a website.
    data_type: 'text', 'links', 'images', 'tables'
    """
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')

        if data_type == 'links':
            links = [{'text': a.get_text(strip=True), 'href': a.get('href', '')}
                     for a in soup.find_all('a', href=True)[:20]]
            return {
                'success': True,
                'data': links,
                'count': len(links),
                'summary': f"🔗 **Scraped {len(links)} links** from {url}",
            }

        elif data_type == 'images':
            images = [img.get('src', '') for img in soup.find_all('img', src=True)[:20]]
            return {
                'success': True,
                'data': images,
                'count': len(images),
                'summary': f"🖼️ **Scraped {len(images)} images** from {url}",
            }

        elif data_type == 'tables':
            tables = []
            for table in soup.find_all('table')[:3]:
                rows = []
                for row in table.find_all('tr'):
                    cells = [cell.get_text(strip=True) for cell in row.find_all(['td', 'th'])]
                    if cells:
                        rows.append(cells)
                tables.append(rows)
            return {
                'success': True,
                'data': tables,
                'count': len(tables),
                'summary': f"📊 **Scraped {len(tables)} tables** from {url}",
            }

        else:  # text
            for tag in soup(['script', 'style', 'nav', 'footer']):
                tag.decompose()
            text = soup.get_text(separator='\n', strip=True)[:3000]
            return {
                'success': True,
                'data': text,
                'summary': f"📄 **Scraped text** from {url}\n\n{text[:500]}...",
            }

    except Exception as e:
        return {'success': False, 'error': str(e)}


# ─── WhatsApp Web automation ──────────────────────────────────────────────────

def send_whatsapp_message(phone_number: str, message: str) -> dict:
    """Send a WhatsApp message via WhatsApp Web."""
    driver = None
    steps = []
    try:
        steps.append({'label': 'Opening WhatsApp Web', 'status': 'done'})
        driver = get_driver(headless=False)

        # Format phone number
        phone = re.sub(r'[^0-9+]', '', phone_number)
        if not phone.startswith('+'):
            phone = '+91' + phone  # default India

        url = f'https://web.whatsapp.com/send?phone={phone}&text={message}'
        driver.get(url)

        steps.append({'label': 'Waiting for WhatsApp Web to load (scan QR if needed)', 'status': 'running'})
        time.sleep(15)  # Give time to scan QR code

        # Find and click send button
        try:
            send_btn = WebDriverWait(driver, 20).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, 'span[data-icon="send"]'))
            )
            send_btn.click()
            steps[-1]['status'] = 'done'
            steps.append({'label': 'Message sent!', 'status': 'done'})
            time.sleep(2)
            driver.quit()
            return {
                'success': True,
                'phone': phone,
                'message': message,
                'steps': steps,
                'summary': f"✅ **WhatsApp message sent!**\n\n**To:** {phone}\n**Message:** {message}",
            }
        except Exception as e:
            steps[-1]['status'] = 'failed'
            driver.quit()
            return {
                'success': False,
                'error': 'Could not send — make sure WhatsApp Web is logged in',
                'steps': steps,
            }

    except Exception as e:
        if driver:
            try: driver.quit()
            except: pass
        return {'success': False, 'error': str(e), 'steps': steps}


# ─── Command parser ───────────────────────────────────────────────────────────

def parse_web_command(user_message: str) -> dict:
    """Parse web automation command."""
    msg = user_message.lower()

    if any(w in msg for w in ['whatsapp', 'whats app']):
        phone_match = re.search(r'[\+]?[\d]{10,13}', user_message)
        phone = phone_match.group(0) if phone_match else ''
        msg_match = re.search(r'(?:message|msg|say|text)[:\s]+(.+?)(?:to\s+[\d+]|$)', user_message, re.IGNORECASE)
        message = msg_match.group(1).strip() if msg_match else user_message
        return {'action': 'whatsapp', 'phone': phone, 'message': message}

    if any(w in msg for w in ['download file', 'download from']):
        url_match = re.search(r'https?://[^\s]+', user_message)
        url = url_match.group(0) if url_match else ''
        return {'action': 'download', 'url': url}

    if any(w in msg for w in ['monitor', 'check website', 'watch website']):
        url_match = re.search(r'https?://[^\s]+', user_message)
        url = url_match.group(0) if url_match else ''
        return {'action': 'monitor', 'url': url}

    if any(w in msg for w in ['scrape', 'extract data', 'get data from']):
        url_match = re.search(r'https?://[^\s]+', user_message)
        url = url_match.group(0) if url_match else ''
        return {'action': 'scrape', 'url': url}

    return {'action': 'unknown'}


def execute_web_command(user_message: str) -> dict:
    """Execute web automation command."""
    command = parse_web_command(user_message)
    action = command.get('action')

    if action == 'whatsapp':
        return send_whatsapp_message(command.get('phone', ''), command.get('message', ''))
    elif action == 'download':
        return download_file_from_url(command.get('url', ''))
    elif action == 'monitor':
        return check_website_changes(command.get('url', ''))
    elif action == 'scrape':
        return scrape_website_data(command.get('url', ''))
    else:
        return {'success': False, 'error': 'Unknown web command', 'summary': ''}
