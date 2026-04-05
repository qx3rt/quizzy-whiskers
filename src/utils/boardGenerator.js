const CLUE_VALUES = [200, 400, 600, 800, 1000];

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function buildCategoryName(index, datasetName) {
  return `${datasetName} ${index + 1}`;
}

function isClueHighQuality(clue) {
  if (!clue.clue || !clue.response) return false;
  const text = clue.clue.toLowerCase();
  if (
    text.includes('000') ||
    text.includes('authorsdouble') ||
    text.includes('dr. phil') ||
    text.includes('/0') ||
    text.includes('oubl') ||
    clue.clue.length < 10
  ) {
    return false;
  }
  return true;
}

export function generateBoardFromStudyClues(studyClues, datasetName = 'Category') {
  const highQualityClues = studyClues.filter(isClueHighQuality);
  const shuffledClues = shuffleArray(highQualityClues);
  const requiredClueCount = 6 * 5;

  if (shuffledClues.length < requiredClueCount) {
    throw new Error(
      `Not enough high-quality study clues to build a board. Need ${requiredClueCount}, got ${shuffledClues.length}.`
    );
  }

  const selectedClues = shuffledClues.slice(0, requiredClueCount);
  const board = [];

  for (let columnIndex = 0; columnIndex < 6; columnIndex++) {
    const start = columnIndex * 5;
    const columnClues = selectedClues.slice(start, start + 5);

    board.push({
      category: buildCategoryName(columnIndex, datasetName),
      clues: columnClues.map((clue, clueIndex) => ({
        id: `${datasetName}-${columnIndex + 1}-${start + clueIndex}`,
        value: CLUE_VALUES[clueIndex],
        clue: clue.clue,
        response: clue.response,
        used: false
      }))
    });
  }

  return board;
}