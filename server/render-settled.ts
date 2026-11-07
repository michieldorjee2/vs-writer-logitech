/**
 * renderToString never waits for a lazy chunk. A boundary whose content is still loading is
 * sent as its fallback, marked `<!--$!-->` ("finish this in the browser"): the browser then
 * throws React #419 and draws that part itself, and the edge cache keeps the copy.
 *
 * The www heading's stacked number (StackedTextIsland, CurvedLineIsland in src/vendor/www) is a
 * React.lazy chunk on the server too, so the FIRST render of such a heading on a freshly
 * started instance bailed out and every later one did not. Measured 7 Nov 2026: a new server's
 * first /cdw/ render had one bailout, its second and third none; on production, right after a
 * deploy, the edge served that first render of /cdw/ to everyone.
 *
 * So a render that bailed out waits for the chunks it started loading and renders again, a few
 * times at most (about 75 ms in all). A boundary that bails out for another reason, such as an
 * error thrown while rendering, is sent as before.
 */
export const BAILED_OUT = '<!--$!-->'

export async function renderSettled(render: () => string): Promise<string> {
  let html = render()
  for (let wait = 0; html.includes(BAILED_OUT) && wait <= 40; wait = wait ? wait * 2 : 5) {
    await new Promise((resolve) => setTimeout(resolve, wait))
    html = render()
  }
  return html
}
