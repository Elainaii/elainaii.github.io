
    const payload = window.__ZHJ_REVIEW_DATA__;
    const subjects = payload.subjects || { os: { label: '操作系统', title: '408 操作系统记忆锚点', topics: payload.topics || [], stats: payload.stats || {} } };
    const subjectOrder = ['ds', 'co', 'os', 'cn'].filter(key => subjects[key]);
    let activeSubject = subjectOrder[0] || Object.keys(subjects)[0] || 'os';
    let topics = currentSubject().topics || [];
    const expandedCards = new Set();
    let collapseObserver = null;
    let collapseRenderQueued = false;
    let autoCollapsePausedUntil = 0;
    const EDIT_STORAGE_KEY = 'tenzen-408-os-review-edits-v1';
    let userEdits = loadUserEdits();
    let activeTier = 'all';
    const tierOptions = [
      { key: 'all', label: '全部考频', tiers: null },
      { key: 'high_mid', label: '高频+中频', tiers: ['high', 'mid'] },
      { key: 'high', label: '只看高频', tiers: ['high'] },
      { key: 'exercise', label: '只看习题', type: 'exercise' }
    ];
    const tierLabel = { high: '高频', mid: '中频', low: '低频', rare: '补充' };
    const chapterList = document.getElementById('chapterList');
    const searchInput = document.getElementById('searchInput');

    function currentSubject() {
      return subjects[activeSubject] || subjects.os || Object.values(subjects)[0] || { label: '操作系统', title: '408 操作系统记忆锚点', topics: [], stats: {} };
    }

    const highlights = {
      red: ['死锁', '饥饿', '抖动', '异常', '错误', '缺点', '风险', '阻塞', '不能', '必须', '不安全状态', 'Belady 现象'],
      yellow: ['银行家算法', '页面置换算法', '系统调用过程', '安全性算法', '资源分配图', '步骤', '流程', '公式', '写回', '释放', 'FIFO', 'LRU', 'OPT', 'Clock', 'P/V', 'PV'],
      blue: ['内核态', '用户态', '系统调用', '文件描述符', '打开文件表', '引用计数', '临界区', '信号量', '管程', 'PCB', 'FCB', 'TCB', '页表', '页框', '工作集', '驻留集', 'inode', 'FAT', 'VFS', 'DMA', 'MMU', 'TLB', 'MBR', 'PBR']
    };
    const wordColor = {};
    Object.entries(highlights).forEach(([color, words]) => words.forEach(word => { wordColor[word] = color; }));
    const highlightWords = Object.keys(wordColor).sort((a, b) => b.length - a.length);
    const highlightRe = new RegExp(highlightWords.map(escapeRegExp).join('|'), 'g');

    function esc(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[char]));
    }

    function escapeRegExp(value) {
      const specials = "\\^$.*+?()[]{}|";
      return String(value).split('').map(ch => specials.includes(ch) ? '\\' + ch : ch).join('');
    }

    function highlightText(value) {
      const text = esc(value);
      if (!text) return '';
      return text.replace(highlightRe, match => `<span class="hl hl-${wordColor[match]}">${match}</span>`);
    }

    function normalizeEdits(value) {
      const safe = value && typeof value === 'object' ? value : {};
      return {
        overrides: safe.overrides && typeof safe.overrides === 'object' && !Array.isArray(safe.overrides) ? safe.overrides : {},
        addedExercises: Array.isArray(safe.addedExercises) ? safe.addedExercises : []
      };
    }

    function loadUserEdits() {
      try {
        const raw = globalThis.localStorage?.getItem(EDIT_STORAGE_KEY);
        return normalizeEdits(raw ? JSON.parse(raw) : null);
      } catch {
        return normalizeEdits(null);
      }
    }

    function saveUserEdits() {
      try {
        globalThis.localStorage?.setItem(EDIT_STORAGE_KEY, JSON.stringify(userEdits));
      } catch {
        alert('保存失败：浏览器本地存储不可用。');
      }
    }

    function renderUserText(value) {
      const text = String(value ?? '').trim();
      if (!text) return '<p></p>';
      return text.split(/\n{2,}/).map(block => `<p>${highlightText(block).replace(/\n/g, '<br>')}</p>`).join('');
    }

    function htmlToText(value) {
      return String(value ?? '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|blockquote|h3|h4|h5|h6|div)>/gi, '\n')
        .replace(/<li[^>]*>/gi, '- ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    function tierFor(topic, concept) {
      const priority = String(topic.priority || '');
      const tone = String(concept?.tone || '');
      if (concept?.cardKind === 'exercise') return topic.weight >= 4 ? 'high' : 'mid';
      if (priority.includes('高频') || topic.weight >= 4 || tone === 'red') return 'high';
      if (topic.weight >= 3 || tone === 'yellow') return 'mid';
      if (tone === 'blue') return 'low';
      return 'rare';
    }

    function cardSearchText(card, topic) {
      return [
        topic.category, topic.title, topic.priority, card.name, card.type,
        card.core, card.bodyText, card.source, ...(topic.tags || [])
      ].join('\n').toLowerCase();
    }

    function applyCardEdits(card) {
      const edit = userEdits.overrides[card.id];
      if (!edit) return card;
      const bodyText = edit.bodyText ?? card.bodyText ?? htmlToText(card.bodyHtml);
      return {
        ...card,
        name: edit.name ?? card.name,
        type: edit.type ?? card.type,
        tier: edit.tier ?? card.tier,
        core: edit.core ?? card.core,
        bodyText,
        bodyHtml: renderUserText(bodyText),
        source: edit.source ?? card.source,
        linkLabel: edit.linkLabel ?? card.linkLabel,
        edited: true
      };
    }

    function cardsForTopic(topic) {
      const conceptCards = (topic.concepts || []).map(concept => ({
        id: concept.id,
        subject: activeSubject,
        topicId: topic.id,
        cardKind: 'concept',
        name: concept.title,
        type: concept.kind || '知识点',
        tier: tierFor(topic, concept),
        core: concept.summary || concept.title,
        bodyHtml: concept.html || '',
        bodyText: concept.summary || '',
        source: `${concept.source}:${concept.line}`,
        linkLabel: `${concept.group || topic.title}`
      }));
      const exerciseCards = (topic.exercises || []).map((item, index) => {
        const source = item.source ? item.source : '自测题';
        return {
          id: `exercise-${topic.id}-${index}`,
          subject: activeSubject,
          topicId: topic.id,
          cardKind: 'exercise',
          name: item.q,
          type: '习题',
          tier: tierFor(topic, { cardKind: 'exercise' }),
          core: item.q,
          bodyHtml: `<p>${highlightText(item.a).replace(/\n/g, '<br>')}</p>`,
          bodyText: item.a,
          source,
          linkLabel: '答案'
        };
      });
      const addedCards = userEdits.addedExercises
        .filter(item => item.topicId === topic.id && (item.subject || 'os') === activeSubject)
        .map(item => {
          const bodyText = item.bodyText ?? item.answer ?? '';
          return {
            id: item.id,
            subject: activeSubject,
            topicId: topic.id,
            cardKind: 'exercise',
            added: true,
            name: item.name || item.question || '自定义习题',
            type: item.type || '习题',
            tier: item.tier || 'mid',
            core: item.core || item.name || item.question || '自定义习题',
            bodyHtml: renderUserText(bodyText),
            bodyText,
            source: item.source || '自定义',
            linkLabel: '答案'
          };
        });
      return [...conceptCards, ...exerciseCards, ...addedCards].map(applyCardEdits);
    }

    function allCards() {
      return topics.flatMap(topic => cardsForTopic(topic));
    }

    function currentTierOption() {
      return tierOptions.find(option => option.key === activeTier) || tierOptions[0];
    }

    function filteredChapters() {
      const query = searchInput.value.trim().toLowerCase();
      const option = currentTierOption();
      return topics.map(topic => {
        const cards = cardsForTopic(topic).filter(card => {
          const tierOk = option.tiers ? option.tiers.includes(card.tier) : true;
          const typeOk = option.type ? card.cardKind === option.type : true;
          const queryOk = !query || cardSearchText(card, topic).includes(query);
          return tierOk && typeOk && queryOk;
        });
        return { topic, cards };
      }).filter(chapter => chapter.cards.length > 0);
    }

    function renderSubjectTabs() {
      const tabs = document.getElementById('subjectTabs');
      tabs.innerHTML = subjectOrder.map(key => {
        const subject = subjects[key];
        const count = subject?.stats?.cardCount ?? (subject?.topics || []).reduce((sum, topic) => sum + (topic.concepts?.length || 0) + (topic.exercises?.length || 0), 0);
        return `<button class="mc-tab ${key === activeSubject ? 'active' : ''}" type="button" data-subject="${esc(key)}">${esc(subject.label)} <span>${esc(count)}</span></button>`;
      }).join('');
      tabs.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
          activeSubject = button.dataset.subject;
          topics = currentSubject().topics || [];
          expandedCards.clear();
          render();
        });
      });
    }

    function renderFilter() {
      const filter = document.getElementById('tierFilter');
      filter.innerHTML = `
        <span class="mc-filter-label">考频</span>
        ${tierOptions.map(option => `
          <button class="mc-filter-chip ${option.key === activeTier ? 'active' : ''}" type="button" data-tier="${esc(option.key)}">${esc(option.label)}</button>
        `).join('')}
      `;
      filter.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
          activeTier = button.dataset.tier;
          render();
        });
      });
    }

    function mindmapLeaves(node) {
      const children = Array.isArray(node?.children) ? node.children : [];
      if (!children.length) return 1;
      return children.reduce((sum, child) => sum + mindmapLeaves(child), 0);
    }

    function mindmapDepth(node) {
      const children = Array.isArray(node?.children) ? node.children : [];
      if (!children.length) return 0;
      return 1 + Math.max(...children.map(mindmapDepth));
    }

    function renderMindmap() {
      const map = currentSubject().mindmap;
      const canvas = document.getElementById('mindmapCanvas');
      const meta = document.getElementById('mindmapMeta');
      if (!map) {
        canvas.innerHTML = '<p class="mindmap-empty">当前科目还没有生成思维导图。</p>';
        meta.textContent = '';
        return;
      }
      const main = Array.isArray(map.children) ? map.children : [];
      const left = main.filter(node => node.side === 'left');
      const right = main.filter(node => node.side !== 'left');
      const slot = 42;
      const depth = mindmapDepth(map);
      const canvasWidth = Math.max(1160, (165 + Math.max(1, depth) * 160 + 180) * 2);
      const maxLeaves = Math.max(
        1,
        left.reduce((sum, node) => sum + mindmapLeaves(node), 0),
        right.reduce((sum, node) => sum + mindmapLeaves(node), 0)
      );
      const canvasHeight = Math.max(460, maxLeaves * slot + 110);
      const centerX = Math.round(canvasWidth / 2);
      const centerY = Math.round(canvasHeight / 2);
      const placed = [];
      const links = [];
      let uid = 0;

      const root = {
        uid: uid++,
        node: map,
        level: 0,
        side: 0,
        x: centerX,
        y: centerY
      };
      placed.push(root);

      function placeNode(node, level, side, y0, y1, parent) {
        const item = {
          uid: uid++,
          node,
          level,
          side,
          x: centerX + side * (150 + (level - 1) * 155),
          y: Math.round((y0 + y1) / 2)
        };
        placed.push(item);
        links.push([parent, item]);
        const children = Array.isArray(node.children) ? node.children : [];
        if (children.length) {
          let cursor = y0;
          children.forEach(child => {
            const span = mindmapLeaves(child) * slot;
            placeNode(child, level + 1, side, cursor, cursor + span, item);
            cursor += span;
          });
        }
      }

      function placeSide(nodes, side) {
        const total = nodes.reduce((sum, node) => sum + mindmapLeaves(node), 0);
        let cursor = Math.max(30, Math.round((canvasHeight - total * slot) / 2));
        nodes.forEach(node => {
          const span = mindmapLeaves(node) * slot;
          placeNode(node, 1, side, cursor, cursor + span, root);
          cursor += span;
        });
      }

      placeSide(left, -1);
      placeSide(right, 1);

      const pathHtml = links.map(([from, to]) => {
        const side = to.x >= from.x ? 1 : -1;
        const fromPad = from.level === 0 ? 44 : (from.level === 1 ? 54 : 44);
        const toPad = to.level === 1 ? 52 : 44;
        const fromX = from.x + side * fromPad;
        const toX = to.x - side * toPad;
        const c1 = fromX + side * 78;
        const c2 = toX - side * 78;
        const width = from.level === 0 ? 2.4 : 1.35;
        const color = from.level === 0 ? '#111827' : '#4b5563';
        return `<path d="M ${fromX} ${from.y} C ${c1} ${from.y}, ${c2} ${to.y}, ${toX} ${to.y}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
      }).join('');

      const nodeHtml = placed.map(item => {
        const node = item.node;
        const hasChildren = Array.isArray(node.children) && node.children.length > 0;
        const levelClass = item.level === 0 ? 'root' : item.level === 1 ? 'main' : hasChildren ? 'mid' : 'leaf';
        const cardId = node.cardId || '';
        const linked = cardId ? ' linked' : '';
        const disabled = cardId ? '' : ' disabled';
        const title = cardId ? '点击查看对应卡片' : '该节点未匹配到具体卡片';
        return `<button class="mm-node ${levelClass}${linked}" type="button"${disabled} data-card-id="${esc(cardId)}" style="left:${item.x}px;top:${item.y}px" title="${esc(title)}">${esc(node.label)}</button>`;
      }).join('');

      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
      canvas.innerHTML = `<svg class="mindmap-svg" viewBox="0 0 ${canvasWidth} ${canvasHeight}" aria-hidden="true">${pathHtml}</svg>${nodeHtml}`;
      const linkedCount = placed.filter(item => item.node.cardId).length;
      meta.textContent = `${esc(currentSubject().label)} · ${main.length} 个主干 · ${linkedCount} 个节点可跳转`;
      canvas.querySelectorAll('.mm-node.linked').forEach(button => {
        button.addEventListener('click', () => openMindmapCard(button.dataset.cardId));
      });
    }

    function openMindmapCard(cardId) {
      if (!cardId) return;
      autoCollapsePausedUntil = Date.now() + 2600;
      if (collapseObserver) collapseObserver.disconnect();
      searchInput.value = '';
      activeTier = 'all';
      expandedCards.add(cardId);
      renderFilter();
      renderChapters();
      bindCards();
      renderToc();
      focusCardInCenter(cardId);
    }

    function scrollCardToCenter(target, behavior = 'smooth') {
      const rect = target.getBoundingClientRect();
      const viewportHeight = globalThis.innerHeight || document.documentElement.clientHeight || 720;
      const currentY = globalThis.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const visibleCardHeight = Math.min(rect.height, viewportHeight * 0.84);
      const top = currentY + rect.top - Math.max(16, (viewportHeight - visibleCardHeight) / 2);
      try {
        globalThis.scrollTo({ top: Math.max(0, top), behavior });
      } catch {
        globalThis.scrollTo(0, Math.max(0, top));
      }
    }

    function focusCardInCenter(cardId) {
      const raf = globalThis.requestAnimationFrame || ((fn) => globalThis.setTimeout(fn, 0));
      raf(() => raf(() => {
        const target = document.getElementById(`card-${cardId}`);
        if (!target) return;
        scrollCardToCenter(target, 'smooth');
        target.classList.add('focused-card');
        globalThis.setTimeout(() => scrollCardToCenter(target, 'auto'), 720);
        globalThis.setTimeout(() => {
          target.classList.remove('focused-card');
          setupAutoCollapse();
        }, 1900);
      }));
    }

    function renderCard(card) {
      const expanded = expandedCards.has(card.id);
      return `
        <article class="mc-card" id="card-${esc(card.id)}" data-card-id="${esc(card.id)}" data-expanded="${expanded ? 'true' : 'false'}">
          <div class="mc-card-head">
            <span class="mc-name">${esc(card.name)}</span>
            <span class="mc-card-spacer"></span>
            <button class="mc-mini-btn" type="button" data-edit-card-id="${esc(card.id)}">编辑</button>
            ${card.edited ? `<button class="mc-mini-btn" type="button" data-reset-card-id="${esc(card.id)}">还原</button>` : ''}
            ${card.added ? `<button class="mc-mini-btn danger" type="button" data-delete-card-id="${esc(card.id)}">删除</button>` : ''}
          </div>
          <button class="mc-toggle" type="button" data-card-id="${esc(card.id)}">${expanded ? '收起理解' : '展开理解 ▾'}</button>
          ${expanded ? `<div class="mc-body">${card.bodyHtml}</div>` : ''}
          <div class="mc-links">
            <span class="mc-links-label">${card.cardKind === 'exercise' ? '习题' : '来源'}</span>
            <span class="mc-chip ${card.cardKind === 'exercise' ? 'mc-chip-q' : 'mc-chip-src'}">${esc(card.source)}</span>
            <span class="mc-chip">${esc(card.linkLabel)}</span>
          </div>
        </article>
      `;
    }

    function renderChapters() {
      const chapters = filteredChapters();
      const count = chapters.reduce((sum, chapter) => sum + chapter.cards.length, 0);
      const totalCards = allCards().length;
      const totalExercises = allCards().filter(card => card.cardKind === 'exercise').length;
      const editedCount = allCards().filter(card => card.edited).length;
      const addedCount = userEdits.addedExercises.filter(item => (item.subject || 'os') === activeSubject).length;
      document.getElementById('statCards').textContent = totalCards;
      document.getElementById('statConcepts').textContent = allCards().filter(card => card.cardKind === 'concept').length;
      document.getElementById('statExercises').textContent = totalExercises;
      document.getElementById('cardCount').innerHTML = `${esc(currentSubject().label)} · 共 ${count} 张 <span class="mc-count-sub">（全部 ${totalCards} 张，本地修改 ${editedCount} 项，自定义习题 ${addedCount} 题）</span>`;
      if (!chapters.length) {
        chapterList.innerHTML = '<p class="mc-state">当前筛选下没有卡片。</p>';
        return;
      }
      chapterList.innerHTML = chapters.map(chapter => `
        <section class="mc-chapter" id="chapter-${esc(chapter.topic.id)}">
          <div class="mc-chapter-head">
            <h2 class="mc-chapter-title">${esc(chapter.topic.category)} · ${esc(chapter.topic.title)}</h2>
            <button class="mc-study-btn" type="button" data-chapter-id="${esc(chapter.topic.id)}">展开本章 →</button>
          </div>
          ${chapter.cards.map(renderCard).join('')}
        </section>
      `).join('');
    }

    function bindCards() {
      chapterList.querySelectorAll('.mc-toggle').forEach(button => {
        button.addEventListener('click', () => {
          const id = button.dataset.cardId;
          const willExpand = !expandedCards.has(id);
          if (willExpand) {
            autoCollapsePausedUntil = Date.now() + 1600;
            if (collapseObserver) collapseObserver.disconnect();
            expandedCards.add(id);
          } else {
            expandedCards.delete(id);
          }
          renderChapters();
          bindCards();
          renderToc();
          if (willExpand) {
            globalThis.setTimeout(setupAutoCollapse, 1600);
          } else {
            setupAutoCollapse();
          }
        });
      });
      chapterList.querySelectorAll('.mc-study-btn').forEach(button => {
        button.addEventListener('click', () => {
          const topic = topics.find(item => item.id === button.dataset.chapterId);
          if (!topic) return;
          autoCollapsePausedUntil = Date.now() + 1800;
          if (collapseObserver) collapseObserver.disconnect();
          cardsForTopic(topic).forEach(card => expandedCards.add(card.id));
          renderChapters();
          bindCards();
          renderToc();
          globalThis.setTimeout(setupAutoCollapse, 1800);
          document.getElementById(`chapter-${topic.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      chapterList.querySelectorAll('[data-edit-card-id]').forEach(button => {
        button.addEventListener('click', () => openEditor('edit', button.dataset.editCardId));
      });
      chapterList.querySelectorAll('[data-reset-card-id]').forEach(button => {
        button.addEventListener('click', () => {
          delete userEdits.overrides[button.dataset.resetCardId];
          saveUserEdits();
          render();
        });
      });
      chapterList.querySelectorAll('[data-delete-card-id]').forEach(button => {
        button.addEventListener('click', () => {
          const id = button.dataset.deleteCardId;
          if (!confirm('删除这道自定义习题？')) return;
          userEdits.addedExercises = userEdits.addedExercises.filter(item => item.id !== id);
          delete userEdits.overrides[id];
          expandedCards.delete(id);
          saveUserEdits();
          render();
        });
      });
    }

    function queueAutoCollapseRender() {
      if (collapseRenderQueued) return;
      collapseRenderQueued = true;
      globalThis.setTimeout(() => {
        collapseRenderQueued = false;
        renderChapters();
        bindCards();
        renderToc();
        setupAutoCollapse();
      }, 120);
    }

    function setupAutoCollapse() {
      if (collapseObserver) collapseObserver.disconnect();
      const Observer = globalThis.IntersectionObserver;
      if (!Observer) return;
      collapseObserver = new Observer(entries => {
        if (Date.now() < autoCollapsePausedUntil) return;
        let changed = false;
        entries.forEach(entry => {
          const id = entry.target.dataset.cardId;
          if (id && expandedCards.has(id) && !entry.isIntersecting) {
            expandedCards.delete(id);
            changed = true;
          }
        });
        if (changed) queueAutoCollapseRender();
      }, { threshold: 0.01, rootMargin: '0px 0px -24px 0px' });
      chapterList.querySelectorAll('.mc-card[data-expanded="true"]').forEach(card => collapseObserver.observe(card));
    }

    function editorEls() {
      return {
        modal: document.getElementById('editorModal'),
        title: document.getElementById('editorTitle'),
        form: document.getElementById('editorForm'),
        mode: document.getElementById('editMode'),
        cardId: document.getElementById('editCardId'),
        topicId: document.getElementById('editTopicId'),
        name: document.getElementById('editName'),
        type: document.getElementById('editType'),
        tier: document.getElementById('editTier'),
        core: document.getElementById('editCore'),
        body: document.getElementById('editBody')
      };
    }

    function fillTopicSelect(selectedTopicId, disabled) {
      const els = editorEls();
      els.topicId.innerHTML = topics.map(topic => `
        <option value="${esc(topic.id)}">${esc(topic.category)} · ${esc(topic.title)}</option>
      `).join('');
      els.topicId.value = selectedTopicId || topics[0]?.id || '';
      els.topicId.disabled = disabled;
    }

    function findCardById(id) {
      for (const topic of topics) {
        const card = cardsForTopic(topic).find(item => item.id === id);
        if (card) return card;
      }
      return null;
    }

    function openEditor(mode, cardId = '') {
      const els = editorEls();
      els.form.reset();
      els.mode.value = mode;
      els.cardId.value = cardId;
      if (mode === 'add') {
        els.title.textContent = '新增习题';
        fillTopicSelect(topics[0]?.id, false);
        els.type.value = '习题';
        els.tier.value = 'mid';
        els.name.value = '';
        els.core.value = '';
        els.body.value = '';
      } else {
        const card = findCardById(cardId);
        if (!card) return;
        els.title.textContent = card.added ? '编辑自定义习题' : '编辑卡片';
        fillTopicSelect(card.topicId, true);
        els.type.value = card.type || '知识点';
        els.tier.value = card.tier || 'mid';
        els.name.value = card.name || '';
        els.core.value = card.core || '';
        els.body.value = card.edited || card.added ? (card.bodyText || '') : (htmlToText(card.bodyHtml) || card.bodyText || '');
      }
      els.modal.classList.remove('hidden');
      globalThis.setTimeout(() => els.name.focus(), 0);
    }

    function closeEditor() {
      editorEls().modal.classList.add('hidden');
    }

    function saveEditor(event) {
      event.preventDefault();
      const els = editorEls();
      const values = {
        topicId: els.topicId.value,
        name: els.name.value.trim(),
        type: els.type.value.trim() || '知识点',
        tier: els.tier.value || 'mid',
        core: els.core.value.trim(),
        bodyText: els.body.value.trim()
      };
      if (!values.name || !values.core) return;
      if (els.mode.value === 'add') {
        const id = `custom-exercise-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        userEdits.addedExercises.push({
          id,
          subject: activeSubject,
          topicId: values.topicId,
          name: values.name,
          type: values.type || '习题',
          tier: values.tier,
          core: values.core,
          bodyText: values.bodyText,
          source: '自定义'
        });
        expandedCards.add(id);
      } else {
        const id = els.cardId.value;
        const card = findCardById(id);
        if (!card) return;
        if (card.added) {
          const item = userEdits.addedExercises.find(entry => entry.id === id);
          if (item) {
            Object.assign(item, values, { source: item.source || '自定义' });
          }
        } else {
          userEdits.overrides[id] = {
            name: values.name,
            type: values.type,
            tier: values.tier,
            core: values.core,
            bodyText: values.bodyText,
            source: card.source,
            linkLabel: card.linkLabel
          };
        }
        expandedCards.add(id);
      }
      saveUserEdits();
      closeEditor();
      render();
    }

    function exportEdits() {
      const data = {
        version: 1,
        subject: activeSubject,
        subjects: subjectOrder,
        exportedAt: new Date().toISOString(),
        edits: userEdits
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '408-review-edits.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function importEdits(file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || '{}'));
          userEdits = normalizeEdits(parsed.edits || parsed);
          saveUserEdits();
          render();
          alert('导入完成。');
        } catch {
          alert('导入失败：JSON 格式不正确。');
        }
      };
      reader.readAsText(file, 'utf-8');
    }

    function renderSources() {
      const items = payload.sources.map(src => `<li><strong>${esc(src.label)}</strong>：${esc(src.path)}</li>`).join('');
      document.getElementById('sources').innerHTML = `
        <strong>来源文件</strong>
        <ul>${items}</ul>
        <div>生成时间：${esc(payload.generatedAt)}</div>
      `;
    }

    function renderToc() {
      const panel = document.getElementById('tocPanel');
      const chapters = filteredChapters();
      if (!chapters.length) {
        panel.innerHTML = `
          <div class="toc-title">${esc(currentSubject().label)}目录 <span>0章</span></div>
          <p class="mc-state">当前筛选下没有目录。</p>
        `;
        return;
      }
      panel.innerHTML = `
        <div class="toc-title">${esc(currentSubject().label)}目录 <span>${chapters.length}章</span></div>
        ${chapters.map(chapter => `
          <div class="toc-chapter">
            <a class="toc-chapter-link" href="#chapter-${esc(chapter.topic.id)}">${esc(chapter.topic.title)}</a>
            <div class="toc-card-list">
              ${chapter.cards.slice(0, 18).map(card => `<a class="toc-card-link" href="#card-${esc(card.id)}">${esc(card.name)}</a>`).join('')}
              ${chapter.cards.length > 18 ? `<span class="toc-card-link">还有 ${chapter.cards.length - 18} 个重点</span>` : ''}
            </div>
          </div>
        `).join('')}
      `;
    }

    function render() {
      topics = currentSubject().topics || [];
      document.getElementById('pageTitle').textContent = currentSubject().title || `408 ${currentSubject().label}记忆锚点`;
      renderSubjectTabs();
      renderMindmap();
      renderFilter();
      renderChapters();
      bindCards();
      renderToc();
      setupAutoCollapse();
      renderSources();
    }

    document.getElementById('addExerciseBtn').addEventListener('click', () => openEditor('add'));
    document.getElementById('editorForm').addEventListener('submit', saveEditor);
    document.getElementById('editorClose').addEventListener('click', closeEditor);
    document.getElementById('editorCancel').addEventListener('click', closeEditor);
    document.getElementById('editorModal').addEventListener('click', event => {
      if (event.target.id === 'editorModal') closeEditor();
    });
    searchInput.addEventListener('input', render);
    render();
  