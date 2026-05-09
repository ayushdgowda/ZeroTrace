import requests
from bs4 import BeautifulSoup
import re
import time
from urllib.parse import quote_plus


HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}


def google_search_urls(query: str, num_results: int = 6) -> list:
    """Get top URLs from Google search."""
    try:
        url = f'https://www.google.com/search?q={quote_plus(query)}&num={num_results}'
        response = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')

        urls = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            if href.startswith('/url?q='):
                actual_url = href.split('/url?q=')[1].split('&')[0]
                if actual_url.startswith('http') and 'google' not in actual_url:
                    urls.append(actual_url)

        return list(dict.fromkeys(urls))[:num_results]  # deduplicate
    except Exception as e:
        return []


def scrape_website(url: str) -> dict:
    """Scrape text content from a website."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=8)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        # Remove unwanted elements
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'ads']):
            tag.decompose()

        # Get title
        title = soup.find('title')
        title = title.text.strip() if title else url

        # Get main content
        content = ''
        for tag in ['article', 'main', 'div.content', 'div.article']:
            el = soup.find(tag)
            if el:
                content = el.get_text(separator=' ', strip=True)
                break

        if not content:
            content = soup.get_text(separator=' ', strip=True)

        # Clean content
        content = re.sub(r'\s+', ' ', content).strip()
        content = content[:3000]  # limit per site

        return {
            'url': url,
            'title': title[:100],
            'content': content,
            'success': True,
        }

    except Exception as e:
        return {
            'url': url,
            'title': url,
            'content': '',
            'success': False,
            'error': str(e),
        }


def summarize_with_ollama(topic: str, scraped_data: list) -> str:
    """Send scraped content to Ollama for summarization."""
    try:
        # Build context from scraped sites
        context = ''
        for i, site in enumerate(scraped_data):
            if site['success'] and site['content']:
                context += f"\n\n--- Source {i+1}: {site['title']} ---\n{site['content'][:1500]}"

        prompt = f"""You are a research assistant. Based on the following web sources, write a comprehensive research report about: "{topic}"

{context}

Write a well-structured report with:
1. Executive Summary
2. Key Findings (5-7 bullet points)
3. Detailed Analysis (3-4 paragraphs)
4. Top Players/Examples (numbered list)
5. Conclusion

Format it clearly with headings. Be informative and factual."""

        response = requests.post(
            'http://localhost:11434/api/generate',
            json={
                'model': 'llama3.2:latest',
                'prompt': prompt,
                'stream': False,
                'options': {'temperature': 0.4, 'num_predict': 1000}
            },
            timeout=120
        )
        response.raise_for_status()
        return response.json().get('response', 'Could not generate summary.')

    except Exception as e:
        # Fallback: create report from raw scraped data
        report = f"# Research Report: {topic}\n\n"
        report += "## Sources Found\n\n"
        for site in scraped_data:
            if site['success']:
                report += f"### {site['title']}\n"
                report += f"**URL:** {site['url']}\n\n"
                report += f"{site['content'][:500]}...\n\n"
        return report


def run_research(topic: str, to_email: str = None) -> dict:
    """
    Full research pipeline:
    1. Search Google
    2. Scrape websites
    3. Summarize with Ollama
    4. Generate PDF
    5. Email if requested
    """
    steps = []
    results = {}

    # Step 1: Search
    steps.append({'label': f'Searching Google for: {topic}', 'status': 'running'})
    urls = google_search_urls(topic, num_results=5)
    steps[-1]['status'] = 'done'
    steps[-1]['label'] = f'Found {len(urls)} sources to research'

    if not urls:
        # Fallback URLs if Google blocks
        urls = [
            f'https://en.wikipedia.org/wiki/{quote_plus(topic)}',
            f'https://www.techcrunch.com/search/{quote_plus(topic)}',
        ]

    # Step 2: Scrape
    steps.append({'label': f'Scraping {len(urls)} websites...', 'status': 'running'})
    scraped = []
    for url in urls[:5]:
        data = scrape_website(url)
        scraped.append(data)
        time.sleep(0.5)
    successful = [s for s in scraped if s['success'] and s['content']]
    steps[-1]['status'] = 'done'
    steps[-1]['label'] = f'Scraped {len(successful)} websites successfully'

    # Step 3: Summarize
    steps.append({'label': 'Summarizing with Ollama (Llama 3.2)...', 'status': 'running'})
    summary = summarize_with_ollama(topic, scraped)
    steps[-1]['status'] = 'done'
    steps[-1]['label'] = 'AI summary generated'
    results['summary'] = summary

    # Step 4: Generate PDF
    steps.append({'label': 'Generating PDF report...', 'status': 'running'})
    try:
        from .pdf_generator import generate_pdf
        pdf_title = f"Research Report: {topic}"
        sources_text = '\n\nSources:\n' + '\n'.join([f'- {s["url"]}' for s in scraped if s['success']])
        full_content = summary + sources_text
        pdf_success, pdf_path, pdf_msg = generate_pdf(pdf_title, full_content)
        steps[-1]['status'] = 'done' if pdf_success else 'failed'
        steps[-1]['label'] = f'PDF saved: {pdf_msg}'
        results['pdf_path'] = pdf_path if pdf_success else None
    except Exception as e:
        steps[-1]['status'] = 'failed'
        steps[-1]['label'] = f'PDF failed: {str(e)}'
        pdf_success = False
        results['pdf_path'] = None

    # Step 5: Email if requested
    if to_email:
        steps.append({'label': f'Sending report to {to_email}...', 'status': 'running'})
        try:
            from .email_sender import send_email
            email_body = f"""
            <html><body>
            <h2 style="color: #0ea5e9;">Research Report: {topic}</h2>
            <p>Your AI-generated research report is ready!</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">{summary[:2000]}...</pre>
            </div>
            <p style="color: #64748b; font-size: 12px;">Generated by ZeroTrace AI · 100% Local · No cloud used</p>
            </body></html>
            """
            email_success, email_msg = send_email(
                to_email=to_email,
                subject=f'Research Report: {topic}',
                body=email_body,
                attachment_path=results.get('pdf_path'),
            )
            steps[-1]['status'] = 'done' if email_success else 'failed'
            steps[-1]['label'] = f'Email {"sent to " + to_email if email_success else "failed: " + email_msg}'
            results['email_sent'] = email_success
        except Exception as e:
            steps[-1]['status'] = 'failed'
            steps[-1]['label'] = f'Email failed: {str(e)}'
            results['email_sent'] = False

    return {
        'success': True,
        'topic': topic,
        'sources_count': len(successful),
        'summary': summary,
        'pdf_path': results.get('pdf_path'),
        'email_sent': results.get('email_sent', False),
        'steps': steps,
    }


def parse_research_command(user_message: str) -> dict:
    """Extract research topic and optional email from message."""
    msg = user_message.lower()

    # Extract email
    email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', user_message)
    to_email = email_match.group(0) if email_match else None

    # Extract topic — remove command words
    topic = user_message
    remove_phrases = [
        'research', 'find information about', 'look up', 'investigate',
        'gather information on', 'write a report on', 'make a report about',
        'and send report to', 'and email to', 'send to', 'email to',
        'and send to', to_email or '',
    ]
    for phrase in remove_phrases:
        if phrase:
            topic = re.sub(re.escape(phrase), '', topic, flags=re.IGNORECASE)

    topic = topic.strip(' .,:-')
    if not topic:
        topic = user_message

    return {'topic': topic, 'to_email': to_email}
