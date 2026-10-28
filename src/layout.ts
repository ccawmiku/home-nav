// iCloud's saved homepage bundle uses SM <760, MD <1165, LG >=1165.
// Only LG renders a large app-library tile. Each grid cell is 315px + 30px gutter.
export function homepageLayout(width: number) {
  const mode = width < 760 ? 'sm' : width < 1165 ? 'md' : 'lg'
  return {
    mode,
    large: mode === 'lg',
    gridWidth: mode === 'sm' ? 345 : mode === 'md' ? 690 : 1035,
    cardWidth: mode === 'lg' ? 660 : 315,
    columns: mode === 'lg' ? 6 : 4,
    editorWidth: width >= 1690 ? 1380 : width >= 1165 ? 1035 : width >= 760 ? 690 : undefined,
  }
}

export function libraryHeight(count: number, large: boolean, editing: boolean) {
  const rows = Math.ceil(count / (large ? 6 : 4))
  // Retain the original 315px tile for the initial 12 sites. Extra rows grow
  // the tile instead of clipping user-created shortcuts.
  if (rows <= (large ? 2 : 3)) return 315
  return editing
    ? 102 + rows * (large ? 76 : 60) + (rows - 1) * (large ? 30 : 10)
    : (large ? 70 : 40) + rows * (large ? 109 : 82) + (rows - 1) * (large ? 30 : 10)
}
