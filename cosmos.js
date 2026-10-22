// Talks to the same public GraphQL endpoint the cosmos.so website uses.
// Cosmos has no official API, so this can break if they change it.

const ENDPOINT = "https://api.cosmos.so/graphql";
const USER_AGENT = "cosmos-mcp/1.0 (+https://www.cosmos.so)";

const SEARCH_QUERY = `
query SearchGlobalElements($searchTerm: String!, $contentType: ElementContentTypeFilter, $order: ElementOrder, $color: String, $pageCursor: String, $pageSize: Int) {
  searchElements(
    filters: { color: $color, contentType: $contentType }
    order: $order
    searchTerm: $searchTerm
    searchOrigin: SEARCH_BOX
    meta: { pageSize: $pageSize, pageCursor: $pageCursor }
  ) {
    results {
      element {
        __typename
        id
        shareUrl
        isReadyToShow
        owner { username }
        generatedCaption { text }
        source { url author { username fullName profileUrl } }
        ... on MediaElementTile { media { ...M } }
        ... on WebsiteElementTile { media { ...M } }
      }
    }
    meta { nextPageCursor count }
  }
}
fragment M on Media {
  __typename
  url
  width
  height
  notSafeForWorkStatus
  aiGenerated
  ... on AnimatedImage { video { url thumbnailUrl } }
  ... on Video { thumbnail { url } duration mux { mp4Url(quality: LOW) } }
}`;

// What the tool accepts → what Cosmos expects.
export const TYPES = { motion: "VIDEO", image: "IMAGE", all: null };
export const SORTS = { relevant: "RELEVANT", popular: "POPULAR", latest: "LATEST", oldest: "OLDEST", random: "RANDOM" };

export async function search({ query, type = "motion", sort = "relevant", color, limit = 12, cursor }) {
  const variables = {
    searchTerm: query,
    contentType: TYPES[type] ?? null,
    order: SORTS[sort] ?? null,
    color: color || null,
    pageSize: limit,
    pageCursor: cursor || null,
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT, origin: "https://www.cosmos.so" },
    body: JSON.stringify({ operationName: "SearchGlobalElements", query: SEARCH_QUERY, variables }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Cosmos returned HTTP ${res.status}`);

  const body = await res.json();
  if (body.errors?.length) throw new Error(`Cosmos error: ${body.errors.map((e) => e.message).join("; ")}`);

  const list = body.data.searchElements;
  // Same rule the Cosmos website uses: only show SAFE or UNSPECIFIED media.
  const results = list.results
    .map((r) => r.element)
    .filter((el) => el?.isReadyToShow && el.media && ["SAFE", "UNSPECIFIED"].includes(el.media.notSafeForWorkStatus))
    .map(toResult);

  return { total: list.meta.count, next_cursor: list.meta.nextPageCursor, results };
}

function toResult(el) {
  const m = el.media;
  const kind = { Video: "video", AnimatedImage: "gif", StaticImage: "image" }[m.__typename] ?? m.__typename.toLowerCase();
  const author = el.source?.author;

  let videoUrl = null;
  let previewUrl = m.url;
  if (m.__typename === "Video") {
    videoUrl = m.url || m.mux?.mp4Url;
    previewUrl = m.thumbnail?.url;
  } else if (m.__typename === "AnimatedImage") {
    videoUrl = m.video?.url;
    previewUrl = m.video?.thumbnailUrl || m.url;
  }

  return {
    id: el.id,
    kind,
    cosmos_url: el.shareUrl,
    caption: el.generatedCaption?.text?.replace(/<\/?n>/g, "") || null,
    creator: author ? author.fullName || author.username : null,
    creator_url: author?.profileUrl || null,
    source_url: el.source?.url || null,
    saved_by: el.owner?.username || null,
    video_url: videoUrl,
    preview_url: previewUrl ? `${previewUrl.replace(/\.$/, "")}?format=jpeg&w=320` : null,
    width: m.width,
    height: m.height,
    duration_s: m.duration ?? null,
    ai_generated: m.aiGenerated || false,
  };
}

// Downloads a small JPEG preview so Claude can look at the result. Returns base64 or null.
export async function fetchPreview(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer()).toString("base64");
  } catch {
    return null;
  }
}
