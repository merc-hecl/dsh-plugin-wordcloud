export function getCloudBands(terms) {
  const visible = terms.slice(0, 18);
  if (!visible.length) return [];

  const floor = Math.log1p(visible.at(-1).count);
  const range = Math.log1p(visible[0].count) - floor;
  const words = visible.map(({ text, count }) => {
    const weight = range ? (Math.log1p(count) - floor) / range : 0.4;
    return { text, count, fontSize: Math.round(16 + weight * 28), fontWeight: Math.round(500 + weight * 250) };
  });
  return [
    { name: "upper", words: words.slice(5, 11) },
    { name: "center", words: [3, 1, 0, 2, 4].map((index) => words[index]).filter(Boolean) },
    { name: "lower", words: words.slice(11) },
  ].filter((band) => band.words.length);
}

export async function renderCloudImage(bands) {
  const canvas = document.createElement("canvas");
  const width = 1440;
  const maxRowWidth = width - 192;
  const wordGap = 30;
  const rowGap = 18;
  canvas.width = width;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");

  // Keep the on-screen bands and wrap long words onto extra rows for export.
  const rows = [];
  for (const { name, words } of bands) {
    let row;
    for (const { text, fontSize, fontWeight } of words) {
      const font = (size) => `${fontWeight} ${size}px system-ui, sans-serif`;
      let size = 2 * Math.min(fontSize, name === "center" ? 44 : 29);
      context.font = font(size);
      let advance = context.measureText(text).width;
      if (advance > maxRowWidth) {
        size = Math.floor(size * maxRowWidth / advance);
        context.font = font(size);
        advance = context.measureText(text).width;
      }
      const wordWidth = Math.min(maxRowWidth, Math.ceil(advance));
      if (!row || row.width + wordGap + wordWidth > maxRowWidth) {
        row = { name, words: [], width: 0, height: 0 };
        rows.push(row);
      }
      const x = row.width + (row.words.length ? wordGap : 0) + wordWidth / 2;
      row.words.push({ text, font: context.font, x, width: wordWidth });
      row.width = x + wordWidth / 2;
      row.height = Math.max(row.height, Math.ceil(size * 1.4));
    }
  }

  const contentHeight = rows.reduce((sum, row) => sum + row.height, 0) + rowGap * (rows.length - 1);
  canvas.height = Math.max(440, contentHeight + 120);
  const background = context.createLinearGradient(0, 0, width, canvas.height);
  background.addColorStop(0, "#eaf2ff");
  background.addColorStop(1, "#f9fbff");
  context.fillStyle = background;
  context.fillRect(0, 0, width, canvas.height);

  const dotSpacing = 28;
  const dotRadius = 1.6;
  const dotX = (width % dotSpacing + dotSpacing) / 2;
  const dotY = (canvas.height % dotSpacing + dotSpacing) / 2;
  context.fillStyle = "rgb(23 69 143 / 12%)";
  context.beginPath();
  for (let y = dotY; y < canvas.height; y += dotSpacing) {
    for (let x = dotX; x < width; x += dotSpacing) {
      context.moveTo(x + dotRadius, y);
      context.arc(x, y, dotRadius, 0, 2 * Math.PI);
    }
  }
  context.fill();

  context.textAlign = "center";
  context.textBaseline = "middle";
  const offsets = { upper: -36, center: 0, lower: 36 };
  let y = (canvas.height - contentHeight) / 2;
  for (const row of rows) {
    context.fillStyle = row.name === "center" ? "#17458f" : "#3d5780";
    const x = (width - row.width) / 2 + offsets[row.name];
    for (const word of row.words) {
      context.font = word.font;
      context.fillText(word.text, x + word.x, y + row.height / 2, word.width);
    }
    y += row.height + rowGap;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG encoding failed")), "image/png");
  });
}
