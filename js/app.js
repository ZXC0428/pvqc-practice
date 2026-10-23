const vocab = window.PVQC_VOCABULARY || [];
const $ = (id) => document.getElementById(id);
const state = { questions: [], answers: [], current: 0, startedAt: 0, sectionStartedAt: 0, timer: null, selectedTests: [], testIndex: 0, bank: [], summaries: [], feedbackMode: 'practice', speechToken: 0 };
const tests = {
  test2: '測驗 2：看英文，選中文', test3: '測驗 3：聽英文發音，選中文',
  test4: '測驗 4：聽英文發音，選英文', test5: '測驗 5：看中文，聽選英文發音', test6: '測驗 6：看英文，聽選英文發音',
};
tests.test4 = '測驗 4：聽英文發音，選正確拼字';
const shuffle = (items) => [...items].sort(() => Math.random() - .5);
const esc = (value) => { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; };
const englishText = (value) => String(value).replace(/&amp;/g, '&');
const pronunciationOverrides = Object.freeze({
  'B/L': 'bill of lading',
  'G2C': 'government to citizen',
  'C2B': 'customer to business',
  'C&I': 'cost and insurance',
  'PIN': 'P I N',
  'ROE': 'R O E',
  'ATM': 'A T M',
});
function pronunciationText(text) {
  const value = String(text).replace(/&amp;/g, '&').trim();
  if (pronunciationOverrides[value]) return pronunciationOverrides[value];
  return value.replace(/([A-Z0-9]+)\/([A-Z0-9]+)/g, '$1 $2').replace(/([A-Z])&([A-Z])/g, '$1 and $2');
}
function stopSpeech() { state.speechToken += 1; window.speechSynthesis?.cancel(); }
function speak(text) { if ('speechSynthesis' in window) { stopSpeech(); const voice = new SpeechSynthesisUtterance(pronunciationText(text)); voice.lang = 'en-US'; voice.rate = 1; speechSynthesis.speak(voice); } }
function speakSequence(texts) {
  if (!('speechSynthesis' in window)) return;
  stopSpeech();
  const token = state.speechToken;
  let index = 0;
  const playNext = () => {
    if (token !== state.speechToken || index >= texts.length) return;
    const voice = new SpeechSynthesisUtterance(pronunciationText(texts[index++]));
    voice.lang = 'en-US'; voice.rate = 1;
    voice.onend = () => { if (token === state.speechToken) setTimeout(playNext, 350); };
    speechSynthesis.speak(voice);
  };
  playNext();
}
function spellingOptions(value) {
  const chars = [...String(value)];
  const letterIndexes = chars.map((char, index) => /[A-Za-z]/.test(char) ? index : -1).filter((index) => index >= 0);
  const variants = new Set();
  const add = (candidate) => { if (candidate && candidate !== value) variants.add(candidate); };
  const middle = letterIndexes[Math.floor(letterIndexes.length / 2)] ?? 0;
  const last = letterIndexes[letterIndexes.length - 1] ?? 0;

  if (letterIndexes.length > 1) add(chars.filter((_, index) => index !== middle).join(''));

  const replacement = { a: 'e', e: 'i', i: 'e', o: 'a', u: 'o', A: 'E', E: 'I', I: 'E', O: 'A', U: 'O' };
  const changed = [...chars];
  const original = changed[middle] || 'a';
  changed[middle] = replacement[original] || (original === original.toUpperCase() ? 'X' : 'x');
  add(changed.join(''));

  const pairStart = letterIndexes.find((index) => /[A-Za-z]/.test(chars[index + 1]));
  if (pairStart !== undefined) {
    const swapped = [...chars];
    [swapped[pairStart], swapped[pairStart + 1]] = [swapped[pairStart + 1], swapped[pairStart]];
    add(swapped.join(''));
  }

  const doubled = [...chars];
  doubled.splice(last, 0, chars[last] || 'x');
  add(doubled.join(''));

  while (variants.size < 3) add(value + 'x'.repeat(variants.size + 1));
  return shuffle([...variants]).slice(0, 3);
}
function buildQuestion(word, requested, bank) {
  const test = requested === 'mixed' ? shuffle(Object.keys(tests))[0] : requested;
  const audioChoices = test === 'test5' || test === 'test6';
  const englishChoices = test === 'test4' || audioChoices;
  const correct = englishChoices ? englishText(word.english) : word.chinese;
  if (test === 'test4') {
    const options = spellingOptions(correct).map((value) => ({ value, partOfSpeech: word.partOfSpeech }));
    options.push({ value: correct, partOfSpeech: word.partOfSpeech });
    return { word, test, correct, audioChoices, options: shuffle(options) };
  }
  const usedValues = new Set([correct]);
  const choices = [];
  for (const item of shuffle(bank.filter((item) => item.id !== word.id))) {
    const value = englishChoices ? englishText(item.english) : item.chinese;
    if (!value || usedValues.has(value)) continue;
    usedValues.add(value);
    choices.push({ value, partOfSpeech: item.partOfSpeech });
    if (choices.length === 3) break;
  }
  choices.push({ value: correct, partOfSpeech: word.partOfSpeech });
  return { word, test, correct, audioChoices, options: shuffle(choices) };
}
function setupRanges() {
  $('rangeStart').max = vocab.length; $('rangeEnd').max = vocab.length; $('rangeEnd').value = vocab.length;
  $('bankInfo').textContent = `題庫共 ${vocab.length.toLocaleString()} 個詞彙；請設定出題範圍與每個測驗的題數。`;
  updateQuestionCounts();
  $('rangeStart').addEventListener('input', updateQuestionCounts); $('rangeEnd').addEventListener('input', updateQuestionCounts);
}
function updateQuestionCounts() {
  const first = Number($('rangeStart').value), last = Number($('rangeEnd').value);
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last > vocab.length || first > last) return;
  const total = last - first + 1;
  $('questionCount').max = total; $('questionCount').value = total;
}
function start() {
  const first = Number($('rangeStart').value), last = Number($('rangeEnd').value);
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last > vocab.length || first > last) { alert(`請輸入有效範圍：1 到 ${vocab.length}，且起始編號不可大於結束編號。`); return; }
  const bank = vocab.filter((item) => item.id >= first && item.id <= last && item.english && item.chinese);
  if (!bank.length) { alert('指定範圍內沒有可用詞彙。'); return; }
  const selectedTests = [...document.querySelectorAll('input[name="test"]:checked')].map((input) => input.value);
  if (!selectedTests.length) { alert('請至少勾選一種測驗。'); return; }
  state.selectedTests = selectedTests; state.testIndex = 0; state.bank = bank; state.summaries = []; state.feedbackMode = $('feedbackMode').value;
  launchCurrentTest();
}
function launchCurrentTest() {
  const test = state.selectedTests[state.testIndex], questionsPerTest = Number($('questionCount').value);
  if (!Number.isInteger(questionsPerTest) || questionsPerTest < 1 || questionsPerTest > state.bank.length) { alert(`每個測驗題數請輸入 1 到 ${state.bank.length}。`); goHome(); return; }
  state.questions = shuffle(state.bank).slice(0, questionsPerTest).map((word) => buildQuestion(word, test, vocab));
  state.answers = Array(state.questions.length).fill(null); state.current = 0; state.startedAt = Date.now(); state.sectionStartedAt = Date.now();
  $('setup').classList.add('hidden'); $('result').classList.add('hidden'); $('exam').classList.remove('hidden'); clearInterval(state.timer); state.timer = setInterval(updateTimer, 1000); updateTimer(); render();
}
function updateTimer() {
  const remain = Math.max(0, 600 - Math.floor((Date.now() - state.sectionStartedAt) / 1000));
  $('timer').textContent = `${String(Math.floor(remain / 60)).padStart(2, '0')}:${String(remain % 60).padStart(2, '0')}`;
  if (remain === 0 && state.questions.length) {
    finish();
  }
}
function answer(option) { if (state.answers[state.current] !== null) return; stopSpeech(); state.answers[state.current] = option; render(); }
function render() {
  const q = state.questions[state.current], selected = state.answers[state.current], answered = selected !== null, heard = q.test === 'test3' || q.test === 'test4';
  const correctOption = 'ABCD'[q.options.findIndex((option) => option.value === q.correct)];
  const selectedOption = answered ? 'ABCD'[q.options.findIndex((option) => option.value === selected)] : '';
  $('progressText').textContent = `第 ${state.current + 1} 題／共 ${state.questions.length} 題`; $('progressBar').style.width = `${state.answers.filter((item) => item !== null).length / state.questions.length * 100}%`;
  $('modeBadge').textContent = state.feedbackMode === 'exam' ? '模擬測驗模式　｜　當題僅顯示對錯' : '練習模式　｜　當題顯示正確答案';
  $('modeBadge').className = `mode-badge ${state.feedbackMode}`;
  $('questionNo').textContent = String(state.current + 1).padStart(2, '0'); $('questionType').textContent = `${tests[q.test]}　｜　可按鍵盤 1–4 作答`;
  $('prompt').innerHTML = heard ? `<span class="audio-instruction">請播放英文題目發音後，再選擇答案</span><button class="audio-question-play" id="promptAudio">🔊 <span>播放題目發音</span><small>可重複播放</small></button>` : esc(q.test === 'test5' ? q.word.chinese : q.word.english);
  $('options').innerHTML = q.options.map((option, index) => q.audioChoices ? `<div class="audio-choice ${selected === option.value ? 'selected' : ''}"><span class="letter">${'ABCD'[index]}</span><button type="button" class="audio-play" data-listen="${esc(option.value)}" aria-label="播放選項 ${'ABCD'[index]} 的英文發音">🔊 <span>聽發音</span></button><button type="button" class="audio-answer answer-option" data-option="${esc(option.value)}" ${answered ? 'disabled' : ''}>選擇此答案</button><span class="part-of-speech">${esc(option.partOfSpeech || '')}</span></div>` : `<button class="option answer-option ${selected === option.value ? 'selected' : ''}" data-option="${esc(option.value)}" ${answered ? 'disabled' : ''}><span class="letter">${'ABCD'[index]}</span>${esc(option.value)}<span class="part-of-speech">${esc(option.partOfSpeech || '')}</span></button>`).join('');
  $('feedback').innerHTML = !answered ? '' : selected === q.correct ? `<div class="feedback correct">✓ 答對！原詞彙庫編號：${q.word.id}</div>` : state.feedbackMode === 'exam' ? `<div class="feedback wrong">✕ 答錯。原詞彙庫編號：<strong>${q.word.id}</strong></div>` : `<div class="feedback wrong">✕ 答錯。原詞彙庫編號：<strong>${q.word.id}</strong><br>正確答案：<strong>${esc(q.correct)}</strong></div>`;
  if (!heard && q.test !== 'test5') $('prompt').textContent = englishText(q.word.english);
  if (answered && state.feedbackMode === 'practice') {
    $('feedback').innerHTML = selected === q.correct
      ? '<div class="feedback correct">✓ 答對！原詞彙庫編號：' + q.word.id + '<br>正確選項：' + correctOption + '　｜　正確答案：' + esc(q.correct) + '</div>'
      : '<div class="feedback wrong">✕ 答錯！原詞彙庫編號：' + q.word.id + '<br>你的選項：' + selectedOption + '　｜　正確選項：' + correctOption + '<br>正確答案：' + esc(q.correct) + '</div>';
  }
  const correctCount = state.questions.filter((question, index) => state.answers[index] === question.correct).length;
  const answeredCount = state.answers.filter((answer) => answer !== null).length;
  $('liveStats').innerHTML = `本測驗累積：<strong class="stat-good">對：${correctCount} 題</strong><strong class="stat-bad">錯：${answeredCount - correctCount} 題</strong><span>目前第 ${state.current + 1} 題</span>`;
  const replay = $('promptAudio'); if (replay) replay.onclick = () => speak(q.word.english);
  document.querySelectorAll('#options .audio-play').forEach((button) => button.onclick = () => speak(button.dataset.listen));
  document.querySelectorAll('#options .answer-option').forEach((button) => button.onclick = () => answer(button.dataset.option));
  $('previous').disabled = true; $('previous').style.visibility = 'hidden'; $('next').disabled = !answered; $('next').textContent = state.current === state.questions.length - 1 ? '交卷並查看結果' : '下一題 ›';
  if (!answered && (q.audioChoices || heard)) {
    const questionIndex = state.current;
    const token = state.speechToken;
    setTimeout(() => {
      if (token !== state.speechToken || questionIndex !== state.current || state.answers[questionIndex] !== null) return;
      if (q.audioChoices) speakSequence(q.options.map((option) => option.value));
      else speak(q.word.english);
    }, 160);
  }
}
function next() { if (state.answers[state.current] === null) return; if (state.current === state.questions.length - 1) finish(); else { state.current += 1; render(); } }
function finish() {
  clearInterval(state.timer); stopSpeech(); const right = state.questions.filter((q, index) => state.answers[index] === q.correct).length, score = Math.round(right / state.questions.length * 100);
  const hasNextTest = state.testIndex < state.selectedTests.length - 1;
  const wrongIds = state.questions.filter((q, index) => state.answers[index] !== q.correct).map((q) => q.word.id);
  const wrongDetails = state.questions.map((q, index) => ({ questionNo: index + 1, id: q.word.id, selected: state.answers[index] || '未作答', isWrong: state.answers[index] !== q.correct })).filter((item) => item.isWrong);
  state.summaries[state.testIndex] = { test: state.questions[0].test, right, total: state.questions.length, wrongIds, wrongDetails };
  $('exam').classList.add('hidden'); $('result').classList.remove('hidden'); $('resultTitle').textContent = `${tests[state.questions[0].test]} 測驗結果`; $('score').textContent = score; $('scoreDetail').textContent = `答對 ${right}／${state.questions.length} 題　｜　剩餘時間 ${$('timer').textContent}`;
  $('nextTest').classList.toggle('hidden', !hasNextTest); if (hasNextTest) $('nextTest').textContent = '開始下一個測驗';
  $('review').innerHTML = state.feedbackMode === 'exam' ? wrongIds.length ? `<div class="review-item"><strong>本題組答錯題目</strong><br>原詞彙庫編號：${wrongIds.join('、')}</div>` : `<div class="review-item correct"><strong>本題組全部答對</strong></div>` : state.questions.map((q, index) => { const ok = state.answers[index] === q.correct; return `<div class="review-item ${ok ? 'correct' : ''}"><strong>第 ${index + 1} 題　${ok ? '✓ 正確' : '✕ 待加強'}</strong><br>原詞彙庫編號：${q.word.id}　｜　${esc(tests[q.test])}<br>單字：${esc(q.word.english)}（${esc(q.word.partOfSpeech)}）　｜　中文：${esc(q.word.chinese)}<br>正確答案：${esc(q.correct)}${ok ? '' : `<br>你的答案：${esc(state.answers[index] || '未作答')}`}</div>`; }).join('');
  if (state.feedbackMode === 'exam') {
    $('review').innerHTML = wrongDetails.length ? `<div class="review-item"><strong>本題組答錯題目</strong>${wrongDetails.map((item) => `<br>第 ${item.questionNo} 題　｜　原詞彙庫編號：${item.id}　｜　你的答案：${esc(item.selected)}`).join('')}</div>` : `<div class="review-item correct"><strong>本題組全部答對</strong></div>`;
  }
  const summary = $('overallSummary');
  if (hasNextTest) { summary.classList.add('hidden'); summary.innerHTML = ''; } else {
    const totalRight = state.summaries.reduce((sum, item) => sum + item.right, 0), totalQuestions = state.summaries.reduce((sum, item) => sum + item.total, 0);
    summary.classList.remove('hidden');
    summary.innerHTML = `<h3>全部題組總結</h3><div class="summary-grid">${state.summaries.map((item) => { const wrong = item.total - item.right, rate = Math.round(item.right / item.total * 100), wrongList = wrong ? `錯題編號：${item.wrongIds.join('、')}` : '本題組全對'; return `<div><strong>${esc(tests[item.test])}</strong><span>答對 ${item.right} 題　答錯 ${wrong} 題</span><em>正確率 ${rate}%</em><small>${wrongList}</small></div>`; }).join('')}</div><p class="summary-total">全部合計：答對 ${totalRight} 題　答錯 ${totalQuestions - totalRight} 題　｜　正確率 ${Math.round(totalRight / totalQuestions * 100)}%</p>`;
    if (state.feedbackMode === 'exam') {
      summary.innerHTML = `<h3>全部題組總結</h3><div class="summary-grid">${state.summaries.map((item) => { const wrong = item.total - item.right, rate = Math.round(item.right / item.total * 100); const wrongList = wrong ? item.wrongDetails.map((detail) => `第 ${detail.questionNo} 題（編號 ${detail.id}）：你的答案 ${esc(detail.selected)}`).join('<br>') : '本題組全對'; return `<div><strong>${esc(tests[item.test])}</strong><span>答對 ${item.right} 題　答錯 ${wrong} 題</span><em>正確率 ${rate}%</em><small>${wrongList}</small></div>`; }).join('')}</div><p class="summary-total">全部合計：答對 ${totalRight} 題　答錯 ${totalQuestions - totalRight} 題　｜　正確率 ${Math.round(totalRight / totalQuestions * 100)}%</p>`;
    }
  }
}
function goHome() { clearInterval(state.timer); stopSpeech(); $('exam').classList.add('hidden'); $('result').classList.add('hidden'); $('setup').classList.remove('hidden'); }
$('start').onclick = start; $('next').onclick = next; $('nextTest').onclick = () => { state.testIndex += 1; launchCurrentTest(); }; $('restart').onclick = () => { $('result').classList.add('hidden'); $('setup').classList.remove('hidden'); }; $('home').onclick = goHome; $('resultHome').onclick = goHome;
document.head.insertAdjacentHTML('beforeend', '<style>.listen-button{border:1px solid #8bb5d4;background:#edf7fd;color:#125e97;border-radius:4px;padding:9px 13px;font:700 15px inherit;cursor:pointer}.feedback{margin-top:18px;padding:14px 16px;border-radius:4px;font-weight:700}.feedback.correct{background:#edf9f1;color:#197143;border-left:4px solid #35a267}.feedback.wrong{background:#fff2f1;color:#aa332c;border-left:4px solid #d9574f}.option:disabled{cursor:default;opacity:.82}.speaker{font-size:20px;margin-right:9px}.audio-copy{font-weight:700;color:#3b546a}</style>');
setupRanges();
