/**
 * 自动检测 CSV 文件编码并解码为字符串
 * 支持 UTF-8 BOM 和 GBK（Windows Excel 导出的中文 CSV）
 */
export function decodeCsv(arrayBuffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(arrayBuffer);

  // UTF-8 BOM: EF BB BF
  if (uint8.length >= 3 && uint8[0] === 0xef && uint8[1] === 0xbb && uint8[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(arrayBuffer);
  }

  // 兜底 GBK（覆盖 gb2312，支持更多生僻字）
  return new TextDecoder('gbk').decode(arrayBuffer);
}
