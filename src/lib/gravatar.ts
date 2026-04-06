/**
 * Gravatar utility — generates avatar URLs from email addresses.
 * Uses ?d=404 so we can detect when no custom avatar is set.
 */

// Minimal MD5 implementation (Gravatar requires MD5 hash of email)
function md5(str: string): string {
  function safeAdd(x: number, y: number) {
    const lsw = (x & 0xffff) + (y & 0xffff);
    return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff);
  }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    return safeAdd(((safeAdd(safeAdd(a, q), safeAdd(x, t))) << s) | ((safeAdd(safeAdd(a, q), safeAdd(x, t))) >>> (32 - s)), b);
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | ~d), a, b, x, s, t); }

  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 128) bytes.push(c);
    else if (c < 2048) { bytes.push((c >> 6) | 192); bytes.push((c & 63) | 128); }
    else { bytes.push((c >> 12) | 224); bytes.push(((c >> 6) & 63) | 128); bytes.push((c & 63) | 128); }
  }

  const n = bytes.length;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bits = n * 8;
  bytes.push(bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >> 24) & 0xff, 0, 0, 0, 0);

  const m: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    m.push(bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24));
  }

  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < m.length; i += 16) {
    const aa = a, bb = b, cc = c, dd = d;
    a = ff(a, b, c, d, m[i + 0], 7, -680876936); d = ff(d, a, b, c, m[i + 1], 12, -389564586);
    c = ff(c, d, a, b, m[i + 2], 17, 606105819); b = ff(b, c, d, a, m[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, m[i + 4], 7, -176418897); d = ff(d, a, b, c, m[i + 5], 12, 1200080426);
    c = ff(c, d, a, b, m[i + 6], 17, -1473231341); b = ff(b, c, d, a, m[i + 7], 22, -45705983);
    a = ff(a, b, c, d, m[i + 8], 7, 1770035416); d = ff(d, a, b, c, m[i + 9], 12, -1958414417);
    c = ff(c, d, a, b, m[i + 10], 17, -42063); b = ff(b, c, d, a, m[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, m[i + 12], 7, 1804603682); d = ff(d, a, b, c, m[i + 13], 12, -40341101);
    c = ff(c, d, a, b, m[i + 14], 17, -1502002290); b = ff(b, c, d, a, m[i + 15], 22, 1236535329);
    a = gg(a, b, c, d, m[i + 1], 5, -165796510); d = gg(d, a, b, c, m[i + 6], 9, -1069501632);
    c = gg(c, d, a, b, m[i + 11], 14, 643717713); b = gg(b, c, d, a, m[i + 0], 20, -373897302);
    a = gg(a, b, c, d, m[i + 5], 5, -701558691); d = gg(d, a, b, c, m[i + 10], 9, 38016083);
    c = gg(c, d, a, b, m[i + 15], 14, -660478335); b = gg(b, c, d, a, m[i + 4], 20, -405537848);
    a = gg(a, b, c, d, m[i + 9], 5, 568446438); d = gg(d, a, b, c, m[i + 14], 9, -1019803690);
    c = gg(c, d, a, b, m[i + 3], 14, -187363961); b = gg(b, c, d, a, m[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, m[i + 13], 5, -1444681467); d = gg(d, a, b, c, m[i + 2], 9, -51403784);
    c = gg(c, d, a, b, m[i + 7], 14, 1735328473); b = gg(b, c, d, a, m[i + 12], 20, -1926607734);
    a = hh(a, b, c, d, m[i + 5], 4, -378558); d = hh(d, a, b, c, m[i + 8], 11, -2022574463);
    c = hh(c, d, a, b, m[i + 11], 16, 1839030562); b = hh(b, c, d, a, m[i + 14], 23, -35309556);
    a = hh(a, b, c, d, m[i + 1], 4, -1530992060); d = hh(d, a, b, c, m[i + 4], 11, 1272893353);
    c = hh(c, d, a, b, m[i + 7], 16, -155497632); b = hh(b, c, d, a, m[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, m[i + 13], 4, 681279174); d = hh(d, a, b, c, m[i + 0], 11, -358537222);
    c = hh(c, d, a, b, m[i + 3], 16, -722521979); b = hh(b, c, d, a, m[i + 6], 23, 76029189);
    a = hh(a, b, c, d, m[i + 9], 4, -640364487); d = hh(d, a, b, c, m[i + 12], 11, -421815835);
    c = hh(c, d, a, b, m[i + 15], 16, 530742520); b = hh(b, c, d, a, m[i + 2], 23, -995338651);
    a = ii(a, b, c, d, m[i + 0], 6, -198630844); d = ii(d, a, b, c, m[i + 7], 10, 1126891415);
    c = ii(c, d, a, b, m[i + 14], 15, -1416354905); b = ii(b, c, d, a, m[i + 5], 21, -57434055);
    a = ii(a, b, c, d, m[i + 12], 6, 1700485571); d = ii(d, a, b, c, m[i + 3], 10, -1894986606);
    c = ii(c, d, a, b, m[i + 10], 15, -1051523); b = ii(b, c, d, a, m[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, m[i + 8], 6, 1873313359); d = ii(d, a, b, c, m[i + 15], 10, -30611744);
    c = ii(c, d, a, b, m[i + 6], 15, -1560198380); b = ii(b, c, d, a, m[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, m[i + 4], 6, -145523070); d = ii(d, a, b, c, m[i + 11], 10, -1120210379);
    c = ii(c, d, a, b, m[i + 2], 15, 718787259); b = ii(b, c, d, a, m[i + 9], 21, -343485551);
    a = safeAdd(a, aa); b = safeAdd(b, bb); c = safeAdd(c, cc); d = safeAdd(d, dd);
  }

  const hex = '0123456789abcdef';
  let out = '';
  for (const v of [a, b, c, d]) {
    for (let j = 0; j < 4; j++) {
      out += hex[(v >> (j * 8 + 4)) & 0xf] + hex[(v >> (j * 8)) & 0xf];
    }
  }
  return out;
}

/** Build a Gravatar URL. Returns 404 if no avatar is set. */
export function gravatarUrl(email: string, size = 80): string {
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}
