/* Collection controls shared by the mistake notebook and bookmarks. */
window.create408CollectionPanel = function create408CollectionPanel(React) {
  const el = React.createElement;
  const subjectOrder = { ds: 0, co: 1, os: 2, cn: 3 };

  function chapterOrder(question) {
    return Number(String(question.chapterId || '').split('-').pop()) || 0;
  }
  function compareQuestionOrder(a, b) {
    return (subjectOrder[a.subjectId] ?? 99) - (subjectOrder[b.subjectId] ?? 99)
      || chapterOrder(a) - chapterOrder(b)
      || Number(a.number || 0) - Number(b.number || 0)
      || String(a.id).localeCompare(String(b.id));
  }
  function sortedQuestions(props, sort) {
    const timestamps = props.kind === 'bookmarks' ? props.bookmarkTimes : {};
    if (props.kind === 'mistakes') {
      for (const record of props.records) {
        for (const id of record.ids || []) {
          const question = props.questions.get(id);
          if (question && record.answers?.[id] && record.answers[id] !== question.answer) {
            const date = record.date || '';
            if (date > (timestamps[id] || '')) timestamps[id] = date;
          }
        }
      }
    }
    const order = new Map(props.ids.map((id, index) => [id, index]));
    const result = props.ids.map(id => props.questions.get(id)).filter(Boolean);
    return result.sort((a, b) => {
      if (sort === 'question') return compareQuestionOrder(a, b);
      const timeOrder = (timestamps[b.id] || '').localeCompare(timestamps[a.id] || '')
        || order.get(b.id) - order.get(a.id);
      return (sort === 'oldest' ? -timeOrder : timeOrder) || compareQuestionOrder(a, b);
    });
  }

  function CollectionPanel(props) {
    const [sort, setSort] = React.useState('recent');
    const [expanded, setExpanded] = React.useState(new Set());
    const [visibleCount, setVisibleCount] = React.useState(100);
    React.useEffect(() => setVisibleCount(100), [props.ids.join('|'), sort]);
    const questions = React.useMemo(() => sortedQuestions(props, sort),
      [props.ids, props.questions, props.bookmarkTimes, props.records, props.kind, sort]);
    const visible = questions.slice(0, visibleCount);
    const label = props.kind === 'mistakes' ? '错题' : '收藏';
    const toggle = id => setExpanded(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    const images = (items, prefix) => (items || []).map((src, index) =>
      el('button', { key: src + index, type: 'button', className: 'collection-image',
        onClick: () => props.onZoom(src), 'aria-label': `${prefix} ${index + 1}，点击放大` },
      el('img', { src, alt: `${prefix} ${index + 1}`, loading: 'lazy' })));
    return el('section', { className: 'collection-list', 'aria-label': `${label}列表` },
      el('div', { className: 'collection-toolbar' },
        el('span', { className: 'collection-count' }, `共 ${questions.length} 道 · 当前显示 ${visible.length} 道`),
        el('label', { className: 'collection-sort' }, '排序',
          el('select', { value: sort, onChange: event => setSort(event.target.value), 'aria-label': `${label}排序` },
            el('option', { value: 'recent' }, props.kind === 'mistakes' ? '最近答错优先' : '最近收藏优先'),
            el('option', { value: 'oldest' }, props.kind === 'mistakes' ? '最早答错优先' : '最早收藏优先'),
            el('option', { value: 'question' }, '科目 / 章节 / 题号'))),
        el('div', { className: 'collection-batch' },
          el('button', { type: 'button', onClick: () => setExpanded(new Set(questions.map(q => q.id))) }, '全部展开'),
          el('button', { type: 'button', onClick: () => setExpanded(new Set()) }, '全部折叠'))),
      props.kind === 'mistakes' && el('p', { className: 'collection-hint' },
        '再次答对后会自动移出错题本。旧记录缺少答错时间时，按加入顺序排列。'),
      visible.map(question => {
        const open = expanded.has(question.id);
        const previewId = `collection-${props.kind}-${question.id}`;
        const color = props.subjectColors[question.subjectId] || {};
        return el('article', { key: question.id, className: `collection-item${open ? ' expanded' : ''}` },
          el('div', { className: 'collection-item-head' },
            el('span', { className: 'mistake-subject', style: { background: color.soft, color: color.color } }, question.subject),
            el('button', { type: 'button', className: 'collection-title', onClick: () => toggle(question.id),
              'aria-expanded': open, 'aria-controls': previewId },
              el('h3', {}, question.stem || '图片题'),
              el('span', { className: 'collection-meta' }, `${question.chapter} · 原册第 ${question.number} 题`)),
            el('div', { className: 'collection-actions' },
              el('button', { type: 'button', onClick: () => toggle(question.id), 'aria-expanded': open,
                'aria-controls': previewId }, open ? '折叠预览' : '展开预览'),
              el('button', { type: 'button', onClick: () => props.onPractice(question) }, props.kind === 'mistakes' ? '重练' : '练习'),
              el('button', { type: 'button', onClick: () => props.onGroup(question.id) }, '分组'),
              props.managing && el('button', { type: 'button', className: 'delete-item',
                onClick: () => props.onRemove(question) }, '移出'))),
          props.kind === 'bookmarks' && props.bookmarkTimes[question.id] &&
            el('time', { className: 'collection-time', dateTime: props.bookmarkTimes[question.id] },
              `收藏于 ${new Date(props.bookmarkTimes[question.id]).toLocaleString('zh-CN')}`),
          open && el('div', { id: previewId, className: 'collection-preview' },
            el('p', { className: 'collection-stem' }, question.stem),
            ...images(question.questionImages, '原题图片'),
            el('ul', { className: 'collection-options' }, ...(question.options || []).map(option =>
              el('li', { key: option.key }, el('strong', {}, option.key + '. '), option.text))),
            el('details', { className: 'collection-answer' },
              el('summary', {}, '查看答案与解析'),
              el('p', { className: 'collection-correct-answer' }, `正确答案：${question.answer}`),
              el('p', {}, question.explanation || '详细解析请查看原 PDF。'),
              ...images(question.explanationImages, '解析图片')),
            el('div', { className: 'collection-pdf-links' },
              el('button', { type: 'button', onClick: () => props.onPdf({ kind: 'question', page: question.questionPdfPage }) }, '查看原题 PDF'),
              el('button', { type: 'button', onClick: () => props.onPdf({ kind: 'answer', page: question.answerPdfPage }) }, '查看解析 PDF'))));
      }),
      visible.length < questions.length && el('button', { type: 'button', className: 'collection-more',
        onClick: () => setVisibleCount(count => count + 100) }, `继续显示（剩余 ${questions.length - visible.length} 道）`));
  }
  // Exposed on the factory for lightweight checks without mounting the application.
  CollectionPanel.sortedQuestions = sortedQuestions;
  return CollectionPanel;
};
