import { nanoid } from "./nanoid";

export const hdrContentType = "Content-Type";
export const mimeApplicationJson = "application/json";

// this is how we identify this particular web session
// we send it with each api request so that the server
// can tell us from other clients connected
// that way when sending Server Side Events telling us
// about changes to the notes from other sessions,
// it can avoid telling us about changes we made
export const sessionId = nanoid(6);

/**
 * @param {string | URL | Request} url
 */
export async function elarisFetch(url, opts = {}) {
  if (!opts.headers) {
    opts.headers = {};
  }
  opts.headers["X-Elaris-Session-Id"] = sessionId;
  return await fetch(url, opts);
}
