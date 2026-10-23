document.addEventListener('keydown', (event) => {
  const exam = document.getElementById('exam');
  if (!exam || exam.classList.contains('hidden')) return;
  if (event.key === 'Enter') {
    const next = document.getElementById('next');
    if (next && !next.disabled) { event.preventDefault(); next.click(); }
    return;
  }
  if (!['1', '2', '3', '4'].includes(event.key)) return;
  const option = document.querySelectorAll('#options .option')[Number(event.key) - 1];
  if (!option) return;
  event.preventDefault();
  option.click();
});
