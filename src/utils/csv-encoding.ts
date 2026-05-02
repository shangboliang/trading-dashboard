/**
 * 自动检测 CSV 文件编码并解码为字符串
 * 优先尝试 UTF-8（无 BOM 也尝试），检测到乱码则回退 GBK
 */
export function decodeCsv(arrayBuffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(arrayBuffer);

  // UTF-8 BOM: EF BB BF
  if (uint8.length >= 3 && uint8[0] === 0xef && uint8[1] === 0xbb && uint8[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(arrayBuffer);
  }

  // 优先尝试 UTF-8，如果解码后出现替换字符 U+FFFD 则说明不是 UTF-8
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
  if (!utf8.includes('\uFFFD')) {
    return utf8;
  }

  // 回退 GBK（Windows Excel 导出的中文 CSV）
  return new TextDecoder('gbk').decode(arrayBuffer);
}
