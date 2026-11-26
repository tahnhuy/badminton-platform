/* Luật tỉ số — cùng bảng luật với backend `services/tournaments/result/score.ts`. */
window.SP_SCORE = (() => {
  const isFinished = (a, b) => {
    const w = Math.max(a, b); const l = Math.min(a, b);
    if (a === b) return false;
    return (w === 21 && l <= 19) || (w >= 22 && w <= 30 && l === w - 2) || (w === 30 && l === 29);
  };
  const isInProgress = (a, b) => {
    const w = Math.max(a, b); const l = Math.min(a, b);
    if (w > 29) return false;
    if (w < 21) return true;
    return w - l < 2 && l >= 20;
  };
  /** Trả về { winner: 1|2|null, wins:[a,b], problems: {setIndex: message} }. */
  function evaluate(sets) {
    const wins = [0, 0]; const problems = {};
    sets.forEach((s, i) => {
      if (s.a === '' || s.b === '') return;
      const a = Number(s.a); const b = Number(s.b);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) { problems[i] = 'Nhập số điểm hợp lệ'; return; }
      if (wins[0] === 2 || wins[1] === 2) { problems[i] = 'Trận đã phân thắng bại'; return; }
      if (i === 2 && !(wins[0] === 1 && wins[1] === 1)) { problems[i] = 'Set 3 chỉ khi hòa 1–1'; return; }
      if (isFinished(a, b)) wins[a > b ? 0 : 1] += 1;
      else problems[i] = isInProgress(a, b) ? 'Set chưa kết thúc (21 điểm, cách 2, tối đa 30)' : 'Tỉ số không thể xảy ra';
    });
    const winner = wins[0] === 2 ? 1 : wins[1] === 2 ? 2 : null;
    return { winner, wins, problems };
  }
  return { isFinished, isInProgress, evaluate };
})();
