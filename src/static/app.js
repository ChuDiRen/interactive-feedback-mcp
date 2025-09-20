// Copyright (c) 2025 左岚. All rights reserved.
(() => {
  const $ = (id) => document.getElementById(id);
  const injected = window.__INJECTED__ || { SESSION_ID: '', PROJECT_DIR: '', PROMPT: '' };

  function switchTab(tab) {
    for (const el of document.querySelectorAll('.tab')) {
      el.classList.toggle('active', el.dataset.tab === tab);
    }
    document.getElementById('panel-summary').classList.toggle('active', tab === 'summary');
    document.getElementById('panel-dialog').classList.toggle('active', tab === 'dialog');
  }

  function bindTabs() {
    document.querySelectorAll('.tab').forEach((el) => {
      el.addEventListener('click', () => switchTab(el.dataset.tab));
    });
  }

  async function submit() {
    const feedback = $('feedbackInput').value.trim();
    $('submitBtn').disabled = true;
    $('status').textContent = '提交中...';
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactive_feedback: feedback, command_logs: '' })
      });
      if (!res.ok) throw new Error('网络错误');
      $('status').textContent = '提交成功，即将自动关闭窗口（若由外部调用）';
    } catch (e) {
      $('status').textContent = '提交失败：' + (e?.message || e);
    } finally {
      $('submitBtn').disabled = false;
    }
  }
  async function pollHealth(){
    try{
      const res = await fetch('/health');
      if(res.ok){ const j = await res.json(); $('status').textContent = `在线 (session:${j.session})`; }
      else { $('status').textContent = '离线'; }
    }catch(e){ $('status').textContent = '离线'; }
  }


    // SSE
    try{
      const es = new EventSource('/events');
      es.addEventListener('hello', ()=>{});
      es.addEventListener('heartbeat', ()=>{});
      es.addEventListener('submitted', ()=>{ $('status').textContent = '收到提交事件'; });
    }catch(e){ /* ignore */ }

  // WebSocket
  function connectWS(){
    try{
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = ()=>{ updateConnectionStatus('WS 已连接', true); };
      ws.onclose = ()=>{ updateConnectionStatus('WS 已断开', false); setTimeout(connectWS, 3000); };
      ws.onmessage = (ev)=>{ try{ const j = JSON.parse(ev.data); if(j.type==='submitted'){ showToast('反馈已提交！', 'success'); } }catch{} };
    }catch(e){ updateConnectionStatus('WS 失败', false); }
  }

  function updateConnectionStatus(text, isConnected) {
    const status = $('status');
    status.textContent = text;
    status.style.color = isConnected ? '#4ade80' : '#f87171';
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: ${type === 'success' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(59, 130, 246, 0.9)'};
      color: white;
      border-radius: 10px;
      backdrop-filter: blur(10px);
      z-index: 1000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      animation: slideInRight 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }

  function appendChat(text, who){
    const box = $('chatLog');
    const line = document.createElement('div');
    line.style.cssText = 'margin:0.5rem 0;padding:0.75rem;border-radius:10px;' + (who==='我'?'background:rgba(102,126,234,0.2);text-align:right;':'background:rgba(255,255,255,0.1);');
    line.textContent = (who?`[${who}] `:'') + text;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  const chatHistory = [];
  async function sendChat(){
    const txt = $('chatInput').value.trim(); if(!txt) return;
    chatHistory.push({ role:'user', content:[{ type:'text', text: txt }] });
    appendChat(txt, '我'); $('chatInput').value='';
    const res = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ messages: chatHistory }) });
    if(!res.ok){ appendChat('网络错误','系统'); return; }
    const j = await res.json(); const reply = j.content||j.error||'(无响应)';
    chatHistory.push({ role:'assistant', content:[{ type:'text', text: reply }] });
    appendChat(reply, 'AI');
  }

  async function doImageOcr(){
    const f = $('imageInput').files?.[0]; if(!f) return;
    const dataUrl = await new Promise((resolve)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.readAsDataURL(f); });
    const res = await fetch('/api/image-to-text', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ dataUrl }) });
    if(!res.ok){ appendChat('图片识别失败：网络错误','系统'); return; }
    const j = await res.json(); appendChat(j.text||j.error||'(无结果)','AI');
  }

  function init() {
    $('projectDir').textContent = injected.PROJECT_DIR || '';
    $('summaryBox').textContent = injected.PROMPT || '';
    bindTabs();
    $('feedbackInput').addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'Enter') submit(); });
    $('submitBtn').addEventListener('click', submit);
    const chatInputEl = document.getElementById('chatInput'); if (chatInputEl) chatInputEl.addEventListener('keydown', (e)=>{ if(e.ctrlKey && e.key==='Enter') sendChat(); });
    const chatBtn = document.getElementById('chatSendBtn'); if (chatBtn) chatBtn.addEventListener('click', sendChat);
    const ocrBtn = document.getElementById('imageOcrBtn'); if (ocrBtn) ocrBtn.addEventListener('click', doImageOcr);
    $('feedbackInput').focus();
    pollHealth(); setInterval(pollHealth, 3000); connectWS();

    // 添加页面加载动画
    document.body.style.opacity = '0';
    setTimeout(() => {
      document.body.style.transition = 'opacity 0.5s ease';
      document.body.style.opacity = '1';
    }, 100);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

