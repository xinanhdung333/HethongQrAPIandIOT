
# SPEC FINAL V3 - P2: RAG + REALTIME + CHATBOT - AI READY

## Mục tiêu
Service AI độc lập, gắn vào P1. Mỗi show và mỗi khách thuê có kho tài liệu riêng. Chatbot white-label trên trang /e/[slug]

## Tech Stack
Python 3.11 FastAPI Uvicorn + LangChain + Qdrant + Ollama Llama3 + nomic-embed-text + Redis cache

## Rules cho AI
Bảo mật: Check X-API-KEY, collection theo customer_id/show_id: customer_{userId} và show_{showId}, không leak chéo, file 20MB chỉ PDF, xóa PDF sau chunk
Cache: Redis embedding cache 1h, Streaming SSE
Chunking: 500 tokens overlap 50 RecursiveCharacterTextSplitter, TopK 3
Log: rag_logs table question, answer, chunks

## API
POST /rag/upload file PDF + customer_id/show_id -> chunk -> embedding -> Qdrant
POST /rag/chat streaming {customer_id/show_id, question, history} -> search top3 -> prompt -> Ollama streaming -> trả về answer + sources [{page, content}]
GET /rag/documents?customer_id=xxx
DELETE /rag/documents/:id
GET /rag/logs

## Prompt Template
System: Bạn là trợ lý của {show_name}. Chỉ trả lời từ CONTEXT. Nếu không có, nói "Thông tin này chưa có trong tài liệu show". Luôn trích nguồn.
User: CONTEXT: {context_str} HISTORY: {history_str} QUESTION: {question} ANSWER kèm nguồn:

## Realtime NestJS
Gateway Socket.io + Redis Adapter
Events: ticket:verified, show:ticket_sold, gate:status
Khi /e/:slug/buy paid -> emit show:ticket_sold room show_{showId} -> Dashboard chủ show nhảy số
Khi /api/v1/tickets/verify -> emit ticket:verified room customer_{id}

## Acceptance
1. Upload PDF Nội quy đêm nhạc -> 20 chunks
2. Khách vào /e/[slug] hỏi "Có được mang đồ ăn vào không?" -> AI trả lời đúng từ PDF + trích nguồn
3. Khi mua vé, dashboard chủ show nhảy số realtime không F5
4. Chat streaming như ChatGPT

## Prompt AI Coder
Build RAG Service FastAPI + Realtime NestJS: Qdrant collection theo customer_id/show_id, chunk 500/50 TopK3 streaming SSE Redis cache embedding, prompt trích nguồn, Socket.io emit show:ticket_sold và ticket:verified, chatbox white-label trên /e/[slug].
