"""
ZeroTrace RAG Engine
Retrieval Augmented Generation for chatting with your own PDF files.
100% local - uses sentence-transformers for embeddings + ChromaDB for vector store.
"""

import os
import re
import json
import hashlib
from pathlib import Path

# ChromaDB and embeddings
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer

# PDF reading
import fitz  # PyMuPDF

import requests
from django.conf import settings

OLLAMA_URL = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434')

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent
RAG_DIR = BASE_DIR / 'generated_files' / 'rag'
UPLOAD_DIR = RAG_DIR / 'uploads'
CHROMA_DIR = RAG_DIR / 'chromadb'

def ensure_dirs():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)

# ─── Initialize models (lazy loading) ────────────────────────────────────────
_embedding_model = None
_chroma_client = None
_collection = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        print("Loading embedding model (first time only)...")
        _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _embedding_model

def get_chroma_collection():
    global _chroma_client, _collection
    if _collection is None:
        ensure_dirs()
        _chroma_client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
        )
        _collection = _chroma_client.get_or_create_collection(
            name='zerotrace_docs',
            metadata={'hnsw:space': 'cosine'},
        )
    return _collection


# ─── PDF Processing ───────────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_path: str) -> list:
    """
    Extract text from PDF and split into chunks.
    Returns list of {text, page, chunk_id}
    """
    doc = fitz.open(pdf_path)
    chunks = []
    chunk_size = 500  # characters per chunk
    overlap = 50

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()

        # Clean text
        text = re.sub(r'\s+', ' ', text).strip()
        if not text:
            continue

        # Split into overlapping chunks
        start = 0
        chunk_idx = 0
        while start < len(text):
            end = start + chunk_size
            chunk_text = text[start:end]

            if len(chunk_text.strip()) > 50:  # skip tiny chunks
                chunks.append({
                    'text': chunk_text,
                    'page': page_num + 1,
                    'chunk_id': f"page{page_num+1}_chunk{chunk_idx}",
                })
                chunk_idx += 1

            start = end - overlap

    doc.close()
    return chunks


def get_pdf_hash(pdf_path: str) -> str:
    """Get MD5 hash of PDF for deduplication."""
    with open(pdf_path, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def index_pdf(pdf_path: str, filename: str) -> dict:
    """
    Index a PDF into ChromaDB.
    Returns indexing stats.
    """
    ensure_dirs()

    # Extract text chunks
    chunks = extract_text_from_pdf(pdf_path)
    if not chunks:
        return {'success': False, 'error': 'No text extracted from PDF'}

    # Get embedding model and collection
    model = get_embedding_model()
    collection = get_chroma_collection()

    pdf_hash = get_pdf_hash(pdf_path)
    doc_prefix = f"{pdf_hash[:8]}_{filename}"

    # Check if already indexed
    existing = collection.get(where={'source': filename})
    if existing['ids']:
        return {
            'success': True,
            'already_indexed': True,
            'chunks': len(existing['ids']),
            'filename': filename,
            'message': f'Already indexed ({len(existing["ids"])} chunks)',
        }

    # Create embeddings
    texts = [c['text'] for c in chunks]
    embeddings = model.encode(texts, show_progress_bar=False).tolist()

    # Store in ChromaDB
    ids = [f"{doc_prefix}_{c['chunk_id']}" for c in chunks]
    metadatas = [{'source': filename, 'page': c['page'], 'hash': pdf_hash} for c in chunks]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=texts,
        metadatas=metadatas,
    )

    return {
        'success': True,
        'already_indexed': False,
        'chunks': len(chunks),
        'filename': filename,
        'pages': max(c['page'] for c in chunks),
        'message': f'Indexed {len(chunks)} chunks from {max(c["page"] for c in chunks)} pages',
    }


def search_documents(query: str, filename: str = None, top_k: int = 5) -> list:
    """
    Search indexed documents using semantic similarity.
    Returns most relevant chunks.
    """
    model = get_embedding_model()
    collection = get_chroma_collection()

    query_embedding = model.encode([query]).tolist()

    # Filter by filename if specified
    where = {'source': filename} if filename else None

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=min(top_k, collection.count() or 1),
        where=where,
    )

    if not results['documents'] or not results['documents'][0]:
        return []

    chunks = []
    for i, doc in enumerate(results['documents'][0]):
        chunks.append({
            'text': doc,
            'source': results['metadatas'][0][i].get('source', 'unknown'),
            'page': results['metadatas'][0][i].get('page', 0),
            'distance': results['distances'][0][i] if results.get('distances') else 0,
        })

    return chunks


def answer_question(question: str, filename: str = None, model: str = None) -> dict:
    """
    RAG pipeline: search relevant chunks → build prompt → get LLM answer.
    """
    # Search for relevant content
    relevant_chunks = search_documents(question, filename=filename, top_k=5)

    if not relevant_chunks:
        return {
            'answer': "I couldn't find relevant information in the uploaded documents. Please make sure you've uploaded and indexed a PDF first.",
            'sources': [],
            'chunks_used': 0,
        }

    # Build context from chunks
    context = '\n\n'.join([
        f"[Page {c['page']} from {c['source']}]:\n{c['text']}"
        for c in relevant_chunks
    ])

    # Build RAG prompt
    prompt = f"""You are a helpful assistant answering questions based ONLY on the provided document context.

DOCUMENT CONTEXT:
{context}

QUESTION: {question}

Instructions:
- Answer based ONLY on the provided context
- If the answer is not in the context, say "This information is not found in the uploaded document"
- Cite page numbers when referencing specific information
- Be concise and accurate

ANSWER:"""

    # Get LLM response
    ollama_model = model or getattr(settings, 'OLLAMA_MODEL', 'llama3.2:latest')

    try:
        response = requests.post(
            f'{OLLAMA_URL}/api/generate',
            json={
                'model': ollama_model,
                'prompt': prompt,
                'stream': False,
                'options': {'temperature': 0.3, 'num_predict': 512},
            },
            timeout=120,
        )
        response.raise_for_status()
        answer = response.json().get('response', 'No response generated')
    except Exception as e:
        answer = f"Error generating answer: {str(e)}"

    return {
        'answer': answer,
        'sources': [{'source': c['source'], 'page': c['page']} for c in relevant_chunks],
        'chunks_used': len(relevant_chunks),
        'context_preview': context[:500] + '...' if len(context) > 500 else context,
    }


def list_indexed_documents() -> list:
    """List all indexed documents."""
    try:
        collection = get_chroma_collection()
        all_docs = collection.get()
        if not all_docs['ids']:
            return []

        # Group by source
        sources = {}
        for i, metadata in enumerate(all_docs['metadatas']):
            source = metadata.get('source', 'unknown')
            if source not in sources:
                sources[source] = {'filename': source, 'chunks': 0, 'pages': set()}
            sources[source]['chunks'] += 1
            sources[source]['pages'].add(metadata.get('page', 0))

        return [
            {
                'filename': v['filename'],
                'chunks': v['chunks'],
                'pages': len(v['pages']),
            }
            for v in sources.values()
        ]
    except Exception:
        return []


def delete_document(filename: str) -> bool:
    """Remove a document from the index."""
    try:
        collection = get_chroma_collection()
        existing = collection.get(where={'source': filename})
        if existing['ids']:
            collection.delete(ids=existing['ids'])
            return True
        return False
    except Exception:
        return False
